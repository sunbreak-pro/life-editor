# HISTORY.md - 変更履歴

### 2026-04-04 - Events完了トグル修正 + timeMemo復活 + EventDetailPanel整理 + TimeGrid Event配置修正 + 統合ScheduleCreatePanel

#### 概要

Eventsタブのチェックボックスが反応しないバグ修正、CalendarView/DetailPanelからのtimeMemo入力復活、EventDetailPanelのRichEditor廃止+compact memo化、ScheduleTimeGridでEventがRoutineGroupの中に入る配置バグ修正、TimeGrid右クリックメニューをTask/Event/Routineの3タブ統合パネルに刷新。

#### 変更点

- **Events完了トグル修正**: `useScheduleItems.ts`の`toggleComplete`に`setEvents`更新を3箇所（primary/undo/redo）追加。`events`stateが更新されずUIに反映されなかった問題を修正
- **EventDetailPanel RichEditor廃止**: `MemoEditor`(TipTap)、`Suspense`、`handleContentUpdate`、Content Editorセクションを削除
- **EventDetailPanel memo compact化**: textareaを`StickyNote`アイコン付きコンパクト`<input>`に置換（TaskDetailPanelと統一スタイル）
- **timeMemo CalendarView復活**: `WeeklyTimeGrid`に`onUpdateTimeMemo`prop追加→`TimeGridTaskBlock`に伝播。`CalendarView`からcallback接続
- **ScheduleItemPreviewPopup memo追加**: `onUpdateMemo`propと`StickyNote`付きmemo inputを追加。CalendarViewから`updateScheduleItem`を接続
- **TimeGrid Event配置修正**: `hasRoutineTaskSplit`の条件を「taskのみ」→「grouped routine以外（task+event）」に拡張。EventがGroupFrameと重なる場合も右カラムに配置。右カラム内のtask+eventでカラム分割を再計算
- **TimeGridClickMenu刷新**: Routine/Task/Note → Task/Event/Routineに変更
- **TaskSchedulePanel 3タブ統合**: タブを[Existing/New]→[Task/Event/Routine]に変更。各タブに「既存を選択」チェックボックストグル追加。`EventTab.tsx`（新規/既存イベント）、`RoutineTab.tsx`（既存ルーティン選択/新規作成）を新規作成
- **OneDaySchedule統合**: 個別の`routinePicker`/`notePicker`stateを削除し、`createPopover`に`defaultTab`を追加して統合パネルに一本化

### 2026-04-04 - Calendar RightSidebar/DayFlow改善 + Popup簡素化

#### 概要

RightSidebarのMiniTodayFlowに全アイテムタイプ（Routine/Event/Task）の編集・削除アイコンを追加し、インライン編集ポップアップを新規作成。DayFlowのEvent色を紫に変更、TimeGridの重なりバグ（RoutineGroup二重半分 + Event重なり）を修正。InProgressTasksList削除、MiniTodayFlowアイコン統一、タスク完了トグル、CalendarのTaskPreviewPopup/ScheduleItemPreviewPopupのボタンレイアウト改善。

#### 変更点

- **InProgressTasksList削除**: `InProgressTasksList.tsx`を削除。`ScheduleSidebarContent.tsx`から参照除去。`useAutoInProgress`は維持
- **Event紫色化**: `index.css`にevent用CSS変数（light/dark）追加。`ScheduleItemBlock.tsx`でEvent背景・ボーダーを紫に変更
- **MiniTodayFlowアイコン統一**: Routine=`Repeat`(emerald)、Task=`CheckSquare`(accent)、Event=`CalendarClock`(purple)にCalendarItemChipと統一
- **MiniTodayFlowにTasks常時表示**: `activeFilters`によるフィルタリングを無視してTasksを常時表示
- **Event/Task編集・削除アイコン**: Event/Taskエントリをgroupパターンにリファクタ。Pencil(編集)+X/CalendarMinus(削除)アイコン追加
- **インライン編集ポップアップ**: `ScheduleItemEditPopup.tsx`新規作成。Routine(title/time/tag)、Event(title/time)、Task(title/time)対応
- **RoutineGroup二重半分バグ修正**: `adjustedItems`後処理でグループ内アイテムのtotalColumnsをグループ内ピアのみで再計算
- **Event重なりバグ修正**: `hasRoutineTaskSplit=true`時、Eventをleft 60%ゾーンに制約する新ブランチ追加
- **タスク完了トグル**: MiniTodayFlowのタスクアイコンクリックで完了/未完了をトグル（タイトルクリックは詳細遷移維持）
- **TaskPreviewPopup簡素化**: Start Timer行+Delete行を削除、「Open Detail」「Clear Schedule」の2ボタン横並びに
- **ScheduleItemPreviewPopup横並び化**: Complete/Edit/Deleteボタンを1行横並びに統合

### 2026-04-04 - Calendar UI改善（MiniTodayFlow + Undo Complete + 検索 + フォルダフィルタ移動）

#### 概要

MiniTodayFlowのRoutineアイテムにクリック完了トグル+ホバーアクションボタン（Edit/Dismiss）を追加。ScheduleItemPreviewPopupの完了戻しラベルを修正。CalendarHeaderからTodayボタン削除・フォルダフィルタをサイドバー最上部に移動。サイドバーにカレンダー検索システムを追加。

