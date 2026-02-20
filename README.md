# Sonic Flow

## 概要

Notionライクなタスク管理に「環境音ミキサー」と「ポモドーロタイマー」を組み合わせた、没入型個人タスク管理アプリケーション。

### 主な機能

- **タスク管理**: 階層型タスクツリー（フォルダ/サブフォルダ/タスク）、ドラッグ&ドロップ並び替え（挿入ライン表示）、並び替え機能（手動/ステータス/スケジュール日）、完了タスク自動ソート、削除確認ダイアログ、カラー継承、ソフトデリート+ゴミ箱
- **タスク左右分割レイアウト**: Tasksセクションは左パネル（TaskTree + ヘッダー）と右パネル（TaskDetailPanel）の2カラム構成、タスク選択で右パネルにリアルタイム詳細表示（タイトル編集、フォルダ移動、カラーピッカー、再生ボタン、作業時間設定、ミニカレンダー、テキストメモ）、未選択時はタスク数サマリー表示
- **グローバルタイマー**: 画面遷移してもタイマーが継続するContextベースのポモドーロタイマー
- **タスク期限管理**: Flagアイコンでdue date設定、DateTimePickerで日時選択
- **集中タイマー**: WORK/BREAK/LONG_BREAK対応、ポモドーロ設定UI（Work/Break/Long Break/Sessions数を個別設定）、ドットインジケーター表示、プログレスバー、WORK完了時モーダル（延長5〜30分/休憩選択/タスク完了）、プリセット機能（保存・一括適用・削除）、休憩自動開始オプション（3秒カウントダウン）、一時停止中±5m時間調整、今日のセッションサマリー表示
- **Work画面**: LeftSidebarの「Work」セクションで常時アクセス可能、3タブ構成（Timer/Pomodoro/Music）。Timerタブにセッション完了・タスク完了ボタン（確認ダイアログ付き）+バックグラウンドサウンドボタン。PomodoroタブにDuration設定・プリセット・自動休憩開始トグル。Musicタブにサウンド管理+プレイリスト管理を統合
- **サイドバータイマー表示**: タイマー実行中はWork項目下にタスク名・残り時間・編集ボタンを表示
- **TaskTreeタイマー表示**: 実行中のタスク行に残り時間テキスト+ミニプログレスバーを表示
- **プレイリスト**: タイマー実行時に選択プレイリストを自動再生、楽曲をシーケンシャル再生（1曲ずつ順番に再生→ループ）、DnD並び替え、シャッフル/リピート（off/one/all）、シークバー、ボリュームコントロール、Timer タブにプレイリストセレクター+プレーヤーバー表示
- **サウンドライブラリ**: 6種の環境音（Rain, Thunder, Wind, Ocean, Birds, Fire）+ カスタムサウンドアップロード、プレビュー再生（ボリューム・シーク付き共有コントロール）、タグ管理・フィルタリング
- **外観設定**: ダークモード/ライトモード切替、フォントサイズ10段階スライダー（12px〜25px）
- **タスク完了演出**: チェックボックスでタスク完了時に紙吹雪アニメーション
- **セッション完了音**: WORKセッション完了時にエフェクト音再生（Settings画面で音量調整可能）
- **デスクトップ通知**: タイマーセッション完了時にブラウザ通知
- **グローバル Undo/Redo**: コマンドパターン + ドメイン別スタックで全セクションの操作を Cmd+Z / Cmd+Shift+Z で元に戻す/やり直し、各セクションヘッダーにボタン配置
- **キーボードショートカット**: Space（タイマー）、n（新規タスク）、Escape（モーダル閉じ）、Cmd/Ctrl+.（左サイドバー開閉）、Cmd/Ctrl+,（Settings遷移）、Cmd/Ctrl+1〜4（セクション切替: Tasks/Work/Analytics/Settings）、↑/↓（タスク移動）、Tab/Shift+Tab（インデント）、r（タイマーリセット）、Cmd/Ctrl+Shift+T（モーダル）、j/k/t/m（カレンダー操作）、Cmd/Ctrl+Z（Undo）、Cmd/Ctrl+Shift+Z（Redo）
- **ゴミ箱**: サイドバーからアクセス可能なトップレベルセクション、削除済みタスク・ノート・カスタムサウンドの復元・完全削除
- **Settings画面**: 右サイドナビ4タブ構成（General/Notifications/Data/Advanced）、外観設定、言語切替、通知設定
- **Tips画面**: ショートカット一覧（6カテゴリ/29件）、タスク/タイマー/カレンダー/メモ/アナリティクス/エディタの操作ガイド（7タブ構成）
- **リッチテキストエディタ**: TipTap拡張（Toggle List/Table/Callout/Image）、スラッシュコマンド対応、テキスト選択時Bubbleツールバー（Bold/Italic/Strikethrough/Code/Link/TextColor）
- **コマンドパレット**: ⌘Kで起動、16コマンド（Navigation/Task/Timer/View）をリアルタイム検索・実行
- **スケジュール（Tasksサブタブ）**: Tasksセクション内にScheduleタブとして統合。3サブタブ構成: Calendar（月/週ビュー）、Dayflow（1日タイムグリッド + Today Flowパネル）、Routine（ルーティンCRUD + テンプレート + 完了率統計）。月/週ビューはタスク日付別表示・フィルタリング・フォルダ別ビュー対応。Tasks/Memoモード切替、MemoモードはDaily memo+Notes を月表示で統合表示
- **タスクツリーフォルダフィルタ**: PROJECTSセクションにドロップダウンフィルター、フォルダ単位で表示絞り込み
- **アナリティクス**: 基本統計（総タスク数、完了率、フォルダ数）、作業時間グラフ（日/週/月別BarChart + タスク別横棒グラフ、Recharts）、総作業時間・セッション数・日平均サマリー
- **データ管理**: SQLite永続化（better-sqlite3）、JSON Export/Import、バックアップ付きインポート、全データリセット（自動バックアップ付き）
- **自由メモ（Notes）**: 日付に縛られないフリーフォームノート、ピン留め、全文検索、ソート切替（更新日/作成日/タイトル）、ソフトデリート対応
- **サウンドタグ**: Music画面でサウンドにカラータグ付与・フィルタリング、タグ管理パネル（名前編集・色変更・削除）
- **テンプレート**: タスクツリー構造をテンプレート保存・展開
- **自動アップデート**: electron-updater + GitHub Releases、ユーザー確認型ダウンロード・インストール
- **構造化ログ**: electron-logによるファイル出力、Settings画面でログ閲覧・フィルタ・エクスポート
- **パフォーマンス監視**: 全IPC応答時間を自動計測、Settings画面でチャネル別メトリクス表示

### 技術スタック

- **Frontend**: React 19 (TypeScript) + Vite + Tailwind CSS v4 + @dnd-kit + TipTap + react-i18next + Recharts
- **Desktop**: Electron 35 + better-sqlite3 + electron-builder

---

## IPC チャンネル

フロントエンドからは `window.electronAPI.invoke(channel, ...args)` 経由でElectronメインプロセスと通信。

| ドメイン  | チャンネル                                                                              | 概要               |
| --------- | --------------------------------------------------------------------------------------- | ------------------ |
| Tasks     | `tasks:getTree` / `tasks:saveTree`                                                      | ツリー一括同期     |
| Tasks     | `tasks:create` / `tasks:update` / `tasks:delete` / `tasks:softDelete` / `tasks:restore` | タスクCRUD         |
| Timer     | `timer:getSettings` / `timer:updateSettings`                                            | タイマー設定       |
| Timer     | `timer:createSession` / `timer:updateSession` / `timer:getSessions`                     | セッション管理     |
| Sound     | `sound:getSettings` / `sound:updateSettings`                                            | サウンド設定       |
| Sound     | `sound:getPresets` / `sound:savePreset` / `sound:deletePreset`                          | プリセット管理     |
| Data I/O  | `data:export` / `data:import`                                                           | JSON Export/Import |
| Tags      | `tags:getAll` / `tags:create` / `tags:update` / `tags:delete`                           | タグ管理           |
| Templates | `templates:getAll` / `templates:save` / `templates:delete`                              | テンプレート管理   |
| Memos     | `memos:get` / `memos:save`                                                              | メモ管理           |
| AI        | `ai:getSettings` / `ai:updateSettings` / `ai:getAdvice`                                 | AIコーチング       |
| App       | `app:getVersion`                                                                        | アプリ情報         |

---

## 開発ジャーナル

### 2026-02-20 - AI機能廃止 + Daily未記入日メモ作成 + 時間表示削除

#### 概要

未使用のAI機能（Gemini API連携）を完全廃止し、Dailyメモの未記入日作成機能を追加。

#### 変更点

- **aiService完全廃止**: AI関連ファイル6件削除（aiService, safeStorageService, aiRepository, aiHandlers, AISettings, types/ai）、参照元11ファイルからAIコード除去、Settings画面からAIタブ削除、i18n（en/ja）からAIキー削除
- **Daily未記入日メモ作成**: Plusボタンをドロップダウンに変更、過去30日間の未記入日リストを表示して選択作成可能に。`onCreateToday` → `onCreateForDate(date)` に汎用化
- **時間表示削除**: Dailyリスト項目の`updatedAt`時間表示を削除（ゴミ箱アイコンとの重なり解消）
- テスト: 全127件パス

### 2026-02-19 - グローバル Undo/Redo システム

#### 概要

コマンドパターン + ドメイン別スタックによる統一的な Undo/Redo システムを全セクションに導入。

#### 変更点

- **コアインフラ**: `shared/UndoRedo/` に UndoRedoManager（ドメイン別スタック管理）、UndoRedoContext、useUndoRedo hook、useUndoRedoKeyboard（Cmd+Z / Cmd+Shift+Z）、UndoRedoButtons コンポーネントを新規作成
- **8ドメイン対応**: taskTree / memo / note / calendar / routine / scheduleItem / playlist / sound の各操作に undo/redo コマンドを実装
- **TaskTree マイグレーション**: 既存のスナップショット型 undo を新システムに移行、useTaskTreeHistory / useTaskTreeKeyboard / TaskTreeHeader を書き換え
- **セクションヘッダー**: SectionHeader に `actions` prop を追加、各セクション（Tasks / Memo / Work > Music）にドメイン連動の Undo/Redo ボタンを配置
- **キーボードショートカット**: グローバル Cmd+Z / Cmd+Shift+Z でアクティブドメインの undo/redo を実行（INPUT/TEXTAREA/contenteditable 内ではスキップし TipTap と競合しない）
- **複合操作**: ScheduleContext の deleteRoutine で routine 削除 + tagAssignment 除去を一括 undo/redo
- **除外**: Timer 操作全て、TipTap content 更新（エディタ内 undo に委任）、customSound add/remove（blob 不可逆）
- **テスト**: UndoRedoManager のユニットテスト 9 件追加、既存テスト全 129 件パス

### 2026-02-18 - ゴミ箱拡張: カスタムサウンド対応 + トップレベルナビゲーション化

#### 概要

ゴミ箱にカスタムサウンドセクションを追加し、サイドバーのトップレベルセクションに昇格。カスタムサウンドのハードデリートをソフトデリートに変更し、復元可能に。

#### 変更点

- **カスタムサウンドのソフトデリート**: `_meta.json`に`isDeleted`/`deletedAt`フラグを追加。削除時はblobファイルを保持し、完全削除時のみファイル削除
- **TrashViewコンポーネント**: Settings内のTrashBinを独立したトップレベルセクション`TrashView`に昇格。3セクション構成（Tasks/Notes/Custom Sounds）
- **サウンド表示名の解決**: `SoundDisplayMeta`（リネーム後の名前）を優先、なければ`CustomSoundMeta.label`にフォールバック
- **サイドバー追加**: AnalyticsとSettingsの間に「ゴミ箱」セクションを配置
- **AudioContext拡張**: `reloadCustomSounds`メソッドを追加し、復元後にサウンドリストを再読み込み
- **IPCチャンネル追加**: `db:customSound:fetchDeleted` / `db:customSound:restore` / `db:customSound:permanentDelete`
- **Settings > Dataタブ**: TrashBinを削除してDataManagementのみに簡素化

### 2026-02-17 - Routine UIUX 調整（Enter二段階・タブ移動・タグシステム）

#### 概要

3つのUX改善を実施: (1) Enter二段階システム（useConfirmableSubmit）、(2) RoutineタブをScheduleサブタブからTasksトップレベルに移動、(3) Routineタグシステムの新規追加。

#### 変更点

