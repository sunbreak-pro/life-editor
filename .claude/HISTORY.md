# HISTORY.md - 変更履歴

### 2026-04-11 - RichEditor & Schedule コード整理リファクタリング

#### 概要

RichEditor（TipTap）と Schedule 関連コードの重複コード除去、共通ユーティリティ抽出、コンポーネント分離を実施。useScheduleItems.ts を1,368行→1,076行に削減（-292行）、全体で約320行の純減。

#### 変更点

- **Phase 1a — timeGridUtils.ts**: `snapTimeFromPosition()` を新規追加。WeeklyTimeGrid.tsx と ScheduleTimeGrid.tsx で重複していた時刻スナップ計算を共通化
- **Phase 1b — prosemirrorHelpers.ts**: `safeDispatch()` を新規追加。BlockContextMenu.tsx の7ハンドラで繰り返されていた try-catch パターンを共通化（5ハンドラを簡素化）
- **Phase 2 — GroupContextMenu.tsx**: ScheduleTimeGrid.tsx（1,309行）内にインライン定義されていた GroupContextMenu（~89行）を独立ファイルに抽出
- **Phase 3 — useScheduleItems リスト操作ヘルパー**: `applyToLists`/`addToLists`/`removeFromLists` を追加。CRUD + undo/redo での `setScheduleItems`/`setMonthlyScheduleItems` ペア呼び出しを統一。`toggleComplete` の3リスト×3箇所のマッパーを `toggleMapper` + `applyToLists` に集約（-116行）
- **Phase 4 — ルーティン同期メソッド統合**: `routineScheduleSync.ts` に `shouldCreateRoutineItem()` と `collectRoutineItemsForDates()` を追加。`backfillMissedRoutineItems`、`ensureRoutineItemsForWeek`、`ensureRoutineItemsForDateRange` の3メソッドの内部ループ（各~30行）を共通関数呼び出しに置換。`diffRoutineScheduleItems` も簡素化（-176行）
- **Phase 5 — usePreviewTimeEdit フック**: TaskPreviewPopup と ScheduleItemPreviewPopup で重複していた時間編集・タイトル編集ロジックを `Schedule/shared/usePreviewTimeEdit.ts` に抽出

### 2026-04-11 - RoutineGroup 複数タグ時のカレンダー表示バグ修正

#### 概要

RoutineGroupに複数タグを割り当てた際、グループのfrequency設定（平日のみ等）が無視され休日にも表示されてしまうバグを修正。表示ロジックで各グループのfrequencyをチェックせずに全グループのバケットにアイテムを追加していたことが原因。

#### 変更点

- **useCalendar.ts**: グループバケット構築ループに`shouldRoutineRunOnDate`によるfrequencyフィルタを追加。当日のfrequencyに合致しないグループへのアイテム追加をスキップ
- **ScheduleTimeGrid.tsx**: `groupFrames`計算で`groups?.[0]`（先頭グループ無条件選択）を`groups?.find()`に変更し、当日のfrequencyに合致するグループのみ選択
- **useCalendar.test.ts**: マルチグループfrequencyフィルタリングテスト2件追加（土曜日にweekdaysグループ非表示 / 月曜日に両グループ表示）

### 2026-04-11 - File Explorer Tab in Materials Section

#### 概要

MaterialsセクションにFinderライクな「Files」タブを追加。PC上の指定フォルダ内のファイルをアプリ内で閲覧・編集・管理でき、Claude MCP経由でのファイル操作も可能。全5フェーズ（基盤+ブラウジング、編集、プレビュー+監視、MCP連携、高度UX）を実装。

#### 変更点

