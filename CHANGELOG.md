# Sonic Flow - Changelog

完了済み機能・タスクの履歴。

---

## ルーティンUI/UXリデザイン (2026-02-15)

- **時間帯タブバー**: 朝/昼/夜の3タブによるフィルタリング表示、カスタム時間帯設定（localStorage）
- **ルーティンセット（横方向ステッパー）**: 旧Habit StackカードをステッパーUIに置換、完了/次/未着手の3状態、矢印コネクター、「次を開始」ボタン
- **単体ルーティン表示**: セット未所属ルーティンのコンパクトリスト表示
- **ルーティン作成ダイアログ改修**: セット選択ドロップダウン追加、anytime除去
- **anytimeマイグレーション**: フロントエンドで`anytime`→`morning`フォールバック（DB変更なし）
- **新規コンポーネント**: `TimeSlotSettingsDialog.tsx`, `RoutineSetStepper.tsx`, `routineTimeSlotConfig.ts`
- **削除**: `RoutineStackCard.tsx`
- **i18n**: en/jaに10+新規翻訳キー追加

## ルーティンUXUX大幅強化 (2026-02-15)

- **独立セクション昇格**: Routine をMemoViewタブからSidebar独立セクションに移行
- **時間帯カテゴリ**: `timeSlot` (morning/afternoon/evening/anytime) によるグループ化表示
- **週N回スケジューリング**: `frequencyType: "timesPerWeek"` + `timesPerWeek` フィールド追加
- **Grace Period ストリーク**: Don't Miss Twice ルール（1日ミスは許容、2連続でストリーク切れ）
- **At-Risk 警告**: ストリーク切れ寸前のルーティンに視覚的警告表示
- **Habit Stacking**: routine_stacks / routine_stack_items テーブル新規追加、Stack CRUD全実装
- **進捗ダッシュボード**: 12週GitHubスタイルヒートマップ、週次達成率バーチャート、ストリーク記録テーブル、マイルストーンバッジ
- **マイクロインタラクション**: チェック完了リップルアニメーション(CSS)、マイルストーントースト通知(7/30/100/365日)
- **タイマー連携**: RoutineItemCard に▶ボタン追加、RoutineStackCard に「次を開始」ボタン、TimerContext に `startRoutineTimer` / `activeRoutineId` 追加
- **DB**: V16マイグレーション（3 ALTER TABLE + 2 CREATE TABLE）
- **IPC**: 7 routineStack チャンネル追加（fetchAll/create/update/delete/addItem/removeItem/reorderItems）
- **i18n**: en/ja に30+新規キー追加
- **新規コンポーネント**: RoutineSection, RoutineItemCard, RoutineCreateDialog, RoutineHeatmap, RoutineStatsPanel, RoutineStackCard, RoutineStackDialog, MilestoneToast

---

## Music Library (Playlist) 機能追加 (2026-02-14)

- **プレイリスト管理**: Music画面にPlaylistsタブ追加、プレイリストの作成・名前変更・削除
- **トラック管理**: DnDでの並び替え、SoundPickerModalからサウンド追加、トラック削除
- **シーケンシャル再生エンジン**: 1曲ずつ順番に再生、曲終了時に次曲自動遷移
- **フルコントロール**: 再生/停止、次/前スキップ、シークバー、シャッフル、リピート（off/one/all）、ボリューム
- **ミキサーとの排他制御**: AudioModeSwitch（Mixer/Playlist切替タブ）をWorkScreenに配置
- **DB**: V15マイグレーション（playlists, playlist_items テーブル）、9 IPCチャンネル追加
- **フック**: usePlaylistData、usePlaylistEngine、usePlaylistPlayer
- **UI**: AudioModeSwitch、PlaylistPlayerBar、PlaylistManager、PlaylistDetail

---

## Calendar Split: Tasks / Memo 切り替え + Routine 日付フィルタ (2026-02-14)

- **カレンダーモード切替**: CalendarSidebarにTasks/Memoタブ追加、localStorageで永続化
- **Memoモード**: 月表示固定、タスクフィルター非表示、DayCellにDaily memo（黄色チップ）+ Notes（青チップ）+ Routine達成状況を統合表示
- **Tasksモード**: 既存動作を完全維持（フォルダフィルター、タスク作成、incomplete/completedフィルター、Week/3day切替）
- **Routine createdAtフィルタ**: `isDayApplicable`にcreatedAt以前の除外ロジック追加、ストリーク計算でも作成日以前に遡らない
- **ノート表示**: NoteNodeのcreatedAtで日付マッピング、クリック→MemoセクションのNotesタブに遷移

