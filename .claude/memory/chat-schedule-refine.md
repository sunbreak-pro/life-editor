# MEMORY (chat-schedule-refine)

## 進行中

### ⏸️ schedule-refine orders 消化（着手日: 2026-07-11）

**対象**: `web/src/schedule/**`
**計画書**: `.claude/docs/vision/plans/2026-07-11-schedule-refine-orders.md`

- 前回: UX 改修 3 件（#222 status タグ / #223 右クリックメニュー / #224 セルクリック→パネル）完了 — **PR #230 merge 済み**
- 現在: runtime 確認（タグ配色 light/dark・メニュー端クランプ・月セル作成 undo・memo 付き複製）は chat-main 実測待ち
- 次: #185 Step 3（Event 編集フローへ繰り返しセクション組込 + detachRoutine 新規実装）— ユーザーの着手指示待ち

## 直近の完了

- life-tags 統一 S2 — calendars の folder→tag rebind（#231 closed・PR #239 merge 済み。S3 = materials-refine へ引き継ぎ）✅（2026-07-11）
- Schedule UX 3 件（#222/#223/#224・PR #230 merge 済み）✅（2026-07-11）
- #185 Step 2 FrequencyEditor 切り出し（PR #221 merge 済み）✅（2026-07-11）

## 予定

- #185 Step 3 実装（ユーザー着手指示後）
- MCP server Supabase 対応の切り出し Issue 起票（#185 計画 Step 6・ユーザー承認後）
