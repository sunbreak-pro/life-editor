# CLAUDE.md — Life Editor 統合定義書

> Life Editor の唯一の最上位定義書。ビジョン・要件・アーキテクチャ・規約・運用ガイドの SSOT（Single Source of Truth）。
> Claude Code は起動時にこのファイルを auto-load する。

---

## 0. Meta

### このファイルの位置づけ

- **役割**: Life Editor プロジェクトの全設計判断・実装規約・現状機能の唯一の参照点
- **読者**: Claude Code（自動読込）、開発者（コードレビュー・実装時）、新規参加者（オンボーディング）
- **管理規範**: 設計判断の追加は本ファイル更新で完結。新規 ADR を作る前に本ファイル該当章への統合可否を検討する

### 更新ルール

- 章 1-5（ビジョン・Identity 系）: ユーザー（作者）判断なしに変更しない
- 章 6-10（アーキテクチャ・規約系）: 実装変更を伴うものは本ファイルとコードを同一 PR で更新
- 章 11（Feature Tier）: 新機能追加時に必ず追記し、`.claude/docs/requirements/` に詳細記入
- 章 13（Roadmap）: セッション終了時に MEMORY.md と同期

### 関連ドキュメント

| ディレクトリ                     | 用途                                                   |
| -------------------------------- | ------------------------------------------------------ |
| `.claude/MEMORY.md`              | タスクトラッカー（進行中 / 直近の完了 / 予定）         |
| `.claude/HISTORY.md`             | 変更履歴（セッション単位の詳細記録）                   |
| `.claude/feature_plans/`         | 実装プラン（PLANNED / IN_PROGRESS）                    |
| `.claude/archive/`               | 完了済み・廃案プラン / アーカイブ ADR                  |
| `.claude/docs/adr/`              | アーキテクチャ決定記録（PROPOSED / Accepted のみ残置） |
| `.claude/docs/requirements/`     | Tier 1-3 機能要件定義（本ファイル章 11 の詳細版）      |
| `.claude/docs/code-explanation/` | 機能別コード解説（学習教材、参照のみ）                 |

ライフサイクル: `feature_plans/` → `archive/`（完了時 Status を COMPLETED に更新後 archive へ移動）

---

## 1. Core Identity

> **素案（Phase A-2）— ユーザーレビュー待ち**

### 1-line definition

**「AI と会話しながら生活を設計・記録・運用するパーソナル OS」**

### Elevator pitch

カレンダー中心の AI 連携ワークスペース。タスク・スケジュール・メモ・知識・家計などを一つのデスクトップアプリに集約し、アプリ内ターミナルから Claude Code が MCP Server 経由で全データを自然言語で操作する。SQLite ローカル SSOT + Cloud Sync で Desktop ↔ iOS 間を同期しつつ、オフラインでも完全動作する。

### 意図的に外したもの

- **チームコラボレーション**: 個人利用前提。共有・コメント・権限管理は持たない
- **Web UI**: Desktop / iOS のネイティブクライアントのみ提供
- **特定用途特化アプリ**: 家計簿専用 / レシピ管理専用などのスペシャライズドアプリではない。Notion 的な汎用 DB で表現する
- **Claude API 直接課金**: Max サブスクリプションの Claude Code ラッピング方式で AI コスト $0 を維持

---

## 2. Target User

> **素案（Phase A-2）— ユーザーレビュー待ち**

### Primary user

**作者本人（N=1）— 平日は macOS、週末は iOS、Claude Code を日常的に使う開発者**

### Key characteristics

- 自分の生活データ（タスク / スケジュール / メモ / 学習記録 / 家計）を一つの SQLite に集約したい
- 自然言語（Claude Code）でデータ操作することに慣れている、ターミナルを日常的に使う
- Notion / Obsidian / Apple Reminders / Google Calendar のいずれも単独では満足できない（複数併用の手間が課題）
- 集中作業時に環境音 + ポモドーロタイマーを使う没入型ワークフロー
- 開発者 = 必要なら自分で機能追加できる、ドキュメンテーション・規約への許容度が高い

### Non-users

- 複数人で共有するチーム / 組織
- 紙ベースの記録を好む人
- Web ブラウザでのみアプリを使いたい人
- 「設定不要・即使える」を重視する一般ユーザー（本アプリは設計に意図と知識を要する）

---

## 3. Core Value Propositions

> **素案（Phase A-2）— ユーザーレビュー待ち**

### V1: AI が自然言語で全データを操作できる（追加コスト $0）

- **根拠**: MCP Server（30 ツール）+ アプリ内ターミナル（portable-pty）+ Claude Code Max サブスクのラッピング方式（ADR-0005）
- **比較**: Notion AI は UI 経由のみで内製 AI、Obsidian の AI プラグインは外部 API キー必須、Apple Reminders には AI なし

### V2: ローカル SQLite が SSOT — オフライン完全動作 + マルチデバイス同期

- **根拠**: rusqlite (WAL) + Tauri 2.0 + Cloud Sync（Cloudflare Workers + D1, 設計中）
- **比較**: Notion はクラウド必須でオフライン制限、Obsidian は同期が Sync プラン（有料）か自前運用、Apple Reminders は Apple エコシステム外と連携困難

### V3: Notion 的汎用 DB + 特化機能の両立

