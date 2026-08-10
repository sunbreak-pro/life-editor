# HISTORY ARCHIVE (chat-refactor-core) — 2026-07

### 2026-07-29 - Phase B Step 2（NotesView hooks 切り出し・PR #463）

#### 概要

Phase B（web 画面 hooks 切り出し）の第 2 弾。NotesView（1313 行）をリスト導出側 `useNoteListState`・リンク側 `useNoteLinking`・デスクトップ行部品 `NoteListRows` + 表示専念の画面（約 890 行）に分割した（挙動変更ゼロ・shared/src 無改変）。

#### 変更点

- **web/notes**: `hooks/useNoteListState.tsx` 新設（タグ見出し折りたたみの永続化 + 検索 → タグ束ね → 並べ替え → タグ絞り込みの導出パイプライン + ソート/フィルタ UI の派生値）/ `hooks/useNoteLinking.ts` 新設（LinkPanel 候補・「[[」リンク先ローダと editor コールバック・タブ跨ぎ選択の引き継ぎ）/ `NoteListRows.tsx` 新設（draggable 行 + droppable タグ見出し。DnD の sensors/handlers は view 側の useNoteTagDnd のまま）。コードは配管以外 verbatim 移動
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 4 ファイル lint 0 problems・session-verifier PASS
- **PR**: #463 open（`claude/refactor-07-notesview-hooks`・merge はユーザーゲート。残り = Phase B Step 3 = MainScreen）

### 2026-07-29 - Phase B Step 1（BriefingScreen hooks 切り出し・PR #462）

#### 概要

Phase B（web 画面 hooks 切り出し）の第 1 弾。BriefingScreen（850 行）をデータ側 `useBriefingData` と編集側 `useDailySections` の 2 hook + 表示専念の画面（約 290 行）に分割した（挙動変更ゼロ・shared/src 無改変）。

#### 変更点

- **web/briefing**: `hooks/useBriefingData.ts` 新設（7 ソース fetch + syncVersion 再取得・集計・夕刊表示リスト・tray 派生・DataService 書き込みハンドラ）/ `hooks/useDailySections.ts` 新設（夕刊エディタ + mood・宣言 draft/echo 照合・debounce flush・セクションマージ保存。夕刊と宣言が共有すべき直列保存チェーンを hook 内部に閉じ込め構造的に保証）。コードは配管以外 verbatim 移動（dep 配列への setDailyContent 追加のみ = stable setter で挙動不変）
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 3 ファイル lint 0 problems・session-verifier PASS
- **PR**: #462 open（`claude/refactor-06-briefing-hooks`・merge はユーザーゲート。#461 とファイル非重複で独立）

### 2026-07-29 - DataService 分割 Step 5（stub 切り出し + facade 最終化・PR #461）

#### 概要

PR #460 merge 後、Phase A の最終回として link・connection の stub 2 クラスを `SupabaseNoteLinksService.ts` へ verbatim 移動し、facade を計画どおりの最終形に到達させた（挙動変更ゼロ・web/src 無改変）。

#### 変更点

- **shared/services**: `SupabaseNoteLinksService.ts` 新設（stub 2 クラス + `_pendingDuRewrite` + PHASE2 Set 2 つ。module-private のため再 export なし）。facade は 202 行・ドメインロジックゼロ（service import + createSupabaseDataService + 互換 re-export のみ）
- **pgrstQuoteValueLocal 統合**: `SupabaseNotesUnifiedService.ts` の重複コピーを `supabaseServiceHelpers.ts` の `pgrstQuoteValue` 参照に付け替え（同一実装・循環 import 回避の理由は Step 1 で消滅済み）。旧 facade ヘッダを指す stale コメント参照も追随
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 3 ファイル lint 0 problems・session-verifier PASS
- **PR**: #461 open（`claude/refactor-05-stubs-facade-final`・merge はユーザーゲート。merge で Phase A 完了、残り = Phase B + 実ブラウザ確認）

### 2026-07-29 - DataService 分割 Step 4（calendar 系切り出し・PR #460）

#### 概要

PR #459 merge 後、calendar ドメイン（`SupabaseCalendarsService` 4 メソッド + `PHASE2_CALENDAR_METHODS`）を `SupabaseCalendarsService.ts` へ verbatim 移動した（挙動変更ゼロ・web/src 無改変）。

#### 変更点

- **shared/services**: `SupabaseCalendarsService.ts` 新設。クラスは module-private で外部 importer ゼロのため再 export なし（前 3 回と異なる点）。calendar 専用だった facade の import（CalendarNode 型 / calendarMapper ブロック / fetchAllPages）を除去し、facade は 333 行に縮小
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 2 ファイル lint 0 problems・session-verifier PASS
- **PR**: #460 open（`claude/refactor-04-calendars-service`・merge はユーザーゲート）

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
