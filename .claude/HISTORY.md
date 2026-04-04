# HISTORY.md - 変更履歴

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

### 2026-04-04 - Routine編集時のCalendar race condition修正

#### 概要

Routine/Group頻度編集後にCalendarビューで間違った曜日にアイテムが表示されるバグを修正。`scheduleItemsVersion`をCalendarView useEffect依存に追加した前回変更がrace conditionの原因だった。

#### 変更点

- **Race condition修正**: CalendarViewのuseEffectから`scheduleItemsVersion`依存を削除。`cleanupNonMatchingScheduleItems`が直接`setMonthlyScheduleItems`でstateを更新するためDBリロードは不要
- **Cleanup直列化**: Group編集時の各メンバーroutineのcleanupを`for...await`で直列実行に変更（並列実行による早期bumpVersionでDB未削除アイテムが復活する問題を解消）
- **明示的リロード**: Routine/Group両方の編集ハンドラで、全cleanup完了後に`loadScheduleItemsForMonth(year, month)`を1回だけ呼ぶように変更

### 2026-04-04 - Role変換機能（CalendarアイテムのTask/Event/Note/Daily相互変換）

#### 概要

CalendarビューのPreviewPopup内にRoleSwitcherコンポーネントを追加し、Task/Event/Note/Dailyの4つのrole間で相互変換（12パス）を可能にした。変換時はタイトル・日時・コンテンツを適切に引き継ぎ、既存Dailyがある日付への変換はエラーで防止。

#### 変更点

- **useRoleConversion hook**: 12パスの変換ロジック（canConvert/convert）。TaskTreeContext, ScheduleContext, MemoContext, NoteContext, ToastContextを統合
- **roleConversionContent utility**: TipTap JSONとプレーンテキスト間の変換ユーティリティ（wrapTextAsTipTap, mergeContentWithMemo, extractPlainText）
- **RoleSwitcher component**: ドロップダウン型role切り替えUI。各roleにアイコン+名称表示、disabled状態・チェックマーク対応
- **TaskPreviewPopup**: ステータスバッジをRoleSwitcherに置き換え（onConvertRole prop追加）
- **MemoPreviewPopup**: 静的バッジをRoleSwitcherに置き換え。date/memoNode/noteNode propsを追加しentity参照を保持
- **ScheduleItemPreviewPopup**: Event時のみRoleSwitcher表示（Routineは従来の静的バッジ維持）
- **CalendarView**: useRoleConversion接続、memoPreview stateにentity参照追加、3つのPopupへconversion props接続、getDisabledRolesヘルパー追加
- **i18n**: calendar.roleTask/roleEvent/roleNote/roleDaily/conversionSuccessをen.json/ja.jsonに追加