- **根拠**: Tasks / Schedule / Notes / Memo は特化テーブル（CRUD 高速、ドメイン制約あり）、家計簿・読書記録・習慣トラッカーなどは汎用 Database で表現
- **比較**: Notion は全部汎用 DB（タスク特化機能が弱い、リマインダー・タイマー・ルーチンが二級市民）、Apple Reminders / TickTick は特化のみで汎用 DB なし

---

## 4. Non-Goals

> **素案（Phase A-2）— ユーザーレビュー待ち**

- **NG-1: マルチテナント / チームコラボ機能は持たない**（個人利用前提、共有・権限・コメントなし）
- **NG-2: Web UI は提供しない**（Desktop / iOS のネイティブのみ。閲覧も含めて）
- **NG-3: 特定用途特化アプリの直接実装はしない**（家計簿専用 UI / レシピ専用 UI などは作らず、汎用 Database で実現）
- **NG-4: Claude API 直接課金は使わない**（Max サブスク Claude Code ラッピングで $0 を維持。将来例外検討は留保）
- **NG-5: モバイル単独起動（Desktop なし）はサポートしない**（Desktop が primary creation device、iOS は consumption + quick capture）
- **NG-6: 既存サービスのフル機能代替は目指さない**（Google Calendar の予定編集など、外部サービスは参照中心 / 片方向同期から）

---

## 5. Platform Strategy

> **素案（Phase A-2）— ユーザーレビュー待ち**

### 役割定義

- **Desktop (macOS / Windows / Linux — Tauri 2.0)**: Primary creation device。すべての機能が揃う。コーディング、AI 対話、深い思考作業
- **Mobile (iOS — Tauri 2.0)**: Consumption + Quick capture。外出時の参照・スケジュール確認・メモ追加
- **Cloud (Cloudflare Workers + D1)**: Desktop ↔ iOS 間の SQLite テーブル双方向同期のみ。Web UI / 認証 UI は提供しない

### Desktop / Mobile / Cloud の機能差分マトリクス

| 機能              | Desktop | Mobile (iOS) | Cloud Sync | 備考                                       |
| ----------------- | ------- | ------------ | ---------- | ------------------------------------------ |
| Tasks             | ✓       | ✓            | ✓          |                                            |
| Schedule          | ✓       | ✓            | ✓          |                                            |
| Notes / Memo      | ✓       | ✓            | ✓          |                                            |
| Materials (Files) | ✓       | -            | -          | Mobile 省略（FileExplorerProvider なし）   |
| Calendar Tags     | ✓       | -            | -          | Mobile 省略（CalendarTagsProvider なし）   |
| Audio Mixer       | ✓       | -            | -          | Mobile 省略（AudioProvider なし）          |
| WikiTags          | ✓       | -            | -          | Mobile 省略（WikiTagProvider なし）        |
| Shortcut Config   | ✓       | -            | -          | Mobile 省略（ShortcutConfigProvider なし） |
| Screen Lock       | ✓       | -            | -          | Mobile 省略（ScreenLockProvider なし）     |
| Pomodoro Timer    | ✓       | ✓            | -          |                                            |
| Terminal + Claude | ✓       | -            | -          | Desktop 専用（PTY 実装が iOS 不可）        |
| MCP Server        | ✓       | -            | -          | Desktop 専用（Claude Code 経由で利用）     |

### Provider セット差分

- **デスクトップ Provider**（外→内）: ErrorBoundary → Theme → Toast → UndoRedo → ScreenLock → TaskTree → Calendar → Template → Memo → Note → FileExplorer → Routine → ScheduleItems → CalendarTags → Timer → Audio → WikiTag → ShortcutConfig
- **モバイル Provider**（外→内）: ErrorBoundary → Theme → Toast → UndoRedo → TaskTree → Calendar → Template → Memo → Note → Routine → ScheduleItems → Timer

モバイルで省略: ScreenLock, FileExplorer, CalendarTags, Audio, WikiTag, ShortcutConfig

---

## 6. Architecture

### 6.1 全体構成

```
Renderer (React 19 + Vite)
   ↓ Tauri IPC (@tauri-apps/api)
Rust Backend (src-tauri/)
   ↓ rusqlite
SQLite (~/Library/Application Support/life-editor/life-editor.db)

       ↑
MCP Server (mcp-server/, 独立 Node.js プロセス)
   stdio 経由で Claude Code から呼ばれる
   同一 SQLite DB をアクセス（better-sqlite3）

       ↑
Cloud Sync (TBD — Phase A-2 で詳細化)
```

#### Terminal (portable-pty)

Rust の `PtyManager` が PTY セッションを管理。Renderer の xterm.js と Tauri Events (`terminal_data`) で通信。

#### MCP Server (`mcp-server/`)

独立 Node.js プロセス。Claude Code が stdio 経由で呼び出し、同一 SQLite DB をアクセス。

### 6.2 Provider ツリー

詳細は §5 Platform Strategy 参照。Provider 順序の依存制約：

- 内側 Provider は外側 Context に依存可（逆は不可）
- ScheduleItemsProvider → RoutineProvider（sync/backfill 依存）
- AudioProvider → TimerProvider

Pattern A（3 ファイル構成）が標準。詳細は §9.2 参照。

### 6.3 DataService 抽象化（重要）

フロントエンドは `getDataService()` 経由でデータアクセス。**直接 Tauri invoke を呼ばない**。
ファクトリ (`dataServiceFactory.ts`) は `TauriDataService` を返す。