---

## Code Signing 設定 (2026-02-14)

- **macOS Notarization**: `@electron/notarize` + `scripts/notarize.js`（afterSign hook）、`build/entitlements.mac.plist`（JIT/unsigned memory/dyld entitlements）、`hardenedRuntime: true`
- **Windows 署名**: `signingHashAlgorithms: [sha256]`、`WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` 環境変数対応
- **CI/CD**: `build.yml` に署名環境変数追加、`create-release` ジョブ新設（ドラフト GitHub Release 自動作成）
- **ローカルビルド対応**: 環境変数未設定時は notarization をスキップ

---

## Music画面リデザイン + WorkScreen同期バグ修正 (2026-02-12)

- **バグ修正**: MusicScreenとAudioProviderが別々のuseWorkscreenSelectionsインスタンスを持ち、MusicScreenでのWork/Rest選択がWorkScreenに反映されない問題を解消
- **状態一元化**: AudioProviderのuseWorkscreenSelectionsを唯一のソースとし、toggleWorkscreenSelection/isWorkscreenSelectedをAudioContextValue/AudioControlContextValue/AudioStateContextValue経由で公開
- **MusicScreen全面改修**: フラットなサウンドリスト → Work/Restタブ切替 + 6スロットUIにリデザイン
- **新規コンポーネント**: EmptySlot.tsx（dashed border空スロット）、MusicSlotItem.tsx（ボリューム/トグル/シーク/削除コントロール付きスロット）、SoundPickerModal.tsx（検索・タグフィルタ・カスタムサウンド追加対応のサウンド選択モーダル）
- **タブ切替ロジック**: activeTabに応じてworkMixer/restMixer、toggleWorkSound/toggleRestSound、setWorkVolume/setRestVolumeを自動切替
- **MusicSoundItem props変更**: wsSelections prop → toggleWorkscreenSelection/isWorkscreenSelected個別props

---

## Task/Noteタグ削除 + Musicタグ管理UI追加 (2026-02-12)

- **DBマイグレーションV9**: task_tags, task_tag_definitions, note_tags, note_tag_definitions テーブル削除
- **Backend削除**: tagRepository.ts, tagHandlers.ts 削除、registerAll.ts/preload.ts/types.ts/dataIOHandlers.ts からtask/noteタグ関連コード除去
- **Frontend削除**: TagContext, useTagContext, useTags, TagEditor, TagBadge, TagFilter, TagManager, NoteTagBar 削除。TaskTree/TaskTreeNode/TaskDetailHeader/CalendarTaskItem/NoteList/NotesView/Settings/DataService/ElectronDataService からタグ参照除去
- **Sound Tag管理UI追加**: SoundTagManager.tsx新規作成（インライン名前編集・色変更・削除確認・新規作成）、MusicScreenにSettings2トグルボタン追加

---

## 6件UIUX改善・バグ修正 (2026-02-12)

- **Notes永続化修正**: MemoEditorのデバウンス未フラッシュバグ修正（latestContentRef追加、unmount/beforeunloadでフラッシュ）
- **W/Rラベル改善**: W→Work、R→Restに変更（MusicSoundItem、MusicScreenヘッダー）
- **サウンド表示名セーブボタン**: 編集時にチェックマークボタン追加、保存成功時「Saved!」フィードバック、defaultLabelガード削除
- **WORKセッション完了音**: playEffectSound.ts新規作成、TimerContextでWORK完了時に再生、NotificationSettingsに音量スライダー+プレビュー追加
- **Music独立再生ボタン**: AudioContextにmanualPlay state追加、MusicScreenにPlay/Stopトグルボタン追加
- **タスク完了紙吹雪**: canvas-confetti導入、TODO→DONE遷移時に紙吹雪アニメーション表示

---

## フロントエンドコード品質改善 (2026-02-11)

### Phase 1: テスト基盤構築

