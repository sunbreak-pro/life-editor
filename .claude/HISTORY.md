# HISTORY.md - 変更履歴

### 2026-04-16 - Tauri 2.0 Migration: Phase 4 Step 4.3 Electron/Capacitor コード完全削除

#### 概要

Tauri 2.0 移行の Phase 4 Step 4.3 を完了。Electron/Capacitor の全コードを削除し、フロントエンドを Tauri 一本化。Phase 0〜4 全完了により、Electron → Tauri 2.0 のコア移行が完了。

#### 変更点

- **ファイル削除（~130ファイル）**: `electron/` ディレクトリ全体（95ファイル）、`frontend/ios/`（Capacitor iOS）、`ElectronDataService.ts`/`OfflineDataService.ts`/`StandaloneDataService.ts`/`RestDataService.ts`/`SyncQueue.ts`（5サービス計~5,000行）、`frontend/src/db/`（indexedDb.ts, syncOperations.ts）、`frontend/src/types/electron.d.ts`、`MobileAccessSettings.tsx`、`electron-builder.yml`、`frontend/capacitor.config.ts`
- **dataServiceFactory.ts**: 4種の DataService 分岐を削除、常に `TauriDataService` を返すように簡素化（69行→22行）
- **events.ts**: 6関数の `if (isTauri()) ... else window.electronAPI` フォールバックを除去、Tauri `listen()` 直接呼び出しに統一
- **terminalBridge.ts**: 5関数の Electron フォールバック除去、`tauriInvoke` 直接呼び出しに統一
- **コンポーネント修正（14ファイル）**: `ClaudeMdEditor`/`ClaudeSetupSection`/`SkillsManager` の `isTauri()` 分岐除去、`UpdateSettings`/`UpdateNotification`/`useReminderListener`/`useFileExplorer` を `events.ts` ブリッジ経由に移行、`main.tsx`/`MobileApp.tsx`/`useOnlineStatus.ts`/`MobileSettingsView.tsx`/`KeyboardShortcuts.tsx` から `isElectron`/`isStandalone` 参照除去
- **platform.ts**: Mac 判定を `window.electronAPI?.platform` から `navigator.userAgent` ベースに変更
- **TerminalPanel.tsx**: `window.electronAPI?.invoke("window:close")` → Tauri `getCurrentWindow().close()` に変更
- **Settings.tsx**: MobileAccessSettings セクション除去（Electron LAN サーバー削除に伴い）
- **Bug fix**: async event listener 4箇所に disposed フラグパターン追加（race condition 防止）
- **package.json**: root から Electron/Capacitor 依存13パッケージ削除、scripts を `cargo tauri dev`/`cargo tauri build` に更新。frontend から `@capacitor/core`/`idb`/`qrcode-generator` 削除
- **CLAUDE.md**: アーキテクチャを Electron → Tauri 2.0 に全面更新（全体構成、DataService、開発コマンド、コマンド追加手順）
- **README.md**: 技術スタック・セットアップ手順を Tauri 2.0 に更新

### 2026-04-16 - Tauri 2.0 Migration: Phase 4 Data I/O + Diagnostics

#### 概要

Tauri 2.0 移行の Phase 4 Step 4.1-4.2 を完了。Data I/O（export/import/reset）3コマンドと Diagnostics 6コマンドのスタブを Rust で本実装。全 V59 テーブル対応のリセット、バックアップ付きインポート/リセット、ファイルダイアログ連携を実装。

#### 変更点

- **helpers.rs**: `query_all_json()` / `query_one_json()` 汎用クエリヘルパー追加。既存 `fetch_deleted_json()` を `query_all_json` のラッパーにリファクタ。`row_to_json()` で ValueRef マッピングを共通化
- **data_export**: `tauri-plugin-dialog` で save dialog → 15テーブル（tasks, timer_settings, timer_sessions, sound_settings, sound_presets, memos, notes, sound_tag_definitions, sound_tag_assignments, sound_display_meta, calendars, routines, routine_tag_assignments, routine_tag_definitions, schedule_items）をクエリ → JSON メタデータ付きファイル出力
- **data_import**: open dialog → JSON パース → バリデーション（app名, version, 14 array フィールド, tasks スキーマ検証）→ DB バックアップ作成 → トランザクション内で 13テーブル DELETE + 14エンティティ INSERT（timer_settings は UPDATE）→ 失敗時ロールバック
- **data_reset**: DB バックアップ → 全 V59 テーブル DELETE（44テーブル、FK依存順）→ timer_settings デフォルトリセット → custom-sounds ファイル削除
- **diagnostics_fetch_logs**: ログファイル解析（regex パース、level フィルタ、limit 対応）。ログファイル未存在時は空配列
- **diagnostics_open_log_folder**: `open` crate で `{userData}/logs/` を Finder で開く
- **diagnostics_export_logs**: save dialog → ログファイルコピー
- **diagnostics_fetch_system_info**: DB ファイルサイズ + 6テーブル COUNT(\*) + platform/arch/appVersion
- **Bug fix**: `as_path().unwrap()` → `as_path().ok_or()` に修正（3箇所、パニック防止）

### 2026-04-16 - Tauri 2.0 Migration: Phase 3 ターミナル PTY

#### 概要

Tauri 2.0 移行の Phase 3 を完了。Electron の node-pty ベースターミナルを Rust の portable-pty に移植。ClaudeDetector（Claude Code 状態検出）も Rust に移植。フロントエンド全 19 箇所の直接 IPC 呼び出しを terminalBridge.ts 経由に統一し、Electron/Tauri 両対応を実現。

#### 変更点

- **portable-pty (Rust)**: `pty_manager.rs` 新規作成 — PtyState（Mutex<HashMap> セッション管理）、セッション毎の専用 OS スレッドで blocking read + 16ms バッチング、`terminal_data` / `terminal_claude_status` イベント emit
- **ClaudeDetector (Rust)**: `claude_detector.rs` 新規作成 — ANSI ストリッピング（regex）、状態機械（inactive/idle/thinking/generating/tool_use/error）、100ms debounce（poll 方式）、LazyLock コンパイル済み regex パターン
- **5 Tauri コマンド**: `terminal_commands.rs` — terminal_create, terminal_write, terminal_resize, terminal_destroy, terminal_claude_state
- **terminalBridge.ts**: 新規作成 — isTauri() で Electron/Tauri を振り分ける 5 関数（create, write, resize, destroy, claudeState）
- **フロントエンド置換**: `useTerminalLayout.ts`（6箇所）、`TerminalPane.tsx`（10箇所 + onTerminalData を events.ts 経由に変更）、`Layout.tsx`（2箇所）— 全 19 箇所の `window.electronAPI?.invoke("terminal:...")` を bridge 経由に統一
- **バグ修正**: TerminalPane.tsx の `onTerminalData` async unlisten に race condition 修正（disposed フラグパターン）
- **Cargo.toml**: portable-pty 0.8, regex 1, tokio sync feature 追加
- **lib.rs**: `mod terminal` + PtyState 管理 + 5 コマンド登録 + window destroy 時 cleanup

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

<!-- older entries archived to HISTORY-archive.md -->