- `TauriDataService.ts` — Tauri IPC 経由（`@tauri-apps/api/core` の `invoke()`）

インターフェース定義: `frontend/src/services/DataService.ts`

### 6.4 Section Routing（6 SectionId）

React Router なし。`App.tsx` の `activeSection` で画面切替。

| SectionId   | 機能                                             |
| ----------- | ------------------------------------------------ |
| `schedule`  | カレンダー・スケジュール表示、イベント管理       |
| `materials` | ファイル管理、Notes / Memos / Databases 閲覧     |
| `connect`   | 日別メモビューとコネクション表示（アイデア整理） |
| `work`      | Pomodoro タイマー、作業セッション追跡            |
| `analytics` | 作業統計、時間分析、パフォーマンス可視化         |
| `settings`  | アプリケーション設定（外観・動作・データ管理）   |

`TerminalPanel`: SectionId に含めず全画面共通の下部パネル（VSCode のターミナルと同じ位置づけ）。

### 6.5 サブシステム

#### Terminal

- 実装: `portable-pty` (Rust) + `xterm.js` (Frontend)
- 起動: Ctrl+`` ` `` で開閉、ドラッグで高さ調整
- テーマ: Catppuccin Mocha
- 全セクション共通の下部パネル

#### Audio Mixer

- 6 種環境音（Rain / Thunder / Wind / Ocean / Birds / Fire）+ カスタムサウンドアップロード
- `AudioContext` state: `suspended` → ユーザー操作後に `resume()` 必要
- フェード: `useAudioEngine` の `gainNode` 操作

#### Sync (Cloud)

- **目的**: Desktop ↔ iOS 間で SQLite テーブルを双方向同期。バックアップは副次効果
- **基盤**: Cloudflare Workers + D1（設計中）
- **プロトコル**: バージョンカラム + last-write-wins ベース。conflict resolution は将来検討
- **対象**: life-editor 全テーブル + 将来の `claude_*` テーブル（ADR-0005）
- **non-goal**: Web UI / 認証 UI（OAuth はネイティブクライアント側で完結）

#### Theme

- ダークモード / ライトモード切替
- フォントサイズ 10 段階スライダー（12px〜25px）
- Tailwind デザイントークン（`notion-*`）使用

---

## 7. Data Model

### 7.1 SQLite v59 テーブル一覧

スキーマは `src-tauri/src/db/migrations.rs` が正。WAL モード。
最新バージョンで扱う ~45 テーブル：

**コアドメイン**: `tasks` / `memos` / `notes` / `time_memos`

**スケジュール**: `schedule_items` / `calendars` / `calendar_tag_definitions` / `calendar_tag_assignments`

**ルーチン・習慣**: `routines` / `routine_logs` / `routine_tag_definitions` / `routine_tag_assignments` / `routine_groups`

**タイマー**: `timer_settings`（シングルトン）/ `timer_sessions` / `pomodoro_presets`

**サウンド**: `sound_settings` / `sound_presets` / `sound_tag_definitions` / `sound_tag_assignments` / `sound_workscreen_selections` / `playlists` / `playlist_items`

**タグシステム**: `wiki_tags` / `wiki_tag_assignments` / `wiki_tag_connections` / `wiki_tag_groups` / `wiki_tag_group_members`

**接続・タグ**: `note_connections` / `task_tags` / `note_tags` / `task_tag_definitions` / `note_tag_definitions`

**テンプレート・ボード**: `task_templates` / `templates` / `paper_boards` / `paper_nodes` / `paper_edges`

**データベース機能（Notion 風）**: `databases` / `database_properties` / `database_rows` / `database_cells`

**その他**: `ai_settings` / `app_settings`

#### 特化 vs 汎用 DB の境界線

**特化テーブル（スキーマ固定）**:

- `tasks` — TaskNode（status / parentId / order / scheduledAt / 階層 DnD）
- `routines` — Routine（frequency / time / days / リマインダー）
- `schedule_items` — ScheduleItem（日次表示・ルーティン自動生成）
- `notes` / `memos` — リッチエディタ + 日次メモ
- `pomodoro_presets` / `timer_sessions` — タイマー特化

**汎用 Database で表現するもの**（databases / database_properties / database_rows / database_cells）:

- 家計簿 / 読書記録 / 習慣トラッカー / 連絡先 / 学習進捗 など、ユーザーが自由にスキーマ設計するもの

**境界判断基準**:

- 特化 UI が必要（DnD / カレンダー表示 / ルーチン生成 / リマインダー連動など）→ 特化テーブル
- 単純な「型付きフィールドのリスト + フィルタ + 集計」で済む → 汎用 Database
- 既存ユーザーが Notion で自前テーブルを作るような用途は汎用 DB に倒す

### 7.2 ID 戦略

- **TaskNode**: `"<type>-<timestamp+counter>"` 形式（例: `task-1710201234566`）
- **その他エンティティ**: `generateId(prefix)` で `"<prefix>-<uuid>"` 形式（例: `note-xxxxxxxx-xxxx-...`）
- すべて String 型

### 7.3 ソフトデリート対象

`is_deleted` + `deleted_at` カラム → TrashView から復元可能：

- Tasks / Notes / Memos / Routines / Databases / Templates
- CustomSounds もソフトデリート対応だがファイルベース（SQLite カラムではなく IPC 経由で管理）

### 7.4 PropertyType 拡張方針

**現状実装済み**: text / number / select / date / checkbox（5 種）

**追加判断基準**: Value Proposition（§3）を直接支える型のみ追加する

**優先度（daily-life-hub-requirements.md より）**:

| 型              | 用途例                                  | 優先度 | 備考                       |
| --------------- | --------------------------------------- | ------ | -------------------------- |
| `relation`      | DB 間リレーション（支出 → カテゴリ DB） | 高     | 家計簿の必須機能           |
| `formula`       | 月次合計の自動計算、予算残高            | 高     | 家計簿・学習進捗の必須機能 |
| `rollup`        | リレーション先の集計（カテゴリ別合計）  | 中     | relation 実装後            |
| ビュー切替      | Board / Gallery / Calendar 表示         | 中     | DB の表現力強化            |
| `url` / `email` | 連絡先 DB、リソース管理                 | 低     | text 型で代用可能          |

**MCP 対応の同時更新**:

- 新しい PropertyType 追加時は `query_database` / `add_database_row` / `update_database_cell` MCP ツールも同時更新（Claude が新型を扱えるように）

---

## 8. AI Integration Strategy

> **§8.3-8.4 は素案（Phase A-2）— ユーザーレビュー待ち**

### 8.1 現状の MCP（30 ツール）

MCP Server は独立 Node.js プロセス。Claude Code が stdio 経由で呼び出し、同一 SQLite DB を直接操作。

| ドメイン        | ツール                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tasks           | `list_tasks` / `get_task` / `create_task` / `update_task` / `delete_task` / `get_task_tree`                             |
| Memos           | `get_memo` / `upsert_memo`                                                                                              |
| Notes           | `list_notes` / `create_note` / `update_note`                                                                            |
| Schedule        | `list_schedule` / `create_schedule_item` / `update_schedule_item` / `delete_schedule_item` / `toggle_schedule_complete` |
| Wiki Tags       | `list_wiki_tags` / `tag_entity` / `search_by_tag` / `get_entity_tags`                                                   |
| Content         | `generate_content` / `format_content`                                                                                   |
| Search          | `search_all`                                                                                                            |
| File Management | `list_files` / `read_file` / `write_file` / `create_directory` / `rename_file` / `delete_file` / `search_files`         |

### 8.2 アプリ内ターミナル + Claude Code 起動

- アプリ内ターミナル（portable-pty）から `claude` コマンドで Claude Code を起動
- MCP Server (`life-editor`) が自動接続され、自然言語でタスク・メモ・ノート操作が可能
- v2 テーマ「AI と一緒に生活を設計する」の中核実装

### 8.3 Cognitive Architecture（ADR-0005, PROPOSED）

> 詳細は `.claude/docs/adr/ADR-0005-claude-cognitive-architecture.md` 参照

#### 要旨

life-editor 既存の MCP Server / SQLite / アプリ内ターミナルを基盤に、**Claude の永続記憶 + 学習サイクル + マルチデバイス対応**を段階的に構築する。

#### 設計判断（3 点）

1. **記憶ストレージ = 同一 SQLite に `claude_*` テーブル群を追加**（claude_memories / claude_episodes / claude_safeguards / claude_preferences / claude_reflections）。生活データと JOIN して横断分析可能、Cloud Sync の対象に統合
2. **新 MCP Server `mcp-server-cognitive/` を分離**（既存 30 ツールの CRUD と分け、内省・分析・記憶管理に専念）
3. **Claude Code プロセス ラッピング方式**で Max サブスク内 $0 実現（Claude Agent SDK は third-party サブスク利用不可のため）

#### 記憶階層モデル（life-editor 適用版）

- **Working Memory**: インメモリ、非永続（現在セッションのコンテキストのみ）
- **Episodic Memory** → `claude_episodes`: 既存 schedule_items / memos / pomodoro 記録が自動的にエピソードとして機能
- **Semantic Memory** → `claude_memories`: Episode から抽象化されたパターン（「午前中に集中作業が得意」等）
- **Safeguard Memory** → `claude_safeguards`: 失敗パターンから抽出された予防知識
- **Vector Memory**: Phase 3 以降の課題（sqlite-vss / Vectorize / ローカル Embedding 検討）

#### 学習サイクル（簡易 MERF ループ）

- **日次**: 1 日終わりに `reflect_on_day` → タスク完了率・スケジュール遵守率・集中セッション分析 → 翌日提案
- **週次**: `analyze_patterns` で曜日別パターン抽出 → Semantic Memory 検証・更新

#### フェーズ計画

| Phase | 内容                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1     | 記憶基盤: claude\_\* テーブル + mcp-server-cognitive 骨格 + save/recall/retire_memory ツール                                 |
| 2     | 内省ループ: reflect_on_day / analyze_patterns / Safeguard 適用ロジック                                                       |
| 3     | チャット UI + Cloud Sync: Claude Code PTY 出力パース → チャットバブル UI、claude\_\* テーブル D1 同期、CloudCLI セルフホスト |
| 4     | 自己最適化: Eval 駆動型改善、提案受け入れ率トラッキング                                                                      |

### 8.4 利用シナリオ + AI 不使用時の機能割合

#### シナリオ 1: 朝の計画

ユーザーが「今日のタスクの優先順位を整理して」とターミナルで Claude に指示。Claude が MCP `list_tasks` でタスクを取得し、`update_task` で並び替え・スケジュール再配置。カレンダー UI が即座に反映される。

#### シナリオ 2: 1 日の振り返り

夜に `reflect_on_day` を起動。Claude が schedule_items の完了率、memos の内容、pomodoro_sessions のパターンを分析し、Semantic Memory に「火曜午後は予定外会議が入りやすい」等のパターンを保存。翌日のスケジュール提案を生成。

#### シナリオ 3: データベース集計

「今月の食費合計して」とユーザーが指示。Claude が Database MCP ツール（Phase 1 で追加予定の `query_database`）で家計簿 DB を集計し、カテゴリ別合計を提示。formula プロパティが追加されれば月次予算残高も自動算出される。

#### AI 不使用でも成立する機能の割合

**コア機能の約 80% は AI なしで動作する**：

- Tasks / Schedule / Notes / Memo の CRUD は完全に UI で完結
- Pomodoro Timer / Audio Mixer / Playlist は AI 不要
- Database（汎用 DB）の作成・編集・集計（sum/avg）は UI のみで可能
- WikiTags / File Explorer / Settings は AI 不要

**AI が真価を発揮する場面**:

- 自然言語での横断検索・一括操作（「先月の TODO で未完了のものを今月に移動」など）
- パターン分析と提案（reflect_on_day / analyze_patterns）
- 外部知識の取り込み（YouTube URL → 要約 → ノート保存）
- 設計支援（Database スキーマ提案、ルーティン構成提案）

---

## 9. Coding Standards & Patterns

### 9.1 命名規則

| 種別             | 規則                   | 例                       |
| ---------------- | ---------------------- | ------------------------ |
| コンポーネント   | PascalCase             | `TaskList.tsx`           |
| フック           | camelCase + use 接頭辞 | `useTasks.ts`            |
| 変数・関数       | camelCase              | `taskList`, `fetchTasks` |
| 定数             | SCREAMING_SNAKE_CASE   | `API_BASE_URL`           |
| Context Value 型 | PascalCase             | `AudioContextValue.ts`   |

- Frontend: ESLint 設定に従う
- コメントは必要最小限

### 9.2 Pattern A（Context/Provider 標準 — 3 ファイル構成）

新しい Context/Provider 作成時の標準（旧 ADR-0002 / rules/project-patterns 統合）：

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider component（フック呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

`context/index.ts` に Provider, Context, ContextValue type を export 追加。

#### 例外（単一ファイル構成）

他 Provider が依存しない・ContextValue 型が他 Context から参照されない・実装が自己完結している場合は単一ファイル許容（例: `ToastContext`, `AnalyticsFilterContext`）

### 9.3 共有コンポーネント配置規約

| 種別                          | 配置先                                           | 例                               |
| ----------------------------- | ------------------------------------------------ | -------------------------------- |
| 共有 UI コンポーネント        | `frontend/src/components/shared/`                | `Modal.tsx`, `IconButton.tsx`    |
| 共有フック                    | `frontend/src/hooks/`                            | `useInlineEdit.ts`               |
| Context（型 + createContext） | `frontend/src/context/FooContextValue.ts`        | `TimerContextValue.ts`           |
| Context（Provider）           | `frontend/src/context/FooContext.tsx`            | `TimerContext.tsx`               |
| Consumer hook                 | `frontend/src/hooks/useFooContext.ts`            | `useTimerContext.ts`             |
| 共有型定義                    | `frontend/src/types/`                            | `shared.ts`                      |
| Schedule 共通コンポーネント   | `frontend/src/components/Tasks/Schedule/shared/` | `RoleSwitcher.tsx`               |
| UndoRedo ロジック             | `frontend/src/utils/undoRedo/`                   | `UndoRedoManager.ts`, `types.ts` |

#### 共有コンポーネント設計

- Tailwind のデザイントークン（`notion-*`）使用、ハードコード禁止
- i18n テキストは props で受け取る（コンポーネント内で `useTranslation()` を呼ばない）
- サイズバリエーション: `size?: 'sm' | 'md' | 'lg'`
- IME 対応: `e.nativeEvent.isComposing` チェック必須

#### 共有フック設計

- ジェネリクスでエンティティ型を外部化: `useDataFetch<T>(fetcher)`
- DataService 依存はコールバックで注入（フック内で直接 `getDataService()` を呼ばない）
- UndoRedo 統合は `push` 関数を引数で受け取る

### 9.4 Schedule 3 分割 + shared/ 規約（旧 ADR-0003 / 0004）

#### Schedule Provider 3 分割（ADR-0003 統合）

`RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider` の 3 分割。
`useScheduleContext()` は後方互換ファサード（3 つの新 hook を内部で合成）。
新コードでは `useRoutineContext()` / `useScheduleItemsContext()` / `useCalendarTagsContext()` を直接使用推奨。

#### Schedule 共通コンポーネント（ADR-0004 統合）

Calendar / DayFlow / Routine の 2 つ以上から参照されるコンポーネントは `frontend/src/components/Tasks/Schedule/shared/` に配置。

### 9.5 i18n / ID 生成 / IME 対応

- **i18n**: `react-i18next`。対応: en / ja。ロケール: `frontend/src/i18n/locales/`。新 UI テキストは `en.json` / `ja.json` 両方に追加
- **ID 生成**: §7.2 参照
- **IME 対応**: `e.nativeEvent.isComposing` チェック必須

### 9.6 リッチテキスト・DnD

- **リッチテキスト**: TipTap (`@tiptap/react`)
- **DnD**: `@dnd-kit` 使用。`moveNode`（並び替え）と `moveNodeInto`（階層移動）は別操作

### 9.7 レイヤー別リファクタリング注意

- **Repository**: prepared statements の再利用維持、`rowToModel` パターン
- **IPC**: コマンド変更時は 3 点セット更新（§10.2 参照）
- **DataService**: インターフェース → 実装 → モックの順で変更

---

## 10. Development Workflows

### 10.1 開発コマンド

```bash
cargo tauri dev                                          # Tauri + Vite 同時起動（開発時はこれ）
cd frontend && npm run test                              # Vitest（単発実行）
cd frontend && npx vitest run src/path/to/File.test.tsx  # 単一テスト実行
cd mcp-server && npm run build                           # MCP Server ビルド
```

### 10.2 IPC 追加時の 3 点同期（旧 rules/project-review-checklist 統合）

Tauri コマンド追加時は以下を必ず更新：

1. `src-tauri/src/commands/` に `#[tauri::command]` 関数追加
2. `src-tauri/src/lib.rs` の `generate_handler![]` にコマンド登録
3. `frontend/src/services/TauriDataService.ts` にメソッド追加
4. `frontend/src/services/DataService.ts` インターフェースにメソッド定義