- MockDataService作成（全60メソッドのvi.fn()モック）
- dataServiceFactory.tsにテストオーバーライド機能追加（setDataServiceForTest/resetDataService）
- renderWithProviders.tsxに全7プロバイダを含むテストヘルパー追加
- ベースラインテスト103件作成: timerReducer(28), TimerContext(9), useTags(10), useCalendar(11), ElectronDataService(16), urlValidation(11), validation(10), duration(3), existing(5)

### Phase 2: セキュリティ修正

- URL検証ユーティリティ追加（urlValidation.ts）: javascript:/data:/file:等を拒否
- BubbleToolbar: リンクURL検証+エラー表示追加
- SlashCommandMenu: window.promptをインラインURL入力に置換
- 入力長制限追加: タグ名50文字、タスクタイトル/ノートタイトル255文字

### Phase 3: Context/Stateリファクタリング

- TimerContext: useState+14useCallback+4ref同期パターン → useReducer移行（timerReducer.ts新規作成）
- useMemos/useNotes/useTags: return値をuseMemoでラップ（Context値安定化）
- AudioContext分割: AudioControlContext（アクション）+AudioStateContext（状態）に分離、後方互換維持
- entityTagsVersionハック削除: useRef<Map>→useState<Map>に変更、5箇所のvoidハック除去

### Phase 4: コンポーネント分割

- App.tsx: 527→172行（useAppCommands, useAppKeyboardShortcuts, useElectronMenuActions, useTaskDetailHandlers抽出）
- TaskTree.tsx: 495→255行（useTaskTreeDnd, useTaskTreeKeyboard抽出）

### Phase 5: パフォーマンス＆パターン統一

- useDebounceフック作成、TaskSelectorの検索に150msデバウンス適用
- logServiceErrorユーティリティ作成、全フックのcatchブロックを統一パターンに置換（8ファイル）

### 新規ファイル

- `frontend/src/test/mockDataService.ts`
- `frontend/src/utils/urlValidation.ts`, `validation.ts`, `logError.ts`
- `frontend/src/context/timerReducer.ts`
- `frontend/src/context/AudioControlContextValue.ts`, `AudioStateContextValue.ts`
- `frontend/src/hooks/useAudioControl.ts`, `useAudioState.ts`, `useDebounce.ts`
- `frontend/src/hooks/useAppCommands.ts`, `useAppKeyboardShortcuts.ts`, `useElectronMenuActions.ts`, `useTaskDetailHandlers.ts`
- `frontend/src/hooks/useTaskTreeDnd.ts`, `useTaskTreeKeyboard.ts`
- テストファイル7件

---

## 5件バグ修正 + WorkScreen UIリデザイン + フェーズ別サウンド選択 (2026-02-11)

- サウンドタグIPC登録失敗を修正: soundRepositoryのV7テーブル参照をtableExists()ガードで保護、テーブル未作成でも他のSoundハンドラが正常動作
- migrateV6のnote_tagsテーブル参照を防御的にガード（テーブル未存在時はスキップ）
- registerAll.tsのエラーログにスタックトレース出力追加、soundRepoを共有化
- ノートデータ消失対策: closeDatabase()にWALチェックポイント追加、noteHandlers全メソッドにエラーログ追加
- フォントサイズ設定が効かない問題を修正: html要素のfontSizeを直接設定し、rem単位のTailwindクラスが自動スケール
- index.cssのbody font-sizeを1remに、memo-editorのfont-sizeをremに変換
- フェーズ別サウンド選択機能追加: Music画面でW/Rボタンでサウンドを各フェーズに割当（最大6つ）、DBマイグレーションV8
- WorkScreenサウンドミキサーをコンパクトリスト表示にリデザイン: SoundListItem（水平レイアウト）、選択済みサウンドのみ表示
- 新規ファイル: useWorkscreenSelections.ts, SoundListItem.tsx
- IPC 2チャンネル追加: fetchWorkscreenSelections, setWorkscreenSelections

---

## WorkScreen 5要件修正 (2026-02-11)

