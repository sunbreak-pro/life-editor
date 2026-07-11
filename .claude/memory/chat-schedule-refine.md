# MEMORY (chat-schedule-refine)

## 進行中

### 🔧 schedule-refine orders 消化（着手日: 2026-07-11）

**対象**: `web/src/schedule/**`
**計画書**: `.claude/docs/vision/plans/2026-07-11-schedule-refine-orders.md`

- 前回: Layout Standard v2 adoption（#204 — PR #205 merge 済み・runtime 表示確認のみ chat-main 待ちで open 維持）
- 現在: #185 実装 Step 2 完了（FrequencyEditor 切り出し・shared 802/802 + web build pass）
- 次: #185 Step 3（Event 編集フローへ繰り返しセクション組込 + detachRoutine 新規実装）— ユーザーの着手指示待ち

## 直近の完了

- Layout Standard v2 adoption — schedule（#204・in-body タブ帯 + 重複トグル撤去）✅（2026-07-11）
- #183 SegmentedControl 連結表示 close（#180 修正の実測確認・desktop/mobile）✅（2026-07-11）
- #181 schedule 行 adoption（gutter トークン化・PR #191 merge 済み）✅（2026-07-11）

## 予定

- #185 実装（計画 PR merge 後）
- MCP server Supabase 対応の切り出し Issue 起票（#185 計画 Step 6・ユーザー承認後）
