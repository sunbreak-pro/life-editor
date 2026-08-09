#!/usr/bin/env node
// records — 記録グラフ層の索引生成と検証（docs/vision/plans/2026-08-09-record-graph-layer.md）
//
// 使い方:
//   node .claude/scripts/records.mjs index   # .claude/INDEX.md + .claude/decisions/INDEX.md を再生成
//   node .claude/scripts/records.mjs check   # frontmatter スキーマ検証 + 索引の鮮度検証（CI / docs-lint 用）
//
// 決定論の規約: 出力にタイムスタンプ・環境依存パスを含めない / ソートは ID のバイト順
// （localeCompare 不使用）/ 改行 LF 固定 / 内容が同一なら書かない（無駄 diff ゼロ）。
// リンク実在チェックは持たない — それは scripts/docs-lint.sh (a) の担当（検査の非複製）。
//
// 索引は「plans/ か decisions/ を変えた PR と同一コミット」でのみ再生成する。
// merge で INDEX が衝突したら中身を読まずに index を再実行して上書きする（正本は D ファイル群）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLAUDE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // .claude/
const DECISIONS_DIR = path.join(CLAUDE_DIR, 'decisions');
const QUEUE_DIR = path.join(CLAUDE_DIR, 'comm', 'decisions');
const PLANS_DIR = path.join(CLAUDE_DIR, 'docs', 'vision', 'plans');

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

// --- 生成 -------------------------------------------------------------------

const sortById = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function renderDecisionsIndex(records, open) {
  const active = records.filter((r) => ['answered', 'recorded'].includes(r.fm.status) && (r.fm['superseded-by'] ?? []).length === 0).sort(sortById);
  const inactive = records.filter((r) => !active.includes(r)).sort(sortById);
  const lines = [];
  lines.push('# Decisions Index');
  lines.push('');
  lines.push('> **生成物 — 手編集禁止。** 再生成: `node .claude/scripts/records.mjs index`。正本 = 本ディレクトリの `D-*.md`（未決 = `comm/decisions/chat-*.md` キュー）。merge で衝突したら中身を読まず再生成で上書きする（→ [`README.md`](./README.md)）。');
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

function renderRootIndex(records, open, plans) {
  const active = records.filter((r) => ['answered', 'recorded'].includes(r.fm.status) && (r.fm['superseded-by'] ?? []).length === 0);
  const lines = [];
  lines.push('# .claude INDEX — 記録の入口');
  lines.push('');
  lines.push('> **生成物 — 手編集禁止。** 再生成: `node .claude/scripts/records.mjs index`（plans/ か decisions/ を変えた PR と同一コミットで再生成 — 鮮度は `records.mjs check` が CI で検証）。');
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
  lines.push('| 完了した計画 | `archive/`（2026-05-23 以前の索引 = [`archive/SUMMARY.md`](./archive/SUMMARY.md)） |');
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
  // answered ステータスの D は ANSWERS.md に行があること（監査突合）
  for (const r of records)
    if (r.fm.status === 'answered' && !answered.has(r.id))
      err(`${r.file}: status=answered だが comm/decisions/ANSWERS.md に行がない`);
  return {
    outputs: [
      { path: path.join(DECISIONS_DIR, 'INDEX.md'), content: renderDecisionsIndex(records, open) },
      { path: path.join(CLAUDE_DIR, 'INDEX.md'), content: renderRootIndex(records, open, plans) },
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
  const { outputs } = build();
  for (const o of outputs) {
    const rel = path.relative(process.cwd(), o.path);
    if (!fs.existsSync(o.path)) err(`${rel}: 索引が存在しない（node .claude/scripts/records.mjs index で生成）`);
    else if (read(o.path) !== o.content) err(`${rel}: 索引が stale（node .claude/scripts/records.mjs index で再生成して同一コミットに含める）`);
  }
  if (errors.length > 0) {
    for (const e of errors) console.error(`records: ${e}`);
    process.exit(1);
  }
  console.log('records: OK');
} else {
  console.error('usage: node .claude/scripts/records.mjs <index|check>');
  process.exit(2);
}
