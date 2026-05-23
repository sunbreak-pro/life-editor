# CLAUDE.md — Life Editor 統合定義書

> 設計判断・実装規約の SSOT。**「変わらない事実」だけを持ち、手順はスキル/エージェントへ委譲**する。抽象構想・設計原則は `docs/vision/`。Claude Code 起動時に auto-load。
>
> ⚠️ **Active Migration**: Tauri 2 + D1 + portable-pty → **Electron + Capacitor + Web + Supabase** へ移行中（`refactor/web-first-v2`）。**現行スタック・Phase 状況・移行手順の SSOT は [`2026-05-04-cross-platform-migration.md`](./2026-05-04-cross-platform-migration.md) と `memory/INDEX.md`** (旧 `MEMORY.md` は 2026-05-23 凍結、per-chat 化済 — §9 参照)。本ファイルの実装パス/コマンドはアーキ非依存に一般化済み（具体は移行 SSOT 参照）。方針: 学習ログ廃止 / 完成までコスト $0 厳守。

---

## 0. Meta

- **役割**: 現状の実装規約 / 設計判断の参照点（400 行以下目標）。抽象構想は `docs/vision/`（ADR は作らない）
- **更新規則**: 実装変更はコードと同一 PR で更新。新機能は §8 + `docs/requirements/` に記入
- **関連**:
  - 進捗 / 履歴: [`memory/INDEX.md`](./memory/INDEX.md) (タスク集約) / [`history/INDEX.md`](./history/INDEX.md) (履歴集約) — per-chat 機構の集約ビュー
  - 凍結 / 参考保全: 旧 `MEMORY.md` / `HISTORY.md` / `HISTORY-archive.md` (2026-05-23 凍結・read-only)
  - 移行: [移行 SSOT](./2026-05-04-cross-platform-migration.md)
  - 設計: `docs/vision/` (設計原則) / `docs/requirements/` (Tier) / `docs/known-issues/` ([INDEX](./docs/known-issues/INDEX.md))
  - アーカイブ: `archive/`

---

## 1. Vision（要約 → [`docs/vision/core.md`](./docs/vision/core.md)）

- **1-line**: AI と会話しながら生活を設計・記録・運用するパーソナル OS
- **Primary user**: 作者本人（N=1）、macOS + iOS、Claude Code 日常利用の開発者
- **Value**: (V1) MCP 経由で AI が全データ操作 $0 / (V2) ローカル SSOT + オフライン完全動作 / (V3) 特化テーブル + Notion 的汎用 DB の両立
- **Non-Goals**: マルチテナント / 特化専用アプリ / Claude API 直課金 / モバイル単独起動

---

## 2. Platform

Desktop（macOS 主機 / Windows 友達 MVP）= 全機能。Mobile（iOS / Android）= Consumption + Quick capture、省略 Provider 適用。Cloud Sync = 作者本人のみ（友達ビルドは feature flag で無効）。**配布・署名・検証戦略の詳細は移行 SSOT へ集約**。

### 機能差分

| 機能                                                                         | macOS | Windows | iOS | Android |  Cloud Sync  | 備考                         |
| ---------------------------------------------------------------------------- | :---: | :-----: | :-: | :-----: | :----------: | ---------------------------- |
| Tasks / Schedule / Notes / Daily                                             |   ✓   |    ✓    |  ✓  |    ✓    | ✓ (作者のみ) | コア                         |
| Pomodoro Timer                                                               |   ✓   |    ✓    |  ✓  |    ✓    |      -       |                              |
| Materials / Calendar Tags / Audio / WikiTags / Shortcut Config / Screen Lock |   ✓   |    ✓    |  -  |    -    |      -       | Mobile 省略 Provider（§6.2） |
| Terminal + Claude + MCP Server                                               |   ✓   |    ✓    |  -  |    -    |      -       | Desktop 専用                 |

Mobile 省略 Provider: Audio / ScreenLock / FileExplorer / CalendarTags / ShortcutConfig（iOS / Android 共通。WikiTag / SidebarLinks は Mobile でも有効）

---

## 3. Architecture

> 現行スタックの構成図・プロセスモデルは移行に追従するため **[移行 SSOT](./2026-05-04-cross-platform-migration.md) を正本**とする。本章はアーキ非依存の恒久原則のみ。

### 3.1 DataService 抽象化（重要・恒久）

フロントエンドは `getDataService()` 経由でのみデータアクセス。**コンポーネントから直接バックエンド呼び出し（`invoke()` 等）を書かない**。実装は `frontend/src/services/`（環境別 DataService + factory）。バックエンド実装が Tauri→Electron/Supabase へ替わってもこの境界は不変。