- SessionType型を `'WORK' | 'BREAK' | 'LONG_BREAK'` に統一（frontend/electron間の不整合を修正）
- WorkScreenからサウンド削除ボタンを除去、Music画面のみ削除可能に（確認ダイアログ追加）
- ポモドーロ設定UIを新設（PomodoroSettings）: Work/Break/Long Break/Sessions数を個別設定可能、ドットインジケーター表示
- DurationPickerにpresets/min/max propsを追加して汎用化
- SoundMixerのuseEffect+setState警告を修正（getDerivedStateFromPropsパターンに移行）
- WORK/RESTタブ手動切替で実際のサウンド再生も切り替わるように修正（mixerOverride機構追加）
- シークコントロール追加: SoundCard/MusicSoundItemで再生位置スライダー表示、ドラッグで再生位置変更可能
- useAudioEngineの戻り値にresetAllPlayback/seekSound/channelPositionsを追加

---

## サウンドタグ + Music画面 (2026-02-11)

- サウンドにタグ付け・フィルタリング機能追加（sound_tag_definitions, sound_tag_assignments テーブル）
- サウンド表示名のカスタマイズ機能追加（sound_display_meta テーブル）
- SessionセクションをMusicにリネーム、専用サウンド管理画面を新規作成
- DBマイグレーションV7追加、IPC 9チャンネル追加
- 新規コンポーネント: MusicScreen, MusicSoundItem, SoundTagEditor, SoundTagFilter, useSoundTags
- data export/import対応

---

## タスクタグ・ノートタグ分離 (2026-02-11)

- 統合tagsテーブルを廃止、task_tag_definitions / note_tag_definitions に完全分離
- tagRepository をファクトリパターン（createTagRepository(db, type)）に書換
- IPC チャンネル: db:taskTags:_ / db:noteTags:_ に移行
- TagManager画面を2セクション（タスクタグ/ノートタグ）に分割
- DBマイグレーションV6追加、既存データ自動移行
- 変更ファイル: 20+ファイル（Backend 8, Frontend 12+）

---

## タスク期限（dueDate）機能追加 (2026-02-11)

- タスクにdueDate（期限）フィールド追加、Flagアイコンでトグル
- DateTimePickerを拡張（icon/label/activeColor props）してdueDate設定UIに再利用
- DBマイグレーションV5: tasks テーブルに due_date カラム追加
- 変更ファイル: 8ファイル

---

## タスクヘッダーのインライン名前変更 (2026-02-11)

- TaskDetail画面のタイトル（h1）をクリックでインライン編集可能に
- Enter/Blur保存、Escapeキャンセルのパターン
- バックエンド変更なし、フロントエンドのみ（3ファイル）

---

## ポモドーロタイマー強化 (2026-02-11)

- WORK完了時セッション完了モーダル追加（延長5〜30分/休憩選択/タスク完了）
- WorkScreen上のタスク完了ボタン追加
- REST中サウンド再生対応（Work/Rest別のサウンドミキサー）
- SoundMixerにWork/Restタブ切替UI追加
- DBマイグレーションV4: sound_settingsにsession_categoryカラム追加
- 変更ファイル: 15ファイル（新規1: SessionCompletionModal.tsx）

---

## Tips セクション補完 (2026-02-11)

- ShortcutsTab を 6 カテゴリ/29 件に拡充（Global, Navigation, View, Task Tree, Timer, Calendar）
- MemoTab 新規作成（5 セクション: Daily Memo, Date Navigation, Rich Text Editor, Calendar Integration, Deleting Memos）
- AnalyticsTab 新規作成（3 セクション: Overview Metrics, Completion Rates, Accessing Analytics）
- Tips.tsx に memo/analytics タブ追加（5 タブ → 7 タブ構成）
- TasksTab に Context Menu / Tags / Templates セクション追加、Task Details にショートカット追記
- TimerTab に `r` リセット、`⌘⇧T` モーダル開閉を追記
- CalendarTab に Keyboard Shortcuts セクション追加（j/k/t/m）

---

## Windows 互換性対応 (2026-02-11)

- `utils/platform.ts` 新規作成: `isMac`, `modSymbol`, `modKey` ユーティリティ
- `e.metaKey` → `(e.metaKey || e.ctrlKey)` に変更（App.tsx, Layout.tsx, TaskTree.tsx）
- コマンドパレット・メニューアクションの合成KeyboardEvent → `LayoutHandle` ref経由の直接呼び出しに置換
- ショートカット表示テキストをプラットフォーム判定で分岐（⌘ / Ctrl）
- `LeftSidebar.tsx` のローカル `isMac` を共通ユーティリティに統一

---

