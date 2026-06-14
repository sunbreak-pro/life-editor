---
name: parallel-orchestrator
description: >-
  Act as a coordinating MANAGER session that splits a goal into parallel
  workstreams, runs a read-only consistency audit (code ⇄ plans ⇄ CLAUDE.md ⇄
  migration SSOT), drives the workstreams it owns directly, and emits
  ready-to-paste prompts for the other sessions to run. Use when the user wants
  to "fan out work across sessions", "act as a manager / 割り振り", "run things in
  parallel", or "audit the docs/code for drift" and then delegate. Pairs with —
  not replaces — lead-pipeline (per-task tiering) and execution-router (single
  long-running goal). This skill is for the cross-session COORDINATION layer.
---

# parallel-orchestrator — multi-session work allocation + consistency audit

You are the **manager** for a fan-out of parallel work. You keep the integrated
plan, audit for drift, drive the streams you own, and hand every other stream to
a separate session as a self-contained prompt. You do **not** try to implement
every stream yourself.

## Operating principles

- **混在 (mixed) execution is the default**: streams whose branch *you own* (or
  that are cheap/read-only, e.g. the audit) run **here** as subagents or direct
  work; independent heavy streams are **delegated** as pasteable prompts.
- **Report-only audit by default**: the consistency audit detects and ranks
  drift; it does not fix. Only fix docs/code if the user grants that authority.
- **One writer per artifact**: never have two streams touch the same files.
  `comm/outbox/chat-<self>.md` is append-only and single-writer (see §9 CLAUDE.md).
- **Respect gates**: 🤖 autonomous / 👀 human visual check / 🛑 human action
  (DDL `supabase db push`, secret injection, PR merge, prod deploy). 👀 and 🛑
  items are **not** delegatable to a session — they belong to the user.

## Procedure

### 1. Clarify prerequisites (once per fan-out)
Use `AskUserQuestion` for the few decisions you cannot default:
- **Execution substrate** — web sessions (no worktree setup) / local Mac
  worktree chats (CLAUDE.md §7.4 4-step) / subagents-in-this-session / mixed.
  This decides the *format* of the prompts you generate.
- **Workstream determination** — you propose a slate (recommended) / user
  enumerates / adopt the memory INDEX 予定 list wholesale.
- **Audit authority** — report-only (default) / detect + auto-fix docs in a
  separate PR / detect + route fixes to owners via `comm/outbox`.
Skip any question already answered in-thread.

### 2. Ground-truth recon (do NOT trust docs blindly)
- Read the migration SSOT (`.claude/2026-05-04-cross-platform-migration.md`) and
  `.claude/memory/INDEX.md` for phase status + backlog.
- **`git fetch origin main` FRESH, then** compute `git rev-list --count
  origin/main..HEAD` and `HEAD..origin/main`. ⚠️ A stale local `origin/main` ref
  will report phantom "N commits ahead" — always fetch first (learned 2026-06-14:
  a "5 ahead" illusion was just a stale ref; W4/Phase3 were already merged).
- List open PRs (`mcp__github__list_pull_requests`, state=open) and reconcile
  against memory — **memory can lag git** (e.g. "PR 未作成" while it was merged).

### 3. Launch the consistency audit (background subagent, read-only)
Spawn a `general-purpose` agent, `run_in_background: true`, with the mandate in
§"Audit mandate" below. Tell it explicitly: **edit/create/delete nothing**.

