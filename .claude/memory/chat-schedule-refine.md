# MEMORY (chat-schedule-refine)

## 進行中

### 🔧 schedule-refine orders 消化（着手日: 2026-07-11）

**対象**: `web/src/schedule/**`
**計画書**: `.claude/docs/vision/plans/2026-07-11-schedule-refine-orders.md`

- 前回: Layout Standard v2 adoption（#204 — タブ帯を標準 SectionHeader へ移行・PR #205 merge 済み・role-qa PASS）
- 現在: #204 は runtime 表示確認（chat-main 実測）のみ残し open 維持
- 次: #185 実装（詳細計画は PR #191 で merge 済み = 承認。Step 2 繰り返し編集部品の共通化から）

## 直近の完了

- Layout Standard v2 adoption — schedule（#204・in-body タブ帯 + 重複トグル撤去）✅（2026-07-11）
- #183 SegmentedControl 連結表示 close（#180 修正の実測確認・desktop/mobile）✅（2026-07-11）
- #181 schedule 行 adoption（gutter トークン化・PR #191 merge 済み）✅（2026-07-11）

## 予定

- #185 実装（計画 PR merge 後）
- MCP server Supabase 対応の切り出し Issue 起票（#185 計画 Step 6・ユーザー承認後）
