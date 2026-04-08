# HISTORY.md - 変更履歴

### 2026-04-09 - Note/Daily パスワード保護 & 画面ロック機能

#### 概要

NoteとDailyアイテムに個別のパスワード保護機能を追加。パスワード設定済みアイテムはコンテンツがブラー表示になり、正しいパスワード入力で解除（セッションベース、アプリ再起動で再ロック）。UIはヘッダー右端の三点メニュー（⋯）からパスワード設定/変更/解除を操作。

#### 変更点

- **DBマイグレーションV51**: `notes`と`memos`テーブルに`password_hash TEXT DEFAULT NULL`カラム追加
- **パスワードハッシュユーティリティ**: `electron/utils/passwordHash.ts`新規作成。Node.js `crypto` PBKDF2（100k iterations, SHA-256）+ `timingSafeEqual`でタイミング攻撃対策
- **Repository層**: `noteRepository.ts`/`memoRepository.ts`に`setPassword`/`removePassword`/`getPasswordHash`メソッド追加。`rowToNode`で`hasPassword: boolean`マッピング（ハッシュ値はメインプロセスのみ保持）
- **IPC 6チャンネル追加**: `db:notes:setPassword/removePassword/verifyPassword` + `db:memo:setPassword/removePassword/verifyPassword`。パスワード削除時は現パスワード検証必須
- **DataService全4実装更新**: インターフェース6メソッド追加、ElectronDataService実装、OfflineDataService/RestDataServiceスタブ
- **ScreenLockContext（Pattern A）**: `ScreenLockContextValue.ts`/`ScreenLockContext.tsx`/`useScreenLockContext.ts`の3ファイル構成。`Set<string>`でセッション内解除済みID管理
- **PasswordDialogコンポーネント**: set/verify/change/removeの4モード対応。ConfirmDialogパターン準拠のportalモーダル
- **ItemOptionsMenuコンポーネント**: 三点メニュードロップダウン。パスワード有無で表示項目切替（設定/変更+解除）
- **NotesView/DailyMemoView統合**: ヘッダーにロック状態アイコン+⋯メニュー追加。コンテンツ部分にblur-mdオーバーレイ（クリックでパスワード入力ダイアログ表示）
- **i18n**: `screenLock`セクション（18キー）をen.json/ja.jsonに追加

### 2026-04-08 - Daily日記の日付表示i18n対応

#### 概要

MaterialsセクションのDaily(日記)で、headerタイトルとsidebarの日付が日本語設定でも英語で表示されるバグを修正。`dateKey.ts`の3関数にlocaleパラメータを追加。

#### 変更点

- **dateKey.ts**: `formatDateHeading`、`formatDisplayDate`、`formatMonthLabel`に`locale`引数追加。ja時は「2026年4月8日 火曜日」「4月8日」「2026年4月」形式
- **呼び出し元6ファイル更新**: DailyMemoView、DailySidebar、ConnectSidebar、MemoNodeComponent、PaperCanvasView、PaperAddItemDialogで`i18n.language`を渡すよう修正

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

<!-- older entries archived to HISTORY-archive.md -->
