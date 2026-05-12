# Schedule セクション

`activeSection === "schedule"` で表示される画面。CLAUDE.md §3.3 / §6.5 (Schedule 3 分割) と直結する。

## 概要

4 つのタブで構成:

- **Calendar** — 月表示 / 週表示のカレンダー
- **DayFlow** — 1 日分のタイムグリッド (時間軸でブロックを並べる「今日の流れ」画面)
- **Tasks** — 期限つきタスク一覧
- **Events** — 予定 (イベント) 一覧

横串で扱うデータは 4 系統:

- `routines` / `routine_groups` / `routine_group_assignments` (繰り返し予定の雛形)
- `schedule_items` (実体ブロック)
- `calendar_tags` / `calendar_tag_assignments` (カレンダー専用タグ)
- `calendars` (外部カレンダー・祝日など)

## A. ルートとタブ切替

| 役割                             | パス                                                              | 何をしている                                                                       |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Section 親                       | `frontend/src/components/ScheduleList/ScheduleSection.tsx`        | `ScheduleTab = calendar / dayflow / tasks / events` 切替。DayFlow dual column 状態 |
| Section への差し込み             | `frontend/src/App.tsx` (`case "schedule":`)                       | サイドナビから Schedule を選んだとき `ScheduleSection` を描画                      |
| Schedule 用の右サイドバー (汎用) | `frontend/src/components/ScheduleList/ScheduleSidebarContent.tsx` | タグ・進捗の出し分け                                                               |

## B. タブ別の画面コンポーネント

### Calendar タブ

