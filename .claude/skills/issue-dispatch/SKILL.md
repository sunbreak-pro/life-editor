---
name: issue-dispatch
description: >-
  chat-main (orchestrator) files EVERY current product issue as a GitHub Issue
  — worktree-agnostic — and routes it purely via labels (section:<id> /
  shared-fix); each worktree chat polls its own labels as its task queue and
  drives each issue to close. Absorbs the retired parallel-orchestrator skill
  and replaces the orders-.md ledger fan-out (both retired 2026-07-11). Use
  when the user says 「課題を起票して」「タスクを配って」「dispatch」「fan out」,
  after an audit / runtime measurement produces findings, or whenever work must
  be distributed across worktree chats.
---

# issue-dispatch — GitHub Issue 駆動タスク分配（chat-main 専用）

課題の「回覧板」（orders .md 台帳・貼り付けプロンプト）を廃止し、**掲示板 1 枚 = GitHub
Issues** に全部貼る方式。chat-main が起票し、各 worktree チャットが自分宛ラベルを
タスクキューとして読む。

## モデル（誰が何をするか）

- **起票 = chat-main のみ**（2026-07-11 ユーザー決定・一元化）。worktree チャットは
  Issue を起票しない — ユーザーから直接指示を受けた場合、実装は即着手してよいが、
  追跡 Issue は自分の outbox に起票依頼を append して chat-main に委ねる
- **正本 = GitHub Issues**（`gh -R sunbreak-pro/life-editor`）。`docs/vision/plans/`
  計画書は大型仕様の詳細のみに使い、**作業分配・進捗追跡の台帳 .md は新規作成しない**
- **消化 = 各 worktree チャット**: セッション開始時と作業の区切りに自分宛 open Issue を
  確認 → 実装 → PR → close まで担う（ポーリング規約の正本 = `comm/README.md`
  §Issue dispatch ルート）

## ルーティング（ラベルが宛先のすべて）

| ラベル         | 宛先                                 | 用途                                                                                                                             |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `section:<id>` | 担当 worktree 直行                   | 単一セクション課題（`<id>` = `shared/src/sections.ts` の SectionId）                                                             |
| `shared-fix`   | タイトル prefix `[<slug>]` / `[all]` | worktree 横断・共有部品・非セクションレーン                                                                                      |
| （宛先なし）   | chat-main 采配                       | 担当 worktree が無い課題（例: trash）。chat-main が一時 worktree で自走するか、手すき worktree へ `shared-fix` `[<slug>]` で回す |

- 種別 `type:*` は必須・重要度 `sev:*` は任意。ラベル一覧の正本 = `gh label list`
- 環境系（hook / ツール挙動）は Issue 化しない — CLAUDE.md §9 のスコープ境界に従う

## 手順

### 1. 課題収集

ソース: ユーザー指示 / playwright 実測レポート（`.claude/reports/`）/ plans の残タスク /
整合監査（下記 mandate・必要時のみ）。サブエージェント報告に含まれる file:line・件数・
引用は**起票前に必ず実測 spot check**（`rules/docs-consistency.md` §5 — 偽 findings の
Issue 化は「矛盾の量産」になる）。

### 2. 重複チェック（起票前必須）

```bash
gh issue list -R sunbreak-pro/life-editor --state open --limit 100
gh issue list -R sunbreak-pro/life-editor --state closed --search "<keyword>"
```

既存 open があれば新規は立てずコメント追記。closed 済み類似は `docs/known-issues/INDEX.md`
grep と両輪で確認（再発なら reopen ではなく新 Issue + 旧番号参照）。

### 3. 起票（1 課題 = 1 Issue）

```bash
gh issue create -R sunbreak-pro/life-editor \
  --title "[<slug> or 素のタイトル]" \
  --label "type:<bug|feature|task>" --label "<section:<id>|shared-fix>" \
  --body "<下記要素>"
```

body 必須要素:

- **現象 / 動機**（1〜3 行・再現手順があれば併記）
- **Scope**（触ってよいパス — one writer per artifact: 同一ファイルを 2 レーンに触らせない）
- **DoD**（機械検証可能: `cd shared && npm run build` exit 0 / vitest 緑 / 実測値 等）
- **参照**（レポート・計画書・コード file:line）
- **Gate**: DDL push / シークレット投入 / PR merge / 本番デプロイ等の 🛑 人手工程が
  含まれるなら明記（Issue に書いても実行はユーザー — 委譲不可）

### 4. 配布（boot は原則不要）

常設 worktree チャットへはラベルを付けて起票するだけで届く（ポーリング規約）。
新規・休眠チャットを起こすときだけ、次の 1 行 boot を渡す:

```text
gh issue list -R sunbreak-pro/life-editor --label section:<id> --state open と
--label shared-fix --state open で自分宛 open Issue を確認し、順に実装して close まで担うこと
```

### 5. 完了追跡（chat-main の巡回）

- 作業の区切りに open Issue を巡回し、停滞・close 漏れ・「merge 済みなのに open」を検出
- PR merge / Issue close 時の docs 追随（plan Status・per-chat memory）=
  `rules/docs-consistency.md` §4

## 整合監査 mandate（必要時・read-only subagent・parallel-orchestrator から継承）

課題収集の一環として乖離を洗うときは、general-purpose subagent に read-only 監査を委任
（**edit/create/delete nothing** を明示）。観点 7 軸: (1) CLAUDE.md 不変式 vs コード
(2) CLAUDE.md vs 移行 SSOT (3) Non-goals vs 要件 §8 (4) plans 完了状態（merge 済みが
IN PROGRESS のまま等）(5) known-issues INDEX 整合 (6) dead link (7) magic-number drift。
findings は severity + evidence（file:line 全数）+ 誤検出可能性の節を必須とし、
spot check 通過分だけを手順 3 で Issue 化する。

## Gotchas（institutional memory・parallel-orchestrator から継承）

- **stale `origin/main`**: 分配判断の前に `git fetch origin main`。古い ref は幻の
  ahead/behind を報告する（2026-06-14 実例）
- **memory/INDEX は git に遅れる**: 「merge された？」は git + `gh pr list` が正
- **無関係作業の同梱 merge 禁止**: 別チャットの scaffold が PR に相乗りしていたら
  merge 前にユーザーへ提示する
- **worktree の Issue 消化と main の pull 順序**: worktree は着手前に
  `git pull --ff-only` → `git fetch origin && git merge origin/main --no-edit` の
  2 段階（CLAUDE.md §7.4）— 古い main 基準で直すと「直したのに再発」に見える