## Electron Shell Foundation (Phase 0)

### Electron基盤構築

- **electron/main.ts**: BrowserWindow (1200x800, min 800x600)、nodeIntegration:false + contextIsolation:true + sandbox:true
- **electron/preload.ts**: `contextBridge.exposeInMainWorld('electronAPI', { platform })` プレースホルダー
- **electron/tsconfig.json**: ES2022 + CommonJS出力
- **ルートpackage.json**: `npm run dev`（concurrently: Vite + tsc --watch + Electron）、`npm run build/start/dist`
- **electron-builder.yml**: mac (dmg/zip) + win (nsis) + linux (AppImage) パッケージング設定
- **vite.config.ts**: `base: './'` 追加（file://プロトコル対応）
- Webモード（`cd frontend && npm run dev`）は完全互換維持

---

## Bubble Toolbar + Command Palette

### Floating Bubble Toolbar (Feature A)

- テキスト選択時にNotionスタイルのフローティングツールバーを表示
- Bold / Italic / Strikethrough / Code / Link / Text Color ボタン
- Markdown入力ルール（`**`, `*`, `~~`, `` ` ``）を無効化、キーボードショートカットは維持
- Link挿入・編集・解除のインラインUI
- 10色テキストカラーピッカー（ダーク/ライト両テーマ対応）
- npm追加: `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-link`

### Command Palette (Feature B)

- `⌘K` でコマンドパレット起動
- リアルタイム検索フィルタリング（タイトル + カテゴリ）
- Arrow Up/Down + Enter キーボードナビゲーション
- Navigation / Task / Timer / View の4カテゴリ、計16コマンド
- エディタ内テキスト選択中は TipTap Link に `⌘K` を委譲

---

## コードクリーンアップ & ディレクトリ構造整理 (009)

### Phase 1: ディレクトリ構造整理

- Barrel `index.ts` を5ディレクトリに追加（api, context, hooks, types, utils）
- `ErrorBoundary.tsx` を `components/shared/` へ移動
- `navigation.ts`（1行のみ）を `taskTree.ts` に統合・削除

### Phase 2: Context命名規約統一

- `*ContextValue.ts` 4ファイルをcamelCase→PascalCaseにリネーム

### Phase 3: エラーハンドリング改善

- `.catch(() => {})` サイレントエラー10箇所に `console.warn` 追加
- JSON.parse失敗時のログ3箇所追加

### Phase 4: セキュリティ脆弱性修正

- SlashCommandMenu XSS修正（画像URL検証: http/httpsのみ許可）
- useCustomSounds MIME検証強化（マジックバイトチェック追加）

### Phase 5: バックエンド クラッシュ防止

- H2コンソールをdevプロファイルのみに制限
- TaskService 循環参照防止（visited Setで無限再帰回避）
- TimerController 型キャスト安全化（instanceofパターンマッチング）
- MemoController 日付パース安全化（DateTimeParseException → 400）
- AIService JSON解析をJackson ObjectMapperに置換

### Phase 6: グローバル例外ハンドラー

- `@ControllerAdvice` で統一エラーレスポンス（400/500）

---

## サウンド再生エンジン バグ修正

### AudioEngine 致命的バグ3件修正

- **AudioContext closed状態の未処理修正**: `ensureContext()`で`state === 'closed'`なら新規AudioContextを作成するよう修正（React StrictMode / WorkScreen再マウントで発生）
- **cleanup後のnull化漏れ修正**: `contextRef.current?.close()`後に`null`代入を追加し、closedなContextの再利用を防止
- **play/pause競合修正**: `pauseTimeoutsRef`でフェードアウト用setTimeoutのIDを管理し、play前にpendingなpauseをキャンセル
- **unmount時タイムアウトリーク修正**: cleanup時に全pauseタイムアウトをclearTimeout

---

## Timer/Sound API連携 + キーボードショートカット拡張

### Timer/Sound バックエンドAPI接続 (004残タスク → 001)

- **ddl-auto変更**: `create-drop` → `update` でDB永続化
- **型修正**: `TimerSession.taskId` を `number` → `string | null` に修正
- **localStorage キー追加**: `BREAK_DURATION`, `LONG_BREAK_DURATION`, `SESSIONS_BEFORE_LONG_BREAK`
- **timerClient.ts (新規)**: Timer Settings/Sessions API クライアント（fetch API）
- **soundClient.ts (新規)**: Sound Settings/Presets API クライアント（fetch API）
- **TimerContext バックエンド同期**: 楽観的更新パターン（localStorage即時 → 500msデバウンスPUT）
  - マウント時に `fetchTimerSettings()` → localStorage上書き（フォールバック対応）
  - `break/longBreak/sessionsBeforeLongBreak` をハードコードから `useLocalStorage` に移行
  - セッション記録: `start()` → POST、`pause()/reset()` → PUT（部分完了）、タイマー完了 → PUT（完了）
- **Sound Mixer バックエンド同期**: `useLocalSoundMixer` に同パターン追加
  - マウント時にバックエンドから設定取得
  - `toggleSound`/`setVolume` 時にサウンドタイプ別デバウンスPUT
- **TimerContextValue 拡張**: `breakDurationMinutes`, `longBreakDurationMinutes`, `setBreakDurationMinutes`, `setLongBreakDurationMinutes`, `setSessionsBeforeLongBreak` 追加

### キーボードショートカット拡張 (007 Phase 1-4)

- **Phase 1 セクション切替**: `Cmd+1`〜`Cmd+5` で tasks/session/calendar/analytics/settings に切替
- **Phase 2 タスク操作**: `↑/↓` フォーカス移動、`→/←` フォルダ展開/折りたたみ、`Cmd+Enter` 完了トグル、`Tab/Shift+Tab` インデント/アウトデント
- **Phase 3 タイマー制御**: `r` リセット、`Cmd+Shift+T` モーダル開閉
- **Phase 4 カレンダーナビゲーション**: `j/k` 前後移動、`t` 今日、`m` 月/週切替

### プラン整理

- `006-calendar-enhancement.md` → archive (COMPLETED)
- `008-tips-and-editor-enhancements.md` → archive (COMPLETED)
- Backend テスト修正: TaskNodeDTO コンストラクタに `color` パラメータ追加

---

## Phase 7: Backend再統合 + Calendar & Analytics

### Backend再統合 (004)

- **Task Entity全面改修**: `Long` ID → `String` ID（フロントエンド `"task-xxxx"` 形式に統一）
- **TaskNodeDTO**: record型で `TaskNode` と1:1マッピング
- **TaskRepository**: `findByIsDeletedFalseOrderBySortOrderAsc()`, `findByIsDeletedTrue()` 追加
- **TaskService全面改修**: `getTaskTree()`, `syncTree()`, `softDelete()`, `restore()`, `permanentDelete()` — カスケード操作対応
- **TaskController新API**: `GET /tree`, `GET /deleted`, `PUT /tree` (一括同期), `DELETE /{id}/soft`, `POST /{id}/restore`
- **TimerSession.taskId**: `Long` → `String` 型変更
- **MigrationController**: `POST /api/migrate/tasks` — localStorage一括投入エンドポイント
- **TaskServiceTest**: 新API対応にテスト全面更新

### Frontend API Client & Hooks

- **taskClient.ts**: native fetch による Task API クライアント（CRUD + sync + migration）
- **useTaskTreeAPI hook**: API起動時にfetch → localStorageフォールバック。Optimistic Update + 500msデバウンスのwrite-through同期
- **TaskTreeContext切替**: `useTaskTree` → `useTaskTreeAPI` にデータソース切替（接続ポイント1箇所のみ）
- **useMigration hook**: localStorage→Backend自動マイグレーション（二重実行防止フラグ付き）

### Calendar & Analytics (005)

- **ナビゲーション拡張**: `SectionId` に `'calendar' | 'analytics'` 追加、LeftSidebar にメニュー追加
- **CalendarView**: 月/週表示切替、前後ナビゲーション、Todayボタン
- **MonthlyView**: 6行x7列グリッド、前後月の日付パディング
- **WeeklyView**: 1行x7列シンプル版
- **DayCell**: 今日ハイライト、最大2件表示 + "+N more" 折りたたみ
- **CalendarTaskItem**: タスク名省略表示、完了状態スタイル
- **DateTimePicker**: カスタムコンポーネント（ミニカレンダー + 時/分セレクター + クリアボタン）
- **useCalendar hook**: タスクを日付キーでグループ化、月/週の日付配列生成
- **scheduledAt フィールド**: TaskNode型拡張、新規タスク作成時に自動設定
- **TaskDetailHeader**: DateTimePicker統合
- **フィルタタブ**: incomplete/completed 切替
- **AnalyticsView**: 基本統計（総タスク数、完了数、進行中数、フォルダ数、完了率）

---

## Phase 6: バグ修正 + Noise Mixer音声再生 + ポリッシュ

### バグ修正・技術的負債 (Phase 1)

- **TimerContext stale closure修正**: `advanceSession`の`sessionType`/`completedSessions`/`config`を`useRef`+`useEffect`で保持し、`setInterval`コールバック内のstale値参照を解消
- **TaskNodeContent 300msクリック遅延修正**: `setTimeout`によるシングル/ダブルクリック区別を廃止、ネイティブ`onClick`/`onDoubleClick`に置き換え
- **React lint error全件修正**: `react-hooks/exhaustive-deps`警告、`react-refresh/only-export-components`エラー、`react-hooks/refs`エラーを修正。TypeScript build error（test/setup.ts `beforeEach`未定義）を`tsconfig.app.json`のexcludeで解消
- **バンドルサイズ最適化**: `MemoEditor`（TipTap）を`React.lazy()`+`Suspense`で遅延読み込み化。メインchunk 671KB→298KB（57%削減）

### Noise Mixer 音声再生 (Phase 2)

- **useAudioEngine hook新規作成**: Web Audio API (`AudioContext` + `HTMLAudioElement` + `MediaElementAudioSourceNode` + `GainNode`)をラップ。ループ再生、リアルタイム音量制御、200msフェードイン/アウト
- **SoundMixer接続**: `WorkScreen`で`useAudioEngine(mixer)`を呼び出し、`useLocalSoundMixer`の状態変更を自動反映
- **リソース管理**: アンマウント時の`AudioContext.close()`+全要素解放、タブ非表示時の自動ミュート/復帰
- **sounds定数にfileパス追加**: `SOUND_TYPES`に`file`フィールド追加（`/sounds/*.mp3`）

### ポリッシュ (Phase 3)

- **ブラウザ通知**: タイマーセッション完了時に`Notification API`でデスクトップ通知。Settings画面にトグルUI追加
- **キーボードショートカット**: `Space`（タイマー開始/停止）、`n`（新規タスク）、`Escape`（モーダル閉じ）、`Delete`/`Backspace`（タスク削除）。テキスト入力中は無効化

---

## Phase 5: AI Coaching (Gemini API)

### AI Coaching Backend

- `AIConfig.java` — RestClient Bean + APIキー管理 (`SONICFLOW_AI_API_KEY` 環境変数)
- `AIService.java` — Gemini API通信、日本語プロンプト(breakdown/encouragement/review)
- `AIController.java` — `POST /api/ai/advice` エンドポイント
- `application.properties` — `sonicflow.ai.api-key`, `sonicflow.ai.model` 設定追加

### AI Coaching Frontend

- `types/ai.ts` — AIAdviceRequest/Response 型定義
- `api/aiClient.ts` — native fetch による API通信
- `hooks/useAICoach.ts` — 状態管理フック (advice/loading/error)
- `components/AICoach/` — AICoachPanel, AIRequestButtons, AIAdviceDisplay
- `TaskDetail.tsx` — MemoEditor下部にAICoachPanel統合
- `vite.config.ts` — `/api` プロキシ追加 (→ localhost:8080)

### AI Coach 429エラー修正 & モデル移行

- モデル `gemini-2.0-flash` → `gemini-2.5-flash-lite` に変更（旧モデル廃止対応）
- `AIService.java` — `@PostConstruct migrateDeprecatedModel()` でDB自動マイグレーション
- `AIService.java` — デバッグログ追加（HTTPステータス・モデル名・レスポンスボディ）
- `AIService.java` — `extractGeminiError()` でAPIエラー詳細をユーザーに表示
- `AIService.java` — `buildPrompt()` で taskContent を500文字に制限
- `AIConfig.java`, `AISettings.java`, `application.properties`, `AISettings.tsx` — デフォルトモデル更新

---

## Phase 4: ドキュメント同期 & テスト基盤

### ドキュメント同期 (Plan 001-documentation-sync)

- `Application_Overview.md` — Java 21→23、フラットTask→TaskNodeツリー、Axios→native fetch、localStorage中心アーキテクチャに全面更新
- `ADR 0001` — Java 23、React 19、Vite 7、Tailwind v4、native fetch、TipTap、@dnd-kit追記
- `00-index.md` — Phase実装マトリクス全面更新（タイマー/サウンド/設定 ✅反映、接続状態カラム追加）
- `01-architecture-overview.md` — localStorage中心アーキテクチャに書き換え、Context Provider構成・コンポーネント階層・状態管理パターン更新
- `02-infrastructure.md` — Axiosクライアント削除、useLocalStorage/storageKeys説明追加、レイアウトシステム更新

---

## Phase 3: リファクタリング & 改善

### SubSidebar & WorkScreen 改善 (Plan 003)

- SubSidebar リサイズ対応 (160-400px)
- WorkScreen モーダルオーバーレイモード
- TaskTreeInput の UX 改善

### Subfolder 廃止、Folder 統一型 + 5階層ネスト対応

- `subfolder` タイプを廃止し `folder` に統一
- フォルダの5階層ネスト対応 (`MAX_FOLDER_DEPTH = 5`)
- localStorage の自動マイグレーション

### Frontend リファクタリング (Plan 002)

- Phase 1 バグ修正 (B1-B4): localStorage参照統一、key collision修正
- Phase 2 重複排除 (D1-D4): 定数・ロジック重複の解消
- Phase 3 コンポーネント分割 (E1-E3): TaskTreeNode→5分割、useTaskTree→4分割、SlashCommandMenu→hook+component分割
- Phase 4 パフォーマンス最適化 (E4-E6, B5-B6): useMemo化、localStorage書込みデバウンス、未使用axios削除

---

## Phase 2: UI-First Implementation

### TaskTree - 階層型タスク管理

- フォルダ/サブフォルダ/タスクの3階層構造
- @dnd-kit によるドラッグ&ドロップ並び替え
- ソフトデリート + ゴミ箱機能

### WorkScreen - 統合作業画面

- ポモドーロタイマー + サウンドミキサー統合画面
- オーバーレイモード（タスクPlay起動）+ メインコンテンツモード（Session）

### Noise Mixer (Feature B) - UI

- NoiseMixer コンポーネント
- 音源選択UI (Rain, Thunder, Wind, Ocean, Birds, Fire)
- 音量スライダー (0-100%)

### Focus Timer (Feature C)

- FocusTimer コンポーネント
- WORK/BREAK/LONG_BREAK カウントダウン
- プログレスバー表示
- 開始/停止/リセット機能
- セッション数カウント
- タイマー設定カスタマイズ

### Settings & Theme

- ダークモード/ライトモード対応
- フォントサイズ設定 (S/M/L)
- Settings画面 (外観設定 + ゴミ箱)

---

## Phase 1: Foundation

### Documentation

- プロジェクト仕様書作成 (Application_Overview.md)
- CLAUDE.md 作成 (開発ガイド)
- MEMORY.md 作成 (技術仕様)
- README.md 更新 (開発ジャーナル形式)
- TODO.md 作成
- ADR/0001-tech-stack.md 作成

### Frontend Setup

- Vite + React + TypeScript プロジェクト作成
- Tailwind CSS設定 (Notionスタイルカラー)
- 基本レイアウトコンポーネント (Layout, Sidebar, MainContent)

### Task Management (Feature A)

- TaskList コンポーネント
- TaskItem コンポーネント (インライン編集対応)
- TaskInput コンポーネント (新規タスク追加)
- useTasks フック (CRUD操作)
- タスク追加/編集/削除機能
- ステータス切り替え (TODO/DONE)
- フォーカスモード実装
- 完了タスク折りたたみ表示

### Backend Setup

- Spring Boot プロジェクトのスキャフォールディング
- build.gradle の作成
- CORS設定 (WebMvcConfigurer)
- H2 Database設定
- Task Entity / Repository / Service / Controller (CRUD API)

### Backend - Timer ドメイン

- TimerSettings / TimerSession Entity
- TimerRepository / TimerService / TimerController

### Backend - Sound ドメイン

- SoundSetting / SoundPreset Entity
- SoundRepository / SoundService / SoundController
