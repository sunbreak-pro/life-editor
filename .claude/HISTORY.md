# HISTORY.md - 変更履歴

### 2026-04-08 - Task Status UI + Complete Folder + Event Creation

#### 概要

TaskDetailPanelにステータス表示、EventDetailPanelに完了チェックボックス、フォルダ内タスク完了時のCompleteフォルダ自動管理、EventsタブへのEvent直接作成機能を追加。チェックボックスUIを角丸四角形に統一。

#### 変更点

- **RoundedCheckbox共有コンポーネント**: `frontend/src/components/shared/RoundedCheckbox.tsx` を新規作成。角丸四角形スタイルのチェックボックス（button ベース）
- **TaskDetailPanel ステータス表示**: タイトル行にTaskStatusIconを追加。3段階ステータス切替 + confetti/sound エフェクト対応
- **EventDetailPanel 完了トグル**: タイトル左にRoundedCheckboxを配置。完了時はストライクスルー+opacity低下表示
- **EventList チェックボックス統一**: Lucide Check/CircleアイコンをRoundedCheckboxに置換
- **Completeフォルダ自動管理**: フォルダ内タスク完了時に「Complete」システムフォルダを自動作成し、タスクを移動。未完了に戻すと元フォルダに復帰、空になったCompleteフォルダは自動削除
- **データモデル拡張**: TaskNodeに`folderType`/`originalParentId`追加、DBマイグレーションV50、taskRepository更新
- **Completeフォルダ保護**: リネーム・削除・DnD投入・コンテキストメニュー無効化。FolderCheckアイコンで視覚区別。i18n対応タイトル表示
- **Completeフォルダ表示**: Incompleteタブ・TaskDetailPanelの両方からCompleteフォルダと内容を確認可能。sortTaskNodesで常に最下部に配置
- **Event直接作成**: Eventsタブのタブバー右端に+ボタン追加。EventQuickCreatePopoverでMiniCalendarGrid+TimeSettingsInlineを使用した作成UI
- **i18n**: `taskTree.completeFolder`、`events.createEvent`、`eventDetail.markComplete/markIncomplete` 等を en.json/ja.json に追加

### 2026-04-06 - Schedule Sidebar 検索統一 + Tasks/Events タブ検索追加

#### 概要

Schedule セクションの Calendar RightSidebar にあったカスタム検索入力を共有 `SearchBar` コンポーネントに置換し、全4タブ（Calendar/DayFlow/Tasks/Events）で統一的な検索UIを提供。タブ別プレースホルダーとサジェスションを実装。

#### 変更点

- **ScheduleSidebarContent 検索置換**: カスタムインライン検索（`<Search>` + `<input>` + `<X>`）を削除し、共有 `SearchBar` コンポーネントに置換。`searchPlaceholder`, `searchSuggestions`, `onSearchSuggestionSelect` props を新規追加
- **全タブ検索拡張**: `ScheduleSection` で検索を Calendar 限定から全タブに拡張。`calendarSearchQuery` → `sidebarSearchQuery` にリネーム。タブ切替時に検索クエリクリア
- **タブ別サジェスション**: Calendar/DayFlow はルーティン+イベント、Tasks はスケジュール済みタスク、Events はイベントをサジェスション表示。タイトルマッチングフィルタ付き
- **ScheduleTasksContent 検索対応**: `sidebarSearchQuery` prop追加。内部TaskTree検索と合成
- **ScheduleEventsContent/EventList 検索対応**: `sidebarSearchQuery` → `EventList` へ伝搬。タイトル部分一致フィルタリング追加
- **i18n**: `schedule.searchTasks` / `schedule.searchEvents` を en.json / ja.json に追加

### 2026-04-06 - Calendar IME修正 + Popup タイトル編集 + メモ重複バグ修正

#### 概要

Calendar からのイベント/タスク作成時にIME変換確定のEnterでタイトルが確定されてしまう問題の修正、ScheduleItemPreviewPopup へのタイトル編集機能追加、InlineMemoInput のEnter押下時メモ二重生成バグの修正を実施。

#### 変更点

- **EventCreatePopover IME対応**: `e.nativeEvent.isComposing` チェックを追加。変換確定のEnterではsubmitされなくなった
- **TaskPreviewPopup IME対応**: タイトル編集入力にも `isComposing` チェック追加
- **ScheduleItemPreviewPopup タイトル編集**: `onUpdateTitle` prop + `isEditingTitle`/`titleDraft` state によるインライン編集機能を追加。クリックで編集開始、Enter/blur で確定、Escape でキャンセル。IME composing 対応付き
- **タイトル編集接続**: `CalendarView`（`updateScheduleItem` 経由）、`ScheduleTimeGrid`（`onUpdateScheduleItemTitle` 新prop）、`OneDaySchedule`/`DualDayFlowLayout` の3箇所で接続
- **InlineMemoInput 二重実行バグ修正**: Enter → `handleSave()` + blur → `handleSave()` の二重呼び出しを `savedRef` ガードで防止。IME composing チェックも追加

### 2026-04-06 - Database機能コードレビュー改善（セキュリティ・可読性・i18n）

#### 概要

新規追加されたDatabase機能（Notionライクなテーブルデータベース）のコードをセキュリティ・可読性・コード品質の3観点でレビューし、11件の問題を5ステップで修正。IPC境界バリデーション、日付比較修正、重複コード排除、デッドコード削除、i18n対応を実施。

#### 変更点

