# MEMORY (chat-schedule-refine)

## 進行中

### ⏸️ life-tags 統一 S2 — CalendarView の folder→life-tag rebind（着手日: 2026-07-11）

**対象**: `web/src/schedule/CalendarView.tsx` / `shared/src/types/calendar.ts` / `shared/src/services/calendarMapper.ts` / `shared/src/hooks/useCalendarsAPI.ts` / `shared/src/services/{DataService,SupabaseDataService}.ts` / `supabase/migrations/`
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（§F S2・epic #225・担当 Issue #231）

- 前回: —
- 現在: 準備完了・実装待機 — main merge / folder 依存の全数実測（Issue #231 に記載）/ Issue #231 起票 / materials-refine へ outbox で案(a) life-tag バインド（`calendars.folder_id` → `tag_id` FK `wiki_tags(id)`）の合意返信済み。コード未変更
- 次: materials-refine の ack 確定後に実装（migration ローカル先行 + 型/mapper/UI 追随）→ 完了を outbox 報告して S3（NodeType から folder 除去）を解禁

### 🔧 schedule-refine orders 消化（着手日: 2026-07-11）

**対象**: `web/src/schedule/**`
**計画書**: `.claude/docs/vision/plans/2026-07-11-schedule-refine-orders.md`

- 前回: #185 Step 2 完了（FrequencyEditor 切り出し・PR #221 merge 済み）
- 現在: UX 改修 3 件（#222 status タグ / #223 右クリックメニュー / #224 セルクリック→パネル）実装・QA 反映済み — **PR #230 open・merge 待ち**。merge 後 chat-main で runtime 確認（タグ配色 light/dark・メニュー端クランプ・月セル作成 undo・memo 付き複製）
- 次: #185 Step 3（Event 編集フローへ繰り返しセクション組込 + detachRoutine 新規実装）— ユーザーの着手指示待ち

## 直近の完了

- Schedule UX 3 件（#222/#223/#224・PR #230 提出）✅（2026-07-11）
- #185 Step 2 FrequencyEditor 切り出し（PR #221 merge 済み）✅（2026-07-11）
- Layout Standard v2 adoption — schedule（#204・in-body タブ帯 + 重複トグル撤去）✅（2026-07-11）
- #183 SegmentedControl 連結表示 close（#180 修正の実測確認・desktop/mobile）✅（2026-07-11）
- #181 schedule 行 adoption（gutter トークン化・PR #191 merge 済み）✅（2026-07-11）

## 予定

- #185 実装（計画 PR merge 後）
- MCP server Supabase 対応の切り出し Issue 起票（#185 計画 Step 6・ユーザー承認後）