#### IPC / Tauri チェックリスト

- IPC 追加・変更時は 3 点同期を確認: `src-tauri/src/commands/` (`#[tauri::command]`) / `src-tauri/src/lib.rs` (`generate_handler![]`) / `frontend/src/services/TauriDataService.ts`
- Tauri IPC は `serde` でシリアライズ。Rust 引数名とフロントエンド `invoke()` 引数名を一致させる

#### DataService 層チェックリスト

- 新しいデータ操作は `DataService.ts` インターフェースに定義 → `TauriDataService.ts` に実装
- コンポーネントから直接 `invoke()` を呼ばない（DataService 経由）

#### Provider / Context チェックリスト

- Provider 順序: §5 Platform Strategy / §6.2 Provider ツリー参照
- ScheduleItemsProvider は RoutineProvider の内側に配置（sync/backfill 依存）
- 新 Provider 追加時は `renderWithProviders.tsx` にも追加
- **Pattern A 準拠**: 新 Context 作成時は 3 ファイル構成（§9.2 参照）。小規模 / 局所 Context は例外あり
- `context/index.ts` に Provider, Context, ContextValue type を export 追加

### 10.3 DB マイグレーション手順

- テーブル / カラム追加は `IF NOT EXISTS` 使用
- `PRAGMA user_version` を正しくインクリメント
- カラム名: DB=`snake_case` / JS=`camelCase`
- スキーマ正本: `src-tauri/src/db/migrations.rs`