- **useConfirmableSubmitフック**: 1回目Enter→blur（入力確定）、2回目Enter→submit＆閉じる。`readyToSubmit`状態でSubmitボタンにring+pulseアニメーション。7コンポーネント（RoutineEditDialog, TemplateEditDialog, TaskCreatePopover, ScheduleItemCreatePopover, CalendarCreateDialog, SoundTagEditor, SoundTagManager）に適用
- **Routineタブ移動**: Tasks→[TaskTree, Schedule, Routine] の3タブ構成に変更。ScheduleTabViewからroutineサブタブを削除
- **Routineタグシステム**: DBスキーマV19（routine_tag_definitions テーブル + routines/routine_templates に tag_id カラム追加）。デフォルト3タグ（Morning/Afternoon/Night）。全レイヤー対応（Repository→IPC→DataService→Hook→Context→UI）。RoutineTagSelector（単一タグ選択ドロップダウン）、RoutineTagManager（タグ管理UI）を新規作成。RoutineEditDialog/TemplateEditDialogにタグ選択追加。RoutinesTabにタグバッジ表示+タグ管理ボタン追加。ScheduleContextにタグ自動追加ロジック（tagId設定時、同タグの全テンプレートにroutineを自動追加）

### 2026-02-17 - Routine / DayFlow タブ UIUX 改善

#### 概要

DayFlowタブに日付ナビゲーション（前日/翌日/今日ボタン）とタスク連携を追加。Routineタブを上部3メトリクス統計パネル + 2カラムレイアウト（左: Routines、右: Templates）に再構成。

#### 変更点

- **DayFlow日付ナビゲーション**: `ScheduleTabView`に`dayFlowDate` state追加、`OneDaySchedule`に`< 2/17(月) >`ナビゲーションヘッダー追加。`dateKey.ts`に`formatDayFlowDate`ヘルパー追加（ja/en対応）
- **DayFlowタスク連携**: `TodayFlowTab`に`FlowEntry`統合型を導入。ScheduleItemとTaskNodeをstartTime順にマージ表示。タスクはカラーボーダー付き、DONE状態は打ち消し線+薄表示、クリックでTaskDetail遷移
- **Routine統計パネル**: 新規`RoutineStatsPanel`コンポーネント（3メトリクス横並び: 達成日数/現在連続/最長連続）。旧`RoutineStatsCard`と`RoutineStatsOverlay`を削除
- **Routine 2カラムレイアウト**: `RoutinesTab`を`grid grid-cols-2`で再構成。左カラムにRoutinesリスト+アーカイブ、右カラムにTemplateManager
- **i18n**: `schedule.dayFlow`キーを追加（ja/en）

### 2026-02-17 - サウンドパネル並び替え機能 + SortDropdown共通化

#### 概要

WorkMusicContentの2カラムサウンドパネルに並び替え機能（デフォルト/名前順/カスタム優先）を追加。既存のTaskTree・Notesで重複していたソートドロップダウンを汎用`shared/SortDropdown`に共通化し、3箇所すべてで再利用。

#### 変更点

- **汎用SortDropdown**: `shared/SortDropdown.tsx`をジェネリクス対応で新規作成。`useClickOutside`+`ArrowUpDown`アイコンの既存パターンを維持
- **TaskTree SortDropdown置換**: 中身を削除し`shared/SortDropdown`のラッパーに変更。外部インターフェースは維持
- **NoteList SortDropdown置換**: インラインソートメニューを削除し`shared/SortDropdown`を使用
- **サウンドソートロジック**: `utils/sortSounds.ts`を新規作成。3モード（default/name/custom-first）対応
- **WorkMusicContentソートUI**: 左右パネルそれぞれに独立したSortDropdownを配置、フィルタリング後にソート適用

### 2026-02-17 - バグ修正 & Music UI改善（7件一括対応）

#### 概要

カレンダータスク削除不具合、プレイリストのカスタムサウンド追加不具合、サウンドUI全体の改善、コンソールエラー修正の計7件を一括対応。

#### 変更点

- **カレンダー月表示タスク削除修正**: `TaskPreviewPopup`の`useClickOutside`が確認ダイアログ表示中も発火しポップアップが閉じる問題を修正。`showDeleteConfirm`時はclick-outsideを無効化
- **プレイリストカスタムサウンド追加修正**: `handleAddCustomSound`がファイル入力の`onchange`未設定だった問題を修正。`useAudioFileUpload`フックを利用し、`addSound`の返り値に`id`を追加、アップロード成功時にプレイリストへ自動追加
- **プレイリスト編集機能**: SortableItemに名前インライン編集（クリック→入力→Enter/Blur保存）、タグドット表示+SoundTagEditor、Trash2アイコンをX（プレイリストから除去）に変更
- **サウンド2カラムレイアウト**: Soundsタブを左パネル（タグなしサウンド）と右パネル（タグ付きサウンド）の2カラム構成に変更。SoundTagFilterを削除し、パネル別の検索フィールドに置換（左: 名前検索、右: 名前+タグ検索）
- **パネルボーダー追加**: 各パネルに`border border-notion-border rounded-lg p-4`を適用
- **カスタムサウンド追加ボタン移動**: 左パネル（タグなし）下部に配置
- **PomodoroSettingsPanel button ネスト修正**: プリセット内の削除ボタン（`<button>`内`<button>`）を`<span role="button">`に変更、コンソール警告を解消

### 2026-02-16 - UX改善4点（ショートカット・Tips更新・削除モーダル・コマンドパレット修正）

#### 概要

4つのUX改善を実施: Backspace/Deleteショートカット廃止、Tips内容の全面更新、TaskTree削除確認ダイアログの廃止（ゴミ箱の永久削除に確認追加）、コマンドパレットのスクロールバグ修正。

#### 変更点

- **コマンドパレットスクロール修正**: `children[selectedIndex]`→`querySelector('[data-command-index]')`に変更。ネストされたカテゴリグループ構造でも正しくスクロール追従
- **Backspace/Deleteショートカット廃止**: 誤操作防止のため削除キーによるタスク削除を廃止。コマンドパレットからの削除は維持（ショートカット表示なし）
- **タスク削除確認の簡素化**: TaskTreeNodeの削除確認ダイアログを廃止し即ソフト削除に変更。ゴミ箱の永久削除ボタンに確認ダイアログを追加
- **Tips全面更新**: NavigationセクションをCmd+1〜3（Tasks/Work/Analytics）に修正。TimerタブでSession→Work表記統一、localStorage→database修正。Scheduleタブに日表示・ルーティンセクション追加。MemoタブにNotesセクション追加。AnalyticsタブにWork Timeセクション追加、Cmd+4→Cmd+3修正。カレンダー系ショートカットをday対応に更新

### 2026-02-16 - ミキサー削除・プレイリスト専用化・UI改善

#### 概要

音楽システムを「ミキサー」ベースから「プレイリスト」ベースに全面移行し、UIを簡素化。ColorPicker修正、ポモドーロ設定2カラム化、タイマー再生バグ修正も実施。

#### 変更点

- **ColorPicker修正**: hover時のscale-110をring-2に変更。SoundTagManagerで共有ColorPicker（20色）を使用するよう統合
- **ポモドーロ設定2カラム化**: 左カラムに現在設定サマリー（WORK/BREAK/LONG BREAK時間、セッションドット、Auto-start状態）、右カラムに設定コントロール
- **ミキサー完全削除**: useLocalSoundMixer、useAudioEngine、useWorkscreenSelections、useAudioControl、useAudioState、AudioControlContext、AudioStateContext、SoundMixer、SoundListItem、AudioModeSwitch、MusicSlotItem を削除
- **AudioContext簡素化**: mixer/toggleSound/setVolume/resetAllPlayback/seekSound/channelPositions/workscreenSelections/manualPlay/audioMode を削除、timerPlaylistId/setTimerPlaylistId を追加
- **タイマープレイリスト選択**: Timer タブにプレイリストセレクター追加、選択プレイリストのみタイマー実行時に再生。PlaylistPlayerBar を manualPlay props なしで配置
- **サウンドリスト簡素化**: MusicSoundItem からボリュームスライダー・シークバー・ワークスクリーン選択を削除、play ボタン+名前+タグドット+hover操作のみに
- **共有プレビューコントロール**: usePreviewAudio に volume/currentTime/duration/seekTo を追加、サウンドリスト下部にプレビュー中のトラック用コントロール表示
- **i18n**: work.noPlaylist、work.backgroundPlaylist、pomodoro.currentConfig を追加。playlist.modeMixer/modePlaylist、music.addToWorkscreen/removeFromWorkscreen/noSoundsWork、work.soundsPlaying を削除
- **storageKeys**: AUDIO_MODE を TIMER_PLAYLIST_ID に置換

### 2026-02-16 - TimeInput共通化 + セクションタブリストラクチャ

#### 概要

カスタムTimeInputコンポーネントを作成し、全箇所のネイティブ時間UI（`<select>`, `<input type="time">`）を置き換え。Scheduleセクションを削除しTasksのサブタブに統合、Analyticsに概要/詳細タブを追加。

#### 変更点

- **TimeInput共通コンポーネント**: HH:MM直接キーボード入力、上下矢印キーで値増減、Tab/クリックでhour↔minute移動、フォーカスアウトで確定
- **TimeInput置き換え**: MiniCalendarGrid（開始/終了 各2箇所）、DateTimePicker（1箇所）、ScheduleItemCreatePopover（2箇所）、RoutineEditDialog（2箇所）の計10箇所
- **SectionTabs拡張**: `size` prop追加（`"default"` | `"sm"`）でネストされたサブタブに小さめスタイル対応
- **Tasksセクション再構成**: トップレベルTasks/Scheduleタブ → TasksタブにIncomplete/Completeサブタブ、ScheduleタブにCalendar/Dayflow/Routineサブタブ
- **サイドバーからSchedule削除**: LeftSidebarのmenuItemsからschedule項目を削除、キーボードショートカット・コマンドパレットも更新
- **CalendarView/CalendarHeaderからDayビュー削除**: 月/週表示のみに簡素化
- **OneDayScheduleからRoutinesタブ削除**: TodayFlowのみ表示
- **AnalyticsView**: 概要/詳細タブ追加（詳細はComing Soonプレースホルダー）
- **i18n**: tabs.\*キー、common.comingSoonを日英両方に追加

### 2026-02-16 - レイアウト統一リファクタリング

#### 概要

RightSidebar を完全削除し、Tasks セクションを左右分割レイアウト（TaskTree + TaskDetailPanel）に変更。全セクションのスペーシングを LAYOUT 定数で統一。

#### 変更点

- **RightSidebar 完全削除**: Layout.tsx から右サイドバー関連のコード（リサイズ、開閉、localStorage）を一掃。CalendarSidebar・SidebarTabs・TaskDetailSidebar を削除
- **Tasks 左右分割**: TasksLayout コンポーネント新規作成（左 TaskTree + 右 TaskDetailPanel の 2 カラム）。TaskDetailPanel・TaskDetailEmpty コンポーネント新規作成
- **統一スペーシング**: LAYOUT 定数（px-8/pt-6/pb-8/mb-5/mt-5）を Settings・Tips・MemoView・WorkScreen・CalendarView・AnalyticsView に適用。MainContent のラッパー padding 削除
- **メニュー・ショートカット整理**: Cmd+Shift+. ショートカット削除、Electron メニューの Toggle Right Sidebar 項目削除、コマンドパレットの右サイドバーコマンド削除
- **ファイル削除**: CalendarSidebar.tsx・SidebarTabs.tsx・TaskDetailSidebar.tsx
- **ファイル新規作成**: layout.ts・TaskDetailPanel.tsx・TaskDetailEmpty.tsx・TasksLayout.tsx

### 2026-02-16 - Work タブ化 + Music セクション統合

#### 概要

Work 画面に SectionTabs（Timer / Pomodoro / Music）を追加し、独立していた Music セクションを Work の Music タブに統合。LeftSidebar から Music メニュー項目を削除してナビゲーションをシンプル化。

#### 変更点