| ファイル                                                                                                                     | 役割                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx`                                                           | カレンダー本体          |
| `frontend/src/components/Tasks/Schedule/Calendar/MonthlyView.tsx`                                                            | 月表示                  |
| `frontend/src/components/Tasks/Schedule/Calendar/WeeklyTimeGrid.tsx`                                                         | 週表示 (時間軸あり)     |
| `frontend/src/components/Tasks/Schedule/Calendar/DayCell.tsx` / `CalendarItemChip.tsx`                                       | 日付セル / セル内チップ |
| `frontend/src/components/Tasks/Schedule/Calendar/CreateItemPopover.tsx` / `EventCreatePopover.tsx` / `NoteCreatePopover.tsx` | セルクリック時の作成 UI |
| `frontend/src/components/Tasks/Schedule/Calendar/CalendarHeader.tsx`                                                         | ヘッダー (月送りなど)   |
| `frontend/src/components/Tasks/Schedule/Calendar/TaskPreviewPopup.tsx` / `MemoPreviewPopup.tsx`                              | プレビューポップアップ  |

### DayFlow タブ

| ファイル                                                                                           | 役割                                                |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `frontend/src/components/Tasks/Schedule/DayFlow/OneDaySchedule.tsx`                                | DayFlow 本体 (1 日タイムグリッド)                   |
| `frontend/src/components/Tasks/Schedule/DayFlow/DualDayFlowLayout.tsx`                             | 2 カラム表示 (今日 + 明日 など)                     |
| `frontend/src/components/Tasks/Schedule/DayFlow/ScheduleTimeGrid.tsx`                              | 縦時間軸の描画と当たり判定                          |
| `frontend/src/components/Tasks/Schedule/DayFlow/scheduleTimeGridLayout.ts`                         | 重なるブロックの列割り当て計算 (純粋関数、テスト済) |
| `frontend/src/components/Tasks/Schedule/DayFlow/ScheduleItemBlock.tsx`                             | 1 つのブロックの描画 + DnD                          |
| `frontend/src/components/Tasks/Schedule/DayFlow/SessionBlock.tsx`                                  | ポモドーロセッションのブロック表示                  |
| `frontend/src/components/Tasks/Schedule/DayFlow/GroupFrame.tsx` / `GroupContextMenu.tsx`           | ルーチングループの枠 + 右クリック                   |
| `frontend/src/components/Tasks/Schedule/DayFlow/RoutinePickerPanel.tsx`                            | DayFlow 上での「ルーチン挿入」パネル                |
| `frontend/src/components/Tasks/Schedule/DayFlow/DayFlowSidebarContent.tsx`                         | DayFlow タブ専用の右サイドバー (進捗 + タグ)        |
| `frontend/src/components/Tasks/Schedule/DayFlow/CompactDateNav.tsx`                                | 日付ナビ                                            |
| `frontend/src/components/Tasks/Schedule/DayFlow/TimeGridClickMenu.tsx` / `TimeGridContextMenu.tsx` | 時間軸クリック / 右クリックメニュー                 |
| `frontend/src/components/Tasks/Schedule/DayFlow/RoutineDeleteConfirmDialog.tsx`                    | ルーチン削除確認                                    |
| `frontend/src/components/Tasks/Schedule/DayFlow/InlineMemoInput.tsx`                               | インラインメモ入力                                  |
| `frontend/src/components/Tasks/Schedule/DayFlow/dayFlowFilters.ts`                                 | フィルタ計算 (純粋関数)                             |

### Tasks / Events タブ

| ファイル                                                                                 | 役割                        |
| ---------------------------------------------------------------------------------------- | --------------------------- |
| `frontend/src/components/ScheduleList/ScheduleTasksContent.tsx`                          | 期限つきタスク一覧          |
| `frontend/src/components/ScheduleList/ScheduleEventsContent.tsx`                         | 予定一覧                    |
| `frontend/src/components/ScheduleList/EventList.tsx`                                     | 予定リスト                  |
| `frontend/src/components/ScheduleList/EventDetailPanel.tsx`                              | 予定詳細パネル              |
| `frontend/src/components/ScheduleList/EventQuickCreatePopover.tsx`                       | 予定の速攻作成              |
| `frontend/src/components/ScheduleList/ScheduleItemEditPopup.tsx`                         | 予定の編集ポップアップ      |
| `frontend/src/components/ScheduleList/MiniTodayFlow.tsx`                                 | 今日の DayFlow ミニ表示     |
| `frontend/src/components/ScheduleList/CalendarTagsPanel.tsx` / `CalendarTagSelector.tsx` | カレンダータグの管理 / 選択 |

## C. ルーチン管理 UI

| ファイル                                                                                                | 役割                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `frontend/src/components/Tasks/Schedule/Routine/RoutineManagementOverlay.tsx`                           | ルーチン管理画面 (オーバーレイ) |
| `frontend/src/components/Tasks/Schedule/Routine/RoutineEditDialog.tsx`                                  | ルーチン編集ダイアログ          |
| `frontend/src/components/Tasks/Schedule/Routine/RoutineGroupEditDialog.tsx`                             | ルーチングループ編集            |
| `frontend/src/components/Tasks/Schedule/Routine/AchievementPanel.tsx` / `AchievementDetailsOverlay.tsx` | 達成率パネル                    |
| `frontend/src/components/Tasks/Schedule/Routine/FrequencySelector.tsx`                                  | 頻度選択 UI                     |
| `frontend/src/components/Tasks/Schedule/Routine/MiniRoutineFlow.tsx`                                    | ミニルーチンフロー              |

## D. Schedule 共有 UI (Calendar / DayFlow / Routine から複数参照)

| ファイル                                                                    | 役割                       |
| --------------------------------------------------------------------------- | -------------------------- |
| `frontend/src/components/Tasks/Schedule/shared/BasePreviewPopup.tsx`        | 共有プレビューポップアップ |
| `frontend/src/components/Tasks/Schedule/shared/DateTimeRangePicker.tsx`     | 日時範囲ピッカー           |
| `frontend/src/components/Tasks/Schedule/shared/ProgressSection.tsx`         | 進捗バー                   |
| `frontend/src/components/Tasks/Schedule/shared/RoleSwitcher.tsx`            | ロール切替                 |
| `frontend/src/components/Tasks/Schedule/shared/RoutineTimeChangeDialog.tsx` | ルーチン時間変更ダイアログ |
| `frontend/src/components/Tasks/Schedule/shared/TimeGridTaskBlock.tsx`       | タイムグリッド用ブロック   |
| `frontend/src/components/Tasks/Schedule/shared/usePreviewTimeEdit.ts`       | プレビュー上の時間編集     |

## E. 状態管理 (Context / Provider) — Schedule 3 分割

| Context                | 値定義                                              | Provider                                                              |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| `RoutineContext`       | `frontend/src/context/RoutineContextValue.ts`       | `frontend/src/context/RoutineContext.tsx`                             |
| `ScheduleItemsContext` | `frontend/src/context/ScheduleItemsContextValue.ts` | `frontend/src/context/ScheduleItemsContext.tsx`                       |
| `CalendarTagsContext`  | `frontend/src/context/CalendarTagsContextValue.ts`  | `frontend/src/context/CalendarTagsContext.tsx` (Mobile では Optional) |
| `CalendarContext`      | `frontend/src/context/CalendarContextValue.ts`      | `frontend/src/context/CalendarContext.tsx`                            |

Provider mount: `frontend/src/providers/DesktopProviders.tsx` / `MobileProviders.tsx`。

> ⚠️ Mobile では `CalendarTagsProvider` が省略。共有コンポーネントは `useCalendarTagsContextOptional()` を使い `null` を許容する設計 (CLAUDE.md §6.3)。

## F. Hooks (Schedule 系)

| Hook                                                                          | パス                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `useScheduleContext`                                                          | `frontend/src/hooks/useScheduleContext.ts` (旧 API ファサード)                                            |
| `useScheduleItems` / `useScheduleItemsContext`                                | `frontend/src/hooks/useScheduleItems.ts` / `useScheduleItemsContext.ts`                                   |
| `useScheduleItemsCore`                                                        | `frontend/src/hooks/useScheduleItemsCore.ts` (CRUD)                                                       |
| `useScheduleItemsEvents`                                                      | `frontend/src/hooks/useScheduleItemsEvents.ts` (イベントだけ抽出)                                         |
| `useScheduleItemsRoutineSync`                                                 | `frontend/src/hooks/useScheduleItemsRoutineSync.ts` (ルーチン展開)                                        |
| `useScheduleItemsStats`                                                       | `frontend/src/hooks/useScheduleItemsStats.ts`                                                             |
| `useRoutineContext` / `useRoutines`                                           | `frontend/src/hooks/useRoutineContext.ts` / `useRoutines.ts`                                              |
| `useRoutineGroups` / `useRoutineGroupAssignments` / `useRoutineGroupComputed` | `frontend/src/hooks/useRoutineGroups.ts` / `useRoutineGroupAssignments.ts` / `useRoutineGroupComputed.ts` |
| `useCalendarTagsContext(Optional)`                                            | `frontend/src/hooks/useCalendarTagsContext.ts` / `useCalendarTagsContextOptional.ts`                      |
| `useCalendarTags` / `useCalendarTagAssignments` / `useCalendarTagFilter`      | `frontend/src/hooks/useCalendarTags.ts` / `useCalendarTagAssignments.ts` / `useCalendarTagFilter.ts`      |
| `useCalendar` / `useCalendars`                                                | `frontend/src/hooks/useCalendar.ts` / `useCalendars.ts`                                                   |
| `useCalendarTypeOrder`                                                        | `frontend/src/hooks/useCalendarTypeOrder.ts`                                                              |
| `useDayFlowColumn`                                                            | `frontend/src/hooks/useDayFlowColumn.ts`                                                                  |
| `useDayFlowFilters` / `useDayFlowDialogs`                                     | `frontend/src/components/Tasks/Schedule/DayFlow/useDayFlowFilters.ts` / `useDayFlowDialogs.ts`            |

## G. データ層 / バックエンド

| 役割                         | パス                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| DataService インターフェース | `frontend/src/services/DataService.ts`                                                                                     |
| Tauri 実装                   | `frontend/src/services/TauriDataService.ts`                                                                                |
| Rust コマンド (予定)         | `src-tauri/src/commands/schedule_item_commands.rs`                                                                         |
| Rust コマンド (ルーチン)     | `src-tauri/src/commands/routine_commands.rs` / `routine_group_commands.rs` / `routine_group_assignment_commands.rs`        |
| Rust コマンド (カレンダー)   | `src-tauri/src/commands/calendar_commands.rs` / `calendar_tag_commands.rs`                                                 |
| 型                           | `frontend/src/types/schedule.ts` / `routine.ts` / `routineGroup.ts` / `calendar.ts` / `calendarTag.ts` / `calendarItem.ts` |
| 同期定数                     | `src-tauri/src/sync/sync_engine.rs` の `VERSIONED_TABLES` / `RELATION_TABLES_WITH_UPDATED_AT`                              |

## H. 主要関数 / メソッド

- `ScheduleSection.tsx::ScheduleSection` — 4 タブの親、`scheduleTab` state、`showRoutineManagement`、DayFlow の dual column 切替を保持
- `ScheduleItemsContext.tsx::ScheduleItemsProvider` — `useScheduleItemsCore` + `useScheduleItemsEvents` + `useScheduleItemsRoutineSync` を合体させて Provider 値を作る
- `useScheduleItemsCore.ts::useScheduleItemsCore` — `schedule_items` の CRUD (loadAll / create / update / delete / toggleComplete)
- `useScheduleItemsRoutineSync.ts::useScheduleItemsRoutineSync` — ルーチン定義から指定日の `schedule_items` を生成・反映
- `RoutineContext.tsx::RoutineProvider` — `useRoutines` + `useRoutineGroups` + `useRoutineGroupAssignments` + `useRoutineGroupComputed` を結合
- `useRoutineGroupComputed.ts::useRoutineGroupComputed` — `frequencyType="group"` ルーチンを `routine_group_assignments` 経由で展開 (V69 で導入)
- `CalendarTagsContext.tsx::CalendarTagsProvider` — `useCalendarTags` + `useCalendarTagAssignments` + `useCalendarTagFilter` を結合
- `useCalendar.ts::useCalendar` — 月/週ナビゲーション state、表示範囲の日付生成
- `OneDaySchedule.tsx::OneDaySchedule` — DayFlow タブ本体
- `ScheduleTimeGrid.tsx::ScheduleTimeGrid` — 時間軸の描画、空き場所クリック、DnD ハンドリング
- `scheduleTimeGridLayout.ts::layoutScheduleItems` — 重なるブロックの列割り当て計算 (純粋関数、テスト済み)
- `useScheduleContext.ts::useScheduleContext` — 後方互換ファサード (新規コードは個別 hook 直接利用、§6.5)

## I. 副作用 / 注意点

- **`ScheduleItemsProvider` は DayFlow / Calendar / Events 全タブで共有**。`schedule_items` の load を変えると 3 タブ全部に波及
- **ルーチン → ScheduleItems の生成は `useScheduleItemsRoutineSync` が一手**。ルーチン側のデータ形を変えると DayFlow に出るブロックの並び順や色も変わる。V69 で導入された `routine_group_assignments` 経由も忘れずに
- **Cloud Sync 対象**: `schedule_items` / `routines` / `routine_groups` は `VERSIONED_TABLES`。`routine_group_assignments` と `calendar_tag_assignments` は inline 個別ハンドリング (soft-delete-aware delta query)。スキーマ変更時は `sync_engine.rs` の定数と Cloud D1 マイグレーションも同時更新が必要
- **Mobile では `CalendarTagsContext` 省略**。共有コンポーネントは `useCalendarTagsContextOptional` で `null` ガード
- **`useScheduleContext` は後方互換ファサード**。中で 3 つの個別 hook を再合成しているので、いずれかのシグネチャを変えると壊れる
- **Web 移行**: `TauriDataService.ts` 経由の IPC 部分は Phase 5 で書き換え予定。Rust 側に深い変更を入れるなら `2026-05-04-cross-platform-migration.md` と整合を取る
