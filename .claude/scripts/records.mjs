#!/usr/bin/env node
// records — 記録グラフ層の索引生成と検証（archive/2026-08-09-record-graph-layer.md）
//
// 使い方:
//   node .claude/scripts/records.mjs index   # .claude/INDEX.md + decisions/INDEX.md + archive/INDEX.md を再生成
//   node .claude/scripts/records.mjs check   # frontmatter スキーマ / supersede / ANSWERS 突合の検証（CI / docs-lint 用）
//
// 決定論の規約: 出力にタイムスタンプ・環境依存パスを含めない / ソートは ID のバイト順
// （localeCompare 不使用）/ 改行 LF 固定 / 内容が同一なら書かない（無駄 diff ゼロ）。
// リンク実在チェックは持たない — それは scripts/docs-lint.sh (a) の担当（検査の非複製）。
//
// 出力 3 本（.claude/INDEX.md / decisions/INDEX.md / archive/INDEX.md）は git 非追跡の
// 派生ビュー（2026-08-12 #735）。commit に載らないので、いつ再生成しても他レーンと
// ぶつからない。archive の索引は D-20260809-main-2 = A（2026-08-11 回答）で追加した。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLAUDE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // .claude/
const DECISIONS_DIR = path.join(CLAUDE_DIR, 'decisions');
const QUEUE_DIR = path.join(CLAUDE_DIR, 'comm', 'decisions');
const PLANS_DIR = path.join(CLAUDE_DIR, 'docs', 'vision', 'plans');
const ARCHIVE_DIR = path.join(CLAUDE_DIR, 'archive');

