# CLAUDE.md — Life Editor 統合定義書

> Life Editor のアーキテクチャ・規約・運用ガイドの SSOT（Single Source of Truth）。
> ビジョン・構想は `.claude/docs/vision/` に分離。Claude Code は起動時に本ファイルを auto-load する。

---

## 0. Meta

### 役割と更新ルール

- **役割**: 現状の設計判断・実装規約の唯一の参照点（400 行以下を目標に保つ）
- **抽象的・未具体化の構想 / 設計原則**: `.claude/docs/vision/` 参照（本ファイルに持ち込まない、ADR は作らない）
- **実装変更を伴う変更**: コードと同一 PR で本ファイル更新
- **新機能追加**: §8 Feature Tier Map に追記 + `.claude/docs/requirements/` に詳細記入

### 関連ドキュメント

| パス                             | 用途                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `.claude/MEMORY.md`              | タスクトラッカー（進行中 / 直近完了 / 予定）                                 |
| `.claude/HISTORY.md`             | 変更履歴（セッション単位）                                                   |
| `.claude/docs/vision/`           | 抽象構想・設計原則（Core Identity, Value Props, AI 詳細, Coding Principles） |
| `.claude/docs/requirements/`     | Tier 1-3 機能要件定義                                                        |
| `.claude/docs/known-issues/`     | 未解決 Issue + Root Cause 記録（[INDEX](./docs/known-issues/INDEX.md)）      |
| `.claude/docs/code-explanation/` | 機能別コード解説（学習教材）                                                 |
| `.claude/archive/`               | 完了済みプラン                                                               |

---

## 1. Vision（要約）

> 詳細は [`.claude/docs/vision/core.md`](./docs/vision/core.md)

- **1-line**: 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」
- **Primary user**: 作者本人（N=1）、macOS + iOS、Claude Code 日常利用の開発者
- **Value**: (V1) MCP 経由で AI が全データ操作 $0 / (V2) ローカル SQLite SSOT + オフライン完全動作 / (V3) 特化テーブル + Notion 的汎用 DB の両立
- **Non-Goals**: マルチテナント / Web UI / 特化専用アプリ / Claude API 直課金 / モバイル単独起動

---

## 2. Platform

### 役割定義

- **Desktop (Tauri 2.0 on macOS/Windows/Linux)**: Primary creation。全機能揃う
- **iOS (Tauri 2.0)**: Consumption + Quick capture
- **Cloud (Cloudflare Workers + D1)**: Desktop ↔ iOS 双方向同期のみ（Web UI なし）

### 機能差分マトリクス

| 機能                                                                         | Desktop | iOS | Cloud Sync | 備考                         |
| ---------------------------------------------------------------------------- | :-----: | :-: | :--------: | ---------------------------- |
| Tasks / Schedule / Notes / Memo                                              |    ✓    |  ✓  |     ✓      | コア                         |
| Pomodoro Timer                                                               |    ✓    |  ✓  |     -      |                              |
| Materials / Calendar Tags / Audio / WikiTags / Shortcut Config / Screen Lock |    ✓    |  -  |     -      | Mobile 省略 Provider（§6.2） |
| Terminal + Claude + MCP Server                                               |    ✓    |  -  |     -      | Desktop 専用（PTY 不可）     |

モバイル省略 Provider: Audio / ScreenLock / FileExplorer / CalendarTags / WikiTag / ShortcutConfig

---

## 3. Architecture

### 3.1 全体構成

```
Renderer (React 19 + Vite)
   ↓ Tauri IPC (@tauri-apps/api)
Rust Backend (src-tauri/)
   ↓ rusqlite (WAL)
SQLite (~/Library/Application Support/life-editor/life-editor.db)
       ↑
MCP Server (mcp-server/, 独立 Node.js プロセス, stdio, better-sqlite3)
       ↑
Cloud Sync (Cloudflare Workers + D1, 双方向)
```

### 3.2 DataService 抽象化（重要）

- フロントエンドは `getDataService()` 経由でデータアクセス。**コンポーネントから直接 `invoke()` を呼ばない**
- インターフェース: `frontend/src/services/DataService.ts` / 実装: `TauriDataService.ts`
- ファクトリ: `dataServiceFactory.ts`