### 3.2 Section Routing（6 SectionId）

React Router なし。`App.tsx::activeSection` で切替: `schedule` / `materials` / `connect` / `work` / `analytics` / `settings`。`TerminalPanel` は全画面共通の下部パネル（VSCode 方式）。

### 3.3 サブシステム（恒久仕様）

- **Audio Mixer**: 6 種環境音 + カスタム。`AudioContext` は `suspended` → ユーザー操作後 `resume()` 必須
- **Sync**: バージョンカラム + last-write-wins、全テーブル対象（機構詳細 → `docs/vision/db-conventions.md` / 移行 SSOT）
- **Theme**: ダーク/ライト、フォントサイズ 10 段階（12-25px）、Tailwind `notion-*` トークン
- **Terminal**: アプリ内ターミナルから `claude` 起動 → MCP Server 自動接続（基盤は移行 SSOT）

---

## 4. Data Model

> write / sync / migration 規約詳細 → [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md)。migration 追加手順 → `db-migration` スキル。バージョン履歴の逐語は git 履歴 / `docs/known-issues/`。

### 4.1 ドメイン

`tasks` / `dailies` / `notes` / `time_memos` / `schedule_items` / `calendars` / `routines` / `routine_groups` / `routine_group_assignments` / `timer_sessions` / `sounds` / `playlists` / `wiki_tags` / `wiki_tag_assignments` / `wiki_tag_connections` / `task_templates` / `paper_boards` / `sidebar_links` / `databases`（汎用 DB: properties / rows / cells）。約 40 テーブル。Sync 区分（versioned / relation / inline）は db-conventions §3 と移行 SSOT が正本。

### 4.2 特化 vs 汎用 DB の境界

- **特化テーブル**（スキーマ固定）: `tasks` / `routines` / `routine_groups` / `schedule_items` / `notes` / `dailies` / `pomodoro_presets` / `timer_sessions` / `sidebar_links`
- **汎用 Database**: 家計簿 / 読書記録 / 習慣 / 連絡先 / 学習進捗 等
- **判断**: 特化 UI（DnD / カレンダー / ルーチン生成 / リマインダー）が必要 → 特化テーブル。型付きフィールド + フィルタ + 集計で済む → 汎用 Database

### 4.3 ID 戦略

- TaskNode: `<type>-<timestamp+counter>`（例 `task-1710201234566`） / DailyNode: `daily-<YYYY-MM-DD>` / その他: `generateId(prefix)` = `<prefix>-<uuid>`。全 String

### 4.4 ソフトデリート

`is_deleted` + `deleted_at` → TrashView から復元可。対象: Tasks / Notes / Dailies / Routines / Databases / Templates。CustomSounds はファイルベース。

### 4.5 PropertyType 拡張方針

実装済み: text / number / select / date / checkbox。優先度: relation(高) / formula(高) / rollup(中) / ビュー切替 Board・Gallery・Calendar(中) / url・email(低)。新型追加時は MCP ツール（`query_database` / `add_database_row` / `update_database_cell`）も同時更新。

---

## 5. AI Integration

### 5.1 MCP Server（32 ツール）

独立 Node.js プロセス。Claude Code が stdio 経由で呼び出し、同一 DB を直接操作。ドメイン別:

- **Tasks**: list / get / create / update / delete / get_tree
- **Dailies**: get / upsert ／ **Notes**: list / create / update
- **Schedule**: list / create / update / delete / toggle_complete / dismiss / undismiss
- **Wiki Tags**: list / tag_entity / search_by_tag / get_entity_tags
- **Content / Search**: generate_content / format_content / search_all
- **File**: list / read / write / create_directory / rename / delete / search

### 5.2 アプリ内ターミナル + Claude Code

アプリ内ターミナルから `claude` 起動 → MCP Server 自動接続 → 自然言語でデータ操作（基盤は移行 SSOT）。

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
- **Mobile**: ScreenLock / FileExplorer / CalendarTags / Audio / ShortcutConfig を省く（SidebarLinks / WikiTag は両方有効）
- 内側 Provider は外側 Context に依存可（逆不可）。例: ScheduleItemsProvider → RoutineProvider、AudioProvider → TimerProvider

### 6.3 Pattern A（Context/Provider 標準 — 3 ファイル）

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider（hook 呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

`context/index.ts` に Provider / Context / type を export。**例外**: 他 Provider が依存しない自己完結なら単一ファイル可（例 `ToastContext`）。**Mobile 省略 Provider は Optional バリアント必須**（詳細 → `vision/coding-principles.md §4`）。