- **Phase 1 — Core Infrastructure**: `electron/services/fileSystemService.ts`新規（サンドボックス化されたfs操作、パストラバーサル防止、MIMEマッピング）。`electron/ipc/fileHandlers.ts`新規（13 IPCチャンネル: selectFolder/getRootPath/listDirectory/getFileInfo/readTextFile/readFile/createDirectory/createFile/writeTextFile/rename/move/delete/openInSystem）。preload.ts ALLOWED_CHANNELS追加、registerAll.ts登録
- **Phase 1 — Frontend**: `frontend/src/types/fileExplorer.ts`（FileEntry/FileInfo型）、DataService/ElectronDataService/OfflineDataService/RestDataService全4実装に13メソッド追加、mockDataServiceモック追加。Context/Provider Pattern A（FileExplorerContextValue.ts/FileExplorerContext.tsx/useFileExplorerContext.ts）、`useFileExplorer.ts`コアhook（ディレクトリ一覧、CRUD、テキスト編集、2秒デバウンスauto-save、パンくず）
- **Phase 1 — UI**: MaterialsView.tsxにFilesタブ追加（FolderOpenアイコン）。FileExplorerSidebar.tsx（ファイルリスト+新規作成ツールバー）、FileExplorerView.tsx（ファイルグリッド+パンくず+リネームダイアログ）。Settings画面にFilesSettings.tsx追加（フォルダパス選択UI、Advanced > Files）
- **Phase 2 — File Editing**: FileEditor.tsx（ファイル種別ルーター: テキスト→monospace textarea+Cmd+S、画像→blob URLプレビュー、音声/動画→HTML5コントロール、非対応→Open in System）。FileEditorToolbar.tsx（ファイル名、未保存インジケータ、サイズ、更新日時、保存/外部アプリ/閉じるボタン）
- **Phase 3 — File Watching**: `electron/services/fileWatcher.ts`新規（fs.watch recursive、150msデバウンス、バッチイベント送信）。main.tsで初期化、preload.tsにonFileChangeリスナー追加、electron.d.tsに型追加、useFileExplorer.tsで変更イベント購読→自動リフレッシュ
- **Phase 4 — MCP Integration**: `mcp-server/src/handlers/fileHandlers.ts`新規（7ツール: list_files/read_file/write_file/create_directory/rename_file/delete_file/search_files、パストラバーサル防止、50MB制限、ファイル名+内容検索）。tools.tsにツール定義+switch cases追加。claudeSetup.tsにFILES_ROOT_PATH環境変数渡し（.claude.json + .mcp.json両方）
- **Phase 5 — Advanced UX**: FileContextMenu.tsx新規（右クリックメニュー: Open/Open in System/Rename/Copy Path/Delete/New File/New Folder、ビューポート調整）。FileExplorerView.tsxにキーボードナビゲーション統合（矢印キー選択、Enter開く、Backspace上の階層、Delete削除、F2リネーム）。ドラッグ&ドロップ（HTML5 DnD APIでファイル移動、ドロップターゲットのビジュアルフィードバック）
- **i18n**: en.json/ja.jsonに`files`セクション（25キー）+ `ideas.files`タブラベル追加

### 2026-04-09 - Routine Calendar — 複数グループ対応 & 頻度クリーンアップ

#### 概要

RoutineGroupが複数タグを持つ場合、Calendarビューでグループチップのカウント・ポップアップが一つのグループのアイテムしか表示しないバグを修正。また、頻度設定に合わない既存スケジュールアイテムを自動クリーンアップするロジックを追加。

#### 変更点

- **useRoutineGroupComputed.ts**: `groupForRoutine`を`Map<string, RoutineGroup>`→`Map<string, RoutineGroup[]>`に変更。1ルーティンが複数グループに属せるように
- **useCalendar.ts**: 各スケジュールアイテムを全マッチグループのバケットに追加。`groupScheduleItems`を`startTime`でソート
- **routineScheduleSync.ts**: グループ頻度チェックを「いずれかのグループが許可すればOK」ロジックに変更
- **useScheduleItems.ts**: 4関数(`ensureRoutineItemsForDate/backfill/ensureWeek/ensureRange`)のパラメータ型・グループチェック更新。`ensureRoutineItemsForDateRange`に頻度不一致アイテムの自動削除ロジック追加
- **消費側5ファイル更新**: `useDayFlowColumn.ts`/`OneDaySchedule.tsx`（フィルタで`.some()`使用）、`ScheduleTimeGrid.tsx`（`groups?.[0]`）、`AchievementDetailsOverlay.tsx`（全グループにカウント加算）、`CalendarView.tsx`（reconcile `groups?.[0]`）

### 2026-04-09 - Note/Daily 編集ロック機能

#### 概要

NoteとDailyアイテムに編集ロック機能を追加。パスワード保護（コンテンツ非表示）とは独立した機能で、ロック時はコンテンツが閲覧可能だが全ての編集操作（タイトル変更、本文編集、タグ追加、ピン切替、カラー変更等）が無効化される。

#### 変更点

- **DBマイグレーションV54**: `notes`と`memos`テーブルに`is_edit_locked INTEGER NOT NULL DEFAULT 0`カラム追加
- **Repository層**: `noteRepository.ts`/`memoRepository.ts`に`toggleEditLock`メソッド追加。`rowToNode`で`isEditLocked: boolean`マッピング
- **IPC 2チャンネル追加**: `db:notes:toggleEditLock`、`db:memo:toggleEditLock`
- **DataService全4実装更新**: インターフェース2メソッド追加、ElectronDataService実装、OfflineDataService/RestDataServiceスタブ
- **ItemOptionsMenu拡張**: セパレータ後に「編集をロック / 編集ロック解除」トグル項目追加。チェックマーク表示。MenuButtonに`trailing` prop追加
- **MemoEditor拡張**: `editable` prop追加。TipTap `useEditor`に`editable`オプション渡し＋`useEffect`で動的切替対応
- **NotesView/DailyMemoView統合**: タイトルinput→`readOnly`、カラーピッカー/ピンボタン→クリック無効+`opacity-50 cursor-not-allowed`、MemoEditor→`editable={!isEditLocked}`、ヘッダーにPenOffアイコン表示
- **i18n**: `screenLock.lockEditing/unlockEditing/editLocked`（3キー）をen.json/ja.jsonに追加

<!-- older entries archived to HISTORY-archive.md -->
