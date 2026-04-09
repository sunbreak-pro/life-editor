# HISTORY.md - 変更履歴

### 2026-04-09 - Settings拡充 — デフォルト動作・リマインダー・タスク管理・システム連携

#### 概要

他のタスク管理アプリと比較して不足していた設定項目を4カテゴリ（デフォルト動作、リマインダー、タスク管理、システム連携）にわたって追加。DB基盤からElectron Main Process、フロントエンドSettings UIまでフルスタック実装。

#### 変更点

- **DBマイグレーションV52-V53**: `tasks.priority`カラム（INTEGER, P1-P4）追加+インデックス、`app_settings`テーブル（key-value）新規作成
- **P1-P4優先度システム**: `PriorityBadge`/`PriorityPicker`共有コンポーネント、TaskTreeNode・TaskDetailPanel・TaskDetailHeaderに統合、`sortTaskNodes.ts`にpriorityソートモード追加、SortDropdownに反映
- **起動時画面設定**: `App.tsx`のinitial sectionをlocalStorage (`STARTUP_SCREEN`) から読み取り。5セクション選択可
- **デフォルトタスクフォルダ**: `useTaskTreeCRUD.ts`の`addNode()`でparentId未指定時にデフォルトフォルダ適用
- **完了タスク自動アーカイブ**: `AutoArchiveService`（Main Process、6時間間隔）。app_settings `auto_archive_days` に基づきソフトデリート
- **親タスク自動完了**: `applyStatusChange`内で全子タスクDONE検出→親フォルダ自動完了（最大10階層、localStorage設定ON時のみ）
- **完了タスク表示切替**: localStorage `HIDE_COMPLETED_TASKS` トグル
- **リマインダーサービス**: `ReminderService`（Main Process、60秒間隔）。scheduledAt基準でOS通知+renderer `reminder:notify`イベント送信。デイリーレビュー通知対応
- **アプリ内リマインダー通知**: `useReminderListener.ts`フック→ToastContext経由で表示。`electron.d.ts`に`onReminder`型追加
- **システムトレイ**: `electron/tray.ts` — macOSテンプレートアイコン、コンテキストメニュー(Show/Hide/Quit)、`tray.setTitle()`でタイマー残時間表示
- **グローバルショートカット**: `electron/globalShortcuts.ts` — `CmdOrCtrl+Shift+Space`(タイマー切替)、`CmdOrCtrl+Shift+A`(クイック追加)。`menu:action`イベント連携
- **自動起動/最小化起動**: `app.setLoginItemSettings()` + `start_minimized`設定。main.tsで`win.hide()`制御
- **IPC 16チャンネル追加**: settings:get/set/getAll/remove、system:get/set×4(autoLaunch/startMinimized/trayEnabled/globalShortcuts)、tray:updateTimer、reminder:get/setSettings。preload.ts ALLOWED_CHANNELS + onReminderリスナー追加
- **DataService全実装更新**: インターフェース16メソッド追加、ElectronDataService実装、OfflineDataService/RestDataServiceスタブ、mockDataServiceモック
- **Settings UI**: `BehaviorSettings.tsx`（5設定）、`SystemSettings.tsx`（4設定+グローバルショートカット表示）、`ReminderSettings.tsx`（タスクリマインダー+デイリーレビュー）。Settings.txsにbehaviors/systemサブタブ追加、settingsSearchRegistryに2エントリ追加
- **i18n**: settings.behaviors/system（18キー）、reminders（12キー）、priority（6キー）、taskTree.sortPriority をen.json/ja.jsonに追加
- **TimerContext**: タイマーtick時に`tray:updateTimer` IPC送信でトレイ表示連動

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

<!-- older entries archived to HISTORY-archive.md -->
