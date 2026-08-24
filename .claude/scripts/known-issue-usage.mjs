#!/usr/bin/env node
// known-issue-usage — docs/known-issues/ が実際に引かれた回数の計測（#1086）
//
// 使い方:
//   node .claude/scripts/known-issue-usage.mjs             # 表を出す
//   node .claude/scripts/known-issue-usage.mjs --json      # 機械可読
//   node .claude/scripts/known-issue-usage.mjs --selftest   # 純関数の自己検査（docs-lint 用）
//
// 読み取り専用: ~/.claude/ には一切書かない（createReadStream のみ・キャッシュも作らない）。
//
// ---------------------------------------------------------------------------
// 測定上の罠（これを知らずに grep すると必ず間違える）
// ---------------------------------------------------------------------------
// 1. 素の grep 集計は bulk ヒットに埋もれる。`ls .claude/docs/known-issues/` や
//    INDEX.md を 1 回読んだセッションは 30 個の slug を一度に吐くので、生の
//    ヒット数の 6 割超がその手の「一覧を見ただけ」で占められる。よって
//    1 セッションが言及した slug 数で bulk / targeted に分け、targeted だけを
//    数える（閾値の根拠は BULK_THRESHOLD のコメント）。
// 2. 自動注入は自発参照ではない。CLAUDE.md / rules/ / memory/ から ID 参照が
//    張られている slug は毎セッション視界に入るため、混ぜると首位を占めて
//    実態を隠す。別列に出して混ぜない。
// 3. 測定セッション自身が結果を汚す。このスクリプトを走らせた回のトランス
//    クリプトにも 30 個の slug が載るので、「最終参照日」を全ヒットから計算
//    すると 30 本すべてが「今日」になる。最終参照日も targeted ヒットのみから
//    計算する（bulk 規則が測定セッション自身を落とす）。
// 4. `\d{3}-<slug>.md` のような総称正規表現は日付入りファイル名と衝突する。
//    `2026-05-24-multi-chat-worktree-policy.md` から `026-05-24-…` が切り出され、
//    026 は実在の known-issue ID なので偽陽性になる。ディレクトリを readdir して
//    得た**実ファイル名だけ**を needle にする。
// 5. サブエージェントのトランスクリプトは親セッション UUID の下に入れ子で置かれ、
//    中の記録は親の sessionId を持つ。ファイル名を鍵にすると fan-out 1 回が
//    8 セッション分に化けるので、親ディレクトリへ畳む（SESSION_KEY 参照）。
//
// 出力は「slug / targeted / 注入元 / 最終参照日」の 4 列、targeted 昇順
// （＝死蔵候補が上に来る）。同数なら slug のバイト順。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const CLAUDE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // .claude/
const KNOWN_ISSUES_DIR = path.join(CLAUDE_DIR, 'docs', 'known-issues');
const TRANSCRIPT_ROOT = path.join(os.homedir(), '.claude', 'projects');

/*
 * 1 セッションがこの数以上の slug に言及したら「一覧を走査しただけ」とみなす。
 *
 * 10 は丸めた値ではなく、実測ヒストグラムの空白帯の中から取っている
 * （2026-08-19・806 transcripts）:
 *   slug数:セッション数 = 1:73 2:15 3:7 4:3 5:1 6:4 8:1 | 20:1 25:1 26:5 27:1 28:3 29:1 30:3
 * 8 と 20 の間が完全に空で、9〜20 のどこを取っても分割は同じ（bulk 15 /
 * targeted 104）。つまり「狙って引いた」と「一覧を見た」は連続体ではなく、
 * 実際に 2 つの山に分かれている。
 *
 * フラグで上書きできるようにはしない — 閾値を動かせると、結論に都合のいい
 * 数字へ後から寄せられてしまう。動かすなら上のヒストグラムを取り直して
 * この定数とコメントを一緒に書き換えること。
 */
const BULK_THRESHOLD = 10;

// --- 読み取りヘルパ ---------------------------------------------------------