### 10.4 コミット規約

```
<type>: <subject>
```

type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`

### 10.5 デバッグガイド（旧 rules/project-debug 統合）

#### Tauri IPC デバッグ

##### コマンド未登録

1. `src-tauri/src/commands/` に `#[tauri::command]` 関数が定義されているか確認
2. `src-tauri/src/lib.rs` の `generate_handler![]` にコマンドが登録されているか確認
3. `frontend/src/services/TauriDataService.ts` の `invoke()` 呼び出しでコマンド名が一致しているか確認

##### シリアライゼーション

- Tauri IPC は `serde` でシリアライズ。Rust 側の引数名はフロントエンドの `invoke()` 引数と一致が必要
- `Date` → 文字列化、`undefined` → 消失（`null` を使う）

#### SQLite デバッグ

- カラム名: DB=`snake_case` / JS=`camelCase`。Repository の `rowToModel` 変換関数を確認
- マイグレーション: `PRAGMA user_version` で現バージョン確認 → `migrations.ts` で処理を読む
- WAL モード: 同時アクセス時のロック注意

##### 診断コマンド

```bash
sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db ".tables"
sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"
```

#### Audio デバッグ

- `AudioContext` state: `suspended` → ユーザー操作後に `resume()` 必要
- フェード: `useAudioEngine` の `gainNode` 操作
- カスタムサウンド: `useCustomSounds` → IPC → ファイルシステム、メタデータは `db:customSound:*`

