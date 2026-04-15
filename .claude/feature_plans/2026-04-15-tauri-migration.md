# Plan: Electron + Capacitor → Tauri 2.0 移行

**Status:** PLANNED
**Created:** 2026-04-15
**Task:** Tauri 2.0 Migration（MEMORY.md）
**Project:** /Users/newlife/dev/apps/notion-timer
**Supersedes:** `2026-04-14-capacitor-ios-standalone.md`（Phase 1 完了済み、Phase 2 クラウド同期は Tauri 移行後に統合）

---

## Context

Life Editor は現在 Electron (Desktop) + Capacitor (iOS) の2フレームワーク構成。これには構造的な非効率がある:

- **2つの異なるDB**: Desktop は SQLite (better-sqlite3)、Mobile は IndexedDB — 異種DB間の同期が複雑
- **2つの DataService**: ElectronDataService + StandaloneDataService (1706行) の重複
- **Electron のリソース消費**: バンドル 200MB+、メモリ 300-500MB
- **IndexedDB の制約**: WKWebView での性能制限、OS による消去リスク、型安全性なし (`Record<string, unknown>`)

**Why:** モバイルとのクラウド同期を実装する前に、データ層を統一することで同期の複雑さを根本的に解消する。
**How to apply:** Tauri 2.0 で Desktop + Mobile を単一フレームワーク化、rusqlite で全プラットフォーム SQLite 統一。

**Tauri 2.0 移行で得られるもの:**

- **SQLite Everywhere**: Desktop/Mobile/Cloud 全て SQLite、スキーマ同一
- **単一フレームワーク**: Desktop + Mobile を Tauri 1つで対応
- **軽量化**: バンドル 10-30MB、メモリ 50-150MB
- **DataService 統一**: TauriDataService 1つで全プラットフォーム

---

## 現在のアーキテクチャ（移行元）

```
Desktop:  React 19 → Electron IPC (137チャンネル) → better-sqlite3 → SQLite
Mobile:   React 19 → Capacitor → IndexedDB (15ストア、型なし)
LAN同期:  Hono HTTP Server (port 13456) + WebSocket
Terminal: node-pty + xterm.js
```

**主要コンポーネント:**

- Repository 層: 27ファイル (~4,218行 TypeScript)
- IPC ハンドラ: 38ファイル (~3,851行)
- マイグレーション: V1-V33 (1,958行)
- DataService: ElectronDS / OfflineDS / StandaloneDS / RestDS の4実装
- イベントチャンネル: 6種 (menu:action, updater:status, terminal:data, terminal:claudeStatus, reminder:notify, files:changed)

## ターゲットアーキテクチャ（移行先）

```
Desktop:  React 19 → Tauri IPC → rusqlite → SQLite
Mobile:   React 19 → Tauri IPC → rusqlite → SQLite  ← 同一パス
Cloud:    CF Workers → D1 (SQLite互換)
Terminal: portable-pty (Rust) + xterm.js
```

**フロントエンド（変更なし）:** React 19, TipTap, dnd-kit, xterm.js, Web Audio API, Tailwind CSS, react-i18next — 全て WebView で動作

---

## Phase 0: 基盤 + IPC ブリッジ層

**目的**: Tauri プロジェクト初期化 + 移行期間中に Electron/Tauri 両方で動くブリッジ作成

### [ ] Step 0.1: Tauri 2.0 プロジェクト初期化

- `cargo tauri init` で `src-tauri/` 生成
- `Cargo.toml` 依存: rusqlite (bundled), serde, serde_json, uuid, chrono
- `tauri.conf.json`: ウィンドウ設定 (hidden titlebar, min 800x600)
- dev コマンド: `http://localhost:5173` (既存 Vite dev server)

**新規ファイル:**

- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/build.rs`
- `src-tauri/capabilities/default.json`

### [ ] Step 0.2: フロントエンド IPC ブリッジ

プラットフォーム検出 + IPC 抽象化レイヤー。移行期間中、React フロントエンドが Electron と Tauri の両方で動作可能にする。

- `bridge.ts`: `invoke()` を Tauri (`@tauri-apps/api/core`) / Electron (`window.electronAPI`) に振り分け
- `events.ts`: イベントリスナーの統一 API (Tauri `listen()` / Electron `ipcRenderer.on()`)
- `TauriDataService.ts`: DataService インターフェース (701行, 62メソッド) の Tauri invoke 実装

**新規ファイル:**

- `frontend/src/services/bridge.ts`
- `frontend/src/services/events.ts`
- `frontend/src/services/TauriDataService.ts`

**変更ファイル:**

- `frontend/src/services/dataServiceFactory.ts` — `isTauri()` 判定追加

**設計ポイント:**

- Electron: `window.electronAPI.invoke("db:tasks:update", id, updates)` (位置引数、コロン区切り)
- Tauri: `invoke("db_tasks_update", { id, updates })` (名前付き引数、アンダースコア区切り)
- TauriDataService がこのマッピングを担う

---

## Phase 1: Rust データベース層（最大のフェーズ）

**目的**: 27 Repository + 33 マイグレーションを Rust に移植

### [ ] Step 1.1: DB 初期化 + マイグレーションランナー

- SQLite 接続: `tauri::path::app_data_dir()/life-editor.db`
- PRAGMA: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`
- マイグレーション: V1-V33 を Rust 関数化、`PRAGMA user_version` で管理
- SQL 文は `electron/database/migrations.ts` からほぼそのまま流用

**新規ファイル:**

- `src-tauri/src/db/mod.rs` — DB シングルトン、接続管理
- `src-tauri/src/db/migrations.rs` — 33 マイグレーション関数

**既存参照:**

- `electron/database/db.ts` (78行)
- `electron/database/migrations.ts` (1,958行)

### [ ] Step 1.2: Repository ヘルパー + taskRepository（リファレンス実装）

最初の1つを丁寧に実装し、残りの移植パターンを確立する。

**Rust Repository パターン:**

```rust
#[derive(Serialize, Deserialize, Debug)]
struct TaskNode { id: String, title: String, parent_id: Option<String>, ... }

impl TaskNode {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> { ... }
}

pub fn fetch_tree(conn: &Connection) -> Result<Vec<TaskNode>> { ... }
pub fn create(conn: &Connection, node: &TaskNode) -> Result<TaskNode> { ... }
pub fn update(conn: &Connection, id: &str, updates: &Value) -> Result<TaskNode> { ... }
pub fn soft_delete(conn: &Connection, id: &str) -> Result<()> { ... }
```

- better-sqlite3 同期 API → rusqlite 同期 API（ほぼ 1:1 対応）
- Tauri コマンドは `#[tauri::command]` マクロで定義、非同期スレッドプールで実行

**新規ファイル:**

- `src-tauri/src/db/helpers.rs` — ソフトデリートヘルパー
- `src-tauri/src/db/task_repository.rs` — タスク Repository
- `src-tauri/src/commands/task_commands.rs` — Tauri コマンド

**既存参照:**

- `electron/database/taskRepository.ts` (220行)
- `electron/database/repositoryHelpers.ts` (31行)

### [ ] Step 1.3: 残り 26 Repository を移植

**バッチ A（単純、各 <100行）:**
| Repository | 行数 | 既存ファイル |
|---|---|---|
| appSettingsRepository | 42 | `electron/database/appSettingsRepository.ts` |
| timeMemoRepository | 59 | `electron/database/timeMemoRepository.ts` |
| noteConnectionRepository | 71 | `electron/database/noteConnectionRepository.ts` |
| wikiTagConnectionRepository | 73 | `electron/database/wikiTagConnectionRepository.ts` |
| pomodoroPresetRepository | 76 | `electron/database/pomodoroPresetRepository.ts` |
| calendarRepository | 85 | `electron/database/calendarRepository.ts` |
| templateRepository | 89 | `electron/database/templateRepository.ts` |
| attachmentRepository | 97 | `electron/database/attachmentRepository.ts` |

**バッチ B（中程度、各 100-200行）:**
| Repository | 行数 | 既存ファイル |
|---|---|---|
| memoRepository | 131 | `electron/database/memoRepository.ts` |
| routineTagRepository | 132 | `electron/database/routineTagRepository.ts` |
| calendarTagRepository | 136 | `electron/database/calendarTagRepository.ts` |
| customSoundRepository | 140 | `electron/database/customSoundRepository.ts` |
| timerRepository | 146 | `electron/database/timerRepository.ts` |
| wikiTagGroupRepository | 151 | `electron/database/wikiTagGroupRepository.ts` |
| routineGroupRepository | 171 | `electron/database/routineGroupRepository.ts` |
| playlistRepository | 190 | `electron/database/playlistRepository.ts` |
| noteRepository | 198 | `electron/database/noteRepository.ts` |
| routineRepository | 213 | `electron/database/routineRepository.ts` |