- **WorkScreen タブ化**: Timer / Pomodoro / Music の 3 タブ構成に書き換え（SectionTabs 使用）
- **Timer タブ**: 既存のタイマー表示 + 「バックグラウンドサウンドを設定する」ボタン（再生中はステータス表示）
- **Pomodoro タブ**: PomodoroSettingsPanel.tsx 新規作成（ポップオーバー版を廃止、フルページレイアウト）
- **Music タブ**: WorkMusicContent.tsx 新規作成（MusicScreen の内容を移植、Sounds/Playlists サブタブ）
- **Music セクション削除**: MusicScreen.tsx 削除、LeftSidebar から music メニュー項目削除、SectionId から "music" 削除
- **キーボードショートカット**: Cmd+2 を music → work に変更
- **コマンドパレット**: "Go to Music" コマンド削除、"Go to Work" に Cmd+2 ショートカット割当
- **Layout クリーンアップ**: calendarMode / onCalendarModeChange props を Layout から削除、CalendarSidebar が内部状態で管理
- **PomodoroSettings.tsx 削除**: ポップオーバー版は PomodoroSettingsPanel に置換
- **レガシー Sidebar.tsx 削除**: 未使用ファイル
- **i18n**: work.tabTimer / tabPomodoro / tabMusic / setBackgroundSound / soundsPlaying / playingPlaylist キー追加

### 2026-02-16 - Schedule Day View 日付修正 + ルーティン達成統計

#### 概要

Day ビューが週の開始日（日曜日）を表示していた問題を修正し、日付ナビゲーションボタンを常時表示に変更。さらにルーティン達成統計機能（RoutineStatsCard / RoutineStatsOverlay）を新規追加。

#### 変更点

- **Day ビュー日付修正**: Day ビュー切替時に今日の日付をセットする useEffect を追加（CalendarView.tsx）
- **ナビゲーションボタン常時表示**: CalendarHeader.tsx の `viewMode !== "day"` 条件を削除、prev/next/today ボタンを全ビューで表示
- **RoutineStats 型**: schedule.ts に RoutineStats インターフェース追加（ストリーク、達成率、ヒートマップ等）
- **統計計算ロジック**: useScheduleItems.ts に過去90日間のデータから統計を計算する `computeRoutineStats` 関数と `refreshRoutineStats` callback を追加
- **RoutineStatsCard**: コンパクトな統計カード（全体達成率、直近7日ストリークドット、連続日数、詳細ボタン）
- **RoutineStatsOverlay**: 詳細オーバーレイ（ストリーク情報、ルーティン別達成率プログレスバー、90日ヒートマップ）
- **i18n**: `schedule.stats.*` キー群を en.json / ja.json に追加

---

### 2026-02-16 - Calendar + Routine → Schedule 統合

#### 概要

Calendar（月/週/3日ビュー）と Routine（習慣トラッカー）を **Schedule** セクションに統合。3日ビューを1日スケジュールビューに置換し、ルーティンのデータモデルを時刻ベースに刷新。

#### 変更点

- **DB V17マイグレーション**: 旧 routines/routine_stacks/routine_stack_items/routine_logs テーブルを DROP し、新 routines（startTime/endTime）/ routine_templates / routine_template_items / schedule_items テーブルを作成
- **OneDaySchedule**: 1日スケジュールビュー新規作成。左にタイムグリッド（ScheduleTimeGrid）、右にタブパネル（TodayFlowTab / RoutinesTab）
- **ScheduleTimeGrid**: 0:00〜24:00 の1日タイムグリッド。ScheduleItemBlock（チェックボックス付き、完了時半透明+次ハイライト）+ TimeGridTaskBlock（TaskNode 薄表示）、現在時刻インジケーター、クリックで ScheduleItemCreatePopover 表示
- **TodayFlowTab**: 縦フローチャート形式の進捗表示（完了=緑、次=アクセント、未着手=グレー）、プログレスバー
- **RoutinesTab**: ルーティン CRUD（title/startTime/endTime）、アーカイブ/復元、完了率表示、TemplateManager 統合
- **TemplateManager**: テンプレート一覧 + 所属ルーティン管理（追加/削除）、頻度表示（daily/custom曜日）
- **テンプレート自動挿入**: `ensureTemplateItemsForDate` で日付表示時にテンプレートのルーティンを ScheduleItem として自動挿入
- **ScheduleContext**: ScheduleItem + RoutineTemplate + Routine をまとめた統合 Provider（ScheduleProvider）
- **SectionId 変更**: `"routine"` 削除、`"calendar"` → `"schedule"`。LeftSidebar/App.tsx/キーボードショートカット/コマンドパレット更新
- **ViewMode 変更**: `"3day"` → `"day"`。CalendarHeader/CalendarView/useCalendar 更新
- **不要コード削除**: Routine コンポーネント10ファイル + Memo 内ルーティン4ファイル + RoutineContext + useRoutineContext + electron 2ファイル（計17ファイル削除）
- **データ IO 更新**: export/import に schedule_items/routine_templates/routine_template_items 追加、routine_logs 削除
- **i18n**: en/ja の `routine` セクション簡略化、`schedule` セクション新設（17キー）

### 2026-02-15 - Tasks セクション大規模リファクタリング

#### 概要

Tasks セクションのレイアウトを反転。メインコンテンツにタスクツリー全体表示、右サイドバーにタスク/フォルダ詳細を配置する UX に変更。AIコーチ機能を廃止。

#### 変更点

- **TaskTreeHeader**: メインコンテンツ用ヘッダー（FolderDirectoryDropdown + Undo/Redo）を新規作成
- **FolderDirectoryDropdown**: フォルダ階層をツリー形式で表示するナビゲーションドロップダウン
- **TaskDetailSidebar**: 右サイドバーの新コンポーネント（タスク/フォルダ詳細、タイトル編集、FolderMovePicker、ColorPicker、DurationPicker、MiniCalendarGrid、テキストメモ）
- **MiniCalendarGrid**: 埋め込み型インタラクティブカレンダー（DateTimeRangePickerから抽出）
- **FolderMovePicker**: フォルダ移動ドロップダウン + 確認ダイアログ（"今後表示しない"チェックボックス付き）
- **ConfirmDialog拡張**: showDontShowAgain/onDontShowAgainChange props追加
- **TaskTree**: 外部filterFolderId対応（Controlled/Uncontrolledモード）、ワイドレイアウト対応（max-w-3xl）
- **App.tsx**: renderContent変更（TaskDetail → TaskTree + TaskTreeHeader）、filterFolderIdリフトアップ
- **Layout.tsx**: RightSidebar → TaskDetailSidebar置き換え、onCreateFolder/onCreateTask props削除
- **AICoach完全廃止**: AICoachPanel/AIAdviceDisplay/AIRequestButtons/useAICoach削除
- **RightSidebar.tsx削除**: TaskDetailSidebarに置き換え
- **i18n**: taskDetailSidebar/taskTreeHeader翻訳キー追加（en/ja）

### 2026-02-15 - コード重複排除リファクタリング

#### 概要

コードベース全体に蓄積した明確なコピペ重複を9フェーズで排除。約470行削減、5つの共通ユーティリティ/ヘルパーを新規作成。

#### 変更点

- **日付フォーマット統合**: `dateKey.ts` に `getTodayKey()` / `formatDisplayDate()` / `formatDateHeading()` を集約し、5ファイルのローカル定義を import に置換
- **Context消費フック統合**: `createContextHook<T>()` ジェネリックヘルパーで7つの同一構造 `useContext` + null チェックフックを各2行に簡略化
- **MemoEditor lazy import 共通化**: `LazyMemoEditor.ts` で TaskDetail/NotesView/DailyMemoView の同一 `lazy()` 宣言を1定数に統合
- **ID 生成統一**: `generateId(prefix)` で `crypto.randomUUID()` / `Date.now()` / `Math.random()` 混在を解消（5ファイル）
- **オーディオファイルアップロード共通化**: `useAudioFileUpload` フックで WorkScreen/MusicSidebar の `createElement("input")` パターンを統合
- **localStorage 直接アクセス統一**: `useCalendars` / `usePlaylistPlayer` の手動 localStorage 操作を `useLocalStorage` フックに置換
- **ConfirmDialog/ConfirmOverlay 統合**: `ConfirmDialog` に title/variant/label props を追加し `ConfirmOverlay.tsx` を削除
- **子孫ノード収集共通化**: `getDescendantTasks.ts` に `collectDescendantIds()` / `isDescendantOf()` を追加、`useTaskTreeDeletion` / `useTaskTreeMovement` の重複を排除
- **IPC ハンドラ try/catch 統一**: `loggedHandler()` ラッパーで17ハンドラファイル（60+ハンドラ）の同一 try/catch パターンを統一
- **新規**: `createContextHook.ts`, `LazyMemoEditor.ts`, `generateId.ts`, `useAudioFileUpload.ts`, `handlerUtil.ts`
- **削除**: `ConfirmOverlay.tsx`

### 2026-02-15 - Memo/Music/Work セクションに RightSidebar 追加

#### 概要

全セクションで RightSidebar を利用可能にし、UI/UX の一貫性を向上。

#### 変更点

- **MemoSidebar**: Daily/Notes タブ切替。Daily タブで日付リスト（Today ショートカット、削除）、Notes タブで検索・ソート・ノート一覧を表示。MemoView からリスト部分を RightSidebar に移動し、メインエリアはエディターのみに特化
- **MusicSidebar**: Sounds/Playlists タブ切替。Sounds タブで検索・タグフィルタ・サウンド一覧・カスタムサウンド追加、Playlists タブでプレイリスト一覧を表示。MusicScreen のメインエリアはタグ管理＋プレイリスト詳細に特化
- **WorkSidebar**: Pomodoro/Playlist タブ切替。Pomodoro タブでプリセット管理・Work/Break/Long Break/Sessions 設定、Playlist タブでプレイリスト選択・全曲リスト・Shuffle/Repeat トグル
- **ConfirmOverlay**: セッション完了・タスク完了ボタン押下時の確認ダイアログ（blue/green バリアント）
- **PlaylistPlayerBar 改善**: `getDisplayName` prop でカスタムサウンドの編集済み名前を正しく表示。プレイリスト全曲リスト表示（現在の曲ハイライト、クリックで曲ジャンプ）
- **Layout.tsx**: `showRightSidebar` を tasks/calendar/memo/music/work の5セクションに拡張
- **i18n**: 確認ダイアログ用の翻訳キーを en/ja に追加

### 2026-02-15 - ルーティンUI/UXリデザイン

#### 概要

ルーティンセクションのUIをタブ形式の時間帯ナビ + 横方向ステッパー中心のフロー型UIに刷新。

#### 変更点

- **時間帯タブバー**: 朝/昼/夜の3タブでルーティンをフィルタリング表示。各タブにカスタマイズ可能な時間帯（HH:MM〜HH:MM）を表示
- **時間帯設定ダイアログ**: ⚙ボタンから各時間帯の開始・終了時刻を設定（localStorage保存）
- **ルーティンセット（横方向ステッパー）**: 旧「Habit Stack」を横方向ステッパーUIに刷新。完了/次/未着手の3状態ビジュアル、矢印コネクター、「次を開始」ボタン
- **単体ルーティン表示**: セットに属さないルーティンはコンパクトリスト形式で表示
- **ルーティン作成ダイアログ改修**: セット選択ドロップダウン追加、anytime選択肢を除去（3タブのみ）
- **anytimeマイグレーション**: 既存の`anytime`ルーティンをフロントエンドで`morning`として表示（DB変更なし）
- **i18n**: en/jaに10+新規翻訳キー追加（時間帯設定、ルーティンセット、単体ルーティン等）
- **RoutineStackCard削除**: RoutineSetStepperに完全置き換え

### 2026-02-15 - ルーティンUXUX大幅強化

#### 概要

Routine機能をMemoViewのタブから独立セクションに昇格し、習慣化を促進するための行動心理学ベースのUI/UXを全面実装。

#### 変更点

- **独立セクション**: Sidebar に専用ナビゲーション追加、シングルペインレイアウト
- **時間帯グルーピング**: Morning/Afternoon/Evening/Anytime の4カテゴリでルーティンを自動分類
- **柔軟なスケジューリング**: 毎日/カスタム曜日に加え「週N回」頻度タイプを追加
- **Grace Period**: "Don't Miss Twice"ルールによるストリーク計算（1日ミスは許容、2日連続でリセット）
- **Habit Stacking**: ルーティンを連鎖させるスタック機能（DB新テーブル、CRUD、進捗バー付きUI）
- **進捗ダッシュボード**: 12週ヒートマップ、週次達成率バーチャート、ストリーク記録、マイルストーンバッジ
- **マイクロインタラクション**: チェック完了アニメーション、マイルストーン祝福トースト、At-Risk警告アイコン
- **タイマー連携**: ルーティンカードから▶ボタンでポモドーロ直接開始、スタック内「次を開始」ボタン
- **DB**: V16マイグレーション（routines テーブル拡張 + routine_stacks / routine_stack_items 新規テーブル）
- **i18n**: en/ja に30+ 新規翻訳キー追加

