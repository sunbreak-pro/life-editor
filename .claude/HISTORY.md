# HISTORY.md - 変更履歴

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

### 2026-04-04 - Noir テーマ削除 + カレンダーUI改善 + ボタンUI統一 + 祝日アイテム

#### 概要

Noirテーマ（monochrome/monochrome-dark）を完全削除。カレンダーDayCellの土日・祝日表現を背景色からテキスト色のみに変更。ルーティン編集後のカレンダー自動リフレッシュ修正。ダイアログのCancel/Saveボタン統一。祝日名をCalendarItemとして生成しトグル表示機能追加。

#### 変更点

- **Noir テーマ削除**: ThemeContextValue型、ThemeContext VALID_THEMES、index.css CSS変数ブロック2つ、AppearanceSettings Noirボタン2つを削除。既存ユーザーはlightにフォールバック
- **カレンダー色テキストのみ化**: `getDateBgClass`を空返却に変更、`getDateTextClass`に`isCurrentMonth`パラメータ追加。当月: 緑/赤/青、非当月: グレーベースの薄い色味で区別
- **ルーティン編集リフレッシュ**: CalendarViewのuseEffectに`scheduleItemsVersion`依存追加。RoutineGroupEditDialogのonSubmitに頻度変更検知+cleanupNonMatchingScheduleItems呼び出し追加
- **ボタンUI統一**: `bg-notion-blue`（未定義色）→`bg-notion-accent`。Cancelボタンを`text-notion-danger`に。RoutineEditDialog, RoutineGroupEditDialog, NewNoteTab対象
- **祝日アイテム**: CalendarItemTypeに`"holiday"`追加。`getHolidayName`関数追加（holiday-jp between API）。useCalendarで42日グリッド内の祝日をCalendarItemとして生成。CalendarItemChipにholidayレンダリング追加（Sparklesアイコン）。CalendarHeaderに祝日トグルボタン追加、localStorage永続化

### 2026-04-04 - Events表示対応 + サイドバーフィルタ マルチセレクト化

#### 概要

MiniTodayFlow（右サイドバー）にEventsアイテムを表示。右サイドバーのフィルタを排他的ラジオからマルチセレクトチェックボックスに変更。フィルタ選択をMiniTodayFlowに反映。

#### 変更点

- **MiniTodayFlow Events表示**: FlowEntryに`"event"`型追加。`routineId === null`のscheduleItemsをeventとして表示（CalendarClockアイコン、紫色）。完了トグル対応
- **フィルタ マルチセレクト化**: ProgressSectionをチェックボックスUIに変更（`activeFilters: Set` / `onToggleFilter`）。DayFlowSidebarContent、ScheduleSection、OneDaySchedule、useCalendar、CalendarViewを全てSetベースに変更。空Set=全表示
- **フィルタMiniTodayFlow連携**: ScheduleSidebarContentに`activeFilters` prop追加。MiniTodayFlowが`showRoutines`/`showEvents`/`showTasks`でentries構築をフィルタリング
- **CompactDateNav互換**: OneDayScheduleに`onSetExclusiveFilter`追加。DayFlow本体のインラインフィルタは排他的UIを維持しつつSetベースstateと連携