### 3.3 Section Routing（6 SectionId）

React Router なし。`App.tsx` の `activeSection` で切替: `schedule` / `materials` / `connect` / `work` / `analytics` / `settings`。
`TerminalPanel` は全画面共通の下部パネル（VSCode 方式）。

### 3.4 サブシステム

- **Terminal**: `portable-pty` (Rust) + `xterm.js` (Frontend)、Ctrl+`` ` `` 開閉、Catppuccin Mocha
- **Audio Mixer**: 6 種環境音 + カスタムサウンド。`AudioContext` は `suspended` → ユーザー操作後 `resume()` 必須
- **Sync (Cloud)**: バージョンカラム + last-write-wins。life-editor 全テーブル + 将来の `claude_*` テーブル（ADR-0005）対象
- **Theme**: ダーク/ライト、フォントサイズ 10 段階（12-25px）、Tailwind `notion-*` デザイントークン

---

## 4. Data Model

### 4.1 SQLite スキーマ

- 正本: `src-tauri/src/db/migrations.rs`（WAL）
- 現行 v60、約 40 テーブル
- ドメイン: tasks / memos / notes / time*memos / schedule_items / calendars / routines / timer*\_ / sound\_\_ / playlists / wiki_tags / task_tags / note_tags / task_templates / paper_boards / databases（汎用 DB: properties / rows / cells）
- V60 で旧 task_tags / note_tags / ai_settings / routine_logs など孤児テーブルを撤去（WikiTags へ完全移行）

### 4.2 特化 vs 汎用 DB の境界

**特化テーブル**（スキーマ固定）: `tasks` / `routines` / `schedule_items` / `notes` / `memos` / `pomodoro_presets` / `timer_sessions`

**汎用 Database で表現**: 家計簿 / 読書記録 / 習慣トラッカー / 連絡先 / 学習進捗 など

**判断基準**:

- 特化 UI が必要（DnD / カレンダー表示 / ルーチン生成 / リマインダー連動）→ 特化テーブル
- 単純な「型付きフィールド + フィルタ + 集計」で済む → 汎用 Database

### 4.3 ID 戦略

- **TaskNode**: `"<type>-<timestamp+counter>"`（例: `task-1710201234566`）
- **その他**: `generateId(prefix)` で `"<prefix>-<uuid>"`
- 全て String 型

### 4.4 ソフトデリート

`is_deleted` + `deleted_at` カラム → TrashView から復元可能。対象: Tasks / Notes / Memos / Routines / Databases / Templates。CustomSounds はファイルベース管理。

### 4.5 PropertyType 拡張方針

**実装済み**: text / number / select / date / checkbox

**優先度**（詳細は `docs/vision/2026-04-17-daily-life-hub-requirements.md`）:

| 型              | 用途                                    | 優先度 |
| --------------- | --------------------------------------- | ------ |
| `relation`      | DB 間リレーション（支出 → カテゴリ DB） | 高     |
| `formula`       | 月次合計の自動計算、予算残高            | 高     |
| `rollup`        | リレーション先の集計                    | 中     |
| ビュー切替      | Board / Gallery / Calendar 表示         | 中     |
| `url` / `email` | 連絡先 DB                               | 低     |

新 PropertyType 追加時は MCP ツール（`query_database` / `add_database_row` / `update_database_cell`）も同時更新。

---

## 5. AI Integration

> 詳細は [`.claude/docs/vision/ai-integration.md`](./docs/vision/ai-integration.md)

### 5.1 MCP Server（30 ツール）

独立 Node.js プロセス。Claude Code が stdio 経由で呼び出し、同一 SQLite DB を直接操作。

| ドメイン  | ツール                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tasks     | `list_tasks` / `get_task` / `create_task` / `update_task` / `delete_task` / `get_task_tree`                             |
| Memos     | `get_memo` / `upsert_memo`                                                                                              |
| Notes     | `list_notes` / `create_note` / `update_note`                                                                            |
| Schedule  | `list_schedule` / `create_schedule_item` / `update_schedule_item` / `delete_schedule_item` / `toggle_schedule_complete` |
| Wiki Tags | `list_wiki_tags` / `tag_entity` / `search_by_tag` / `get_entity_tags`                                                   |
| Content   | `generate_content` / `format_content`                                                                                   |
| Search    | `search_all`                                                                                                            |
| File      | `list_files` / `read_file` / `write_file` / `create_directory` / `rename_file` / `delete_file` / `search_files`         |

### 5.2 アプリ内ターミナル + Claude Code

アプリ内ターミナル（portable-pty）から `claude` 起動 → MCP Server (`life-editor`) 自動接続 → 自然言語でデータ操作。

### 5.3 Cognitive Architecture（構想中）

- 同一 SQLite に `claude_*` テーブル群（episodes / memories / safeguards / preferences / reflections）
- 新 MCP Server `mcp-server-cognitive/` で内省・分析・記憶管理
- Claude Code プロセスラッピングで Max サブスク内 $0
- 4 フェーズ計画。詳細は `vision/ai-integration.md`

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

Frontend は ESLint 設定に従う。コメントは必要最小限。

### 6.2 Provider 順序（依存制約）

- **Desktop**（外→内）: ErrorBoundary → Theme → Toast → UndoRedo → ScreenLock → TaskTree → Calendar → Template → Memo → Note → FileExplorer → Routine → ScheduleItems → CalendarTags → Timer → Audio → WikiTag → ShortcutConfig
- **Mobile**（省略）: ScreenLock / FileExplorer / CalendarTags / Audio / WikiTag / ShortcutConfig を省く
- 制約: 内側 Provider は外側 Context に依存可（逆不可）。ScheduleItemsProvider → RoutineProvider、AudioProvider → TimerProvider

### 6.3 Pattern A（Context/Provider 標準 — 3 ファイル構成）

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider component（hook 呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

`context/index.ts` に Provider / Context / ContextValue type を export 追加。

**例外**: 他 Provider が依存しない・実装が自己完結している場合は単一ファイル可（例: `ToastContext`）。

**Mobile 省略 Provider は Optional バリアント必須**（原則詳細は `vision/coding-principles.md` §4）:

- 必須 hook: Provider 外で throw
- Optional hook (`useFooContextOptional`): `null` を返す → Mobile 到達可能な共有コンポーネントで `if (!ctx) return null` ガード

### 6.4 共有コンポーネント配置

| 種別          | 配置先                                           |
| ------------- | ------------------------------------------------ |
| 共有 UI       | `frontend/src/components/shared/`                |
| 共有フック    | `frontend/src/hooks/`                            |
| Context       | `frontend/src/context/`                          |
| 共有型        | `frontend/src/types/`                            |
| Schedule 共通 | `frontend/src/components/Tasks/Schedule/shared/` |
| UndoRedo      | `frontend/src/utils/undoRedo/`                   |

**設計規約**:

- Tailwind デザイントークン（`notion-*`）使用、ハードコード禁止
- i18n テキストは props 経由（コンポーネント内で `useTranslation()` を呼ばない）
- ジェネリクスでエンティティ型を外部化: `useDataFetch<T>(fetcher)`
- DataService 依存はコールバックで注入（フック内で直接 `getDataService()` を呼ばない）

### 6.5 Schedule 3 分割

`RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider` の 3 分割。`useScheduleContext()` は後方互換ファサード。新コードでは個別 hook (`useRoutineContext()` / `useScheduleItemsContext()` / `useCalendarTagsContext()`) 直接使用推奨。

Calendar / DayFlow / Routine の 2 つ以上から参照されるものは `Schedule/shared/` に配置。背景は `vision/coding-principles.md` §3。

### 6.6 その他規約

- **i18n**: `react-i18next`。en / ja。`frontend/src/i18n/locales/` の両方に追加
- **IME 対応**: `e.nativeEvent.isComposing` チェック必須
- **リッチテキスト**: TipTap (`@tiptap/react`)
- **DnD**: `@dnd-kit`。`moveNode`（並び替え）と `moveNodeInto`（階層移動）は別操作

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

Tauri IPC は `serde` でシリアライズ。Rust 引数名と `invoke()` 引数名を一致させる。`Date` は文字列化、`undefined` は消失するので `null` を使う。

### 7.3 DB マイグレーション

- テーブル / カラム追加は `IF NOT EXISTS` 使用
- `PRAGMA user_version` を正しくインクリメント
- カラム名: DB=`snake_case` / JS=`camelCase`（Repository の `rowToModel` で変換）
- 正本: `src-tauri/src/db/migrations.rs`

診断:

```bash
sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db ".tables"
sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"
```

### 7.4 コミット規約

```
<type>: <subject>
```

type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`