### 2026-02-15 - データリセット機能追加

#### 概要

Settings → Data タブにデータリセット機能を追加。全テーブルのデータを削除してアプリを初期状態に戻す。リセット前に自動バックアップを作成し、失敗時は自動復元。

#### 変更点

- **Electron**: `data:reset` IPCハンドラ追加（全テーブルDELETE、timer_settings/ai_settingsデフォルト復元、カスタムサウンドファイル削除、バックアップ＆自動復元）
- **preload**: `data:reset` チャンネルをホワイトリストに追加
- **DataService**: `resetData()` メソッド追加
- **DataManagement**: 赤い「データリセット」ボタン + ConfirmDialog二重確認
- **i18n**: reset関連4キー追加（en/ja）

### 2026-02-14 - Music Library (Playlist) 機能追加

#### 概要

Music画面にプレイリスト機能を追加。環境音ミキサーとは排他で、楽曲を1曲ずつシーケンシャル再生する方式。DnD並び替え、シャッフル、リピート（off/one/all）、シークバー、ボリュームコントロールを完備。

#### 変更点

- **DB**: V15マイグレーション（playlists, playlist_items テーブル）
- **Electron**: playlistRepository（CRUD + items管理）、playlistHandlers（9 IPCチャンネル）、preload + registerAll更新
- **DataService**: 10メソッド追加（fetchPlaylists, createPlaylist, updatePlaylist, deletePlaylist, fetchPlaylistItems, fetchAllPlaylistItems, addPlaylistItem, removePlaylistItem, reorderPlaylistItems）
- **フック**: usePlaylistData（CRUD + 楽観的更新）、usePlaylistEngine（シーケンシャル再生エンジン）、usePlaylistPlayer（高レベル状態管理）
- **AudioProvider**: audioMode（mixer/playlist）排他制御、playlistData/playlistPlayer をContext経由で公開
- **WorkScreen**: AudioModeSwitch（Mixer/Playlist切替タブ）、PlaylistPlayerBar（再生コントロール）
- **MusicScreen**: Sounds/Playlistsタブ切替、PlaylistManager（一覧管理）、PlaylistDetail（トラック一覧 + DnD）
- **i18n**: playlist関連20キー追加（en/ja）
- **型**: Playlist, PlaylistItem, RepeatMode, AudioMode

### 2026-02-14 - Calendar Split: Tasks / Memo 切り替え + Routine 日付フィルタ

#### 概要

カレンダーをTasks専用・Memo専用の2モードに分割。右サイドバーのタブで切り替え可能。Routineの作成日以前の日付を分母から除外するフィルタも追加。

#### 変更点

- **CalendarSidebar**: Tasks/Memoタブ追加、Memoモード時はカレンダーリスト・+ボタン非表示
- **CalendarHeader**: Memoモード時にビューモード切り替え（Month/Week/3day）非表示
- **CalendarView**: Memoモード時は月表示固定、タスクフィルター非表示、notesByDate計算追加
- **DayCell**: Memoモード分岐追加（Routine達成 + Daily memo黄色チップ + Notes青チップ、+N more対応）
- **useRoutines**: `isDayApplicable`にcreatedAt比較追加、currentStreakに作成日ガード追加
- **App.tsx**: calendarMode状態管理（localStorage永続化）、handleCalendarSelectNoteハンドラ追加
- **i18n**: calendarSidebar.tasksTab/memoTab、calendar.noteItem追加

### 2026-02-14 - Code Signing 設定（macOS Notarization + Windows署名 + CI/CDリリース）

#### 概要

プロダクション配布に向けて、macOS Notarization と Windows コード署名を設定。CI/CDパイプラインにドラフトGitHub Release自動作成を追加。

#### 変更点

- **macOS Notarization**: `@electron/notarize` v2.x + `scripts/notarize.js`（afterSign hook、CJS形式）、環境変数未設定時は自動スキップ（ローカルビルド対応）
- **Entitlements**: `build/entitlements.mac.plist`（allow-jit / allow-unsigned-executable-memory / allow-dyld-environment-variables）
- **electron-builder.yml**: `afterSign`, `hardenedRuntime: true`, `gatekeeperAssess: false`, `entitlements`/`entitlementsInherit`, `win.signingHashAlgorithms: [sha256]`
- **CI/CD**: `build.yml` の macOS ジョブに `CSC_LINK`/`CSC_KEY_PASSWORD`/`APPLE_*` 環境変数追加、Windows ジョブに `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` 追加
- **create-release ジョブ**: 両プラットフォームビルド完了後にドラフト GitHub Release を自動作成（`softprops/action-gh-release@v2`）

#### 新規ファイル（2）

- `build/entitlements.mac.plist` — macOS entitlements
- `scripts/notarize.js` — Notarization afterSign hook

### 2026-02-14 - ルーティン（ハビットトラッカー）+ カレンダータスク作成強化

#### 概要

MemoView内にRoutineタブを追加し、日々の習慣を追跡・記録できるハビットトラッカー機能を実装。カレンダーからのタスク作成時にTask/Notes切替とフォルダ選択を可能にする改善も同時実施。

#### Feature 2: Routine（ハビットトラッカー）

- **バックエンド**: `routines`/`routine_logs`テーブル追加（migrateV14）、`routineRepository.ts`（CRUD + toggleLog）、`routineHandlers.ts`（7チャンネル）
- **DataService層**: DataService/ElectronDataServiceに7メソッド追加
- **状態管理**: `useRoutines`フック（楽観的更新、統計計算）、`RoutineContext`/`RoutineProvider`、`useRoutineContext`
- **UI**: `RoutineView`（メインコンテナ）、`RoutineList`（一覧）、`RoutineItem`（今日チェック、7日履歴○×、ストリーク、月別サマリー）、`RoutineCreateDialog`（タイトル+頻度設定モーダル）
- **MemoView**: 3番目のタブ「Routine」追加（Repeatアイコン）
- **カレンダー統合**: MonthlyView/WeeklyTimeGridにルーティン達成インジケーター表示（緑=全完了、灰=未完了）
- **Data I/O**: Export/Importにroutines/routineLogs対応追加

#### Feature 1: カレンダータスク作成強化

- **TaskCreatePopover**: Task/Notesモード切替ボタン追加、Taskモード時にツリー形式フォルダセレクター表示（インデント付き）、Notesモード時はフォルダ非表示
- **ハンドラ更新**: `handleCalendarCreateTask`にparentId引数追加、`handleCalendarCreateNote`新規追加
- **App.tsx**: useNoteContextのcreateNoteをCalendarViewに配線

#### 新規ファイル（10）

- `frontend/src/types/routine.ts` — ルーティン型定義
- `electron/database/routineRepository.ts` — ルーティンDBリポジトリ
- `electron/ipc/routineHandlers.ts` — ルーティンIPCハンドラ
- `frontend/src/hooks/useRoutines.ts` — ルーティン状態管理フック
- `frontend/src/context/RoutineContext.tsx` — ルーティンContext Provider
- `frontend/src/hooks/useRoutineContext.ts` — ルーティンContext消費フック
- `frontend/src/components/Memo/RoutineView.tsx` — ルーティンメインビュー
- `frontend/src/components/Memo/RoutineList.tsx` — ルーティン一覧
- `frontend/src/components/Memo/RoutineItem.tsx` — ルーティンアイテム
- `frontend/src/components/Memo/RoutineCreateDialog.tsx` — ルーティン作成ダイアログ

### 2026-02-14 - カレンダー UX 改善（フィルター・作成・プレビュー）

#### 概要

カレンダーの3つのUX問題を修正: タグフィルターのドロップダウン化、タスク作成時の名前入力ダイアログ、タスクプレビューポップアップ。

#### 変更点

- **タグフィルタードロップダウン**: チップ一覧をフィルターアイコン+ドロップダウンに変更。タグ名を最後2階層に短縮表示（`truncateFolderTag`）
- **タスク作成ポップオーバー**: カレンダーからタスク作成時、名前入力ポップオーバーを表示。Enter+テキストで作成、空Enter/Escでキャンセル
- **タスクプレビューポップアップ**: タスクブロッククリック時にTasks画面遷移ではなく、その場でプレビュー表示。「詳細を開く」「タイマー開始」ボタン付き

### 2026-02-14 - カレンダー UI/UX 改善（3件）

#### 概要

カレンダー週表示の3つの問題を修正し、3日表示モードを追加。

#### 変更点

- **終日タスク省略表示**: all-day バナーの flexbox 子要素に `min-w-0 overflow-hidden` を追加し、長いタスク名がカラム幅を崩す問題を修正
- **日跨ぎタスクはみ出し修正**: `getClampedStartAndDuration()` を導入し、タスクの開始/終了時刻を当日の 0:00-24:00 にクランプ。22:00-02:00 のタスクが 24 時間グリッドからはみ出す問題を解消
- **3日表示モード追加**: Google Calendar モバイルと同様の 3Day ビューを追加。ヘッダーに「3日」ボタン、前後ナビは ±3 日移動、キーボード `m` で月→週→3日→月のサイクル切り替え

### 2026-02-13 - TaskTree UI/UX 9項目改善

#### 概要

TaskTreeの日常操作体験を向上させる包括的なUI/UX改修。フォント、操作感、視覚フィードバック、ソート機能など9項目を実装。

#### 変更点

- **フォント**: TaskTree全体のテキストを14px→15pxに拡大（TaskNodeContent/Editor/InlineCreateInput/DragOverlay）
- **フォルダ間隔**: Projectsセクションのフォルダ間スペースを4px→8pxに拡大
- **削除確認**: ゴミ箱アイコン・右クリックメニューの削除に確認ダイアログを追加
- **Enter操作改善**: InlineCreateInputでEnter+テキスト→作成&入力欄クリア（連続作成可能）、Enter+空→閉じる。TaskNodeEditorでEnter→保存して編集継続、再Enter→終了
- **カラー継承**: フォルダ内タスクに親フォルダの色を薄く（opacity 0x18）表示
- **完了タスクUI**: 行レベルでopacity-60+hover:opacity-90、チェックボックスにホバーエフェクト、check-popアニメーション、「Complete!」トースト通知
- **自動ソート**: タスク完了時に兄弟の末尾へ、未完了に戻すと未完了グループ末尾へ自動移動
- **並び替え機能**: SortDropdown（手動/ステータス/スケジュール日）をInboxヘッダーに追加、非手動モード時はドラッグハンドル非表示
- **ドラッグ挿入ライン**: ドラッグ中にタスク間にアクセントカラーのラインを表示、フォルダはring表示に限定

#### 新規ファイル

- `frontend/src/components/common/CompletionToast.tsx`
- `frontend/src/utils/sortTaskNodes.ts`
- `frontend/src/components/TaskTree/SortDropdown.tsx`

### 2026-02-13 - コードベースリファクタリング（Critical+High優先度）

#### 概要

コードベース全体の品質調査で発見されたCritical+High優先度の約20項目を修正。DB起動安全性、IPCエラーハンドリング、データインポートバリデーション、フロントエンドユーティリティ抽出、型安全性向上。

#### 変更点

- **Phase 1**: DB初期化失敗時にapp.quit()で起動阻止、migrateV9でDROP前にバックアップテーブルへRENAME、customSoundRepository防御的ロック追加
- **Phase 2**: 全14 IPCハンドラファイルにtry-catch+ログ追加（noteHandlers等の既存対応済みを除く11ファイル修正）、AIサービスに30秒タイムアウト（AbortSignal.timeout）追加
- **Phase 3**: データインポートにバージョンチェック、validateImportData()追加（配列フィールド型チェック、tasks必須フィールド検証）
- **Phase 4**: `useClickOutside`フック新規作成、6コンポーネントのclick outside重複コード置換、`formatDateKey`をutils/dateKey.tsに集約（useCalendar/useMemos/analyticsAggregationから参照）、hooks/index.ts・utils/index.tsバレルファイル拡充
- **Phase 5**: BubbleToolbar二重型アサーション修正、サイレントcatch改善（WorkScreen/AISettings/usePreviewAudio）、WorkScreen useEffectにキャンセルパターン追加、MusicSlotItem/MusicSoundItemのvoid式除去+未使用props削除、CalendarViewキーボードナビ重複解消（handleNext/handlePrev再利用）
- **Phase 6**: ルートTypeScript ~5.8.3→~5.9.3統一、4テストファイル追加（useClickOutside/dateKey/analyticsAggregation/formatRelativeDate）、CLAUDE.mdのテーブル一覧・リポジトリ数・ハンドラファイル数を現状反映