#### 変更点

- **MiniTodayFlow Routine修正**: Routineアイテムのクリックで完了トグル。ホバー時にPencil(Edit)とX(Dismiss)ボタン表示。ScheduleSidebarContentにdismissScheduleItem/editRoutineコールバック追加
- **Undo Completeラベル**: ScheduleItemPreviewPopupの完了済みアイテムボタンを"DONE"→"Undo Complete"/"完了を取り消す"に変更。i18n対応
- **CalendarHeader整理**: Todayボタン削除（キーボードショートカット`t`は維持）。フォルダフィルタをCalendarHeaderから除去、未使用import整理
- **フォルダフィルタ移動**: ScheduleSidebarContentにfilterFolderId/onFilterFolderChange props追加。サイドバー最上部に全幅FolderDropdownを配置。Calendar tab時のみ表示
- **カレンダー検索**: ScheduleSection→CalendarView→filteredItemsByDateにsearchQuery伝播。サイドバー最上部に検索入力欄（Searchアイコン+クリアボタン）追加。タイトル部分一致でCalendarItem非表示フィルタリング

### 2026-04-04 - Event First-Class Entity + 全ビューRole切り替え

#### 概要

ScheduleItemにcontentフィールドを追加しEventをリッチコンテンツ対応に拡張。ScheduleセクションにEventsタブ（EventList+EventDetailPanel）を新設。Toast にアクションボタン対応を追加。全ビュー（TaskDetailPanel/NotesView/DailyMemoView/EventDetailPanel）にRoleSwitcherを統合。

#### 変更点

- **DB migration V46**: schedule_itemsテーブルにcontent TEXT DEFAULT NULL追加
- **全層content対応**: ScheduleItem型、Repository（create/update/toggleComplete/bulkCreate）、IPC handlers、DataService、ElectronDataService、OfflineDataService、RestDataService、useScheduleItems hookを更新
- **fetchEvents API**: routine_id IS NULLのScheduleItemを全件取得する新メソッド。Repository→IPC→DataService→Hook全層に追加
- **EventList component**: 日付グルーピング付きフラットリスト。完了/未完了フィルタ。完了チェックボックス+CalendarClockアイコン
- **EventDetailPanel component**: タイトル編集（ダブルクリック）、日付表示、TimeInput時間編集、メモテキストエリア、TipTap MemoEditor、RoleSwitcher、削除ボタン
- **ScheduleEventsContent**: useResizablePanel 2パネルレイアウト（EventList左 + EventDetailPanel右）
- **Events tab**: ScheduleSection ScheduleTab型に"events"追加、SCHEDULE_TABS配列に4番目タブ追加
- **Toast actionButton**: ToastContext showToastにToastOptions（actionLabel/onAction）追加。Toast.tsxにアクションボタンUI追加。アクション付きは5秒表示
- **useRoleNavigation hook**: role別ナビゲーションコールバック（task/event/note/daily）
- **useRoleConversion更新**: convert返り値をConversionResult（success+targetId+targetRole）に変更。content直接コピー対応。actionLabel付きToast表示。bumpEventsVersion呼び出し
- **RoleSwitcher統合**: TaskDetailPanel（TaskRoleSwitcherRow）、NotesView（NoteRoleSwitcher）、DailyMemoView（DailyRoleSwitcher）、EventDetailPanel（EventRoleSwitcherInline）に追加
- **i18n**: tabs.events、events._、eventDetail._、calendar.goToTarget、calendar.searchPlaceholder、schedule.complete/undoCompleteをen.json/ja.jsonに追加

### 2026-04-04 - Routine schedule reconciliation リファクタリング

#### 概要

Routine頻度編集後にCalendarビューで間違った曜日にアイテムが表示されるバグの根本修正。cleanup(削除のみ)をreconcile(削除+作成)に統合し、skipNextSync機構を廃止、3箇所に分散していた編集ハンドラを統一パターンに整理。

#### 変更点

- **reconcileRoutineScheduleItems新設**: `cleanupNonMatchingScheduleItems`を置換。非一致アイテムのDB削除に加え、dateRange内の一致日にアイテムが無ければ新規作成。CalendarViewでは42日グリッド範囲を渡す
- **skipNextSync完全廃止**: `skipNextSyncRef`/`skipNextSync`コールバックを削除。`syncScheduleItemsWithRoutines`はタイトル/時刻のみ更新で冪等のため不要
- **CalendarView統一**: Routine/Group両ハンドラで`await reconcileRoutineScheduleItems` + `await loadScheduleItemsForMonth`パターンに統一
- **OneDaySchedule修正**: Routine編集に`await reconcile` + `await loadItemsForDate`追加。**Group編集にreconcileを追加**（完全に欠落していたバグ修正）
- **RoutineManagementOverlay修正**: `onCleanupNonMatchingScheduleItems`→`onReconcileRoutineScheduleItems`に置換、Group編集のcleanupを`await`に変更、`onSkipNextSync`廃止
- **DualDayFlowLayout修正**: `skipNextSync`参照を除去