- **IPC境界バリデーション（セキュリティ）**: `databaseHandlers.ts` に `validatePropertyFields()` を追加。PropertyType enum・name長（1-255文字）・order（非負整数）・config（オブジェクト|null）を実行時検証。`addProperty`/`updateProperty` の両ハンドラに適用。`noteHandlers.ts` の検索クエリに型・長さ上限（500文字）チェック追加
- **JSON parse ログ出力**: `databaseRepository.ts` の `propRowToProperty` でJSON.parse失敗時に `console.warn` でログ出力（従来は silent ignore）
- **デッドコード削除**: `databaseRepository.ts` の `updateProperty` 内の `stmts.fetchProperties.all("").find(() => false)` — 常にundefinedを返す無意味なコードを削除。`CellEditor.tsx` の `CheckboxEditor` コンポーネントを削除（チェックボックスは `DatabaseTable` の `handleCellClick` で直接トグルされ、CellEditor は描画されないデッドコード）
- **日付フィルタ修正**: `databaseFilter.ts` の `before`/`after` オペレータを文字列比較から `new Date().getTime()` ベースのタイムスタンプ比較に変更。NaN ガード付き
- **getCellValue重複排除**: `databaseCell.ts` に共通ユーティリティとして抽出。`databaseFilter.ts`・`databaseSort.ts`・`useDatabase.ts` の3箇所の同一実装を統合
- **upsertCellレース修正**: `useDatabase.ts` で `data?.cells.find()` が `setData` の外で読まれていた問題を修正。`setData` updater 内で cellId を決定し変数にキャプチャするパターンに変更
- **バレルexport追加**: `Database/index.ts` を新規作成（`DatabaseView`, `DatabaseTable`）
- **i18n対応**: Database機能の全ハードコード英語文字列（約30個）を `en.json`/`ja.json` に移行。`DatabaseView`/`DatabaseTable`/`DatabaseFilterBar`/`DatabaseSortBar`/`AddPropertyPopover`/`CellEditor` の6コンポーネントに `useTranslation()` 適用

### 2026-04-05 - UI/UXレイアウト改善（スクロールバー・幅安定化・コンパクト化）

#### 概要

グローバル thin scrollbar（6px、ホバー時のみ表示）を導入し、`scrollbar-gutter: stable` でスクロールバー出現時のレイアウトシフトを防止。セクションパディングを縮小してコンパクト化し、Work/Analytics/Settings に max-width 制約を追加してワイド画面でのコンテンツ散らばりを防止。

#### 変更点

- **グローバル thin scrollbar**: `index.css` に WebKit 6px scrollbar + Firefox `scrollbar-width: thin` を追加。ホバー時のみ thumb 表示（Notion/VS Code風）。テーマカラー（`--color-border` / `--color-text-secondary`）で自動ダークモード対応
- **scrollbar-gutter: stable**: `MainContent.tsx` と `RightSidebar.tsx` のポータルdivに追加。スクロールバーの出現/消失による ~15px レイアウトシフトを解消
- **パディング縮小**: `layout.ts` の CONTENT_PX を `px-8` → `px-6`、CONTENT_PT を `pt-6` → `pt-4`、CONTENT_PB を `pb-8` → `pb-6` に変更。全セクションが定数参照のため一箇所で反映
- **max-width 定数追加**: `layout.ts` に `CONTENT_MAX_W: "max-w-6xl"` と `CONTENT_NARROW_MAX_W: "max-w-3xl"` を追加
- **セクション max-width 適用**: `WorkScreen.tsx`、`AnalyticsView.tsx`、`Settings.tsx` の内部コンテンツに `max-w-6xl mx-auto w-full` wrapper 追加。Connect/Calendar/DayFlow はフル幅を維持

### 2026-04-05 - RoutineGroup Calendar自動生成 + isVisible表示/非表示 + Group編集メンバー時間設定

#### 概要

新規RoutineGroupがCalendarビューに表示されないバグを修正。CalendarViewにスケジュールアイテム自動生成を追加し、DayFlowを開かなくても表示されるように改善。Routine/RoutineGroupに`isVisible`フラグを追加し表示/非表示を制御可能に。Group編集ダイアログにメンバーRoutineの時間設定UIを追加。

#### 変更点

- **CalendarView自動生成**: `ensureRoutineItemsForDateRange`関数を`useScheduleItems`に追加。CalendarViewに42日グリッド分のアイテム自動生成useEffectを追加。routines/tagAssignments/groupForRoutine変更で再実行
- **isVisible DBカラム**: migration V47で`routines`と`routine_groups`に`is_visible INTEGER NOT NULL DEFAULT 1`を追加
- **isVisible型・Repository**: `RoutineNode.isVisible`と`RoutineGroup.isVisible`をfrontend/electron両方の型定義に追加。routineRepository/routineGroupRepositoryのrowToModel・INSERT・UPDATEに反映
- **isVisible DataService**: DataService interface、ElectronDataService、OfflineDataService、RestDataServiceの全4実装のupdate型に`isVisible`追加
- **スケジュール生成のvisibilityチェック**: `diffRoutineScheduleItems`、`backfillMissedRoutineItems`、`ensureRoutineItemsForWeek`、`ensureRoutineItemsForDateRange`の全4箇所でroutine.isVisibleとgroup.isVisibleをチェック
- **RoutineManagementOverlay表示/非表示UI**: Routine単体とGroupそれぞれにEye/EyeOffトグルボタン追加。非表示時はopacity-40で視覚的に区別。Groupの非表示はメンバーRoutineに優先
- **Group編集ダイアログメンバー一覧**: `RoutineGroupEditDialog`にメンバーRoutine一覧を追加。各RoutineのstartTime/endTimeをTimeInputでインライン編集可能。新規作成時は選択タグから動的プレビュー
- **i18n**: `routineGroup.memberRoutines`、`routineGroup.noTimeSet`をen/jaに追加

<!-- older entries archived to HISTORY-archive.md -->