### 2026-02-13 - Work/Restサウンド分離廃止・WorkScreenモーダルピッカー追加

#### 概要

MusicScreenとWorkScreenの「Work/Rest別サウンド設定」を廃止し、1セットの統一サウンド設定に変更。WorkScreenにサウンドピッカーモーダルを追加し、直接サウンドを追加可能に。

#### 変更点

- **DB Migration V13**: `sound_settings`と`sound_workscreen_selections`テーブルから`session_category`カラムを削除、WORK行のみ保持
- **Repository/IPC**: `soundRepository.ts`と`soundHandlers.ts`から`sessionCategory`引数を全削除
- **Types**: `SessionCategory`型削除、`SoundSettings`から`sessionCategory`フィールド削除
- **Services**: `DataService`/`ElectronDataService`のメソッドシグネチャから`sessionCategory`引数削除
- **Hooks**: `useLocalSoundMixer`を単一ミキサーに変更、`useWorkscreenSelections`を`string[]`型に簡素化
- **Context**: `AudioContext`から`workMixer`/`restMixer`/`toggleWorkSound`/`toggleRestSound`/`setWorkVolume`/`setRestVolume`/`setMixerOverride`を削除、単一`mixer`/`toggleSound`/`setVolume`に統一
- **MusicScreen**: Work/Rest/Allタブを廃止、全サウンドのフラットリスト表示に変更、各サウンドに「タイマーに追加/解除」ボタン
- **WorkScreen**: `SoundPickerModal`統合、SoundMixerに「+ Add Sound」ボタン追加
- **i18n**: `addToWorkscreen`/`removeFromWorkscreen`キー追加

### 2026-02-12 - Music名前反映バグ修正・カレンダー終日/終了日時改善・ポモドーロUX強化

#### 概要

5つの機能改善/バグ修正。Music画面で変更したサウンド名がWorkScreenに反映されないバグ修正、カレンダーの終日イベント・終了日時の操作性改善、日付+時間表示の統一フォーマット化、ポモドーロタイマーのUX向上（プリセット/自動休憩/時間調整/サマリー）。

#### 変更点

- **バグ修正（Music名前）**: `SoundMixer.tsx`に`getDisplayName`プロップ追加、`useSoundTags`の表示名をWorkScreenのSoundMixerに伝播
- **終日=1日**: 終日ON時に`scheduledEndAt`を自動クリア、DateTimeRangePickerでも連動
- **終了日時トグル**: DateTimeRangePickerに「End time」チェックボックス追加、OFF時はstart dateのみの1クリック選択、ON時はstart→end の2クリック選択、カレンダーからのタスク作成はデフォルトで開始時間のみ
- **日付+時間統一表示**: `formatSchedule.ts`ユーティリティ新規作成、DateTimeRangePicker・TimeGridTaskBlockの表示を統一（同日: "Feb 12 14:30 - 18:00"、別日: "Feb 12 14:30 - Feb 15 18:00"）
- **ポモドーロプリセット**: `pomodoro_presets`テーブル追加（migrateV12）、IPC 4チャンネル追加、PomodoroSettings UIにプリセットチップ（クリックで一括適用/ホバーで削除）・保存ボタン追加、デフォルト3プリセット（Standard/Deep Work/Quick Sprint）
- **休憩自動開始**: `timer_settings`に`auto_start_breaks`カラム追加、PomodoroSettingsにトグル追加、SessionCompletionModalで3秒カウントダウン後に自動休憩開始
- **一時停止中の時間調整**: TimerDisplayに±5mボタン表示（一時停止中のみ）、TimerContextに`adjustRemainingSeconds`メソッド追加
- **今日のセッションサマリー**: WorkScreenのタイマー下に完了セッション数+合計作業時間を表示

#### 新規ファイル

- `frontend/src/utils/formatSchedule.ts` — 日時範囲フォーマットユーティリティ
- `frontend/src/components/WorkScreen/TodaySessionSummary.tsx` — 今日のサマリーコンポーネント
- `electron/database/pomodoroPresetRepository.ts` — プリセットDB操作
- `electron/ipc/pomodoroPresetHandlers.ts` — プリセットIPCハンドラ

### 2026-02-12 - 6機能追加: Analytics強化・Notes日時・キーボードバグ修正・Music個別再生・i18n完全対応・Tips OS切替

#### 概要

6つの機能追加・バグ修正を一括実施。Analyticsに作業時間グラフ（Recharts）追加、Notes/Memoに日時表示追加、タスク名編集時のキーボードショートカット横取りバグ修正、Music画面に個別試聴ボタン追加、Tips全7タブのi18n完全対応、TipsショートカットにmacOS/Windows切替トグル追加。

#### 変更点

- **バグ修正（キーボード）**: `useAppKeyboardShortcuts`/`useTaskTreeKeyboard`/`CalendarView`の`isInputFocused()`を`document.activeElement`から`e.target`ベースに変更、`closest('[contenteditable="true"]')`で祖先要素も検出、入力コンポーネントに`e.stopPropagation()`追加
- **i18n完全対応**: Tips全7タブ（Shortcuts/Tasks/Timer/Calendar/Memo/Analytics/Editor）、EmptyState、MusicSlotItem/MusicSoundItemの保存・削除確認ダイアログを`useTranslation()`+`Trans`コンポーネントで多言語化
- **Notes日時表示**: `formatRelativeDate()`ユーティリティ新規作成（相対日時: "5分前"/"昨日"等）、NoteList/NotesView/MemoDateList/DailyMemoViewに作成日時・更新日時表示追加
- **Tips OS切替**: `Tips.tsx`に`showMac`状態管理追加、ShortcutsTabにmacOS/Windowsトグルボタン配置、各タブに`showMac` prop伝播で`⌘`/`Ctrl`記号切替
- **Music個別Play**: `usePreviewAudio`フック新規作成（独立HTMLAudioElement管理）、グローバルPlay/Stop廃止、MusicSlotItem/MusicSoundItemに個別Play/Stopボタン追加、`soundSources`をAudioContext経由で公開
- **Analytics作業時間グラフ**: `recharts`依存追加、`analyticsAggregation.ts`（日/週/月/タスク別集計）新規作成、`WorkTimeChart`（期間別BarChart）、`TaskWorkTimeChart`（タスク別横棒グラフ）、`PeriodSelector`（日/週/月切替）コンポーネント追加、AnalyticsViewにtimer_sessionsデータ取得+グラフ描画+サマリーカード（総作業時間/セッション数/日平均）追加

### 2026-02-12 - UI/UX改善: Font Size・Sidebar・i18n・Settingsタブ化

#### 概要

フォントサイズを3段階から10段階スライダーに変更、左サイドバーをドラッグリサイズ可能に（160〜320px）、react-i18nextによる日英多言語対応、Settings画面を右サイドナビ5タブ構成に刷新。

#### 変更点

- **Font Size**: `FontSize`型を`number`（1〜10）に変更、FONT_SIZE_PXマッピング（12px〜25px）、レガシー値（small/medium/large）からの自動マイグレーション、AppearanceSettingsをスライダーUIに変更
- **Left Sidebar**: Layout.tsxに左サイドバーリサイズロジック追加（右サイドバーと同パターン）、LeftSidebarに`width` prop追加、`sonic-flow-left-sidebar-width`でlocalStorage永続化
- **i18n**: `i18next` + `react-i18next`導入、`i18n/locales/en.json`・`ja.json`に全UIテキスト（100+キー）、ThemeContextにlanguage状態管理+`i18n.changeLanguage()`連携、Settings > GeneralにLanguageSettings追加
- **Settings タブ化**: 8セクション縦並び → 右サイドナビ5タブ（General/Notifications/AI/Data/Advanced）に再構成
- **翻訳対象**: LeftSidebar, Settings全サブコンポーネント, TaskTree, TaskTreeNode, TaskNodeContextMenu, TaskNodeActions, FolderFilterDropdown, WorkScreen, TaskSelector, SessionCompletionModal, PomodoroSettings, TimerDisplay, MemoView, NotesView, NoteList, AnalyticsView, ConfirmDialog, MusicScreen, SoundPickerModal, EmptySlot, CommandPalette, Tips, CalendarView, CalendarHeader, CalendarSidebar, CalendarCreateDialog, AICoachPanel, AIRequestButtons, TemplateDialog, TaskDetailHeader（全UIコンポーネント網羅）

### 2026-02-12 - 複数カレンダー + タスクツリーフォルダフィルタリング

#### 概要

フォルダ増加時のカレンダー・タスクツリーの視覚情報過多を解決。カレンダーをフォルダ単位で分割表示する複数カレンダー機能と、タスクツリーのPROJECTSセクションにフォルダフィルタリングを追加。

#### 変更点

- **DB**: migrateV10追加、calendarsテーブル（id/title/folder_id/order/timestamps、ON DELETE CASCADE）
- **Backend**: calendarRepository.ts（CRUD）、calendarHandlers.ts（4チャンネル）、preload.ts/registerAll.ts更新
- **DataService**: CalendarNode型定義、DataService/ElectronDataServiceにcalendar CRUD 4メソッド追加
- **CalendarContext**: CalendarProvider + useCalendars hook + useCalendarContext（activeCalendarIdのlocalStorage永続化）
- **CalendarSidebar**: カレンダー一覧表示、All Tasks/個別カレンダー切替、作成/リネーム/削除、コンテキストメニュー
- **CalendarCreateDialog**: タイトル入力 + フォルダ選択ドロップダウン（パス表示付き）
- **CalendarView**: activeCalendar選択時にgetDescendantTasksでフォルダサブツリーのタスクのみ表示
- **Layout.tsx**: calendar セクション時にCalendarSidebar表示（既存サイドバーリサイズ・開閉ロジック共用）
- **FolderFilterDropdown**: タスクツリーPROJECTSヘッダーにフィルタードロップダウン追加
- **TaskTree.tsx**: filterFolderIdでPROJECTS/COMPLETEDセクションをフォルダ単位でフィルタ（localStorage永続化、削除時自動リセット）
- **ユーティリティ**: getDescendantTasks（サブツリー再帰取得）、flattenFolders（パス付きフォルダ一覧）
- **Data I/O**: export/importにcalendarsテーブル対応追加

### 2026-02-12 - WorkScreen UI改善 + Sidebar Work Section追加

#### 概要

WorkScreenをモーダルオーバーレイから独立セクションに移行。LeftSidebarに「Work」メニュー追加、ボタン類をヘッダーに横並び配置、SoundMixerのWork/Restタブを削除しsessionType自動切替化、「セッション完了」ボタン追加、SessionCompletionModalをApp.tsxレベルに移動してどの画面からでも表示可能に。Music画面の音楽名インライン編集バグも修正（MusicSlotItemに編集機能追加）。

#### 変更点

- **WorkScreen**: overlay/onClose props削除、ヘッダーにTaskSelector+セッション完了+タスク完了+ポモドーロ設定ボタンを横並び配置
- **SoundMixer**: Work/Restタブ削除、activeSessionTypeから直接mixer/toggle/volumeを導出
- **PomodoroSettings**: ドロップダウンをbottom-10からtop-full下向き開きに変更
- **LeftSidebar**: Workメニュー追加（Playアイコン）、mini timerをWork項目下に移動、onOpenTimerModal削除
- **App.tsx**: isTimerModalOpen state削除、work caseをrenderContentに追加、SessionCompletionModalをグローバル配置
- **Hooks**: useTaskDetailHandlers/useAppKeyboardShortcuts/useAppCommands/useElectronMenuActionsからsetIsTimerModalOpen削除、setActiveSection('work')に統一
- **MusicSlotItem**: インライン名前編集機能追加（クリック→input→Enter/blur保存）

### 2026-02-12 - Music画面リデザイン + WorkScreen同期バグ修正

#### 概要

Music画面をWork/Restタブ + 6スロットUIにリデザイン。MusicScreenでのサウンド選択がWorkScreenに反映されないバグを修正（useWorkscreenSelectionsの別インスタンス問題）。

#### 変更点

- **バグ修正**: AudioProviderとMusicScreenが別々のuseWorkscreenSelectionsインスタンスを持っていた問題を解消。AudioProviderを唯一のソースとし、toggleWorkscreenSelection/isWorkscreenSelectedをContext経由で公開
- **AudioContext拡張**: AudioContextValue/AudioControlContextValue/AudioStateContextValueにworkscreenSelection操作を追加
- **新UIコンポーネント**: EmptySlot（空スロット）、MusicSlotItem（スロット別サウンドコントロール）、SoundPickerModal（検索・タグフィルタ付きサウンド選択モーダル）
- **MusicScreen全面改修**: フラットリスト→Work/Restタブ+6スロットレイアウトに変更。タブに応じたmixer/toggle/volume関数の切替、ピッカーモーダルによるサウンド追加/削除フロー