### 4. Build the workstream slate
From backlog (`memory/INDEX.md` 予定) + `docs/vision/plans/` + migration SSOT:
- Mark each stream: independent? depends-on? gate (🤖/👀/🛑)? rough size?
- Separate **delegatable implementation** from **human-gated (👀/🛑)** and
  **already-in-progress** (avoid duplicating another chat's PR).
- Note which streams must base off a branch other than `main` (e.g. needs
  unmerged work) — prefer "merge the prerequisite to main first, then fan out".

### 5. Confirm selection (`AskUserQuestion`, multiSelect)
Present the slate; let the user pick which streams to spin up now. ≤4 options per
question — if more, present the full slate as text and offer "Other".

### 6. Generate per-session prompts
One self-contained prompt per delegated stream, from the template in
§"Per-session prompt template". Drive the streams you own directly instead.

### 7. Surface audit + reconcile
Report findings with severity + owner tag (A=doc-only / B=stream / C=human
judgement). Apply fixes only under the granted authority.

## Per-session prompt template

```text
あなたは <repo>（owner/repo）の新規セッションです。実装タスクの起点は lead-pipeline スキル。
最初に `.claude/comm/.session-name` に `chat-<slug>` と宣言してください。

【ゴール】<one-sentence outcome>
【Scope（触ってよいパス）】<paths>。それ以外（frontend/ は FROZEN 等）は触らない。
  - DataService 境界厳守（getDataService 経由 / コンポーネントから直接 invoke 禁止）
  - 新規 UI は shared/src/components/ に集約・notion-* トークン必須・主要背景に透明度禁止
【base ブランチ】origin/main 基点で `claude/<slug>` を切る（最新を fetch してから）
【Gate】🤖 <autonomous parts> / 🛑 <human: DDL push / merge / secrets>
【参照】<SSOT / plan / known-issue を必読>
【Acceptance Criteria（機械検証可能）】<bullet list>
【検証】<exact commands, e.g. `cd shared && npm run typecheck && npm run test` /
        `cd web && npm run build && npm run lint`>
【完了時】task-tracker で記録 → draft PR 作成 → `.claude/comm/outbox/` に要約 append。
  並行ストリーム（<list>）が走行中なのでそれらのファイルには触れない。
```

## Audit mandate (give verbatim to the audit subagent)

Read-only. Produce a Markdown report: `## サマリ (Critical/Moderate/Minor counts)`,
then per finding **severity / title / evidence (every file:line) / what conflicts
with what / owner (A=doc-only, B=stream, C=human judgement)**, then a
`## 誤検出の可能性が高い項目` section. Verify by actually grepping/reading code;
mark anything unconfirmed as 未確認. Seven axes:

1. **CLAUDE.md invariants vs code** — SectionId set, DataService boundary
   violations, table/role counts, MCP tool count ("一覧はコードが正" → code wins),
   PropertyType set.
2. **CLAUDE.md vs migration SSOT** — branch policy, phase status, stale paths.
3. **migration Non-goals vs requirements §8** — frozen/removed features still
   listed as Tier-1/2 (Database, FileExplorer …).
4. **plans completion state** — merged work still IN_PROGRESS/Draft, duplicate
   plan files, plans not moved to `archive/`, plans missing Scope/Gate/AC (§7.3).
5. **known-issues INDEX** — Active/Fixed placement + tally vs real file count.
6. **dead doc links** — relative links pointing at moved/deleted files.
7. **magic-number drift** — "約N", "Nツール", "N role", "Nテーブル" vs reality.

## Gotchas / institutional memory

- **Stale `origin/main`**: always `git fetch origin main` before reasoning about
  divergence. The local ref in a fresh container can be many commits behind.
- **memory/INDEX lags git**: it is a git-ignored derived view; PR/merge state may
  be stale. Trust git + open-PR list over memory for "is it merged?".
- **Skills live in an external skill-lib**: `.claude/skills/<name>` are symlinks
  to `/Users/newlife/dev/Claude/skill-lib/projects/life-editor/<name>` on the
  author's Mac. A skill authored from a cloud container is a **real file** in the
  repo; to fold it into the central lib, the user runs (on the Mac):
  `mv .claude/skills/<name> <skill-lib>/projects/life-editor/<name> && ln -s
  <skill-lib>/projects/life-editor/<name> .claude/skills/<name>`.
- **Plan-gate for DDL**: local migration file first → user `supabase db push`.
  Never `apply_migration` MCP alone (CLAUDE.md §7.3).
- **Don't bundle unrelated work into one merge PR** unless the user agrees;
  surface bundling (e.g. another chat's scaffold riding along) before merge.
