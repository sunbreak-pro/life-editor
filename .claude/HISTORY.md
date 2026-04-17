# HISTORY.md - 変更履歴

### 2026-04-17 - CLAUDE.md 現状コード反映更新

#### 概要

Tauri 2.0 移行・機能追加後の CLAUDE.md を現在のコードベースと照合し、5箇所の差分を修正。

#### 変更点

- **モバイル判定**: `isTauri() が false` → `isTauriMobile() が true`（Tauri + iOS デバイス判定）に修正
- **Provider スタック（Desktop/Mobile）**: Calendar と Memo の間に `Template` を追加（TemplateProvider の記載漏れ）
- **ソフトデリート対象**: Templates を追加（Tasks/Notes/Memos/Routines/Databases/Templates）
- **SectionId**: `schedule/materials/connect/work/analytics/settings` の6値を明記（旧 tasks/memo/trash/tips は廃止済み）
- **ID 生成**: `generateId(prefix)` 関数名を明記、UUID 例を `note-xxxxxxxx-xxxx-...` に修正

### 2026-04-16 - Tauri 2.0 Migration: Phase 6 Cloud Sync (CF Workers + D1)

#### 概要

Cloudflare Workers + D1 によるクラウド同期機能を実装。Desktop ↔ iOS 間のデータ同期を実現。Cloud backend (Hono REST API)、Rust sync engine (delta query + batch apply + HTTP client)、Frontend integration (SyncProvider + Settings UI) の3層を新規構築。

#### 変更点

- **Cloud Backend (`cloud/`)**: Hono + Wrangler プロジェクト新規作成。D1 スキーマ（10 versioned テーブル + 8 relation テーブル）、Token 認証ミドルウェア、3 API エンドポイント（`/sync/full`, `/sync/changes`, `/sync/push`）。Last-write-wins 競合解決（version カラム比較）
- **Rust Sync Engine (`src-tauri/src/sync/`)**: `sync_engine.rs`（collect_local_changes / collect_all / apply_remote_changes）、`http_client.rs`（reqwest + rustls-tls で iOS 対応）、`types.rs`（SyncPayload / SyncResult / SyncStatus / SyncError）。5 Tauri コマンド（sync_configure / sync_trigger / sync_get_status / sync_disconnect / sync_full_download）
- **Frontend Integration**: SyncProvider/Context（ADR-0002 Pattern A 3ファイル構成）、30秒ポーリング同期、`sync_complete` Tauri Event によるデータ再取得トリガー。Desktop Settings（Advanced > Cloud Sync）+ Mobile Settings に同期設定 UI。DataService + TauriDataService に5メソッド追加
- **Bug fix**: `create_full_schema()` の memos/notes テーブルに欠落していた `version INTEGER DEFAULT 1` カラムを追加
- **Bug fix**: `sync_engine.rs` の SQL 文字列補間を `query_all_json_with_params()` によるパラメータバインドに修正
- **Bug fix**: `SyncContext.tsx` の `isSyncing` stale closure 問題を useRef ガードで修正（interval リセットループ防止）
- **helpers.rs**: `query_all_json_with_params()` ヘルパー関数追加（パラメータ付き SQL クエリ）
- **i18n**: en.json / ja.json に sync セクション（16キー）追加
- **mockDataService.ts**: sync 5メソッドのモック追加
- **Cargo.toml**: `reqwest` 依存追加（rustls-tls feature、iOS OpenSSL 不要）

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

<!-- older entries archived to HISTORY-archive.md -->