**バッチ C（複雑、各 200行+）:**
| Repository | 行数 | 既存ファイル |
|---|---|---|
| wikiTagRepository | 263 | `electron/database/wikiTagRepository.ts` |
| soundRepository | 281 | `electron/database/soundRepository.ts` |
| databaseRepository | 296 | `electron/database/databaseRepository.ts` |
| scheduleItemRepository | 379 | `electron/database/scheduleItemRepository.ts` |
| paperBoardRepository | 470 | `electron/database/paperBoardRepository.ts` |

**新規ファイル:** `src-tauri/src/db/{name}_repository.rs` × 26、対応する `src-tauri/src/commands/{domain}_commands.rs` × ~12

**移植対象行数合計:** ~4,218行 TypeScript → Rust（SQL 文はほぼ同一で流用可能）

### 検証ゲート

`cargo tauri dev` で起動 → 全ドメインの CRUD が React UI から動作確認

---

## Phase 2: システム統合

**目的**: Electron 固有の OS 機能を Tauri プラグインに置換

### [ ] Step 2.1: ウィンドウ管理 + メニュー

- `tauri-plugin-window-state` でウィンドウ位置/サイズ永続化
- メニューは `tauri::menu::Menu` API で再構築
- トラフィックライト位置は `tauri.conf.json` で設定
- **既存参照:** `electron/windowState.ts` (69行), `electron/menu.ts` (150行)

### [ ] Step 2.2: システムトレイ

- `tray-icon` feature でトレイアイコン + コンテキストメニュー
- タイマー状態のツールチップ表示
- **既存参照:** `electron/tray.ts` (77行)

### [ ] Step 2.3: グローバルショートカット

- `tauri-plugin-global-shortcut` で 1:1 置換
- **既存参照:** `electron/globalShortcuts.ts` (65行)

### [ ] Step 2.4: 自動アップデーター

- `tauri-plugin-updater` に置換
- **既存参照:** `electron/updater.ts` (61行)

### [ ] Step 2.5: ファイルシステム + ファイル監視

- ファイル操作: Rust `std::fs`
- ファイル監視: `notify` crate
- ダイアログ: `tauri-plugin-dialog`
- **既存参照:** `electron/services/fileSystemService.ts` (~200行), `electron/services/fileWatcher.ts` (97行)

### [ ] Step 2.6: リマインダー + 自動アーカイブ

- バックグラウンドタスク: `tauri::async_runtime::spawn()`
- 通知: `tauri-plugin-notification`
- **既存参照:** `electron/services/reminderService.ts` (242行), `electron/services/autoArchiveService.ts` (63行)

### [ ] Step 2.7: Claude/MCP セットアップ

- `~/.claude.json` 読み書き → Rust `std::fs` + `serde_json`
- MCP Server 自体は独立 Node.js プロセスのまま（変更不要）
- **既存参照:** `electron/services/claudeSetup.ts` (350行)

---

## Phase 3: ターミナル (PTY)

**目的**: node-pty → portable-pty (Rust) に置換。xterm.js (フロント) は変更なし。

### [ ] Step 3.1: Rust PTY マネージャー

- `portable_pty::native_pty_system().openpty()` でシェル起動
- 出力読み取りスレッド + 16ms バッチング（現行と同一仕様）
- `app.emit("terminal:data", ...)` でフロントに送信
- **新規:** `src-tauri/src/terminal/mod.rs`, `src-tauri/src/terminal/pty_manager.rs`
- **既存参照:** `electron/terminal/TerminalManager.ts` (132行)

### [ ] Step 3.2: Claude Detector

- ANSI ストリッピング + 正規表現パターンマッチを Rust に移植
- **新規:** `src-tauri/src/terminal/claude_detector.rs`
- **既存参照:** `electron/terminal/ClaudeDetector.ts` (118行)

### [ ] Step 3.3: ターミナルコマンド登録

- `terminal_create`, `terminal_write`, `terminal_resize`, `terminal_destroy`
- **新規:** `src-tauri/src/commands/terminal_commands.rs`

---

## Phase 4: 残機能 + Electron コード除去

**目的**: 機能パリティ達成 → Electron/Capacitor コードを削除

### [ ] Step 4.1: Data I/O (export/import/reset)

- **既存参照:** `electron/ipc/dataIOHandlers.ts` (468行)

### [ ] Step 4.2: 診断 (logs, metrics, systemInfo)

- **既存参照:** `electron/ipc/diagnosticsHandlers.ts` (150行)

### [ ] Step 4.3: Electron/Capacitor コード削除

**削除対象:**