#### Context/Provider デバッグ

- Provider 順序: §5 Platform Strategy / §6.2 参照
- 内側 Provider は外側 Context に依存可（逆は不可）
- 依存関係: ScheduleItemsProvider → RoutineProvider、AudioProvider → TimerProvider
- `Cannot read properties of null` → コンポーネントが対応 Provider の外で使用されている
- Schedule 系は 3 Provider に分解済み（§9.4 参照）: Routine / ScheduleItems / CalendarTags
- `useScheduleContext()` はファサード（3 つの新 hook を内部で合成）。新コードでは `useRoutineContext()` / `useScheduleItemsContext()` / `useCalendarTagsContext()` を直接使用推奨

### 10.6 Review Checklist（旧 rules/project-review-checklist 統合）

コード変更時に該当する項目を確認する。

#### IPC / Tauri

§10.2 参照。

#### DataService 層

§10.2 参照。

#### Provider / Context

§10.2 参照。

#### SQLite / Migration

§10.3 参照。

#### フロントエンド

- i18n: 新 UI テキストは `en.json` / `ja.json` 両方に追加
- ID 生成: `"type-timestamp"` 形式の String 型
- `createMockDataService` に新メソッドのモック追加

#### セキュリティ

- API キーはフロントエンドに直接記載しない
- `public/sounds/*` はコミット禁止