### 2026-02-12 - Task/Noteタグ削除 + Musicタグ管理UI追加

#### 概要

使用されていないTask Tags・Note Tagsシステムを完全削除。DBマイグレーションV9で4テーブルDROP、バックエンド/フロントエンド全レイヤーからtask/noteタグ関連コードを除去。Sound Tags（Music画面）とFolder Name Tags（仮想タグ）のみ残存。Music画面にSoundTagManagerパネルを追加し、タグの名前編集・色変更・削除がMusic画面内で完結するようになった。

#### 変更点

- **DB**: migrateV9追加、task_tags/task_tag_definitions/note_tags/note_tag_definitions削除
- **Backend**: tagRepository.ts, tagHandlers.ts削除、preload.tsから13チャンネル除去
- **Frontend**: TagContext/useTags/TagEditor/TagBadge/TagFilter/TagManager/NoteTagBar等10+ファイル削除
- **UI**: TaskTree/TaskDetail/Calendar/NoteList/Settingsからタグ関連UI除去
- **新機能**: SoundTagManager.tsx（インライン編集・色パレット・削除確認・新規作成）
- **MusicScreen**: Settings2アイコンでタグ管理パネルのトグル表示

### 2026-02-12 - 6件UIUX改善・バグ修正

#### 概要

6つの改善: Notes永続化バグ修正（デバウンス未フラッシュ）、W/Rラベル改善（Work/Rest表記）、サウンド表示名セーブボタン追加、WORKセッション完了音、Music独立再生ボタン、タスク完了紙吹雪アニメーション。

#### 変更点

- **バグ修正**: MemoEditorのデバウンス未フラッシュ修正（アプリ終了/ノート切替時のデータ消失防止）
- **ラベル改善**: W/R → Work/Rest表記に変更（MusicSoundItem、MusicScreenヘッダー）
- **セーブボタン**: サウンド表示名編集時にチェックマークボタン+「Saved!」フィードバック追加
- **完了音**: WORKセッション完了時にエフェクト音再生、Settings画面に音量スライダー+プレビュー追加
- **独立再生**: タイマー未開始でもMusic画面のPlayボタンで環境音再生可能に
- **紙吹雪**: タスク完了時にcanvas-confettiによる紙吹雪アニメーション表示

### 2026-02-11 - フロントエンドコード品質改善

#### 概要

5フェーズの品質改善: テスト基盤構築（103テスト）、セキュリティ修正（URL検証、入力長制限）、Context/Stateリファクタリング（TimerContext useReducer化、AudioContext分割）、コンポーネント分割（App.tsx 527→172行、TaskTree.tsx 495→255行）、パフォーマンス改善（デバウンス、エラーハンドリング統一）。

#### 変更点

- **テスト**: MockDataService、renderWithProviders、103件のベースラインテスト作成
- **セキュリティ**: URL検証（javascript:/data:拒否）、BubbleToolbar/SlashCommandMenu修正、入力長制限
- **リファクタリング**: TimerContext useReducer化、AudioContext分割、entityTagsVersionハック削除、useMemo値安定化
- **分割**: App.tsx→4フック抽出、TaskTree.tsx→2フック抽出
- **パフォーマンス**: TaskSelector検索デバウンス、logServiceErrorユーティリティで統一エラーハンドリング

### 2026-02-11 - 5件バグ修正 + WorkScreen UIリデザイン + フェーズ別サウンド選択

#### 概要

5つのバグ修正と2つの新機能: サウンドタグIPC登録失敗修正、ノートデータ永続化修正、フォントサイズ設定修正、WorkScreenコンパクトUIリデザイン、Music画面フェーズ別サウンド選択。

#### 変更点

- **サウンドタグIPC修正**: soundRepositoryのV7テーブル参照をtableExists()で保護。migrateV6のnote_tags参照を防御ガード。registerAll.tsのエラーログ改善+soundRepo共有化
- **ノート永続化修正**: closeDatabase()にWALチェックポイント追加。noteHandlers全メソッドにtry-catch+エラーログ
- **フォントサイズ修正**: html要素のfontSizeを直接設定、body font-sizeを1remに、memo-editorをrem化。Tailwind remクラスが自動スケール
- **フェーズ別サウンド選択**: Music画面でW/Rボタンによりサウンドを各フェーズに割当（最大6つ）。DBマイグレーションV8、useWorkscreenSelectionsフック
- **WorkScreenリデザイン**: SoundMixerをコンパクトリスト表示に変更（SoundListItem）。選択済みサウンドのみ表示、未選択時は誘導メッセージ表示

### 2026-02-11 - WorkScreen 5要件修正

#### 概要

WorkScreenの5つの問題を修正: React useEffect警告、音楽削除制限、ポモドーロ設定UI、タブ切替連動、シークコントロール。

#### 変更点

- **SessionType型統一**: `'WORK' | 'REST' | 'LONG_REST'` → `'WORK' | 'BREAK' | 'LONG_BREAK'`に修正（TimerContextの実使用値に合わせる）
- **音楽削除制限**: WorkScreenからのサウンド削除を禁止、Music画面のみ削除可（確認ダイアログ付き）
- **ポモドーロ設定UI**: DurationSelectorをPomodoroSettingsに置換。Work/Break/Long Break/Sessions数を個別設定可能（折りたたみ式）。DurationPickerをpresets/min/max props対応に汎用化。ドットインジケーター表示（●●○○形式）
- **タブ切替連動**: WORK/RESTタブ手動切替でサウンド再生も実際に切り替わるように（mixerOverride機構追加）。SoundMixerのuseEffect+setStateをgetDerivedStateFromPropsパターンに修正
- **シークコントロール**: SoundCard/MusicSoundItemに再生位置スライダー追加。useAudioEngineにseekSound/channelPositions/resetAllPlaybackを追加

### 2026-02-11 - 4機能一括実装（タスクUX強化・タグ分離・Music画面）

#### 概要

タスク管理のUX向上（インライン名前変更、期限管理）、タグシステムの3分離（タスク/ノート/サウンド）、サウンド管理画面の専用化の4機能を実装。DBマイグレーションV5〜V7追加。

#### 変更点

- **タスクヘッダーインライン名前変更**: TaskDetailのh1タイトルをクリックでインライン編集（Enter/Blur保存、Escapeキャンセル）
- **タスク期限（dueDate）**: tasksテーブルにdue_dateカラム追加（V5）、Flagアイコン+DateTimePickerでトグル設定
- **タスクタグ・ノートタグ分離**: 統合tagsテーブル廃止、task_tag_definitions/note_tag_definitionsに分離（V6）、tagRepositoryをファクトリパターンに、IPCチャンネルdb:taskTags:*/db:noteTags:*に移行
- **サウンドタグ+Music画面**: sound_tag_definitions/sound_tag_assignments/sound_display_metaテーブル追加（V7）、SessionセクションをMusicにリネーム、サウンド管理専用画面（検索・タグフィルタ・インライン名前変更・タグ割当）を新規作成

### 2026-02-11 - ポモドーロタイマー強化

#### 概要

ポモドーロタイマーの4つの課題を解決: セッション完了モーダル、タスク完了ボタン、REST中サウンド再生、Work/Rest別サウンド設定。

#### 変更点

- **セッション完了モーダル**: WORK完了時に延長(5〜30分)/休憩選択モーダルを表示（以前は自動でBREAKに遷移）
- **タスク完了ボタン**: WorkScreen上とセッション完了モーダルからタスクをDONEにできる機能を追加
- **REST中サウンド再生**: BREAK/LONG_BREAK中もサウンドが再生されるよう変更（`shouldPlay`からsessionType条件を削除）
- **Work/Rest別サウンド設定**: サウンドミキサーにWork/Restタブを追加、セッション種別ごとに独立したサウンド設定を保存
- **DBマイグレーション(V4)**: sound_settingsテーブルにsession_categoryカラム追加（UNIQUE制約をsound_type+session_categoryに変更）

### 2026-02-11 - 自由メモ（Notes）機能追加

#### 概要

MemoView内にDaily/Notesタブ切替を追加し、日付に縛られないフリーフォームのノート機能を実装。SQLite V3マイグレーション（notes + note_tagsテーブル）、NoteRepository、IPC 11チャンネル、NoteContext、フロントエンドUI（NoteList/NotesView/NoteTagBar）を一括実装。

#### 変更内容

- **Backend**: `migrations.ts` V3追加（notes, note_tags）、`noteRepository.ts` 新規、`noteHandlers.ts` 新規（11チャンネル）、`preload.ts` チャンネル追加、`registerAll.ts` Notes登録追加、`dataIOHandlers.ts` export/import対応
- **Frontend サービス層**: `DataService.ts` / `ElectronDataService.ts` に11メソッド追加、`note.ts` 型定義新規
- **Frontend 状態管理**: `useNotes.ts`（楽観的更新 + fire-and-forget DB同期）、`NoteContext.tsx` / `useNoteContext.ts` 新規、`main.tsx` NoteProvider追加
- **Frontend UI**: `MemoView.tsx` タブコンテナ化、`DailyMemoView.tsx` 既存日記ビュー抽出、`NotesView.tsx`（タイトル編集+ピン+タグ+TipTapエディタ）、`NoteList.tsx`（検索/ソート/タグフィルタ/ピン優先表示）、`NoteTagBar.tsx`（タグ追加・削除UI）
- **TrashBin拡張**: 削除済みノートのセクション追加（復元・完全削除対応）
- **ストレージ**: `MEMO_TAB` localStorage キー追加

### 2026-02-11 - Tips セクション補完

#### 概要

Tips画面のドキュメントを大幅に補完。ShortcutsTabを4カテゴリ/~12件から6カテゴリ/29件に拡充。Memo・Analyticsの新タブを追加（7タブ構成）。既存タブにもコンテキストメニュー、タグ、テンプレート、キーボードショートカット等の欠落情報を追記。

#### 変更内容

- **ShortcutsTab**: 全25+ショートカットを6カテゴリ（Global/Navigation/View/Task Tree/Timer/Calendar）に整理
- **MemoTab**: 新規作成（Daily Memo/Date Navigation/Rich Text Editor/Calendar Integration/Deleting Memos）
- **AnalyticsTab**: 新規作成（Overview Metrics/Completion Rates/Accessing Analytics）
- **Tips.tsx**: memo/analyticsタブ追加（5タブ→7タブ）
- **TasksTab**: Context Menu/Tags/Templatesセクション追加、Task Detailsにショートカット追記
- **TimerTab**: rリセット、⌘⇧Tモーダル開閉を追記
- **CalendarTab**: Keyboard Shortcutsセクション追加（j/k/t/m）

### 2026-02-11 - フォルダ手動完了機能

#### 概要

フォルダの完了判定を子タスクの自動判定から手動チェック方式に変更。フォルダにCheckCircle2ボタンを追加し、ユーザーが明示的に完了/未完了を切り替えられるようにした。

#### 変更内容

- **フォルダ完了方式変更**: `isFolderFullyCompleted()`（再帰的自動判定）を削除し、`node.status === 'DONE'`によるシンプルな判定に変更
- **一括完了**: フォルダ完了時に全子孫（タスク・サブフォルダ）を再帰的にDONEに設定、確認ダイアログ付き
- **完了解除**: フォルダのみTODOに戻す（子タスクは変更しない）
- **進捗カウント表示**: フォルダ名の後ろに `completed/total` を表示（子孫タスクのみカウント）
- **CheckCircle2ボタン**: フォルダ行のホバー時アクションに追加
- **コンテキストメニュー**: 「Complete Folder」/「Mark Incomplete」アクションを追加
- **汎用確認ダイアログ**: `ConfirmDialog`コンポーネントを新規作成

### 2026-02-11 - Windows 互換性対応

#### 概要

macOS 前提で実装されていたキーボードショートカットと表示テキストを Windows 対応。

#### 変更内容