- `electron/` ディレクトリ全体
- `frontend/src/services/ElectronDataService.ts`
- `frontend/src/services/OfflineDataService.ts`
- `frontend/src/services/StandaloneDataService.ts` (1706行)
- `frontend/src/services/RestDataService.ts` (1246行)
- `frontend/src/db/indexedDb.ts` (208行)
- `frontend/src/db/syncOperations.ts` (178行)
- `capacitor.config.ts`, `ios/` (Capacitor)
- `electron-builder.yml`

**簡素化対象:**

- `dataServiceFactory.ts` → TauriDataService のみ返す
- `package.json` → Electron/Capacitor/better-sqlite3/node-pty/ws/hono 依存削除

---

## Phase 5: iOS ターゲット

**目的**: Tauri 2.0 の iOS サポートで「SQLite Everywhere」実現

### [ ] Step 5.1: iOS 初期化

- `cargo tauri ios init` → `src-tauri/gen/apple/` 生成
- Bundle ID: `com.lifeEditor.app`
- rusqlite `bundled` feature で iOS 向け SQLite 自動コンパイル
- Deployment Target: iOS 16.0+

### [ ] Step 5.2: モバイル固有調整

- ターミナル/PTY: iOS では無効化 (`not supported`)
- トレイ/グローバルショートカット/アップデーター: iOS 非該当、graceful disable
- ファイルパス: `tauri::path::app_data_dir()` が iOS で正しく解決
- Safe area / ノッチ / ホームインジケーター対応

### [ ] Step 5.3: 既存モバイル UI の流用

- `MobileApp.tsx` + 全 `Mobile*` コンポーネント: そのまま動作
- DataService: `TauriDataService` → Rust/rusqlite（IndexedDB 不要、LAN サーバー不要）
- ConnectionSetup: 不要（ローカル SQLite に直接アクセス）

### [ ] Step 5.4: 既存 Capacitor ユーザーのデータ移行

- IndexedDB → JSON エクスポート（既存 data:export 機能）
- JSON → 新 Tauri iOS アプリの SQLite にインポート

---

## Phase 6: クラウド同期（移行完了後）

**目的**: SQLite Everywhere を活かしたシンプルなクラウド同期

### [ ] Step 6.1: Cloud Backend (CF Workers + D1)

- `cloud/` ディレクトリに Wrangler プロジェクト
- D1 スキーマ = 既存 SQLite スキーマ（同一 SQL、変換不要）
- Sync API: `/sync/full`, `/sync/changes`, `/sync/batch`（既存 `electron/server/routes/sync.ts` の設計を流用）
- 認証: シンプルトークン（個人利用前提）

### [ ] Step 6.2: Tauri 側 Sync 実装

- SyncQueue パターンを Rust で実装（or フロントの既存 `SyncQueue.ts` を流用）
- `version` カラム（既存全テーブルに存在）で楽観的ロック
- ポーリング（30秒間隔）で差分同期
- 競合解決: last-write-wins（既存 `StandaloneDataService` の ConflictHandler パターン流用）

**SQLite Everywhere の利点:**

```
Desktop: rusqlite → SQLite ←→ CF Workers ←→ D1 (SQLite)
Mobile:  rusqlite → SQLite ←→ CF Workers ←→ D1 (SQLite)
全て SQLite、スキーマ変換なし、同一 SQL クエリ
```

---

## 影響ファイル一覧

### 新規ファイル (Tauri/Rust)

| ファイル                                    | Phase | 備考                                   |
| ------------------------------------------- | ----- | -------------------------------------- |
| `src-tauri/Cargo.toml`                      | 0     | Rust 依存定義                          |
| `src-tauri/tauri.conf.json`                 | 0     | Tauri 設定                             |
| `src-tauri/src/main.rs`                     | 0     | エントリポイント                       |
| `src-tauri/src/db/mod.rs`                   | 1     | DB 初期化・接続管理                    |
| `src-tauri/src/db/migrations.rs`            | 1     | 33 マイグレーション (1,958行 SQL 流用) |
| `src-tauri/src/db/helpers.rs`               | 1     | ソフトデリートヘルパー                 |
| `src-tauri/src/db/*_repository.rs` × 27     | 1     | Repository 層                          |
| `src-tauri/src/commands/*.rs` × ~15         | 1-4   | Tauri コマンド                         |
| `src-tauri/src/terminal/mod.rs`             | 3     | PTY モジュール                         |
| `src-tauri/src/terminal/pty_manager.rs`     | 3     | PTY マネージャー                       |
| `src-tauri/src/terminal/claude_detector.rs` | 3     | Claude 検出                            |
| `frontend/src/services/bridge.ts`           | 0     | IPC ブリッジ                           |
| `frontend/src/services/events.ts`           | 0     | イベントブリッジ                       |
| `frontend/src/services/TauriDataService.ts` | 0     | DataService 実装                       |
| `cloud/`                                    | 6     | CF Workers + D1                        |