### 10.7 作業時の注意点

- **README.md 更新**: 機能追加・削除時は本ファイル §11 の Feature Tier Map を更新（README.md 自体は概要のみ保持）
- **音源ファイル**: リポジトリにコミット禁止（`public/sounds/` は `.gitignore` 対象）

---

## 11. Feature Tier Map

> Phase B（要件定義）への入口。各 Tier の詳細は `.claude/docs/requirements/` 参照。
> Tier 分類は Phase A-2 で確定予定。以下は暫定マッピング。

### Tier 1（コア — Value Proposition を直接支える）

詳細: `.claude/docs/requirements/tier-1-core.md`（Phase B-1 で作成予定）

- **Tasks (TaskTree)**: 階層型タスクツリー、DnD、ソフトデリート、ステータス管理
- **Schedule (Routine + ScheduleItems + CalendarTags)**: カレンダー、ルーチン、スケジュール項目
- **Notes**: フリーフォームノート、ピン留め、全文検索
- **Memo**: 日別メモ
- **Database (Notion 風)**: カスタム DB、プロパティ・行・セル管理
- **MCP Server**: 30 ツールで自然言語からデータ操作
- **Cloud Sync**: 複数デバイス同期
- **Terminal + Claude Code 起動**: アプリ内ターミナルから AI 連携

### Tier 2（補助 — あると価値が大幅増）

詳細: `.claude/docs/requirements/tier-2-supporting.md`（Phase B-2 で作成予定）

- **Audio Mixer**: 6 種環境音 + カスタムサウンド + プレビュー
- **Playlist**: タイマー連動再生、シャッフル / リピート、シークバー
- **Pomodoro Timer**: WORK/BREAK/LONG_BREAK、プリセット、自動休憩
- **WikiTags**: タグ定義・接続・グループ管理
- **File Explorer**: ファイル管理（Materials セクション）
- **Templates**: タスクツリー構造のテンプレート保存・展開
- **UndoRedo**: コマンドパターン + ドメイン別スタック、Cmd+Z / Cmd+Shift+Z
- **Theme**: ダーク / ライト切替、フォントサイズ 10 段階
- **i18n**: en / ja 切替
- **Shortcuts**: キーボードショートカット（29 件 / 6 カテゴリ）
- **Toast**: 通知トースト
- **Trash**: ソフトデリート復元

### Tier 3（実験 / 凍結候補）

詳細: `.claude/docs/requirements/tier-3-experimental.md`（Phase B-3 で作成予定）

- **Paper Boards**: ノード・エッジ管理（実験的）
- **Analytics**: 作業統計、グラフ表示
- **NotebookLM 連携**: 構想のみ
- **Google Calendar 連携**: 構想のみ
- **Google Drive 連携**: 構想のみ
- **Cognitive Architecture (ADR-0005)**: 永続的記憶化（PROPOSED）

### 補足: 実装済み機能リスト（README.md より転記、Tier 分類は Phase A-2 で確定）

- 階層型タスクツリー（フォルダ/サブフォルダ/タスク）、ドラッグ&ドロップ並び替え（挿入ライン表示）、並び替え機能（手動/ステータス/スケジュール日）、完了タスク自動ソート、削除確認ダイアログ、カラー継承、ソフトデリート+ゴミ箱
- タスク左右分割レイアウト（左: TaskTree + ヘッダー / 右: TaskDetailPanel）、タスク選択でリアルタイム詳細表示
- グローバルタイマー（画面遷移してもタイマーが継続する Context ベース）
- タスク期限管理（Flag アイコンで due date 設定、DateTimePicker）
- 集中タイマー（WORK/BREAK/LONG_BREAK、ポモドーロ設定 UI、ドットインジケーター、プログレスバー、WORK 完了モーダル、プリセット、休憩自動開始、一時停止中±5m 調整、今日のサマリー）
- Work 画面（3 タブ: Timer/Pomodoro/Music）
- サイドバータイマー表示（Work 項目下にタスク名・残り時間・編集ボタン）
- TaskTree タイマー表示（実行中タスク行に残り時間 + ミニプログレスバー）
- プレイリスト（タイマー連動、シーケンシャル再生、DnD、シャッフル/リピート、シークバー、ボリューム）
- サウンドライブラリ（6 種 + カスタムサウンド、プレビュー、タグ管理）
- 外観設定（ダーク/ライト、フォントサイズ 10 段階）
- タスク完了演出（紙吹雪アニメーション）
- セッション完了音（音量調整可能）
- デスクトップ通知（タイマー完了時）
- グローバル Undo/Redo（コマンドパターン + ドメイン別スタック）
- キーボードショートカット（29 件）
- ゴミ箱（タスク・ノート・カスタムサウンドの復元・完全削除）
- Settings 画面（4 タブ: General/Notifications/Data/Advanced）
- Tips 画面（ショートカット一覧 6 カテゴリ/29 件、操作ガイド 7 タブ）
- リッチテキストエディタ（TipTap 拡張、スラッシュコマンド、Bubble ツールバー）
- コマンドパレット（⌘K、16 コマンド）
- スケジュール（Tasks サブタブ統合、Calendar/Dayflow/Routine 3 サブタブ）
- タスクツリーフォルダフィルタ
- アナリティクス（基本統計、作業時間グラフ）
- データ管理（SQLite、JSON Export/Import、バックアップ、リセット）
- 自由メモ（Notes）
- サウンドタグ（タグ付与・フィルタリング）
- テンプレート（タスクツリー構造保存・展開）
- 自動アップデート（tauri-plugin-updater + GitHub Releases）
- 構造化ログ（ファイル出力、Settings で閲覧）
- アプリ内ターミナル（portable-pty + xterm.js）
- MCP Server（life-editor、30 ツール）