const STATUS_ENUM = ['answered', 'recorded', 'superseded', 'withdrawn'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const D_ID_RE = /^D-\d{8}-[a-z][a-z-]*-\d+$/;

const errors = [];
const err = (msg) => errors.push(msg);

// --- パーサ -----------------------------------------------------------------

function read(p) {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

function parseArray(raw) {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (inner === '') return [];
  if (inner.includes('"')) {
    return [...inner.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  }
  return inner.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseFrontmatter(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    err(`${file}: frontmatter（--- 区切り）がない`);
    return null;
  }
  const fm = {};
  // prettier は 80 桁を超える配列を複数行へ折り返す（`refs:\n  [\n    "a",\n  ]`）。
  // frontmatter は行単位で読むので、折り返された配列を先に 1 行へ畳んでおく。
  // これをしないと配列が文字列として読まれ「refs は配列にする」で落ちる（2026-08-09 実測）。
  const body = m[1].replace(/^([a-zA-Z-]+):[ \t]*\r?\n?[ \t]*(\[[^\]]*\])/gm, (_, key, arr) =>
    `${key}: ${arr.replace(/\s*\r?\n\s*/g, ' ')}`,
  );
  for (const line of body.split('\n')) {
    const kv = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].replace(/\s+#.*$/, '').trim(); // 行末コメントを除去
    if (value.startsWith('[')) {
      fm[kv[1]] = parseArray(value);
    } else {
      fm[kv[1]] = value === 'null' ? null : value;
    }
  }
  return fm;
}

function h1Title(text, file) {
  const m = text.match(/^# (D-[^:]+): (.+)$/m);
  if (!m) {
    err(`${file}: H1 見出し（# D-...: 問い）がない`);
    return '';
  }
  return m[2].trim();
}

// --- スキャン ---------------------------------------------------------------

function scanDecisions() {
  if (!fs.existsSync(DECISIONS_DIR)) return [];
  const files = fs.readdirSync(DECISIONS_DIR).filter((f) => /^D-.*\.md$/.test(f)).sort();
  const records = [];
  for (const f of files) {
    const rel = `decisions/${f}`;
    const text = read(path.join(DECISIONS_DIR, f));
    const fm = parseFrontmatter(text, rel);
    if (!fm) continue;
    const base = f.replace(/\.md$/, '');
    if (fm.id !== base) err(`${rel}: id (${fm.id}) がファイル名と一致しない`);
    if (!D_ID_RE.test(base)) err(`${rel}: ファイル名が D-YYYYMMDD-<chat>-<n>.md 形式でない`);
    if (fm.type !== 'decision') err(`${rel}: type は decision のみ（${fm.type}）`);
    if (!STATUS_ENUM.includes(fm.status)) err(`${rel}: status enum 外（${fm.status}）`);
    if (!DATE_RE.test(fm.asked ?? '')) err(`${rel}: asked が YYYY-MM-DD でない（${fm.asked}）`);
    if (['answered', 'recorded'].includes(fm.status)) {
      if (!DATE_RE.test(fm.answered ?? '')) err(`${rel}: status=${fm.status} には answered 日付が必須`);
      if (!fm.answer) err(`${rel}: status=${fm.status} には answer が必須`);
    }
    if (!fm.chat) err(`${rel}: chat が空`);
    if (!Array.isArray(fm.topics) || fm.topics.length === 0) err(`${rel}: topics が空`);
    for (const key of ['refs', 'supersedes', 'superseded-by', 'implemented-by']) {
      if (fm[key] !== undefined && !Array.isArray(fm[key])) err(`${rel}: ${key} は配列にする`);
    }
    records.push({ id: base, file: rel, title: h1Title(text, rel), fm });
  }
  // supersedes ⇔ superseded-by の双方向検証（D-ID 形式のエントリのみ。文書位置の文字列は対象外）
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const r of records) {
    for (const target of r.fm.supersedes ?? []) {
      if (!D_ID_RE.test(target)) continue;
      const t = byId.get(target);
      if (!t) err(`${r.file}: supersedes の ${target} が台帳に存在しない`);
      else if (!(t.fm['superseded-by'] ?? []).includes(r.id))
        err(`${t.file}: superseded-by に ${r.id} がない（${r.file} が supersedes 宣言済み — 双方向にする）`);
    }
    for (const target of r.fm['superseded-by'] ?? []) {
      if (!D_ID_RE.test(target)) continue;
      const t = byId.get(target);
      if (!t) err(`${r.file}: superseded-by の ${target} が台帳に存在しない`);
      else if (!(t.fm.supersedes ?? []).includes(r.id))
        err(`${t.file}: supersedes に ${r.id} がない（${r.file} が superseded-by 宣言済み — 双方向にする`);
    }
  }
  return records;
}

function scanAnswers() {
  const p = path.join(QUEUE_DIR, 'ANSWERS.md');
  if (!fs.existsSync(p)) return new Set();
  const ids = new Set();
  for (const m of read(p).matchAll(/^- (D-\d{8}-[a-z-]+-\d+):/gm)) ids.add(m[1]);
  return ids;
}

function scanQueues(answeredIds) {
  if (!fs.existsSync(QUEUE_DIR)) return [];
  const open = [];
  for (const f of fs.readdirSync(QUEUE_DIR).filter((n) => /^chat-.*\.md$/.test(n)).sort()) {
    const text = read(path.join(QUEUE_DIR, f));
    for (const m of text.matchAll(/^##+ (D-\d{8}-[a-z-]+-\d+): (.+)$/gm)) {
      if (answeredIds.has(m[1])) continue; // 回答済み（昇格待ち）は open に出さない
      if (/（取り下げ）\s*$/.test(m[2])) continue;
      open.push({ id: m[1], title: m[2].trim(), chat: f.replace(/^chat-|\.md$/g, '') });
    }
  }
  open.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return open;
}

function scanPlans() {
  if (!fs.existsSync(PLANS_DIR)) return [];
  const plans = [];
  for (const f of fs.readdirSync(PLANS_DIR).filter((n) => n.endsWith('.md') && n !== '_TEMPLATE.md').sort()) {
    const text = read(path.join(PLANS_DIR, f));
    const m = text.match(/^Status:\s*([^#\n]+?)\s*(?:#.*)?$/m);
    plans.push({ file: f, status: m ? m[1].trim() : '(Status 行なし)' });
  }
  return plans;
}

/*
 * archive/ の Status 行は plans/ より書式が広い。archive には計画書だけでなく要件定義書や
 * 棚卸しメモも同居しており（D-20260801-main-2 で enum の適用外と確定）、`Status:` /
 * `**Status**:` / 先頭の `-` や `>` 付き、の 4 通りが実在する。docs-consistency.md §3 が
 * 「先頭 14 行に 2 種類の正規表現を当てる」と書いているのと同じ範囲を 1 本で拾う。
 * 実測（2026-08-31・直下 99 本）では Status 行はすべて 5 行目までにあり、持たないのは 4 本。
 */
const ARCHIVE_STATUS_RE = /^>?\s*-?\s*(?:\*\*Status[^*]*\*\*|Status)\s*:\s*(.+?)\s*$/;
const ARCHIVE_HEAD_LINES = 14;
const NO_STATUS = '(Status 行なし)';

/** Markdown の表セルに入れる前に、区切りと衝突する `|` だけ潰す。 */
const cell = (text) => text.replace(/\|/g, '\\|');

/**
 * 見出しに使う短い Status。長い注記（`COMPLETED — 〜で全 81 ステップ達成`）は正本側に
 * 置いたままにし、索引は語だけを出す。`SPECIFICATION（凍結）` のように語の一部が括弧に
 * 入る形もあるので、切るのは em ダッシュ以降だけにする。
 *
 * `#` の扱いが plans と違う点に注意: frontmatter の `Status: COMPLETED # 注記` では
 * コメント開始だが、本文の `Status: COMPLETED (2026-06-11, PR #34 merged)` では ただの
 * Issue 番号で、切ると括弧が閉じない見出しになる（実測）。数字が続かない `#` だけを
 * コメントとみなす。
 */
function shortStatus(raw) {
  const head = raw
    .split(/\s+[—–]\s+|\s+--\s+/)[0]
    .split(/\s+#(?!\d)/)[0]
    .replace(/[。\s]+$/, '')
    .trim();
  return head.length > 60 ? `${head.slice(0, 59)}…` : head || NO_STATUS;
}

/** Status 逆引きの見出し語。注記や日付を落として enum 相当の 1 語に寄せる。 */
const statusBucket = (short) =>
  short.split(/\s+/)[0].replace(/[（(].*$/, '').replace(/[.,:;。]$/, '') || NO_STATUS;

function scanArchive() {
  if (!fs.existsSync(ARCHIVE_DIR)) return [];
  const skip = new Set(['SUMMARY.md', 'INDEX.md']);
  const entries = [];
  for (const f of fs.readdirSync(ARCHIVE_DIR).filter((n) => n.endsWith('.md') && !skip.has(n)).sort()) {
    const text = read(path.join(ARCHIVE_DIR, f));
    const lines = text.split('\n');
    let status = NO_STATUS;
    for (const line of lines.slice(0, ARCHIVE_HEAD_LINES)) {
      const m = line.match(ARCHIVE_STATUS_RE);
      if (m) {
        status = shortStatus(m[1]);
        break;
      }
    }
    const h1 = text.match(/^# (.+)$/m);
    entries.push({ file: f, status, title: h1 ? h1[1].trim() : '—' });
  }
  return entries;
}

// --- 生成 -------------------------------------------------------------------

const sortById = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function renderDecisionsIndex(records, open) {
  const active = records.filter((r) => ['answered', 'recorded'].includes(r.fm.status) && (r.fm['superseded-by'] ?? []).length === 0).sort(sortById);
  const inactive = records.filter((r) => !active.includes(r)).sort(sortById);
  const lines = [];
  lines.push('# Decisions Index');
  lines.push('');
  lines.push('> **生成物 — 手編集禁止・git 非追跡の派生ビュー。** 再生成: `node .claude/scripts/records.mjs index`。正本 = 本ディレクトリの `D-*.md`（未決 = `comm/decisions/chat-*.md` キュー）。古ければ再生成する（→ [`README.md`](./README.md)）。');
  lines.push('');
  lines.push('## Open（キュー — 回答待ち）');
  lines.push('');
  if (open.length === 0) {
    lines.push('（なし）');
  } else {
    lines.push('| ID | 問い | chat |');
    lines.push('| --- | --- | --- |');
    for (const o of open) lines.push(`| ${o.id} | ${o.title} | ${o.chat} |`);
  }
  lines.push('');
  lines.push('## Active（現在有効な裁定 — superseded-by なし）');
  lines.push('');
  lines.push('| ID | 問い | 回答 | 日付 | topics |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of active)
    lines.push(`| [${r.id}](./${r.id}.md) | ${r.title} | ${r.fm.answer} | ${r.fm.answered} | ${(r.fm.topics ?? []).join(', ')} |`);
  lines.push('');
  lines.push('## Superseded / Withdrawn');
  lines.push('');
  if (inactive.length === 0) {
    lines.push('（なし）');
  } else {
    lines.push('| ID | status | 後継 |');
    lines.push('| --- | --- | --- |');
    for (const r of inactive)
      lines.push(`| [${r.id}](./${r.id}.md) | ${r.fm.status} | ${(r.fm['superseded-by'] ?? []).join(', ') || '—'} |`);
  }
  lines.push('');
  lines.push('## Topic 逆引き');
  lines.push('');
  const byTopic = new Map();
  for (const r of records.sort(sortById))
    for (const t of r.fm.topics ?? []) {
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push(r.id);
    }
  for (const t of [...byTopic.keys()].sort()) lines.push(`- ${t}: ${byTopic.get(t).join(' / ')}`);
  const chains = records.filter((r) => (r.fm.supersedes ?? []).length > 0).sort(sortById);
  if (chains.length > 0) {
    lines.push('');
    lines.push('## Supersede 連鎖');
    lines.push('');
    for (const r of chains) for (const s of r.fm.supersedes) lines.push(`- ${s} → ${r.id}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderArchiveIndex(entries) {
  const lines = [];
  lines.push('# Archive Index — 完了・凍結した文書の所在表');
  lines.push('');
  lines.push('> **生成物 — 手編集禁止・git 非追跡の派生ビュー。** 再生成: `node .claude/scripts/records.mjs index`（SessionStart hook でも自動実行）。正本 = 各ファイル冒頭の Status 行と git 履歴。');
  lines.push('> 本索引は所在表で、要約は持たない（[`D-20260809-main-2`](../decisions/D-20260809-main-2.md) = A）。**2026-05-23 以前**に archive 入りした分の圧縮要約（なぜやったか・どうなったか・恒久知見）は [`SUMMARY.md`](./SUMMARY.md) が持つ — 役割が違うので両方を残している。');
  lines.push('> `archive/` には計画書のほかに要件定義書・棚卸しメモも同居するため、Status は plans の enum に揃わない（[`D-20260801-main-2`](../decisions/D-20260801-main-2.md)）。ここでは各ファイルが名乗る語をそのまま出す。');
  lines.push('');
  lines.push(`## 一覧（${entries.length} 本・ファイル名昇順）`);
  lines.push('');
  lines.push('| ファイル | Status | 見出し |');
  lines.push('| --- | --- | --- |');
  for (const e of entries)
    lines.push(`| [${cell(e.file)}](./${e.file}) | ${cell(e.status)} | ${cell(e.title)} |`);
  lines.push('');
  // 内訳は件数だけ。ファイル名を並べる逆引きも書けるが、COMPLETED だけで 68 本になり
  // 1 行が画面を埋める（実測）。どのファイルがどの Status かは上の表が 1 行ずつ持っている。
  lines.push('## Status 別の内訳');
  lines.push('');
  const byStatus = new Map();
  for (const e of entries) {
    const key = statusBucket(e.status);
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  for (const key of [...byStatus.keys()].sort()) lines.push(`- ${key}: ${byStatus.get(key)} 本`);
  lines.push('');
  return lines.join('\n');
}

function renderRootIndex(records, open, plans) {
  const active = records.filter((r) => ['answered', 'recorded'].includes(r.fm.status) && (r.fm['superseded-by'] ?? []).length === 0);
  const lines = [];
  lines.push('# .claude INDEX — 記録の入口');
  lines.push('');
  lines.push('> **生成物 — 手編集禁止・git 非追跡の派生ビュー。** 再生成: `node .claude/scripts/records.mjs index`（SessionStart hook でも自動実行。正本 = `decisions/D-*.md` + `docs/vision/plans/*.md`）。');
  lines.push('> 無人セッションの読む順: CLAUDE.md（自動ロード）→ 本ファイル → [`decisions/INDEX.md`](./decisions/INDEX.md) §Open + [`comm/decisions/ANSWERS.md`](./comm/decisions/ANSWERS.md) → `memory/chat-<self>.md` → 自分宛 open Issue。ここまで grep なしで届く。');
  lines.push('');
  lines.push('## 進行中の計画（`docs/vision/plans/` の Status 行より）');
  lines.push('');
  lines.push('| 計画 | Status |');
  lines.push('| --- | --- |');
  for (const p of plans) lines.push(`| [${p.file}](./docs/vision/plans/${p.file}) | ${p.status} |`);
  lines.push('');
  lines.push('## 判断の現在地');
  lines.push('');
  lines.push(`- 未回答（キュー）: ${open.length} 件 → [\`decisions/INDEX.md\`](./decisions/INDEX.md) §Open`);
  lines.push(`- 確定台帳: ${records.length} 件（うち Active ${active.length}）→ [\`decisions/INDEX.md\`](./decisions/INDEX.md)`);
  lines.push('');
  lines.push('## 型別の正本（この情報はどこにあるか）');
  lines.push('');
  lines.push('| 探しもの | 正本 |');
  lines.push('| --- | --- |');
  lines.push('| 決定の Why・却下案 | [`decisions/`](./decisions/README.md)（索引 = INDEX.md） |');
  lines.push('| 「聞かなくていい」恒久裁定 | [`comm/decisions/POLICY.md`](./comm/decisions/POLICY.md) |');
  lines.push('| レーンの進行中 / 履歴 | `memory/chat-*.md` / `history/chat-*.md`（per-chat SSOT。集約は SessionStart hook 生成の派生 INDEX） |');
  lines.push('| 課題の追跡 | GitHub Issues（`gh issue list -R sunbreak-pro/life-editor`） |');
  lines.push('| 障害知見（環境系含む） | [`docs/known-issues/INDEX.md`](./docs/known-issues/INDEX.md) |');
  lines.push('| 完了した計画 | [`archive/INDEX.md`](./archive/INDEX.md)（2026-05-23 以前の圧縮要約 = [`archive/SUMMARY.md`](./archive/SUMMARY.md)） |');
  lines.push('| チャット間の連絡 | `comm/outbox/chat-*.md`（プロトコル = [`comm/README.md`](./comm/README.md)） |');
  lines.push('| どこに書くかの判定 | [`rules/records.md`](./rules/records.md) |');
  lines.push('');
  return lines.join('\n');
}

// --- コマンド ---------------------------------------------------------------

function build() {
  const records = scanDecisions();
  const answered = scanAnswers();
  const open = scanQueues(answered);
  const plans = scanPlans();
  const archived = scanArchive();
  // answered ステータスの D は ANSWERS.md に行があること（監査突合）
  for (const r of records)
    if (r.fm.status === 'answered' && !answered.has(r.id))
      err(`${r.file}: status=answered だが comm/decisions/ANSWERS.md に行がない`);
  return {
    outputs: [
      { path: path.join(DECISIONS_DIR, 'INDEX.md'), content: renderDecisionsIndex(records, open) },
      { path: path.join(CLAUDE_DIR, 'INDEX.md'), content: renderRootIndex(records, open, plans) },
      { path: path.join(ARCHIVE_DIR, 'INDEX.md'), content: renderArchiveIndex(archived) },
    ],
  };
}

const cmd = process.argv[2];
if (cmd === 'index') {
  const { outputs } = build();
  if (errors.length > 0) {
    for (const e of errors) console.error(`records: ${e}`);
    process.exit(1);
  }
  for (const o of outputs) {
    const current = fs.existsSync(o.path) ? read(o.path) : null;
    if (current !== o.content) {
      fs.writeFileSync(o.path, o.content);
      console.log(`records: wrote ${path.relative(process.cwd(), o.path)}`);
    }
  }
} else if (cmd === 'check') {
  // 索引の鮮度（存在しない / stale）は検査しない（2026-08-12 #735）。出力 2 本を git 非追跡に
  // したため、CI の checkout には存在しないのが正常であり、鮮度を強制すると「plans か
  // decisions を触った PR に索引の全文再生成を同梱せよ」という規約に戻る — それが並行
  // レーンの衝突の製造元だった（同日の #719 / #720 / #733 の衝突箇所はこの 2 本だけ）。
  // 検証の価値は正本側（frontmatter スキーマ・supersede 双方向・ANSWERS 突合 = build()
  // 内の err()）にあるので、そちらは CI ゲートとして残す。
  build();
  if (errors.length > 0) {
    for (const e of errors) console.error(`records: ${e}`);
    process.exit(1);
  }
  console.log('records: OK');
} else {
  console.error('usage: node .claude/scripts/records.mjs <index|check>');
  process.exit(2);
}