### 7.5 デバッグ要点

- **IPC 未登録**: §7.2 の 4 点同期を確認
- **Context null エラー**: 対応 Provider の外で使用されている。§6.2 の順序を確認
- **Audio 無音**: `AudioContext.state === 'suspended'` → ユーザー操作後 `resume()` 必要
- **類似バグの既知解決策**: まず `.claude/docs/known-issues/INDEX.md` を grep

---

## 8. Feature Tier Map

> 詳細は `.claude/docs/requirements/` 参照（Tier 1/2/3、計 26 機能、Phase B 完了済み）

### Tier 1: コア（Value Proposition を直接支える）

[`tier-1-core.md`](./docs/requirements/tier-1-core.md)（8 機能）: Tasks (TaskTree) / Schedule (Routine + ScheduleItems + CalendarTags) / Notes / Memo / Database (Notion 風) / MCP Server / Cloud Sync / Terminal + Claude Code

### Tier 2: 補助（あると価値が大幅増）

[`tier-2-supporting.md`](./docs/requirements/tier-2-supporting.md)（12 機能）: Audio Mixer / Playlist / Pomodoro Timer / WikiTags / File Explorer / Templates / UndoRedo / Theme / i18n / Shortcuts / Toast / Trash

### Tier 3: 実験 / 凍結候補

