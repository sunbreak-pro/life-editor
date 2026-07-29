---
Status: IN PROGRESS
Created: 2026-07-28
Branch: main # docs のみ。commit する場合は一時 worktree 経由（main 直 push 禁止）
Owner-chat: main
---

# Plan: Open Issue 一斉消化 fan-out（2026-07-28）

> **意図的に緩い計画書**。方向性と担当 worktree だけを固定し、手順・DoD は各 Issue body を正本とする（転記しない — 数値の非複製原則）。
> コード調査で前提が変わったら Issue コメント側を更新し、本書は方向レベルのまま保つ。

---

## Context

- **動機**: open Issue 21 件（2026-07-28 時点）を 4 つの常設 worktree チャットへ一括分配して消化する。4 チャットの前ブランチはすべて merge 済み（PR #423 / #425 / #426 / #432）で全員着手可能
- **制約**: 実ブラウザ検証は merge 後に main の検証専用セッションが playwright MCP で実施（→ [`2026-07-28-post-merge-playwright-verification.md`](./2026-07-28-post-merge-playwright-verification.md)）。各 worktree は build / vitest まで
- **Non-goals**: #372（DDL 要・将来）の実装、Epic #290 / #321 の完了（チェックボックス追随のみ）

---

## Worktree 分担

| worktree           | 担当（1 行）                                              | 対応 Issue（着手順）      | 触ってよいパス（目安）                                                                                                          |
| ------------------ | --------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `schedule-refine`  | #407 後始末 → Schedule 再編（Epic #290 Step 5）           | #433 → #434 → #408 → #411 | `web/src/schedule/**` `web/src/MainScreen.tsx` `shared/src/components/schedule/**` `shared/src/utils/routineFrequency*`         |
| `briefing-section` | Briefing 小修正 + docs 追随 + connect 要否判断            | #427 → #410 → #431 → #361 | `web/src/briefing/**` `shared/src/components/briefing/**` `.claude/docs/**` `shared/src/components/Connect/graph/**`            |
| `analytics-refine` | Analytics 集計の正しさ + materials perf（materials 兼務） | #420 → #428 → #429 → #430 | `shared/src/utils/analyticsAggregation*` `shared/src/components/Analytics/**` `shared/src/hooks/**`                             |
| `shell-refine`     | tags UI 配線 + lint / MCP ツールの土台                    | #412 → #421 → #419        | `web/src/wikitag/**` `web/src/tasks/**` `shared/src/components/**` `shared/package.json` `.github/workflows/**` `mcp-server/**` |

- **手すき枠**: 自分の担当を消化し終えたチャットが **#363**（`[all]` docs sweep）を先着 1 チャットで拾う（着手宣言 = Issue にコメント）
- **後回し（今回スコープ外）**: #372（DDL 要 → DEFERRED のまま）/ #368（低優先 tags — 余力があれば shell-refine）/ #369（低優先 materials — 余力があれば analytics-refine）
- **Epic 追随**: #290 は #408 / #411 close 時に Step 5 を schedule-refine が更新。#321 は chat-main 管理
- ブランチ運用は CLAUDE.md §7.4 のとおり: Issue ごとに `claude/<slug>-<issue>-<短slug>` を origin/main から切り直し、`.claude/comm/.session-branch` を都度更新。着手前に `git pull --ff-only` → `git fetch origin && git merge origin/main --no-edit`

---

## 方向性メモ（1〜2 行の向きだけ。詳細・DoD = Issue body）

### schedule-refine

- **#433**: origin/main から新ブランチを切り、置き去り 2 コミット（`a873e583` / `52b6d081`）を cherry-pick で回収して PR。**これが着地するまで #434 に着手しない**（同ファイル衝突）
- **#434**: 変換中セグメントの pending / disabled 表示 + attach reject の toast。`convertingSeedsRef` の shared 切り出しは余力次第（見送りなら根拠を Issue にコメント）
- **#408**: Routines タブ除去 + rightSidebar に繰り返し一覧パネル。本丸は「Calendar 編集パネルだけで繰り返し操作が完結するか」の棚卸し
- **#411**: Todo タブを Schedule へ移設。`setMaterialsTab("tasks")` 経路の全数 grep が肝（取りこぼすとタスク導線が全部死ぬ）。#408 と同じタブ構造を触るので連続着手し、順序は実装者判断

### briefing-section

- **#427**: `intentionCaption` 算出の「未宣言かつドラフト無しなら出さない」化。file:line は再実測
- **#410**: ↗ ボタンを「アイコン＋編集」に変え右端揃え。EveningView の同型も grep で拾う
- **#431**: docs のみ 2 件（materials brief の Notes 節棚卸し / db-conventions に PostgREST join の FK 名指し注意を追記）
- **#361**: 位置復元を実装するか `savePositions` ごと退役するかの要否判断込み。根拠を Issue コメントに残して決着

### analytics-refine

- **#420**: 完了 Todo の引き当てキーをローカル暦日（`todayCalendarKey` と整合）へ。報告 5 箇所 + grep 再実測。過去データの見え方が変わる旨を PR 本文に明記
- **#428**: **仕様判断が先**（案 1: trash 分を集計から除外 / 案 2: 現状維持を明文化）。案 1 を第一候補に検討し、根拠を Issue コメントへ。判断に迷ったら停止してユーザーに確認
- **#429**: 呼び出し元ゼロを grep で全数実測してから退役。巻き添えで参照ゼロになる legacy 型の扱いを PR 本文に
- **#430**: `[[` 候補フェッチを初回 `[[` 入力まで遅延（方式は実装者判断）。3 role + `balanceByRole` の配分維持が条件

### shell-refine

- **#412**: Phase 1 = タスク詳細面に `TagPicker` を配線。#409 で入ったタグパネルとデザインを揃え、「種類が分かるチップ」の型をここで決める（Phase 2 の布石）
- **#421**: #409 が merge 済みのため violation 件数・ファイル位置を**再実測してから**。件数が多ければ「CI 導入先行・解消は別 PR」に切り分け可
- **#419**: 契約変更 3 案の判断根拠を Issue コメントに残してから実装（呼び手は Claude Code のみ = 破壊的リネームも許容範囲）

---

## 共通ゲート（全 worktree）

DDL ゼロ / `lumen-*` トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / `cd shared && npm run test`・`npm run build`・`cd web && npm run build` すべて exit 0 / 実ブラウザ検証は merge 後の検証セッション（worktree ではやらない）/ 起票が必要な発見は自分の outbox に依頼を append（起票は chat-main 一元化）

---

## 検証

- merge 後の実ブラウザ検証 = [`2026-07-28-post-merge-playwright-verification.md`](./2026-07-28-post-merge-playwright-verification.md)（main の検証専用セッションが playwright MCP で実施。検証項目・貼り付けプロンプトは同書）

---

## References

- CLAUDE.md §7.4（worktree / ブランチ運用）・§9（Issue dispatch）
- Epic: #290（Schedule redesign）/ #321（Mobile 追随）
- 関連 memory: `push-after-merge-strands-commits`（#433 の背景）
