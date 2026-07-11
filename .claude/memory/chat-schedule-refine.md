# MEMORY (chat-schedule-refine)

## 進行中

### 🔧 schedule-refine orders 消化（着手日: 2026-07-11）

**対象**: `web/src/schedule/**`
**計画書**: `.claude/docs/vision/plans/2026-07-11-schedule-refine-orders.md`

- 前回: #183 close（実測で解消確認）+ #181 schedule 行（gutter トークン化・PR #191）
- 現在: #185 詳細計画書作成済（案 B = データモデル維持・UI 統合。`plans/2026-07-11-event-routine-unification.md`・PR #191 同梱で承認待ち）
- 次: 計画 PR merge 後に Step 2（繰り返し編集部品の共通化）から実装

## 直近の完了

- #183 SegmentedControl 連結表示 close（#180 修正の実測確認・desktop/mobile）✅（2026-07-11）
- #181 schedule 行 adoption（gutter トークン化・PR #191）✅（2026-07-11・merge 待ち）
- Schedule 画面修正 4 件（Event/Routine 統合 Issue #185 起票 / hover 背景改善 / アイテム詳細 rightSidebar 化 / Routines タブ同様）✅（2026-07-10）

## 予定

- #185 実装（計画 PR merge 後）
- Layout Standard v2 adoption（v2 共通部品 merge 待ち — orders 台帳参照）
- MCP server Supabase 対応の切り出し Issue 起票（#185 計画 Step 6・ユーザー承認後）
