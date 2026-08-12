---
name: docs-workflow
description: life-editor のドキュメント体系と課題管理運用の正本。GitHub Issue のラベル routing（section:<id> / shared-fix）・Issue 起票の一元化ルール・Issue と docs/known-issues のスコープ境界・実装プラン（plans/）のライフサイクル・並行チャット通信（comm/）・判断の非同期キュー（decisions/）を扱う。Issue を起票する / 自分宛タスクを探す / プランを書く or archive する / 他チャットへ連絡する / ユーザー判断をキューに積む ときに読む。Triggers include "Issue 起票", "issue dispatch", "自分宛", "shared-fix", "section ラベル", "plans", "archive", "known-issues", "comm", "decisions", "判断キュー".
---

# Document System — ドキュメント体系と課題管理

> CLAUDE.md §9 の本体。CLAUDE.md 側には「進捗は per-chat / 追跡は GitHub Issues / 起票は chat-main 一元 / 鉄則」の要約だけを残し、運用の詳細はここが正本。

## 進捗 / 履歴は per-chat

`.claude/memory/chat-<self>.md` + `.claude/history/chat-<self>.md`（task-tracker 経由・git 追跡・単一書込者）。集約 `memory/INDEX.md` / `history/INDEX.md` は **git 非追跡の派生ビュー**（`hooks/regen-index.sh` が再生成）。チャット名宣言 = `.claude/comm/.session-name`。

## 実装プラン（plans/）

`docs/vision/plans/YYYY-MM-DD-<slug>.md` → 完了で `archive/` へ移動。

Status 語彙は enum のみ: `Draft` / `IN PROGRESS` / `BLOCKED` / `COMPLETED` / `SUPERSEDED` / `DEFERRED` / `REFERENCE` / `ACTIVE (adopted policy)`（enum の適用範囲・全数チェック方法 → `rules/docs-consistency.md`）。

移行 SSOT（`2026-05-04-cross-platform-migration.md`）のみ歴史的経緯で `.claude/` 直下に置く例外。設計判断の Why・却下案は **`.claude/decisions/` の決定台帳**に残す（旧「ADR は作らない」方針は D-20260809-main-1 で SUPERSEDE — 陳腐化は上書きでなく supersede 連鎖で表現する。書き込み先の判定 = `rules/records.md`）。

## Known Issue / 課題管理（2026-07-04〜）

追跡の正 = **GitHub Issues + Projects**（`gh -R sunbreak-pro/life-editor` で読み書き・種別 = label `type:*`）。新規バグは Issue で起票（`.github/ISSUE_TEMPLATE/known-issue.yml`）。

`docs/known-issues/` は Fixed の凍結アーカイブ ＋ 環境系知見（Issue 化対象外 — 例 026/028）の管理台帳。**類似バグは `gh issue list --search` + `INDEX.md` grep の両輪**。計画書 .md 更新時は対応 Issue の DoD も更新（.md = 詳細 / Issue = 追跡）。

### スコープ境界（Issue に何を書くか）

Issue はプロダクト課題（life-editor のコードを直せば直るもの）専用。**Claude Code の作業環境・hook・ツール挙動に関する知見は Issue 化せず `docs/known-issues/` + `rules/` で管理する**。

判定 = 「life-editor のコードを直せば直るか？」— No なら環境系として Issue 化しない（例: cwd 漂流 028 / formatter 挙動 026）。

## worktree 担当ルーティング（2026-07-10〜）

セクション単位の Issue には `section:<id>` ラベルを付与（`<id>` は `shared/src/sections.ts` の SectionId と一致。trash は担当 worktree がないため chat-main 采配）。各セクション worktree は `gh issue list -R sunbreak-pro/life-editor --label section:<id>` で自分の担当タスクを判断する。

セクションに紐づかない横断タスク（app-integration / layout-standard / docs-workspace 等のレーン）は **`shared-fix`** ラベルに集約（宛先 = タイトル prefix `[<worktree-slug>]`）。各 worktree チャットはセッション開始時と作業の区切りに `gh issue list --label shared-fix --state open` で自分宛を確認する（Outbox との使い分け → `comm/README.md` §Issue dispatch ルート）。

ラベル一覧の正本は GitHub（`gh label list`）。

### `[all]` prefix は実装タスクに使わない

（2026-08-01 ユーザー確定 D-20260731-main-2）chat-main が**起票時点で宛先 slug を 1 つに決める**。`[all]` は Epic と全レーン共通の告知だけに使う。

理由 = 2026-07-31 に `[all]` の #473 / #499 を 2 レーンが同時に掴み、**どちらも片方の実装が丸ごと無駄になった**。回避策として試した 2 案はどちらも実証で潰れている — 着手宣言コメントは `gh issue list` の出力に出ないため一覧しか見ないレーンに届かず（宣言の 8 時間 23 分後に別レーンが PR を出した）、assignee はこの repo の作業者が GitHub 上 `sunbreak-pro` 一人なのでレーンを表せない。

### Issue 起票は chat-main に一元化する

（2026-07-11 (2) ユーザー決定 — 同日の worktree 自己起票運用を SUPERSEDE）課題の起票はすべて chat-main が `issue-dispatch` スキルで行う（重複チェック → ラベル routing → DoD 付き body）。

ユーザーが worktree チャットへ直接指示した場合、実装は即着手してよいが、そのチャットは自分で起票せず**自分の outbox に起票依頼を append** する（chat-main が拾って起票）。各 worktree はセッション開始時と作業の区切りに自分宛 open Issue（`section:<id>` + `shared-fix`）を確認して実行 → close まで担う。

## 並行チャット通信

`.claude/comm/`（自分の Outbox にのみ append → `comm/README.md`）。

## 判断の非同期キュー（2026-07-28〜）+ 確定台帳（2026-08-09〜）

ユーザー判断は `.claude/comm/decisions/` に書き溜めて次の作業へ進む（事前決裁 = `decisions/POLICY.md`・行動規定 = `rules/decision-queue.md`・設計 = `docs/vision/plans/2026-07-28-loop-engineering-harness.md`）。

回答が付いて実装 Issue を起票する前に、`gh issue list -R sunbreak-pro/life-editor --state closed --search <キーワード>` で先行着地が無いか確かめる（裁定は数日〜数週間寝るので、待っている間に別レーンが直していることがある — D-20260801-sched-2 は回答の 10 日前に PR #547 で着地済みで、#741 が重複起票になった）。

回答が付いたらキューを消す前に確定台帳へ昇格する（D-20260809-main-1）。**手順・書式・INDEX の扱いの正本 = [`.claude/decisions/README.md`](../../decisions/README.md)**。過去の判断の Why・却下案を探すときは grep でなく `.claude/decisions/INDEX.md` の Active 表・Topic 逆引きから辿る。
