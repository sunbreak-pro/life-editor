# HISTORY.md - 変更履歴

### 2026-04-16 - Tauri 2.0 Migration: Phase 2.2〜2.7 システム統合完了

#### 概要

Tauri 2.0 移行の Phase 2（システム統合）全 7 ステップを完了。Electron の OS 統合機能（トレイ、ショートカット、ファイルシステム、リマインダー、Claude/MCP 等）を Rust に移植。フロントエンドの Electron 直接呼び出しを全て bridge/DataService 経由に修正。

#### 変更点

- **Phase 2.2 — システムトレイ**: `tray.rs` 新規作成（setup_tray, remove_tray, update_timer, toggle_window_visibility）、`system_commands.rs` の tray_update_timer 実装 + system_set_tray_enabled に動的トグル追加、`TimerContext.tsx` を DataService 経由に修正、`main.tsx` に isTauri() 判定追加（デスクトップ/モバイル振り分け）、Cargo.toml に `image-png` feature 追加
- **Phase 2.3 — グローバルショートカット**: `shortcuts.rs` 新規作成（register_shortcuts, unregister_all — menu_action イベント emit）、`tauri-plugin-global-shortcut` 追加、`system_reregister_global_shortcuts` 実装、`useElectronMenuActions.ts` を events.ts ブリッジ経由に修正 + toggleTimer/quickAddTask ハンドラ追加、`KeyboardShortcuts.tsx` の isElectronEnv → isDesktopEnv に修正
- **Phase 2.4 — アップデーター**: `updater_commands.rs` に updater_status イベント emit 骨格（署名設定後に plugin 化予定）
- **Phase 2.5 — ファイルシステム+監視**: `files_commands.rs` 全13コマンド実装（path traversal 検証、MIME 判定、50MB 上限、trash 削除）、`file_watcher.rs` 新規作成（notify crate + 150ms デバウンス + files_changed イベント）、`tauri-plugin-dialog` 追加
- **Phase 2.6 — リマインダー+自動アーカイブ**: `reminder.rs` 新規作成（60秒間隔、3種チェック: タスク/per-item/デイリーレビュー + notification plugin）、`auto_archive.rs` 新規作成（6時間間隔、完了タスク soft delete）、`tauri-plugin-notification` 追加
- **Phase 2.7 — Claude/MCP**: `claude_commands.rs` 新規作成（7コマンド: registerMcp, readClaudeMd, writeClaudeMd, listAvailableSkills, listInstalledSkills, installSkill, uninstallSkill）、`ClaudeSetupSection.tsx`, `ClaudeMdEditor.tsx`, `SkillsManager.tsx` を bridge 経由に修正
- **lib.rs**: 5 mod 追加（shortcuts, file_watcher, reminder, auto_archive）、3 plugin 登録（global-shortcut, dialog, notification）、バックグラウンドサービス起動、7 Claude コマンド登録
- **capabilities/default.json**: core:tray:default, global-shortcut 4権限, dialog:default, notification:default 追加
- **Cargo.toml**: tauri-plugin-global-shortcut, tauri-plugin-dialog, tauri-plugin-notification, trash, notify, notify-debouncer-mini, tokio, dirs 追加

### 2026-04-16 - Tauri 2.0 Migration: Phase 0.2 + Phase 1 + Phase 2.1

#### 概要

Tauri 2.0 移行の中核実装。フロントエンド IPC ブリッジ層（Phase 0.2）、Rust DB層全27リポジトリ+全コマンド（Phase 1）、ウィンドウ管理+ネイティブメニュー（Phase 2.1）を完了。`cargo check` パス。

#### 変更点

- **Phase 0 Step 0.2 — IPC ブリッジ**: `bridge.ts`（isTauri + tauriInvoke）、`events.ts`（6イベントリスナー統一API）、`TauriDataService.ts`（DataService 全243メソッドの Tauri 実装 ~1200行）、`dataServiceFactory.ts`（isTauri 分岐追加）、`@tauri-apps/api@^2` 依存追加
- **Phase 1 Step 1.1 — DB 初期化**: `db/mod.rs`（DbState + init_database）、`db/migrations.rs`（V59 consolidated schema + incremental migrations）
- **Phase 1 Step 1.2 — リファレンス実装**: `db/helpers.rs`（soft_delete/restore/permanent_delete ヘルパー）、`db/task_repository.rs`（TaskNode CRUD + syncTree）
- **Phase 1 Step 1.3 — 全リポジトリ+コマンド**: 27 リポジトリ（timer, memo, note, sound, schedule_item, routine, wiki_tag, paper_board, database, playlist, attachment, custom_sound 等）+ 32 コマンドファイル（`#[tauri::command]` 全登録）
- **Phase 2.1 — ウィンドウ+メニュー**: `tauri-plugin-window-state`（ウィンドウ状態永続化）、`menu.rs`（File/Edit/View/Window/Help ネイティブメニュー + フロントエンドへのイベント送信）
- **lib.rs**: 全コマンド登録 + DB初期化 + plugin 初期化 + メニューセットアップ

- 2026-04-15: [途中] Capacitor iOS Standalone App — Step 1-3 完了（Capacitor init, StandaloneDataService, スタンドアロンモード対応）。Step 4（Xcode ビルド&テスト）待ち