---

## 12. Document System

### .claude/ 内ファイル一覧

| パス                                 | 役割                                                                                          | ライフサイクル                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `.claude/CLAUDE.md`                  | 本ファイル（最上位定義書、SSOT）                                                              | 常時 maintained                          |
| `.claude/MEMORY.md`                  | タスクトラッカー（進行中 / 直近完了 / 予定）                                                  | セッションごと更新                       |
| `.claude/HISTORY.md`                 | 変更履歴（セッション単位）                                                                    | セッション終了時 append                  |
| `.claude/feature_plans/*.md`         | 実装プラン（PLANNED / IN_PROGRESS）。命名規則: `YYYY-MM-DD-<slug>.md` または `NNN-<topic>.md` | 完了後 archive へ移動                    |
| `.claude/archive/*.md`               | 完了済み・廃案プラン                                                                          | 永続保存（参照のみ）                     |
| `.claude/archive/adr/*.md`           | アーカイブ ADR（Superseded / 統合済み）                                                       | 永続保存（参照のみ）                     |
| `.claude/docs/adr/*.md`              | アクティブな ADR（PROPOSED / Accepted のみ）                                                  | Accepted → 統合可能なら CLAUDE.md へ吸収 |
| `.claude/docs/requirements/*.md`     | Tier 1-3 機能要件定義（本ファイル §11 の詳細版）                                              | 機能変更時に更新                         |
| `.claude/docs/code-explanation/*.md` | 機能別コード解説（学習教材）                                                                  | 大規模リファクタ時に更新                 |

### ADR ライフサイクル

1. **PROPOSED**: `.claude/docs/adr/` に作成、本ファイル該当章で要約参照
2. **Accepted**: 内容を本ファイル該当章に統合 → ADR は `.claude/archive/adr/` へ移動
3. **Superseded**: `.claude/archive/adr/` へ移動 + 後継 ADR 番号を Status に記載
4. **Rejected**: `.claude/archive/adr/` へ移動 + 却下理由を末尾に追記

### プラン完了時の手順

1. プランファイル内の Status を `COMPLETED` に更新
2. `feature_plans/` から `archive/` へファイルを移動
3. 関連する MEMORY.md / HISTORY.md を更新

### ADR 採番ルール

- 連続採番（0001, 0002, ...）
- archive 移動後も番号は再利用しない
- Phase A 完了時点で 0001-0004 が archive、0005 がアクティブ → 次の新規 ADR は 0006

---

## 13. Roadmap & Status

### 現在進行中（IN_PROGRESS）

> 詳細は `.claude/MEMORY.md` 参照

- **iOS Safe Area 対応**（着手: 2026-04-17）— `.claude/feature_plans/2026-04-17-ios-safe-area.md`
- **アプリ再定義ロードマップ v2 実装**（着手: 2026-04-18）— `.claude/feature_plans/2026-04-18-integrated-design-roadmap.md`

### 直近の完了

> 詳細は `.claude/HISTORY.md` 参照

- 2026-04-18: アプリ再定義ロードマップ v2 策定（本プラン作成）
- 2026-04-18: Rust 警告 24 件修正
- 2026-04-18: コードレビュー + Blocking/Important バグ修正
- 2026-04-15: Tauri 2.0 移行完了

### 完了履歴（旧 TODO.md より転記）

- ✅ コードクリーンアップ & ディレクトリ構造整理 — `archive/009-code-cleanup-restructuring.md`
- ✅ Timer/Sound API 連携 + キーボードショートカット拡張 — `archive/001-timer-sound-api-integration.md`
- ✅ カレンダー & アナリティクス — `archive/005-calendar-analytics.md`
- ✅ AI Coaching (Feature D) — `archive/001-ai-coaching.md`
- ✅ Noise Mixer 音声再生 — `archive/002-noise-mixer-audio.md`
- ✅ Polish & Enhancement — `archive/003-polish-enhancement.md`
- ✅ ドキュメント同期 — `archive/003-documentation-sync.md`

### 保留中（Phase C で再評価予定）

- **I-1**: `db_tasks_fetch_by_scheduled_range` Rust 新コマンド
- **S-2**: Tauri IPC naming 方針（typed input struct 移行）
- **S-4**: `computeFolderProgress` パフォーマンス
- **S-5**: `useServiceErrorHandler` 共通ヘルパ
- **S-6**: `createContextHook` optional バリアント（Mobile 対応）

詳細: `.claude/feature_plans/2026-04-18-deferred-items-reevaluation.md`

### 完了履歴の詳細

- `CHANGELOG.md` — リリース単位の変更履歴
- `.claude/HISTORY.md` — セッション単位の作業ログ
- `.claude/archive/` — 完了済みプラン群