[`tier-3-experimental.md`](./docs/requirements/tier-3-experimental.md)（6 機能）: Paper Boards（凍結継続）/ Analytics（凍結、Cognitive Phase 4 統合予定）/ NotebookLM 連携（未着手）/ Google Calendar 連携（ICS 購読 Phase 1 検討）/ Google Drive 連携（MCP で代替）/ Cognitive Architecture（構想、Phase 1 着手予定 — vision/ai-integration.md）

---

## 9. Document System

### Vision → 実装プラン → 統合 フロー

1. **Vision**（抽象・設計原則）: `docs/vision/` に記述。ADR は作らず vision/ に一元化
2. **実装プラン**（具体）: `.claude/YYYY-MM-DD-<slug>.md` 作成 → Vision から相互リンク
3. **完了**: 該当プランを `archive/` に移動、実装規約は CLAUDE.md に統合、背景・判断理由は vision/coding-principles.md 等に残す
4. **MEMORY.md / HISTORY.md**: セッション単位で同期

### なぜ ADR を使わないか

- ADR は「時点の判断」を記録するため、時間経過で古い情報を参照してしまうリスクがある
- vision/ は「現在から未来に向けた設計原則」として継続更新されるため、常に最新の意思決定を反映
- 過去の却下案・判断理由は vision/coding-principles.md §6 の更新フローに従って残す

### Known Issue ライフサイクル

`docs/known-issues/` は **壊れている／壊れていた箇所の Root Cause と再発防止知見** を置く場所（MEMORY.md / HISTORY.md では拾えないもの）。

1. **発見時**: `NNN-<slug>.md` を `_TEMPLATE.md` ベースで作成、Status=Active、INDEX.md 更新
2. **解決時**: Status=Fixed、Resolved 日付 / 修正箇所 / Lessons Learned 追記、INDEX.md の Active → Fixed 移動
3. **Monitoring**: 将来の落とし穴になりうる構造的問題は Monitoring で保持

類似バグ遭遇時はまず `INDEX.md` を grep が基本運用。

### 作業時の注意点

- 機能追加・削除時は §8 Feature Tier Map を更新（README.md 自体は概要のみ）
- 音源ファイルはコミット禁止（`public/sounds/` は `.gitignore` 対象）
- API キーはフロントエンドに直接記載しない
