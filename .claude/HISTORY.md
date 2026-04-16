# HISTORY.md - 変更履歴

### 2026-04-16 - Tauri 2.0 IPC 引数キー名修正 (snake_case → camelCase)

#### 概要

Tauri 2.0 の `#[tauri::command]` マクロがデフォルトで引数名を camelCase にリネームする仕様により、TauriDataService.ts が snake_case キーで送信していたためコマンド呼び出しが失敗していた。Schedule タブ表示時の `db_schedule_items_fetch_by_date_range` エラーを起点に発覚。約80箇所の引数キーを一括修正。

#### 変更点

- **TauriDataService.ts**: 全 `tauriInvoke` 呼び出しの引数オブジェクトキーを snake_case → camelCase に変換（約80箇所）。Timer, Sound, Memo, Notes, Calendar, Routines, Schedule Items, Routine Groups, Playlists, Wiki Tags, Wiki Tag Groups/Connections, Note Connections, Paper Boards/Nodes/Edges, Database, Files, Copy の全セクション対象
- **短縮プロパティ活用**: `{ start_date: startDate }` → `{ startDate }` のように、変数名とキー名が一致する箇所は短縮プロパティ表記に統一

### 2026-04-16 - Electron コード・依存関係の完全削除

#### 概要

Tauri 2.0 移行完了後に残存していた Electron アーティファクト（ディレクトリ、依存関係、コード参照、CI/CD）を全削除。root node_modules を 709 MB → 37 MB に削減。CI/CD を Tauri ビルドに書き換え。

#### 変更点

- **ディレクトリ削除**: `electron/`（1.3 MB、compiled dist）、`scripts/`（notarize.js — Electron macOS notarization）、`build/`（entitlements.mac.plist — Electron entitlements）、`code-review-report.md`（旧レビューレポート）
- **容量削減**: root `node_modules/` 709 MB → 37 MB（672 MB 削減）、`package-lock.json` を再生成（stale な Electron 依存を除去）
- **ファイルリネーム**: `useElectronMenuActions.ts` → `useMenuActions.ts`（interface/function 名も更新）、`electronAccelerator.ts` → `accelerator.ts`。消費側の `App.tsx`、`KeyboardShortcuts.tsx` の import 更新
- **型・UI クリーンアップ**: `SystemInfo` から `electronVersion`/`nodeVersion` 削除、`PerformanceMonitor.tsx` から Electron InfoCard 削除（grid 4→3列）、i18n の `performance.electron` キー削除（en/ja）、mockDataService のモック更新
- **CI/CD 書き換え**: `.github/workflows/build.yml` を `electron-builder` → `tauri-apps/tauri-action@v0` に全面書き換え（macOS + Windows、Rust cache、Tauri 成果物パス）
- **ドキュメント更新**: `.gitignore` から Electron エントリ削除、`.claude/rules/` 3ファイル（project-debug.md, project-patterns.md, project-review-checklist.md）を Tauri パターンに更新
- **CSS**: `index.css` のコメント `Electron titlebar drag regions` → `Titlebar drag regions`

### 2026-04-16 - Tauri 2.0 Migration: Phase 5 iOS Target (Steps 5.1-5.3)

#### 概要

Tauri 2.0 の iOS サポートを追加。デスクトップ専用モジュールの条件コンパイル、iOS プロジェクト初期化、フロントエンドのモバイル検出・ローカルモード対応を実装。Desktop/iOS 両ターゲットでコンパイル成功。

#### 変更点

- **Cargo.toml**: `portable-pty`, `notify`, `notify-debouncer-mini`, `trash` を `[target.'cfg(not(target_os = "ios"))'.dependencies]` に分離。`tauri-plugin-global-shortcut`, `tauri-plugin-window-state`, `tray-icon` feature も同セクション
- **lib.rs**: 5モジュール（terminal, tray, shortcuts, file_watcher, menu）を `#[cfg(not(mobile))]` でゲート。プラグイン登録・setup・on_window_event も条件分岐
- **terminal_commands.rs**: desktop/mobile 分離。iOS では5コマンド全てエラースタブ（State<PtyState> 不要）
- **system_commands.rs**: `system_set_tray_enabled`, `system_reregister_global_shortcuts`, `tray_update_timer` の OS 操作部分を `#[cfg(not(mobile))]` でゲート（DB操作は共通）
- **files_commands.rs**: `files_delete` の `trash::delete` をゲート（iOS は `std::fs::remove_file/remove_dir_all`）、`files_select_folder` の `blocking_pick_folder` をデスクトップ限定に
- **capabilities**: `default.json` に `"platforms": ["macOS", "windows", "linux"]` 追加、`mobile.json` 新規作成（iOS 用最小権限: core, shell, dialog, notification）
- **bridge.ts**: `isTauriMobile()` 追加（UserAgent ベースの同期判定）
- **main.tsx**: `const isMobile = !isTauri() || isTauriMobile()` に変更。Tauri iOS → MobileApp レンダリング
- **MobileApp.tsx**: `local` prop 追加。ローカルモード時は ConnectionSetup スキップ、realtimeState/onlineStatus を定数で上書き
- **useOnlineStatus.ts**: API 未設定時にヘルスチェックポーリングをスキップ
- **MobileSettingsView.tsx**: `local` prop 追加。ローカルモード時は接続セクション非表示
- **iOS init**: `cargo tauri ios init` で `src-tauri/gen/apple/` Xcode プロジェクト生成

- 2026-04-16: [途中] TitleBar ドラッグ修復 + タイトル修正 — タイトル「Life Editor」変更、pl-[88px]間隔修正、isMac を navigator.userAgent ベースに変更、Tauri capabilities に allow-start-dragging 追加、getCurrentWindow().startDragging() による全域ドラッグ実装済み。動作確認待ち

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

<!-- older entries archived to HISTORY-archive.md -->
