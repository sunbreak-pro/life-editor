# CLAUDE.md — Life Editor 統合定義書

> 設計判断・実装規約の SSOT。ビジョン・抽象構想は `.claude/docs/vision/` に分離。Claude Code 起動時に auto-load。

---

## 0. Meta

- **役割**: 現状の実装規約 / 設計判断の参照点（400 行以下を目標）。抽象的・未具体化の構想 / 設計原則 は `docs/vision/` を参照（ADR は作らない）
- **更新規則**: 実装変更を伴う変更はコードと同一 PR で更新。新機能は §8 + `docs/requirements/` に記入
- **関連ドキュメント**: `MEMORY.md`(タスク) / `HISTORY.md`(履歴) / `docs/vision/`(設計原則) / `docs/requirements/`(Tier 1-3) / `docs/known-issues/`(Root Cause [INDEX](./docs/known-issues/INDEX.md)) / `docs/code-explanation/` / `archive/`

---

## 1. Vision（要約）

詳細 → [`docs/vision/core.md`](./docs/vision/core.md)

- **1-line**: AI と会話しながら生活を設計・記録・運用するパーソナル OS
- **Primary user**: 作者本人（N=1）、macOS + iOS、Claude Code 日常利用の開発者
- **Value**: (V1) MCP 経由で AI が全データ操作 $0 / (V2) ローカル SQLite SSOT + オフライン完全動作 / (V3) 特化テーブル + Notion 的汎用 DB の両立
- **Non-Goals**: マルチテナント / Web UI / 特化専用アプリ / Claude API 直課金 / モバイル単独起動

---

## 2. Platform

- **Desktop (Tauri 2.0)**: Primary creation、全機能
- **iOS (Tauri 2.0)**: Consumption + Quick capture
- **Cloud (Cloudflare Workers + D1)**: Desktop ↔ iOS 双方向同期のみ（Web UI なし）

### 機能差分

| 機能                                                                         | Desktop | iOS | Cloud Sync | 備考                         |
| ---------------------------------------------------------------------------- | :-----: | :-: | :--------: | ---------------------------- |
| Tasks / Schedule / Notes / Daily                                             |    ✓    |  ✓  |     ✓      | コア                         |
| Pomodoro Timer                                                               |    ✓    |  ✓  |     -      |                              |
| Materials / Calendar Tags / Audio / WikiTags / Shortcut Config / Screen Lock |    ✓    |  -  |     -      | Mobile 省略 Provider（§6.2） |
| Terminal + Claude + MCP Server                                               |    ✓    |  -  |     -      | Desktop 専用（PTY 不可）     |

Mobile 省略 Provider: Audio / ScreenLock / FileExplorer / CalendarTags / ShortcutConfig（WikiTag / SidebarLinks は Mobile でも有効）

---

## 3. Architecture

### 3.1 全体構成

```
Renderer (React 19 + Vite) ─IPC→ Rust Backend (src-tauri/) ─rusqlite WAL→ SQLite (~/Library/Application Support/life-editor/life-editor.db)
                                                                             ↑
                                       MCP Server (Node.js, stdio, better-sqlite3)
                                                                             ↑
                                         Cloud Sync (Cloudflare Workers + D1, 双方向)
```

### 3.2 DataService 抽象化（重要）

フロントエンドは `getDataService()` 経由でデータアクセス。**コンポーネントから直接 `invoke()` を呼ばない**。`frontend/src/services/{DataService.ts, TauriDataService.ts, dataServiceFactory.ts}`。

### 3.3 Section Routing（6 SectionId）

React Router なし。`App.tsx::activeSection` で切替: `schedule` / `materials` / `connect` / `work` / `analytics` / `settings`。`TerminalPanel` は全画面共通の下部パネル（VSCode 方式）。

### 3.4 サブシステム