### 2026-04-15 - テンプレート内容編集をコンテンツエリアに移動

#### 概要

テンプレートの内容編集をサイドバー内の小さなインラインエディタからメインコンテンツエリアのフル MemoEditor に移動。NotesView と同じパターンで、サイドバーのテンプレート選択→コンテンツエリア表示を実現。

#### 変更点

- **useTemplates フック拡張**: `selectedTemplateId` / `setSelectedTemplateId` / `selectedTemplate` を追加。テンプレート選択状態を Context 経由で共有
- **TemplateManager リファクタ**: インライン TipTap エディタ（TemplateEditor）を完全削除。サイドバーリスト専用化。クリックで `onSelectTemplate` を呼び、選択中テンプレートをハイライト表示
- **TemplateContentView 新規作成**: NotesView パターン準拠のコンテンツエリアコンポーネント。テンプレート名 `<input>` インライン編集 + ★Note/Daily デフォルトトグル + 削除ボタン + フル LazyMemoEditor
- **IdeasView / MaterialsView 統合**: `selectedTemplateId` があれば TemplateContentView を表示、Note/Daily 選択時にテンプレート選択を自動解除
- **MaterialsSidebar / DailySidebar**: `onSelectTemplate` / `selectedTemplateId` props を TemplateManager に伝播
- **i18n**: `selectTemplate`, `defaultNoteShort`, `defaultDailyShort` を en/ja に追加

### 2026-04-15 - notion-timer / Sonic Flow → Life Editor 完全リネーム

#### 概要

プロジェクト全体から旧アプリケーション名（notion-timer、Sonic Flow、sonic-flow）の参照を Life Editor / life-editor に統一。ソースコード1ファイル + ドキュメント/ルール15ファイルを更新。マイグレーション/後方互換コードと HISTORY-archive.md の歴史的記録は意図的に旧名を保持。

#### 変更点

- **ソースコード**: `electron/services/claudeSetup.ts` のスキルパス `projects/notion-timer` → `projects/life-editor`
- **ルール**: `.claude/rules/project-debug.md` の診断コマンドパス `sonic-flow` → `life-editor`
- **設計書（life-editor-v2/）**: 5ファイル（00-vision〜04-ui-adjustment）の全旧名称を置換
- **コード解説ドキュメント**: 3ファイル（00-index, 01-architecture, 02-infrastructure）のアプリ名・localStorage キー名・Java パッケージ名を更新
- **機能計画**: 5ファイルの Project パスを `/dev/apps/life-editor` に更新
- **アーカイブ/ロードマップ**: 2ファイルのプロジェクト名・タイトルを更新
- **意図的に保持**: `renameMigration.ts`、`migrateStorageKeys.ts`、`dataIOHandlers.ts`（マイグレーション/後方互換）、`HISTORY-archive.md`（歴史的記録）

### 2026-04-14 - Note/Daily テンプレート機能 + フォルダアクションボタン + DnD修正

#### 概要

Note/Daily 作成時にリッチテキストテンプレートを自動適用するテンプレートシステムを新規実装。Note サイドバーのフォルダにホバー時の＋ボタン追加。展開中フォルダへの DnD ドロップがフォルダ外に配置されるバグを修正。

#### 変更点

- **DB Migration V59**: `templates` テーブル新規作成（id, name, content, is_deleted, deleted_at, version, created_at, updated_at）
- **templateRepository + templateHandlers**: CRUD リポジトリ・IPC ハンドラ新規作成（6チャンネル: fetchAll, fetchById, create, update, softDelete, permanentDelete）
- **DataService 全層**: Template CRUD 6メソッドを DataService / ElectronDataService / OfflineDataService / RestDataService / mockDataService に追加
- **useTemplates フック**: テンプレート管理（CRUD + デフォルト設定）。デフォルトID は `app_settings` テーブルに `default_template_note` / `default_template_daily` キーで保存
- **Template Context (Pattern A)**: `TemplateContextValue.ts` + `TemplateContext.tsx` + `useTemplateContext.ts` の3ファイル構成。デスクトップ/モバイル両方の Provider ツリーに追加
- **TemplateManager UI**: サイドバー下部に配置。テンプレート一覧・インライン名前編集・TipTap 内容編集・★デフォルトトグル・削除確認ダイアログ。Note/Daily 両サイドバーに統合
- **テンプレート適用**: Note 作成時に `getDefaultNoteContent()` で初期コンテンツ設定。Daily 作成時も同様
- **createNote parentId 対応**: `noteRepository.create()` / IPC / DataService 全層に `parentId` パラメータ追加
- **NoteTreeNode フォルダアクション**: フォルダホバー時に `Plus`（+ノート）/ `LucideFolderPlus`（+フォルダ）ボタン表示。クリックでフォルダ直下に作成 + 自動展開
- **DnD バグ修正**: `useNoteTreeDnd` に `expandedIds` パラメータ追加。展開中フォルダの下部にドロップ → フォルダ内先頭に挿入（`moveNodeInto` に `insertIndex` パラメータ追加）
- **テスト**: `useNoteTreeMovement.test.ts` 新規作成（5テスト: moveNodeInto default/insertIndex=0/reject non-folder/reject already-in-target/reject circular）
- **i18n**: `templates.*` キー10件を en/ja に追加

<!-- older entries archived to HISTORY-archive.md -->