function read(p) {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `.claude/docs/known-issues/` の実ファイル名（INDEX / テンプレは対象外）。 */
function loadSlugs() {
  if (!fs.existsSync(KNOWN_ISSUES_DIR)) return [];
  return fs
    .readdirSync(KNOWN_ISSUES_DIR)
    .filter((f) => /^\d{3}-.+\.md$/.test(f))
    .sort();
}

/** 3 桁 ID を取り出す（`031-mac-only-….md` → `031`）。 */
const idOf = (file) => file.slice(0, 3);

// --- 純関数（--selftest が検査するのはここ） --------------------------------

/**
 * トランスクリプト 1 ファイルのパスから「セッション鍵」を作る。
 *
 * projects/<proj>/<uuid>.jsonl                              → <proj>/<uuid>
 * projects/<proj>/<uuid>/subagents/**\/agent-*.jsonl        → <proj>/<uuid>
 *
 * サブエージェントを親へ畳むのは、fan-out した 8 体が同じ known-issue を読んだ
 * とき「8 セッションが引いた」ではなく「1 セッションが引いた」が実態だから。
 * 逆に、独立に引いた分は見えなくなる — 過大評価より過小評価に倒している。
 */
export function sessionKeyFor(relPath) {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  if (parts.length < 2) return null;
  const [project, second] = parts;
  return `${project}/${second.replace(/\.jsonl$/, '')}`;
}

/** 1 行に現れた known-issue ファイル名（重複なし）。needle は実ファイル名のみ。 */
export function slugsInLine(line, needleRe) {
  // 全ファイル名が `.md` で終わるので、含まない行は正規表現を通さない
  // （637MB / 806 ファイルを 1 行ずつ舐めるため、この足切りが効く）。
  if (!line.includes('.md')) return null;
  needleRe.lastIndex = 0;
  const hits = line.match(needleRe);
  return hits && hits.length > 0 ? hits : null;
}

/**
 * (セッション → 言及した slug 集合) を bulk / targeted に分ける。
 * targeted 側だけが「狙って引かれた」参照として数えられる。
 */
export function classifySessions(sessionSlugs, threshold = BULK_THRESHOLD) {
  const bulk = [];
  const targeted = [];
  for (const [key, slugs] of sessionSlugs) {
    (slugs.size >= threshold ? bulk : targeted).push(key);
  }
  return { bulk: bulk.sort(), targeted: targeted.sort() };
}

/**
 * 常時ロードされる場所の本文から、ID 参照が張られている known-issue を拾う。
 *
 * 完全ファイル名と「known-issue(s) NNN」の 2 形を両方見る — CLAUDE.md は
 * 完全名で書くが、rules/ と memory/ は素の番号で書いていることがあり、
 * 完全名だけだと注入元を取りこぼす。`(?<![0-9])` は罠 4（日付との衝突）を防ぐ。
 */
export function detectInjected(texts, files) {
  const injected = new Map(); // id -> [source, ...]
  for (const { source, text } of texts) {
    for (const file of files) {
      const id = idOf(file);
      const bare = new RegExp(`known-issues?[^0-9\\n]{0,4}(?<![0-9])${id}(?![0-9])`);
      if (text.includes(file) || bare.test(text)) {
        if (!injected.has(id)) injected.set(id, []);
        if (!injected.get(id).includes(source)) injected.get(id).push(source);
      }
    }
  }
  return injected;
}

/** 表の行を組む。targeted 昇順 → slug バイト順（死蔵候補が上）。 */
export function buildRows(files, targetedCounts, lastSeen, injected) {
  return files
    .map((file) => ({
      slug: file,
      targeted: targetedCounts.get(file) ?? 0,
      injectedFrom: injected.get(idOf(file)) ?? [],
      lastReferenced: lastSeen.get(file) ?? null,
    }))
    .sort((a, b) =>
      a.targeted !== b.targeted
        ? a.targeted - b.targeted
        : a.slug < b.slug
          ? -1
          : a.slug > b.slug
            ? 1
            : 0,
    );
}

// --- 走査 -------------------------------------------------------------------

function walkJsonl(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkJsonl(full, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

const DATE_RE = /"timestamp":"(\d{4}-\d{2}-\d{2})/;

async function scanTranscripts(files) {
  const needleRe = new RegExp(files.map(escapeRe).join('|'), 'g');
  const paths = walkJsonl(TRANSCRIPT_ROOT);
  const sessionSlugs = new Map(); // sessionKey -> Set<file>
  const seenDates = new Map(); // sessionKey -> Map<file, latest YYYY-MM-DD>

  for (const p of paths) {
    const key = sessionKeyFor(path.relative(TRANSCRIPT_ROOT, p));
    if (!key) continue;
    if (!sessionSlugs.has(key)) sessionSlugs.set(key, new Set());
    if (!seenDates.has(key)) seenDates.set(key, new Map());
    const slugs = sessionSlugs.get(key);
    const dates = seenDates.get(key);

    const rl = readline.createInterface({
      input: fs.createReadStream(p, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      const hits = slugsInLine(line, needleRe);
      if (!hits) continue;
      const day = DATE_RE.exec(line)?.[1] ?? null;
      for (const hit of hits) {
        slugs.add(hit);
        if (day && (!dates.has(hit) || dates.get(hit) < day)) dates.set(hit, day);
      }
    }
  }
  return { sessionSlugs, seenDates, fileCount: paths.length };
}

/** 常時ロードされる場所: CLAUDE.md / rules/ / memory/（派生 INDEX は除く）。 */
function loadAlwaysLoaded() {
  const texts = [];
  const add = (p, source) => {
    try {
      texts.push({ source, text: read(p) });
    } catch {
      /* 無ければ黙って飛ばす — worktree ごとに揃っていないことがある */
    }
  };
  add(path.join(CLAUDE_DIR, 'CLAUDE.md'), 'CLAUDE.md');
  for (const dir of ['rules', 'memory']) {
    const full = path.join(CLAUDE_DIR, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      // INDEX.md は hook が作り直す派生ビュー。正本（memory/chat-*.md）の
      // 写しなので、数えると同じ参照を二重に拾う。
      if (!f.endsWith('.md') || f === 'INDEX.md') continue;
      add(path.join(full, f), `${dir}/${f}`);
    }
  }
  return texts;
}

// --- 出力 -------------------------------------------------------------------

function renderTable(rows, meta) {
  const head = ['slug', 'targeted', 'injected from', 'last referenced'];
  const body = rows.map((r) => [
    r.slug,
    String(r.targeted),
    r.injectedFrom.length ? r.injectedFrom.join(' + ') : '—',
    r.lastReferenced ?? '—',
  ]);
  const widths = head.map((h, i) =>
    Math.max(h.length, ...body.map((b) => b[i].length)),
  );
  const line = (cells) =>
    cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  const out = [line(head), widths.map((w) => '-'.repeat(w)).join('  ')];
  for (const b of body) out.push(line(b));

  const zeros = rows.filter((r) => r.targeted === 0).map((r) => r.slug);
  out.push('');
  out.push(
    `scanned ${meta.fileCount} transcripts — ${meta.targetedCount} targeted sessions, ` +
      `${meta.bulkCount} bulk (>= ${BULK_THRESHOLD} slugs, excluded)`,
  );
  out.push('');
  out.push(`参照 0（targeted ヒットなし）= ${zeros.length} 本:`);
  for (const z of zeros) out.push(`  ${z}`);
  return out.join('\n');
}

// --- selftest ---------------------------------------------------------------

function selftest() {
  const errors = [];
  const eq = (actual, expected, msg) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) errors.push(`${msg}: expected ${e}, got ${a}`);
  };

  // セッション鍵: サブエージェントは親へ畳む
  eq(sessionKeyFor('proj/abc.jsonl'), 'proj/abc', 'session key (top level)');
  eq(
    sessionKeyFor('proj/abc/subagents/workflows/wf_1/agent-x.jsonl'),
    'proj/abc',
    'session key (subagent folds into parent)',
  );
  eq(sessionKeyFor('proj\\abc\\subagents\\agent-x.jsonl'), 'proj/abc', 'session key (windows sep)');
  eq(sessionKeyFor('stray.jsonl'), null, 'session key (no project dir)');

  // 行の照合: 実ファイル名だけ・`.md` を含まない行は素通り
  const files = ['026-supabase-cli.md', '031-mac-only-symlinked-skills-agents.md'];
  const re = new RegExp(files.map(escapeRe).join('|'), 'g');
  eq(
    slugsInLine('read docs/known-issues/031-mac-only-symlinked-skills-agents.md now', re),
    ['031-mac-only-symlinked-skills-agents.md'],
    'exact filename hit',
  );
  eq(slugsInLine('nothing to see here', re), null, 'no .md, no scan');
  // 罠 4: 日付入りファイル名から 026 を切り出さない
  eq(slugsInLine('see 2026-05-24-multi-chat-worktree-policy.md', re), null, 'date collision');
  // 同じ行に 2 回出ても、集計側は Set なので 1 回に畳まれる
  eq(
    slugsInLine('026-supabase-cli.md and 026-supabase-cli.md', re)?.length,
    2,
    'raw hits are not deduped per line (the Set upstream is)',
  );

  // bulk / targeted の分割
  const sessions = new Map([
    ['p/one', new Set(['a', 'b'])],
    ['p/two', new Set(Array.from({ length: 25 }, (_, i) => `s${i}`))],
    ['p/three', new Set(['a'])],
  ]);
  eq(classifySessions(sessions).bulk, ['p/two'], 'bulk classification');
  eq(classifySessions(sessions).targeted, ['p/one', 'p/three'], 'targeted classification');
  // 閾値ちょうどは bulk 側
  eq(
    classifySessions(new Map([['p/x', new Set(Array.from({ length: BULK_THRESHOLD }, (_, i) => i))]])).bulk.length,
    1,
    'threshold is inclusive',
  );

  // 注入元の検出: 完全名と素の番号の両方
  const injected = detectInjected(
    [
      { source: 'CLAUDE.md', text: 'see 031-mac-only-symlinked-skills-agents.md' },
      { source: 'memory/chat-x.md', text: 'known-issue 026 covers this' },
      { source: 'rules/y.md', text: 'the plan 2026-05-24-foo.md is unrelated' },
    ],
    files,
  );
  eq([...injected.keys()].sort(), ['026', '031'], 'injected ids');
  eq(injected.get('026'), ['memory/chat-x.md'], 'injected source (bare form)');
  eq(injected.get('031'), ['CLAUDE.md'], 'injected source (full filename)');
  // 罠 4 の再確認: 日付だけの行からは注入と判定しない
  eq(
    [...detectInjected([{ source: 'r', text: 'plan 2026-05-24-foo.md' }], files).keys()],
    [],
    'date is not an injection',
  );

  // 並び: targeted 昇順 → slug バイト順
  const rows = buildRows(
    ['026-supabase-cli.md', '031-mac-only-symlinked-skills-agents.md'],
    new Map([['031-mac-only-symlinked-skills-agents.md', 5]]),
    new Map([['031-mac-only-symlinked-skills-agents.md', '2026-08-18']]),
    injected,
  );
  eq(rows.map((r) => r.targeted), [0, 5], 'rows sorted by targeted ascending');
  eq(rows[0].slug, '026-supabase-cli.md', 'dead entries float to the top');
  eq(rows[0].lastReferenced, null, 'no targeted hit means no date');

  if (errors.length) {
    for (const e of errors) console.error(`known-issue-usage: ${e}`);
    process.exit(1);
  }
  console.log('known-issue-usage: OK');
}

// --- CLI --------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();

  const files = loadSlugs();
  if (files.length === 0) {
    console.error('known-issue-usage: .claude/docs/known-issues/ に対象ファイルが無い');
    process.exit(2);
  }

  const injected = detectInjected(loadAlwaysLoaded(), files);

  if (!fs.existsSync(TRANSCRIPT_ROOT)) {
    // Mac / Windows でパスが異なり、CI ランナーにはそもそも無い。
    // 測れないことは失敗ではない — 測れないと言って 0 で抜ける。
    const msg = `known-issue-usage: 測定不能 — トランスクリプトが見つからない (${TRANSCRIPT_ROOT})`;
    if (args.includes('--json')) console.log(JSON.stringify({ measurable: false, reason: msg }, null, 2));
    else console.log(msg);
    return;
  }

  const { sessionSlugs, seenDates, fileCount } = await scanTranscripts(files);
  const { bulk, targeted } = classifySessions(sessionSlugs);

  if (fileCount === 0) {
    const msg = `known-issue-usage: 測定不能 — ${TRANSCRIPT_ROOT} に *.jsonl が 1 件も無い`;
    if (args.includes('--json')) console.log(JSON.stringify({ measurable: false, reason: msg }, null, 2));
    else console.log(msg);
    return;
  }

  const targetedSet = new Set(targeted);
  const targetedCounts = new Map();
  const lastSeen = new Map();
  for (const [key, slugs] of sessionSlugs) {
    if (!targetedSet.has(key)) continue; // 罠 1 / 罠 3: bulk は数えない
    for (const slug of slugs) {
      targetedCounts.set(slug, (targetedCounts.get(slug) ?? 0) + 1);
      const day = seenDates.get(key)?.get(slug);
      if (day && (!lastSeen.has(slug) || lastSeen.get(slug) < day)) lastSeen.set(slug, day);
    }
  }

  const rows = buildRows(files, targetedCounts, lastSeen, injected);
  const meta = { fileCount, targetedCount: targeted.length, bulkCount: bulk.length };

  if (args.includes('--json')) {
    console.log(JSON.stringify({ measurable: true, threshold: BULK_THRESHOLD, ...meta, rows }, null, 2));
  } else {
    console.log(renderTable(rows, meta));
  }
}

main().catch((e) => {
  console.error(`known-issue-usage: ${e.message}`);
  process.exit(1);
});