- **Terminal**: `portable-pty` (Rust) + `xterm.js`、Ctrl+`` ` `` 開閉、Catppuccin Mocha
- **Audio Mixer**: 6 種環境音 + カスタム。`AudioContext` は `suspended` → ユーザー操作後 `resume()` 必須
- **Sync**: バージョンカラム + last-write-wins。全テーブル対象
- **Theme**: ダーク/ライト、フォントサイズ 10 段階（12-25px）、Tailwind `notion-*` トークン

---

## 4. Data Model

> write / sync / migration 規約詳細 → [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md)（timestamp 形式・version 管理・LWW・D1 制約・multi-language write）

### 4.1 SQLite スキーマ

- 正本: `src-tauri/src/db/migrations.rs`（WAL）/ 現行 v67、約 40 テーブル
- ドメイン: tasks / dailies / notes / time*memos / schedule_items / calendars / routines / timer*\_ / sound\_\_ / playlists / wiki_tags / task_templates / paper_boards / databases（汎用 DB: properties / rows / cells）
- 直近 migration: V60(孤児テーブル撤去 → WikiTags 完全移行) / V62(NULL updated*at backfill + tasks INSERT トリガー) / V63(schedule_items 重複排除 + partial UNIQUE) / V64(`memos` → `dailies` rename。id 形式 / `note_links.source*\*`/`wiki_tag_assignments` の entity_type 全移行。`time_memos`は別概念で対象外) / V65(CalendarTags 1:1 化:`calendar_tag_definitions`に Cloud Sync 列追加 +`calendar_tag_assignments`を`id PK / entity_type / entity_id / tag_id` に rebuild) / V66(`timer_sessions.label` 追加: Pomodoro Free セッションの命名保存用) / V67(`sidebar_links` 新規: LeftSidebar 用 URL/Mac アプリ快速リンク。version + LWW で Cloud Sync 対象)
- Cloud D1 専用: 2026-04-24 適用 migration 0003 で `server_updated_at` 列追加（delta sync cursor 用、Desktop SQLite には無い）/ 2026-04-25 適用 migration 0004 で V65 に追従（`calendar_tag_definitions` の sync 用列追加 + `calendar_tag_assignments` rebuild、`calendar_tag_assignments` は `RELATION_TABLES_WITH_UPDATED_AT` に昇格）/ 2026-04-25 適用 migration 0005 で V67 に追従（`sidebar_links` 新設、`VERSIONED_TABLES` に追加）。詳細 → `docs/known-issues/013-*.md` / `docs/vision/db-conventions.md §3`

### 4.2 特化 vs 汎用 DB の境界

- **特化テーブル**（スキーマ固定）: `tasks` / `routines` / `schedule_items` / `notes` / `dailies` / `pomodoro_presets` / `timer_sessions`
- **汎用 Database で表現**: 家計簿 / 読書記録 / 習慣 / 連絡先 / 学習進捗 等
- **判断**: 特化 UI（DnD / カレンダー / ルーチン生成 / リマインダー）が必要 → 特化テーブル。型付きフィールド + フィルタ + 集計で済む → 汎用 Database

### 4.3 ID 戦略

- TaskNode: `<type>-<timestamp+counter>`（例: `task-1710201234566`）
- DailyNode: `daily-<YYYY-MM-DD>`（日付キー 1 エントリ）
- その他: `generateId(prefix)` で `<prefix>-<uuid>`。全 String

### 4.4 ソフトデリート

`is_deleted` + `deleted_at` → TrashView から復元可。対象: Tasks / Notes / Dailies / Routines / Databases / Templates。CustomSounds はファイルベース。

### 4.5 PropertyType 拡張方針

実装済み: text / number / select / date / checkbox。優先度: relation(高、DB 間リレーション) / formula(高) / rollup(中) / ビュー切替 Board・Gallery・Calendar(中) / url・email(低)。新型追加時は MCP ツール（`query_database` / `add_database_row` / `update_database_cell`）も同時更新。

---

## 5. AI Integration

### 5.1 MCP Server（30 ツール）

独立 Node.js プロセス。Claude Code が stdio 経由で呼び出し、同一 SQLite DB を直接操作。ドメイン別:

- **Tasks**: list / get / create / update / delete / get_tree
- **Dailies**: get / upsert
- **Notes**: list / create / update
- **Schedule**: list / create / update / delete / toggle_complete
- **Wiki Tags**: list / tag_entity / search_by_tag / get_entity_tags
- **Content / Search**: generate_content / format_content / search_all
- **File**: list / read / write / create_directory / rename / delete / search

### 5.2 アプリ内ターミナル + Claude Code

`portable-pty` 経由で `claude` 起動 → MCP Server 自動接続 → 自然言語でデータ操作。

---

## 6. Coding Standards

### 6.1 命名規則

| 種別             | 規則                   | 例                     |
| ---------------- | ---------------------- | ---------------------- |
| コンポーネント   | PascalCase             | `TaskList.tsx`         |
| フック           | camelCase + use 接頭辞 | `useTasks.ts`          |
| 変数・関数       | camelCase              | `fetchTasks`           |
| 定数             | SCREAMING_SNAKE_CASE   | `API_BASE_URL`         |
| Context Value 型 | PascalCase             | `AudioContextValue.ts` |

ESLint 設定に従う。コメントは必要最小限。

### 6.2 Provider 順序（依存制約）

- **Desktop**（外→内）: ErrorBoundary → Theme → Toast → Sync → UndoRedo → ScreenLock → TaskTree → Calendar → Template → Daily → Note → FileExplorer → Routine → ScheduleItems → CalendarTags → Timer → Audio → WikiTag → ShortcutConfig → SidebarLinks
- **Mobile**: ScreenLock / FileExplorer / CalendarTags / Audio / ShortcutConfig を省く（SidebarLinks / WikiTag は両方で有効）
- 内側 Provider は外側 Context に依存可（逆不可）。例: ScheduleItemsProvider → RoutineProvider、AudioProvider → TimerProvider

### 6.3 Pattern A（Context/Provider 標準 — 3 ファイル構成）

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider component（hook 呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

`context/index.ts` に Provider / Context / ContextValue type を export 追加。

**例外**: 他 Provider が依存しない・自己完結している場合は単一ファイル可（例: `ToastContext`）。

**Mobile 省略 Provider は Optional バリアント必須**（詳細 → `vision/coding-principles.md §4`）: 必須 hook は Provider 外で throw / Optional hook (`useFooContextOptional`) は `null` を返し共有コンポーネントで `if (!ctx) return null` ガード。

### 6.4 共有コンポーネント配置

| 種別          | 配置先                                           |
| ------------- | ------------------------------------------------ |
| 共有 UI       | `frontend/src/components/shared/`                |
| 共有フック    | `frontend/src/hooks/`                            |
| Context       | `frontend/src/context/`                          |
| 共有型        | `frontend/src/types/`                            |
| Schedule 共通 | `frontend/src/components/Tasks/Schedule/shared/` |
| UndoRedo      | `frontend/src/utils/undoRedo/`                   |

設計規約: Tailwind `notion-*` トークン使用（ハードコード禁止）/ i18n テキストは props 経由（フック内で `useTranslation()` を呼ばない）/ ジェネリクスでエンティティ型を外部化（`useDataFetch<T>(fetcher)`）/ DataService 依存はコールバックで注入（フック内で直接 `getDataService()` を呼ばない）

### 6.5 Schedule 3 分割

`RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider`。`useScheduleContext()` は後方互換ファサード。新コードは個別 hook 直接使用推奨。Calendar / DayFlow / Routine の 2 つ以上から参照されるものは `Schedule/shared/` に配置。背景 → `vision/coding-principles.md §3`。

### 6.6 その他規約

- **i18n**: `react-i18next`（en / ja、`frontend/src/i18n/locales/` 両方に追加）
- **IME**: `e.nativeEvent.isComposing` チェック必須
- **リッチテキスト**: TipTap (`@tiptap/react`)
- **DnD**: `@dnd-kit`。`moveNode`(並び替え) と `moveNodeInto`(階層移動) は別操作

---

## 7. Development Workflows

### 7.1 開発コマンド

```bash
cargo tauri dev                                         # Tauri + Vite 同時起動
cd frontend && npm run test                             # Vitest
cd frontend && npx vitest run src/path/to/File.test.tsx # 単一テスト
cd mcp-server && npm run build                          # MCP Server ビルド
```

### 7.2 IPC 追加時の 4 点同期（必須）

1. `src-tauri/src/commands/` に `#[tauri::command]` 関数追加
2. `src-tauri/src/lib.rs` の `generate_handler![]` にコマンド登録
3. `frontend/src/services/DataService.ts` インターフェースにメソッド定義
4. `frontend/src/services/TauriDataService.ts` に実装追加