- **プラットフォーム判定ユーティリティ**: `utils/platform.ts` を新規作成（`isMac`, `modSymbol`, `modKey` エクスポート）
- **キーボードショートカット修正**: `e.metaKey` → `(e.metaKey || e.ctrlKey)` に変更（App.tsx, Layout.tsx, TaskTree.tsx）
- **合成イベント廃止**: コマンドパレット・メニューアクションの `window.dispatchEvent(new KeyboardEvent(...))` を `LayoutHandle` ref 経由の直接呼び出しに置換
- **ショートカット表示テキスト**: `⌘` → Windows では `Ctrl` と表示（CommandPalette、BubbleToolbar、ShortcutsTab）
- **LeftSidebar**: ローカル `isMac` 宣言を共通ユーティリティのインポートに統一

### 2026-02-11 - Phase 7: 本番環境対応（自動アップデート・ログ・パフォーマンス監視）

#### 概要

本番運用に向けたインフラ整備。構造化ログ、IPCパフォーマンス計測、自動アップデート機能、診断UIを実装。

#### 変更内容

- **electron-log**: ファイルトランスポート（2MB、ローテーション5）、グローバルエラーキャッチ（uncaughtException/unhandledRejection）
- **console.error→log.error置換**: main.ts、registerAll.ts、dataIOHandlers.tsの全console.errorをelectron-log経由に統一
- **IPCパフォーマンス計測**: 全IPCハンドラの応答時間を自動計測、100ms超のスロークエリを警告ログ出力
- **診断系IPC**: ログ閲覧（レベルフィルタ対応）、ログフォルダオープン、ログエクスポート、メトリクス取得/リセット、システム情報取得
- **自動アップデート**: electron-updater + GitHub Releases、autoDownload=false（ユーザー確認必須）、起動10秒後に非ブロッキングチェック
- **Settings UI**: LogViewer（レベルフィルタ、モノスペースリスト、Export/OpenFolder）、PerformanceMonitor（チャネル別テーブル、システム情報、DBテーブル行数）、UpdateSettings（チェック/ダウンロード/再起動ボタン）
- **更新通知バナー**: アプリ上部に非侵入型バナー（available/downloaded状態で表示、dismissible）
- **Helpメニュー**: 「Check for Updates…」追加
- **コード署名計画書**: macOS notarization + Windows署名の手順・CI/CD統合計画

#### 新規ファイル（12）

- `electron/logger.ts` — electron-log初期化
- `electron/updater.ts` — electron-updater初期化
- `electron/ipc/ipcMetrics.ts` — IPC計測ミドルウェア
- `electron/ipc/diagnosticsHandlers.ts` — 診断系IPCハンドラ
- `electron/ipc/updaterHandlers.ts` — アップデート操作IPCハンドラ
- `frontend/src/types/diagnostics.ts` — 診断系型定義
- `frontend/src/types/updater.ts` — アップデート型定義
- `frontend/src/components/Settings/LogViewer.tsx` — ログビューアUI
- `frontend/src/components/Settings/PerformanceMonitor.tsx` — パフォーマンスモニタUI
- `frontend/src/components/Settings/UpdateSettings.tsx` — アップデート設定UI
- `frontend/src/components/UpdateNotification.tsx` — 更新通知バナー
- `.claude/feature_plans/code-signing-plan.md` — コード署名計画書

### 2026-02-11 - Export/Import修正 + Electronクリーンアップ

#### 概要

バックエンド（Spring Boot）を完全削除し、Electron + SQLiteアーキテクチャに完全移行。Export/Importの堅牢化、デッドコード削除、ドキュメント更新を実施。

#### 変更内容

- **main.ts**: エラーハンドリング強化（uncaughtException/unhandledRejection捕捉）
- **registerAll.ts**: IPC登録の個別try/catch + `[IPC]`プレフィックスログ
- **dataIOHandlers.ts**: Export/Importのエラーハンドリング堅牢化、バックアップ付きインポート
- **devスクリプト改善**: 初回`tsc`実行 → `concurrently`でVite + tsc --watch + Electron同時起動
- **デッドコード削除**: backend/ディレクトリ完全削除、`useTaskTree.ts`削除、未使用storageKeys 9件削除
- **ドキュメント更新**: CLAUDE.md/MEMORY.mdをElectron構成に更新
- **README.md更新**: バックエンド記述削除、IPC/セットアップをElectron構成に更新

### 2026-02-10 - Electron Shell Foundation (Phase 0)

#### 概要

既存ReactアプリをElectronウィンドウで動作させるデスクトップアプリ化の基盤を構築。React側のコード変更は最小限（`vite.config.ts`の`base`設定のみ）。

#### 変更内容

- **electron/main.ts**: BrowserWindow作成（1200x800）、dev/prod分岐ロード、macOS対応
- **electron/preload.ts**: contextBridgeプレースホルダー（`window.electronAPI.platform`）
- **electron/tsconfig.json**: ES2022 + CommonJS出力設定
- **ルートpackage.json**: Electron起動スクリプト（concurrently + wait-on）、パッケージングスクリプト
- **electron-builder.yml**: mac(dmg/zip) + win(nsis) + linux(AppImage)パッケージング設定
- **vite.config.ts**: `base: './'`追加（file://プロトコル対応、Webモードも互換）

#### 新規ファイル

- `electron/main.ts`, `electron/preload.ts`, `electron/tsconfig.json`
- `package.json`（ルート）, `electron-builder.yml`, `resources/.gitkeep`

#### 起動方法

```bash
npm run dev    # Electron + Vite 同時起動
```

### 2026-02-10 - Bubble Toolbar + Command Palette

#### 概要

テキスト選択時のNotionスタイルフローティングツールバーと、`⌘K`コマンドパレットを実装。

#### 変更内容