### 変更ファイル

| ファイル                                      | Phase | 変更内容                 |
| --------------------------------------------- | ----- | ------------------------ |
| `frontend/src/services/dataServiceFactory.ts` | 0     | `isTauri()` 判定追加     |
| `frontend/package.json`                       | 0     | `@tauri-apps/api` 追加   |
| `package.json`                                | 0     | Tauri CLI 追加           |
| `.gitignore`                                  | 0     | `src-tauri/target/` 追加 |

### 削除ファイル (Phase 4.3)

| ファイル/ディレクトリ                                     | 備考                  |
| --------------------------------------------------------- | --------------------- |
| `electron/` 全体                                          | Electron main process |
| `frontend/src/services/ElectronDataService.ts`            | Tauri に置換          |
| `frontend/src/services/OfflineDataService.ts` (1904行)    | 不要                  |
| `frontend/src/services/StandaloneDataService.ts` (1706行) | 不要                  |
| `frontend/src/services/RestDataService.ts` (1246行)       | 不要                  |
| `frontend/src/db/indexedDb.ts` (208行)                    | IndexedDB 不要        |
| `frontend/src/db/syncOperations.ts` (178行)               | 新方式に置換          |
| `capacitor.config.ts`, `ios/`                             | Capacitor 不要        |
| `electron-builder.yml`                                    | 不要                  |

---

## 設計判断の根拠

| 判断             | 選択                              | 理由                                                                                                                              |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DB アクセス      | rusqlite (raw) > tauri-plugin-sql | prepared statements、PRAGMA、トランザクション制御が必要。Plugin は SQL 文字列をフロントから送る設計で現行アーキテクチャに合わない |
| LAN HTTP Server  | 後回し                            | Tauri iOS では rusqlite 直アクセス → LAN サーバー不要。Phase 6 クラウド同期で完全に代替                                           |
| 移行方式         | 並行ビルド                        | `electron/` と `src-tauri/` を共存させ、`cargo tauri dev` と `npm run dev` の両方が動く状態を維持                                 |
| Cloud Backend    | CF Workers + D1                   | SQLite 互換で SQL 変換不要。Hono ネイティブ対応。無料枠大 (5M reads/day)                                                          |
| 認証             | シンプルトークン                  | 個人利用。デスクトップで生成、クラウドに登録、モバイルで入力                                                                      |
| リアルタイム同期 | ポーリング (30秒)                 | MVP として十分。Durable Objects WebSocket は後日追加可                                                                            |
| ターミナル PTY   | portable-pty crate                | Rust エコシステムで最も成熟した PTY ライブラリ。node-pty と同等の機能                                                             |

---

## Verification

### フェーズ別検証

- [ ] Phase 0: `cargo tauri dev` で React UI が表示される
- [ ] Phase 1: 全ドメインの CRUD が UI から動作 (Tasks, Memos, Notes, Schedules, Routines, Timer, Wiki Tags, Paper Boards, Databases, Templates)
- [ ] Phase 2: トレイアイコン表示、グローバルショートカット動作、ファイル操作動作
- [ ] Phase 3: ターミナルでシェル起動・コマンド実行・Claude Code 連携
- [ ] Phase 4: Electron 版と同一機能が全て動作、Electron コード削除後もビルド成功
- [ ] Phase 5: iOS シミュレータで起動、4タブ表示、タスク CRUD → 再起動 → データ永続化
- [ ] Phase 6: Desktop で作成 → Cloud 同期 → iOS で表示確認

### 移行期間中の並行テスト

Electron 版と Tauri 版で同じ `life-editor.db` を開き、データの読み書きが双方向で正しいことを確認。スキーマ互換性と serde Serialization の一致を検証。

### 機能パリティチェックリスト

137 invoke チャンネル + 6 イベントチャンネルを一覧化し、各チャンネルの「移植済み / テスト済み / UI検証済み」ステータスを管理。

**参照すべき既存ファイル:**

- `electron/preload.ts` — 全 IPC チャンネル一覧 (ALLOWED_CHANNELS)
- `frontend/src/services/DataService.ts` — 全 62 メソッドの契約
- `electron/ipc/registerAll.ts` — Repository とハンドラの対応関係
- `electron/database/migrations.ts` — 全スキーマ定義
