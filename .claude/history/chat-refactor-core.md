# HISTORY (chat-refactor-core)

### 2026-07-29 - DataService 分割 Step 3（event・schedule 系切り出し・PR #459）

#### 概要

PR #458 merge 後、schedule ドメイン（`SupabaseScheduleItemsService` 19 メソッド + `PHASE2_SCHEDULE_ITEM_METHODS`）を `SupabaseScheduleItemsService.ts` へ verbatim 移動した（挙動変更ゼロ・web/src 無改変）。

#### 変更点

- **shared/services**: `SupabaseScheduleItemsService.ts` 新設（831 行）。facade は import + `export { SupabaseScheduleItemsService }` 再 export に置き換え（テスト無改変）。schedule 専用だった facade の import（scheduleItemMapper ブロック / ScheduleItem 型 / getAuthedUserId / DEFAULT_ROUTINE_\* / fetchByIdChunks / forEachIdChunk）を除去し、facade は 475 行に縮小
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 2 ファイル lint 0 problems・session-verifier PASS
- **PR**: #459 open（`claude/refactor-03-schedule-items-service`・merge はユーザーゲート）

### 2026-07-29 - DataService 分割 Step 2（routine 系切り出し・PR #458）

#### 概要

PR #457 merge 後、routine ドメイン（`SupabaseRoutinesService` 10 メソッド + `PHASE2_ROUTINES_METHODS`）を `SupabaseRoutinesService.ts` へ verbatim 移動した（挙動変更ゼロ・web/src 無改変）。

#### 変更点

- **shared/services**: `SupabaseRoutinesService.ts` 新設。facade は import + `export { SupabaseRoutinesService }` 再 export に置き換え（テスト 2 ファイル無改変）。routine 専用だった facade の import（routineMapper ブロック / logServiceError / todayDateKey / RoutineNode）を除去
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 2 ファイル lint 0 problems・session-verifier PASS
- **PR**: #458 open（`claude/refactor-02-routines-service`・merge はユーザーゲート）

### 2026-07-29 - DataService 分割 Step 1（tasks 系 + 共有ヘルパ切り出し・PR #457）

#### 概要

SupabaseDataService.ts（約 2400 行）分割の第 1 弾。計画書を新設し、tasks ドメインと共有ヘルパを専用ファイルへ verbatim 移動した（挙動変更ゼロ・web/src 無改変）。

#### 変更点

- **計画書**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md` 新設（ドメイン一覧・切り出し順・facade 最終形・全 PR 共通 AC を固定。Status: IN PROGRESS）
- **shared/services**: `SupabaseTasksService`（9 メソッド）+ `PHASE2_TASKS_METHODS` を `SupabaseTasksService.ts` へ、`pgrstQuoteValue` / `getAuthedUserId` を `supabaseServiceHelpers.ts` へ切り出し。`SupabaseDataService.ts` は import + 再 export に置き換え（431 行削減・既存 export 全維持でテスト無改変）
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 3 ファイル lint 0 problems・session-verifier PASS
- **PR**: #457 open（`claude/refactor-01-tasks-service`・merge はユーザーゲート）。chat-main 宛の起票依頼を outbox に append