`serde` シリアライズ。Rust 引数名と `invoke()` 引数名を一致させる。`Date` は文字列化、`undefined` は消失するので `null` を使う。

### 7.3 DB マイグレーション

- カラム追加は `IF NOT EXISTS` / `PRAGMA user_version` を正しくインクリメント
- カラム名: DB=snake_case / JS=camelCase（`rowToModel` で変換）
- 正本: `src-tauri/src/db/migrations.rs`
- 診断: `sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db ".tables"` / `... "PRAGMA user_version"`

### 7.4 コミット規約

`<type>: <subject>` — type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`

### 7.5 デバッグ要点

- **IPC 未登録**: §7.2 の 4 点同期を確認
- **Context null エラー**: 対応 Provider の外で使用 → §6.2 の順序確認
- **Audio 無音**: `AudioContext.state === 'suspended'` → ユーザー操作後 `resume()`
- **類似バグ**: まず `docs/known-issues/INDEX.md` を grep

---

## 8. Feature Tier Map

詳細 → `docs/requirements/`（Tier 1/2/3、計 26 機能、Phase B 完了済み）

- **Tier 1 コア**: [`tier-1-core.md`](./docs/requirements/tier-1-core.md)（8 機能）— Tasks (TaskTree) / Schedule (Routine + ScheduleItems + CalendarTags) / Notes / Daily / Database / MCP Server / Cloud Sync / Terminal + Claude Code
- **Tier 2 補助**: [`tier-2-supporting.md`](./docs/requirements/tier-2-supporting.md)（12 機能）— Audio Mixer / Playlist / Pomodoro / WikiTags / File Explorer / Templates / UndoRedo / Theme / i18n / Shortcuts / Toast / Trash
- **Tier 3 実験 / 凍結**: [`tier-3-experimental.md`](./docs/requirements/tier-3-experimental.md)（6 機能）— Paper Boards(凍結) / Analytics(凍結) / NotebookLM(未着手) / Google Calendar(ICS 検討) / Google Drive(MCP 代替) / Cognitive Architecture(凍結)

### 次フェーズ計画

- [`vision/mobile-porting.md`](./docs/vision/mobile-porting.md) — Desktop → iOS 移植 + Cloud Sync 連携（主戦場）
- [`requirements/ios-additions.md`](./docs/requirements/ios-additions.md) — iOS 限定の上乗せ要件
- [`vision/ios-everywhere-sync.md`](./docs/vision/ios-everywhere-sync.md) — Apple Developer Program 不加入運用（無料署名 + 週次再署名）
- [`vision/desktop-followup.md`](./docs/vision/desktop-followup.md) — Desktop 残課題

---

## 9. Document System

### Vision → 実装プラン → 統合 フロー

1. **Vision**（抽象 / 設計原則）: `docs/vision/` に記述。ADR は作らず vision/ に一元化
2. **実装プラン**: `.claude/YYYY-MM-DD-<slug>.md` に作成 → Vision と相互リンク
3. **完了**: プランを `archive/` 移動、実装規約は本ファイルに統合、判断理由は `vision/coding-principles.md` 等に残す
4. **MEMORY.md / HISTORY.md** はセッション単位で同期

ADR を使わない理由: 「時点の判断」は時間経過で古い情報を参照するリスク。vision/ は「現在から未来に向けた設計原則」として継続更新。却下案・判断理由は `vision/coding-principles.md §5` に残す。

### Known Issue ライフサイクル

`docs/known-issues/` は **壊れている／壊れていた箇所の Root Cause + 再発防止知見** を蓄積（MEMORY.md / HISTORY.md では拾えないもの）。

1. **発見時**: `_TEMPLATE.md` ベースで `NNN-<slug>.md` 作成、Status=Active、INDEX.md 更新
2. **解決時**: Status=Fixed + Resolved 日付 + Lessons Learned 追記、INDEX 移動
3. **Monitoring**: 構造的に再発しうる問題は Monitoring で保持

類似バグ遭遇時はまず `INDEX.md` を grep が基本運用。

### 作業時の注意点

- 機能追加・削除時は §8 を更新（README.md は概要のみ）
- 音源ファイルはコミット禁止（`public/sounds/` は `.gitignore` 対象）
- API キーはフロントエンドに直接記載しない