- **BubbleToolbar**: テキスト選択時にBold/Italic/Strikethrough/Code/Link/TextColorのフローティングツールバー表示
- **Markdown入力ルール無効化**: `**`, `*`, `~~`, `` ` ``の自動変換をOFF（キーボードショートカットは維持）
- **Link UI**: インラインURL入力、既存リンク編集・解除
- **テキスト色**: 10色プリセットのカラーピッカー
- **CommandPalette**: `⌘K`でNavigation/Task/Timer/View計16コマンドを検索・実行
- **`⌘K`競合解決**: エディタ内テキスト選択中はTipTap Linkに委譲

#### 新規ファイル

- `frontend/src/components/TaskDetail/BubbleToolbar.tsx`
- `frontend/src/components/CommandPalette/CommandPalette.tsx`

### 2026-02-10 - コードクリーンアップ & ディレクトリ構造整理

#### 概要

コードベース全体の品質改善。ディレクトリ構造整理、命名規約統一、エラーハンドリング改善、セキュリティ脆弱性修正、バックエンドクラッシュ防止を実施。

#### 変更内容

- **Phase 1**: Barrel `index.ts` 5ディレクトリに追加、ErrorBoundary移動、navigation.ts統合
- **Phase 2**: Context Valueファイル名をPascalCaseに統一（4ファイルリネーム）
- **Phase 3**: サイレントエラー10箇所+JSON.parseエラー3箇所にconsole.warn追加
- **Phase 4**: SlashCommandMenu XSS修正（URL検証）、MIME検証強化（マジックバイトチェック）
- **Phase 5**: H2コンソール制限、循環参照防止、型キャスト安全化、日付パース安全化、JSON解析安全化
- **Phase 6**: `@ControllerAdvice` グローバル例外ハンドラー追加

### 2026-02-10 - サウンド再生エンジン バグ修正

#### 問題

WorkScreenでサウンドカードをクリックしても音声が再生されない不具合。コンソールに以下のエラーが発生:

- `Construction of MediaElementAudioSourceNode is not useful when context is closed.`
- `Construction of GainNode is not useful when context is closed.`
- `[AudioEngine] Playback blocked for fire: The play() request was interrupted by a call to pause().`

#### 原因と修正 (`useAudioEngine.ts`)

1. **AudioContext closed状態の未処理（致命的）**: `ensureContext()`が`state === 'closed'`のContextを再利用していた。React StrictModeやWorkScreen再マウント時にcleanupで`close()`された後、再利用不能なContextでノード作成を試行 → `closed`状態なら新しいAudioContextを作成するよう修正
2. **cleanup後のnull化漏れ（致命的）**: `contextRef.current?.close()`の後に参照を`null`にしていなかったため、closedなContextが残存 → cleanup時に`contextRef.current = null`を追加
3. **play/pause競合（中）**: フェードアウト後の`setTimeout(pause)`がIDを管理されておらず、素早いON→OFF→ON操作で古いpauseが新しいplayを中断 → `pauseTimeoutsRef`でタイムアウトIDを追跡し、play前にキャンセル
4. **unmount時のタイムアウトリーク**: cleanup時に残存するpauseタイムアウトをクリアするよう追加

#### 変更ファイル

- `frontend/src/hooks/useAudioEngine.ts` — 上記4修正

### 2026-02-09 - Timer/Sound API連携 + キーボードショートカット拡張

#### Timer/Sound バックエンドAPI接続

- `ddl-auto` を `create-drop` → `update` に変更（DB永続化）
- `timerClient.ts` / `soundClient.ts` 新規作成（fetch APIベース）
- TimerContext: 楽観的更新パターンでバックエンド同期（設定 + セッション記録）
- break/longBreak/sessionsBeforeLongBreak をハードコードから `useLocalStorage` + API同期に移行
- Sound Mixer: サウンドタイプ別デバウンスPUTでバックエンド同期
- バックエンド不可用時は localStorage フォールバック

#### キーボードショートカット拡張 (Phase 1-4)

- `Cmd+1〜5` — セクション切替（tasks/session/calendar/analytics/settings）
- `↑/↓` — タスクツリー内フォーカス移動
- `→/←` — フォルダ展開/折りたたみ
- `Cmd+Enter` — タスク完了/未完了トグル
- `Tab/Shift+Tab` — タスクインデント/アウトデント
- `r` — タイマーリセット
- `Cmd+Shift+T` — タイマーモーダル開閉
- `j/k` — カレンダー前後移動
- `t` — 今日にジャンプ
- `m` — 月/週表示切替

### 2026-02-09 - Tips画面 + TipTapエディタ拡張 (Plan 008)

#### Tips画面

- LeftSidebarに6つ目のセクション「Tips」追加（Lightbulbアイコン）
- 5タブ構成: Shortcuts / Tasks / Timer / Calendar / Editor
- 全キーボードショートカット一覧、各画面の操作ガイド、スラッシュコマンド一覧を表示

#### TipTapエディタ拡張（4ブロックタイプ追加）

- **Toggle List**: カスタムNode拡張（HTML `<details>`/`<summary>` ベース、開閉可能）
- **Table**: 公式 `@tiptap/extension-table` 系（3×3デフォルト、ヘッダー行付き）
- **Callout**: カスタムNode拡張（💡絵文字 + 背景色付きボックス）
- **Image**: 公式 `@tiptap/extension-image`（URL prompt入力）
- スラッシュコマンドメニューに4コマンド追加、CSSスタイリング追加

### 2026-02-09 - Keyboard Shortcuts 追加

#### 新規ショートカット

- `Cmd+.` — Left Sidebar 開閉トグル（Layout.tsx）
- `Cmd+Shift+.` — Right Sidebar 開閉トグル（Layout.tsx）
- `Cmd+,` — Settings画面に遷移（App.tsx、入力中でも動作）

#### Feature Plan

- `.claude/feature_plans/007-keyboard-shortcuts.md` 作成（セクション切替、タスク操作、タイマー制御、カレンダー操作、コマンドパレットの将来ショートカット提案）

### 2026-02-09 - Calendar Enhancement (Plan 006)

#### フォルダカラーシステム

- フォルダ作成時に10色パステルパレットから自動カラー割当
- タスクは親フォルダのカラーを継承（`resolveTaskColor`）
- バックエンド: Task entity + DTO に `color` カラム追加

#### フォルダタグ

- 親フォルダ階層パスをタグとして表示（例: `Projects/frontend`）
- `FolderTag` コンポーネント（パステルカラーpill/badge）
- TaskDetailHeader + CalendarTaskItem に表示

#### カレンダーからタスク作成

- DayCell hover時に `+` ボタン表示
- クリック → 無題タスク作成（scheduledAt=クリック日付 12:00）→ WorkScreen モーダル即時表示
- `addNode` に `options?: { scheduledAt?: string }` 引数追加

#### Weekly表示 時間軸UI

- Google Calendar風 `WeeklyTimeGrid` コンポーネント新規作成
- 24時間タイムライン + 時刻ラベル + 水平グリッド線
- フォルダカラー付きタスクブロック（`TimeGridTaskBlock`）
- 現在時刻インジケーター（赤い水平線、毎分更新）
- 重複タスクの横並びレイアウト（最大5列）
- 空きスロットクリックで15分刻みスナップ付きタスク作成

#### 新規ファイル

- `frontend/src/constants/folderColors.ts` - カラーパレット
- `frontend/src/constants/timeGrid.ts` - 時間グリッド定数
- `frontend/src/utils/folderColor.ts` - カラー解決ユーティリティ
- `frontend/src/utils/folderTag.ts` - タグパス計算ユーティリティ
- `frontend/src/components/shared/FolderTag.tsx` - フォルダタグbadge
- `frontend/src/components/Calendar/WeeklyTimeGrid.tsx` - 時間軸付き週表示
- `frontend/src/components/Calendar/TimeGridTaskBlock.tsx` - タスクブロック

---

### 2026-02-08 (3) - バグ修正 + Noise Mixer音声再生 + ポリッシュ

#### バグ修正・技術的負債

- **TimerContext stale closure修正**: `advanceSession`のクロージャ問題を`useRef`+`useEffect`パターンで解消
- **TaskNodeContent 300msクリック遅延修正**: ネイティブ`onClick`/`onDoubleClick`に置き換え
- **lint error全件修正**: React Compiler lint error 0件達成
- **バンドルサイズ57%削減**: `MemoEditor`を`React.lazy()`で遅延読み込み（671KB→298KB）

#### Noise Mixer 音声再生

- `useAudioEngine` hook新規作成（Web Audio API, ループ再生, フェードイン/アウト）
- `WorkScreen`で`useLocalSoundMixer`状態をオーディオエンジンに自動連携
- タブ非表示時自動ミュート、アンマウント時リソース解放

#### ポリッシュ

- ブラウザ通知（`Notification API`）+ Settings画面にトグル追加
- キーボードショートカット4種（Space/n/Escape/Delete）

#### 新規ファイル

- `frontend/src/hooks/useAudioEngine.ts` — Web Audio APIラッパー
- `frontend/src/components/Settings/NotificationSettings.tsx` — 通知設定UI

#### 変更ファイル

- `context/TimerContext.tsx` — stale closure修正 + 通知ロジック追加
- `components/TaskTree/TaskNodeContent.tsx` — クリックハンドラ簡素化
- `components/TaskDetail/TaskDetail.tsx` — MemoEditor遅延読み込み
- `components/WorkScreen/WorkScreen.tsx` — `useAudioEngine`統合
- `components/WorkScreen/TaskSelector.tsx` — lint fix（unused `nodes`）
- `components/Settings/Settings.tsx` — NotificationSettings追加
- `constants/sounds.ts` — `file`フィールド追加
- `constants/storageKeys.ts` — `NOTIFICATIONS_ENABLED`追加
- `tsconfig.app.json` — testディレクトリ除外
- `App.tsx` — キーボードショートカットハンドラ追加

### 2026-02-08 (2) - AI Coach 429エラー修正 & モデル移行

- **モデル変更**: `gemini-2.0-flash` → `gemini-2.5-flash-lite`（旧モデル廃止対応）
- **DB自動マイグレーション**: `@PostConstruct migrateDeprecatedModel()` で既存DB内の旧モデル名を自動更新
- **デバッグログ追加**: `RestClientResponseException` 発生時にHTTPステータス・モデル名・レスポンスボディをログ出力
- **エラーメッセージ改善**: Gemini APIのエラー詳細（`message`フィールド）をユーザー向けメッセージに付加
- **taskContentトランケート**: `buildPrompt()` で500文字上限を設定し、不要なトークン消費を防止
- 変更ファイル: `AIService.java`, `AIConfig.java`, `AISettings.java`, `application.properties`, `AISettings.tsx`

### 2026-02-08 - AI Coaching 実装 (Gemini API)

- Backend: `AIConfig` + `AIService` + `AIController` で Gemini API (gemini-2.5-flash-lite) 連携
- Frontend: `useAICoach` hook + `AICoachPanel` コンポーネントを TaskDetail に統合
- 3種のリクエストタイプ: breakdown（ステップ分解）/ encouragement（励まし）/ review（レビュー）
- Vite proxy (`/api` → `localhost:8080`) 追加

### 2026-02-07 (3) - Phase 2 重複排除 (D1-D4)

#### 変更内容

- **D2: localStorage定数集約**: 全6キーを`constants/storageKeys.ts`に集約、各ファイルのハードコード文字列を定数参照に置換
- **D3: 汎用`useLocalStorage`フック**: `hooks/useLocalStorage.ts`を新規作成し、ThemeContext / TimerContext / Layout / useLocalSoundMixer の手動read/write処理を統一
- **D1: DurationPicker統一**: DurationSelector.tsx と TaskDetailHeader.tsx の完全重複コード（PRESETS定数、formatDuration関数、±ステップロジック、プリセットグリッド）を`components/shared/DurationPicker.tsx`に統合
- **D4: コンポーネント外定数の整理**: D1で解決済み（PRESETS移動）、SlashCommandMenuのCOMMANDS配列は現状維持

#### 新規ファイル

- `frontend/src/constants/storageKeys.ts` — localStorage キー定数
- `frontend/src/hooks/useLocalStorage.ts` — 汎用localStorage永続化フック
- `frontend/src/components/shared/DurationPicker.tsx` — 共通Duration Pickerコンポーネント
- `frontend/src/utils/duration.ts` — formatDuration ユーティリティ関数

#### 変更ファイル

- `hooks/useTaskTree.ts` — STORAGE_KEYS定数参照に置換
- `hooks/useLocalSoundMixer.ts` — STORAGE_KEYS + useLocalStorageで書き換え
- `context/TimerContext.tsx` — STORAGE_KEYS + useLocalStorageで書き換え
- `context/ThemeContext.tsx` — STORAGE_KEYS + useLocalStorageで書き換え
- `components/Layout/Layout.tsx` — STORAGE_KEYS + useLocalStorageで書き換え
- `components/WorkScreen/DurationSelector.tsx` — DurationPickerラッパーに簡素化
- `components/TaskDetail/TaskDetailHeader.tsx` — DurationPicker + formatDuration使用に統合

### 2026-02-07 (2) - フロントエンド コード品質分析 & リファクタリングプラン作成

#### 変更内容

- **包括的コード品質調査**: フロントエンド49ファイル・約2,440行を分析し、バグ温床6件・重複4件・効率改善6件を特定
- **Phase 1 バグ修正プラン**: TimerContext config未メモ化、MemoEditor stale closure、TaskTreeNode click競合、Error Boundary未実装の4件を具体的なBefore/Afterコード例付きで文書化
- **Phase 2-4 将来対応概要**: 重複排除、コンポーネント分割、パフォーマンス最適化の方針を記載
- **API移行設計指針**: Repository Patternによるデータアクセス抽象化、非同期化への備えを記載

#### 新規ファイル

- `.claude/current_plans/002-frontend-refactoring.md` — リファクタリングプランドキュメント

### 2026-02-07 - ドキュメント構造の再編成

#### 変更内容

- **ドキュメント分類体系を導入**: `.claude/` 配下に `current_plans/`（進行中）、`feature_plans/`（将来予定）、`archive/`（完了済み）を新設
- **ライフサイクル**: `feature_plans/` → `current_plans/` → `archive/` のフローで管理
- **TODO.md**: 完了タスクを削除し、簡潔なロードマップに書き換え。各項目から `feature_plans/` へリンク
- **CHANGELOG.md**: 新規作成。Phase 1/2 の全完了タスク履歴を集約
- **既存ドキュメント移動**:
  - `docs/documentation-update-plan.md` → `current_plans/001-documentation-sync.md`
  - `docs/UI_Implementation_Plan.md` → `archive/001-ui-implementation-phase2.md`
  - `docs/code-integrity-report.md` → `archive/002-code-integrity-review.md`
- **feature_plans 新規作成**: AI Coaching / Noise Mixer音声再生 / Polish & Enhancement / Backend再統合

### 2026-02-06 (2) - UI拡張: グローバルタイマー + サブサイドバー

#### 実装済み

- **TimerContext**: タイマーをReact Contextに昇格、全コンポーネントから共有可能に
  - `activeTask`状態（タイマーと紐づくタスク情報）
  - `startForTask(id, title)` / `clearTask()` / `setWorkDurationMinutes()`
  - 作業時間をlocalStorageに永続化（5〜60分、デフォルト25分）
- **モーダル化**: WorkScreenのフルスクリーンオーバーレイを中央配置モーダルに変更
  - バックドロップクリック / ESCキーで閉じる（タイマーはバックグラウンドで継続）
- **サイドバータイマー表示**: Session下にタスク名・残り時間・Pencil編集ボタンを表示
- **TaskTreeタイマー表示**: アクティブタスク行に残り時間テキスト + ミニプログレスバー + Pauseアイコン
- **SubSidebar**: Inbox（ルートタスク）+ フォルダ一覧でタスク絞り込み、新規フォルダ作成UI
- **DurationSelector**: +/-ボタン（5分刻み）+ プリセット（15/25/30/45/60分）、実行中はdisabled
- **プログレスバードット**: 現在位置に12pxのドットインジケータ、1秒スムーズトランジション

#### 新規ファイル

- `frontend/src/context/TimerContextValue.ts` — Timer Context型定義
- `frontend/src/context/TimerContext.tsx` — TimerProvider
- `frontend/src/hooks/useTimerContext.ts` — Consumerフック
- `frontend/src/components/Layout/SubSidebar.tsx` — プロジェクトナビゲーション
- `frontend/src/components/WorkScreen/DurationSelector.tsx` — タイマー時間選択UI

#### 変更ファイル

- `main.tsx` — TimerProvider追加
- `App.tsx` — isTimerModalOpen + selectedFolderId状態、フォルダナビ連携
- `WorkScreen.tsx` — Context化、モーダルUI、DurationSelector追加
- `TimerProgressBar.tsx` — ドットインジケータ追加
- `Sidebar.tsx` — タイマー表示+編集ボタン
- `Layout.tsx` — SubSidebar条件レンダリング
- `TaskTreeNode.tsx` — タイマー表示+ミニプログレスバー
- `TaskTree.tsx` — selectedFolderIdでフィルタリング

### 2026-02-06 - 実装状況まとめ

#### 実装済み

- **Backend全体**: Task/Timer/Sound の3ドメイン（Controller/Service/Repository/Entity）、CORS設定、H2 DB
- **TaskTree**: 階層型タスク管理（フォルダ/サブフォルダ/タスク）、@dnd-kitによるDnD並び替え、ソフトデリート
- **WorkScreen**: ポモドーロタイマー + サウンドミキサー統合画面
- **FocusTimer**: WORK/BREAK/LONG_BREAK、セッション数カウント、プログレスバー、設定カスタマイズ
- **NoiseMixer**: 6種の環境音選択UI + 音量スライダー
- **Settings**: ダークモード/ライトモード、フォントサイズ（S/M/L）、ゴミ箱

#### 以降のバージョンで実装済み

- AIコーチング → 2026-02-08 実装（Gemini API連携）
- 音声再生 → 2026-02-08 実装（Web Audio API）
- キーボードショートカット → 2026-02-09 実装
- 通知機能 → 2026-02-08 実装（ブラウザ通知）

### 2025-02-06 - プロジェクト初期化

#### Completed

- プロジェクト仕様書の作成 (Application_Overview.md)
- 開発ドキュメント構成の策定
  - CLAUDE.md: 開発ガイド・作業指示
  - MEMORY.md: 技術仕様（API/データモデル）
  - README.md: 開発ジャーナル
  - TODO.md: 実装タスクリスト
  - ADR: アーキテクチャ決定記録

#### Learnings

- Claude Code用のドキュメント構成
  - CLAUDE.md: プロジェクトルートに配置、作業指示・コーディング規約
  - MEMORY.md: ~/.claude/projects/配下、セッション間で保持される技術仕様
- 日本語（概要）+ 英語（技術仕様）の二言語運用が効果的

---

## セットアップ

### 前提条件

- Node.js 18+
- npm

### インストール

```bash
npm install    # postinstallでfrontend依存 + electron-rebuild自動実行
```

### 起動

```bash
npm run dev    # Vite(5173) + tsc --watch + Electron 同時起動
```

---

## ドキュメント

- [開発ガイド](.claude/CLAUDE.md)
- [仕様書](.claude/docs/Application_Overview.md)
- [アーキテクチャ決定記録](.claude/docs/adr/)
- [ロードマップ](TODO.md)
- [完了履歴](CHANGELOG.md)
- [実装プラン](.claude/feature_plans/)
