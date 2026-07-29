# MEMORY (chat-refactor-core)

## 進行中

### 🔧 SupabaseDataService 分割 + web hooks 切り出し（着手日: 2026-07-29）

**対象**: `shared/src/services/`・`web/src/`（CalendarTab.tsx 除外）
**計画書**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`

- 前回: Step 3 完了 — event・schedule 系（`SupabaseScheduleItemsService` 19 メソッド）を `SupabaseScheduleItemsService.ts` へ切り出し（PR #459・3 ゲート緑 + lint 0 problems・session-verifier PASS）
- 現在: PR #459 の merge 待ち（ユーザーゲート）
- 次: merge 後に origin/main から `claude/refactor-04-calendars-service` を切り、calendar 系（`SupabaseCalendarsService`）を切り出す（PR #4）

## 直近の完了

- DataService 分割 Step 2（routine 系・PR #458 merged）✅（2026-07-29）
- DataService 分割 Step 1（tasks 系 + 共有ヘルパ・PR #457 merged）✅（2026-07-29）

## 予定

- calendar 系切り出し（PR #4）→ link・connection 系 stub + facade 最終化 + pgrstQuoteValueLocal 統合（PR #5）
- web 画面 hooks 切り出し: BriefingScreen → NotesView → MainScreen（CalendarTab は対象外 — schedule-refine レーン #290 と衝突回避）