### 6.4 共有コンポーネント配置

| 種別          | 配置先                                           |
| ------------- | ------------------------------------------------ |
| 共有 UI       | `frontend/src/components/shared/`                |
| 共有フック    | `frontend/src/hooks/`                            |
| Context       | `frontend/src/context/`                          |
| 共有型        | `frontend/src/types/`                            |
| Schedule 共通 | `frontend/src/components/Tasks/Schedule/shared/` |
| UndoRedo      | `frontend/src/utils/undoRedo/`                   |

設計規約: `notion-*` トークン使用（ハードコード禁止）/ i18n は props 経由（フック内で `useTranslation()` 禁止）/ ジェネリクスで型外部化 / DataService はコールバック注入（フック内で `getDataService()` 直呼び禁止）/ **主要 UI コンテナ背景に透明度禁止**（不透明トークン使用、未定義クラスは silent fail で透明落ち）— 詳細 → `vision/coding-principles.md §5`。UI デザイン判断は `frontend-react-designer` スキル。

### 6.5 Schedule 3 分割

`RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider`。`useScheduleContext()` は後方互換ファサード。新コードは個別 hook 直接使用。複数参照されるものは `Schedule/shared/` へ。背景 → `vision/coding-principles.md §3`。

### 6.6 その他規約

- **i18n**: `react-i18next`（en / ja 両方に追加）／ **IME**: `e.nativeEvent.isComposing` チェック必須
- **リッチテキスト**: TipTap ／ **DnD**: `@dnd-kit`（`moveNode`=並び替え と `moveNodeInto`=階層移動 は別操作）

---

## 7. Development Workflows

### 7.0 ワークフロー = スキル/エージェント（手順の正本）

手順は本ファイルに書かず、以下に委譲する。**実装タスクの起点は `lead-pipeline` スキル**（ティア判定 → 必要工程を采配）。

| 局面                               | 委譲先                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------- |
| 実装タスク全体の采配               | `lead-pipeline` スキル（軽=直接 / 中=verifier→tracker / 重=フルチェーン）                                          |
| 長時間・並列・条件達成型の実行戦略 | `execution-router` スキル（/goal・/batch・/loop・subagent 判断）                                                   |
| 要件分解 / 実装 / 独立監査         | `role-pm` → `role-engineer` → `role-qa`（メインが Agent 起動。再帰禁止）                                           |
| セッション開始/中断/終了           | `session-manager`（→ session-loader / task-tracker / session-verifier）                                            |
| 品質ゲート                         | `session-verifier`（commit 前）                                                                                    |
| 進捗記録                           | `task-tracker`（per-chat: `memory/chat-<self>.md` + `history/chat-<self>.md` + INDEX 集約 / legacy fallback あり） |
| branch / PR / merge                | `git-orchestrator`（→ git-workflow / git-branch-flow / git-conflict-resolver）                                     |
| IPC 追加                           | `add-ipc-channel` スキル ／ DB 変更                                                                                | `db-migration` スキル |
| デバッグ                           | `debug-strategy` スキル + `docs/known-issues/INDEX.md` を grep                                                     |
| life-editor 整合監査               | `life-editor-ipc-validator` / `-migration-validator` / `-sync-auditor`                                             |

### 7.1 開発コマンド

```bash
cd frontend && npm run test                             # Vitest
cd frontend && npx vitest run src/path/to/File.test.tsx # 単一テスト
cd frontend && npm run build                            # 型検証（tsc -b。--noEmit は solution 構成で無効）
```

起動・ビルドコマンドは移行に追従するため **移行 SSOT を参照**（Tauri 時代の `cargo tauri dev` 等は廃止）。

### 7.2 コミット規約

`<type>: <subject>` — type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`（詳細・破壊的操作の境界は `git-workflow` スキル）

### 7.3 Plan Gate Convention（計画書ゲート規約）

並行作業の認知負荷を構造的に下げるため、新規・大改訂の計画書は [`docs/vision/plans/_TEMPLATE.md`](./docs/vision/plans/_TEMPLATE.md) をベースに作成し、以下を必須とする（既存計画書は触る時に移行、一括書き換えしない）。

- **Scope 宣言**: 触ってよいパスを計画書冒頭に明示（scope drift 検出の根拠）
- **Gate 列**: 各 Step を 🤖 自律 / 👀 目視 / 🛑 人手 で分類
  - 🤖 自律 = Claude 完結。後追い検証で品質担保
  - 👀 目視 = UI/体感/レイアウトでユーザー目視必須
  - 🛑 人手 = DDL push / シークレット投入 / PR merge / 本番デプロイ
- **Acceptance Criteria**: 機械検証可能な基準で完了条件を定義（`npm run build` exit 0 / vitest 緑 / Supabase に該当列存在 等）
- **DB Migration Notes**: DDL 含む場合は「ローカルファイル先行 → ユーザー `supabase db push`」を明記（`apply_migration` MCP 単独使用禁止）

**Stop hook 連動**: `.claude/hooks/stop-check.sh` が応答終了時に frontend 変更を検知して裏で `npm run build` を走らせ、結果を `.claude/comm/outbox/<chat>/stop-report.md` に追記する。登録は `.claude/settings.json::hooks.Stop`。無効化は同ファイル削除。

**SessionStart hook 連動**: `.claude/hooks/session-start-check.sh` が新規セッション開始時に `.claude/comm/.session-name` を 4 観点 (A 未宣言 / B `chat-` プレフィックス違反 / C allowlist 外文字 (`^[a-zA-Z0-9_-]+$`) / D `.session-name` の mtime が HEAD commit より 3 日以上古い) で検査し、警告があれば `.claude/comm/outbox/<chat>/session-start-warnings.md` に追記。**informational only でセッションは止めない**。登録は `.claude/settings.json::hooks.SessionStart`。per-chat 機構 (`.claude/memory/INDEX.md`) 不在の legacy プロジェクトでは無音 (即 exit 0)。

---

## 8. Feature Tier Map（詳細 → `docs/requirements/`）

- **Tier 1 コア**: [`tier-1-core.md`](./docs/requirements/tier-1-core.md)（8）— Tasks / Schedule / Notes / Daily / Database / MCP Server / Cloud Sync / Terminal
- **Tier 2 補助**: [`tier-2-supporting.md`](./docs/requirements/tier-2-supporting.md)（12）— Audio / Playlist / Pomodoro / WikiTags / File Explorer / Templates / UndoRedo / Theme / i18n / Shortcuts / Toast / Trash
- **Tier 3 実験/凍結**: [`tier-3-experimental.md`](./docs/requirements/tier-3-experimental.md)（6）— Paper Boards / Analytics / NotebookLM / Google Calendar / Google Drive / Cognitive Architecture
- **次フェーズ**: [移行 SSOT](./2026-05-04-cross-platform-migration.md) が現行計画（Windows/Android 配布も移行 SSOT Phase 5 に統合済。旧 `2026-04-26-windows-android-port.md` は移行 SSOT が完全に置換し 2026-05-16 削除＝逐語は git 履歴）。旧 Tauri 前提 vision も 2026-05-16 削除済（恒久知見は [`archive/SUMMARY.md`](./archive/SUMMARY.md)）。`requirements/ios-additions.md` は Phase 5 で再仕分け

---

## 9. Document System

- **フロー**: Vision（`docs/vision/`、ADR 不使用）→ 実装プラン（`.claude/docs/vision/plans/YYYY-MM-DD-*.md`）→ 完了で `archive/` 移動・規約は本ファイルへ統合。**進捗 / 履歴はチャット別 (per-chat) ファイルに分割** — `.claude/memory/chat-<self>.md` + `.claude/history/chat-<self>.md`（task-tracker 経由）、集約は `memory/INDEX.md` + `history/INDEX.md`（自動再生成）。チャット名は `.claude/comm/.session-name` で宣言（FileChanged 監視レイヤーとも共有）。旧 `.claude/MEMORY.md` / `HISTORY.md` は 2026-05-23 凍結・参考保全。ADR 不使用の理由・却下案は `vision/coding-principles.md §5`
- **Known Issue**: `docs/known-issues/` に Root Cause + 再発防止を蓄積。発見時 `_TEMPLATE.md` で `NNN-<slug>.md` 作成 + INDEX 更新、解決時 Status=Fixed。**類似バグはまず `INDEX.md` を grep**
- **並行チャット通信**: `.claude/comm/` 経由（プロトコル → [`comm/README.md`](./comm/README.md)）。自分の Outbox にのみ append、他チャットは読み取り専用
- **作業時の鉄則**: 機能追加/削除時は §8 更新 ／ 音源ファイルはコミット禁止（`public/sounds/` は `.gitignore`）／ API キーをフロントエンドに直書きしない ／ **`.mcp.json`（git 追跡対象）のトークンは `${SUPABASE_ACCESS_TOKEN}` 等の参照プレースホルダのまま維持。実トークン（`sbp_...` 等）へ平文展開禁止 — 平文化＝即リポジトリ流出。実値は shell 環境変数で供給。commit 前に参照形式か必須確認（2026-05-17 平文展開で GitHub Push Protection ブロック発生）**
