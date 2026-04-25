# HISTORY.md - 変更履歴

### 2026-04-25 - リファクタリング Phase 2-1 migrations.rs 6 ファイル分割完了 + テスト復活

#### 概要

`src-tauri/src/db/migrations.rs` 2431 行のモノリシックファイルを `migrations/` ディレクトリ配下 6 ファイルに分割。`mod.rs` を orchestrator とし、`full_schema.rs`（V60 final state）/ `util.rs`（exec_ignore / has_column / has_table）/ `v2_v30.rs` / `v31_v60.rs` / `v61_plus.rs` の 5 サブモジュールに責務分離。各 SQL ブロックは byte-identical で公開 API 不変。副次改善として `LATEST_USER_VERSION = 66` 定数を導入し Q2 patch (V65/V66 追加) で陳腐化していた `assert_eq!(user_version, 64)` 5 箇所のハードコードを置換、`cargo test --lib db::migrations` を 2/7 → **7/7 pass** に復活。1 commit (`e36845b`)。`cargo check --lib` clean / `+2500/-2431 行`。

#### 変更点

- **`src-tauri/src/db/migrations.rs` 削除** (-2431 行)
- **`migrations/mod.rs` 新設** (341 行) — `pub fn run_migrations` orchestrator + `fn run_incremental_migrations` で各バージョンレンジモジュールへ dispatch + 末尾の defensive backfill (schedule_items.template_id / routine_groups.version) を保持。`use util::{exec_ignore, has_column}` で helpers を import、`#[cfg(test)] mod tests` に既存 7 tests を保持し `LATEST_USER_VERSION` 定数を追加
- **`migrations/full_schema.rs` 新設** (592 行) — `pub(super) fn create_full_schema(conn) -> rusqlite::Result<()>` で V60 final state の `CREATE TABLE IF NOT EXISTS` バッチを保持。フレッシュ DB（user_version=0）がブートストラップ時に呼ばれ、その後 user_version=61 へジャンプ
- **`migrations/util.rs` 新設** (32 行) — `exec_ignore` / `has_column` / `has_table` を `pub(super)` で集約。各バージョンモジュールから `super::util::*` で参照可能
- **`migrations/v2_v30.rs` 新設** (688 行) — V2-V30 の `if current_version < N { ... }` ブロック群を `pub(super) fn apply(conn, current_version)` でラップ
- **`migrations/v31_v60.rs` 新設** (536 行) — 同 V31-V60
- **`migrations/v61_plus.rs` 新設** (311 行) — 同 V61-V66（live frontier、新 migration はここに append）。V64 memos→dailies migration が `has_table` を使用するため import に追加
- **副次改善: テスト assertion の定数化**: `tests` モジュール先頭に `const LATEST_USER_VERSION: i32 = 66;` を追加し、5 箇所の `assert_eq!(user_version, 64)` を `LATEST_USER_VERSION` 経由に置換。これにより Q2 patch (`1847e4c`) で V65 / V66 追加時に更新漏れていた 5 件のテスト失敗（fresh_db_reaches_latest / v60_db_upgrades_to_v61 / v59_db_upgrades_to_v60 / v62_migration_is_idempotent / v64_renames_memos）を解消。今後の migration 追加時はこの定数だけ bump すればよい
- **Verification**: `cd src-tauri && cargo check --lib` exit 0 / `cargo test --lib db::migrations` **7/7 passed** (was 2/7 on baseline before this commit) / 各 SQL ブロックの byte-identity は git diff で確認

#### 残課題

- **Phase 2-2 TauriDataService.ts 分割**: 1481 行 / 257 メソッドの class を `services/data/{tasks,timer,notes,daily,schedule,wikitags,...}.ts` に分割。class → composition pattern (object spread) の設計判断 + `dataServiceFactory.ts` の `new TauriDataService()` 経由参照箇所への影響評価が必要
- **Phase 2-3b/c/d 巨大コンポーネント残**: ScheduleTimeGrid (1220) / OneDaySchedule (1165) / TagGraphView (1443) — 1 セッション 1 ファイル + 手動 UI 検証
- **Phase 2-4 Calendar Mobile-Desktop 統合**: `useCalendarViewLogic` + `components/Calendar/shared/` 新設

---

### 2026-04-25 - Q2 機能パッチ Phase A/B/C 実装（CalendarTags 1:1+Task / Pomodoro Free / WikiTag 未登録 + Events ソート）

#### 概要

ユーザー要件 4 件のうち 3 件 (CalendarTags 単数化 + Task 対応 + Schedule rightSidebar UI / Pomodoro Free モード + 保存ダイアログ / WikiTag 未登録フィルタ + Events リスト排他的ソート) を 1 セッションで実装。Phase D (Sidebar Links + Browser/App 起動) と Phase A の Cloud Sync は次セッション以降。tsc -b clean / Vitest 257/257 / 変更ファイル lint clean / cargo check pass。28 modified + 6 new files。**過去ドキュメントの誤記修正**として `tier-1-core.md` / `tier-2-supporting.md` から「Tasks に WikiTag 付与可」という記述を削除し、「Tasks は CalendarTags 担当 / WikiTags 対象外（RichTextEditor 非搭載）」を明記。計画書: `.claude/2026-04-25-sidebar-tags-free-pomodoro.md`（Phase A/B/C COMPLETED, Phase D PENDING）。

#### 変更点

- **Phase A — CalendarTags 1:1 + Task 対応**:
  - **DB V65**: `calendar_tag_assignments` を `(id PK, entity_type CHECK in 'task'|'schedule_item', entity_id, tag_id)` + `UNIQUE(entity_type, entity_id)` で再構築。旧複合 PK の multi-tag は `MIN(tag_id)` で 1:1 に collapse。`calendar_tag_definitions` に `created_at / updated_at / version / is_deleted / deleted_at` カラム追加（Cloud Sync 用）
  - **Rust**: `calendar_tag_repository::set_tag_for_entity(entity_type, entity_id, Option<i64>)` を新規追加 / 旧 `set_tags_for_schedule_item` は後方互換 shim として `MIN(tag_ids)` で `set_tag_for_entity` 呼び出しに統一 / `delete` は soft delete + cascade clear 対応 / 親エンティティの `updated_at + version` を bump して Cloud Sync delta が拾えるよう保証
  - **IPC**: 新規コマンド `db_calendar_tags_set_tag_for_entity` を `lib.rs` に登録 + DataService interface に `setTagForEntity(entityType, entityId, tagId | null)` + `fetchAllCalendarTagAssignments` の戻り値を `{entityType, entityId, tagId}` 形式に変更
  - **Frontend**: `useCalendarTagAssignments` を `Map<entityKey, number>` 1:1 化（後方互換 shim 維持）/ `useCalendarTagFilter` 新規（`number | "untagged" | null` を localStorage `calendarTagFilter` に永続化）/ `CalendarTagsContext` に filter state を統合 / `CalendarTagsPanel.tsx` 新規（タグ管理 + 色変更 + 削除 + 「すべて」「未登録」フィルタチップ） / `CalendarTagSelector.tsx` 新規（単一選択 dropdown） / `ScheduleSidebarContent.tsx` で `CalendarTagsPanel` を全 4 タブ常時表示に / `ScheduleItemEditPopup.tsx` の event/task 詳細にタグセレクター追加 / `useCalendarTagsContextOptional` で Provider 外でも null 安全
- **Phase B — Pomodoro Free モード + 保存ダイアログ**:
  - **DB V66**: `timer_sessions` に `label TEXT` カラム追加
  - **Rust**: `end_session_with_label` repository fn + `db_timer_end_session_with_label` IPC コマンド追加 / `lib.rs` に handler 登録
  - **TimerContext**: SessionType に `"FREE"` 追加 / `timerReducer` に `START_FREE` action + FREE モード TICK +1 (count up) / `pause` で FREE 時は `pendingFreeSave: { sessionId, elapsedSeconds }` を state にセット / `startFreeSession` / `saveFreeSession({label, role, parentTaskId, calendarTagId})` / `discardFreeSession` を Context に追加。Task 保存時は `createTask({status: 'DONE', parentId, completedAt, workDurationMinutes})` で完了済タスクとして TaskTree に挿入、Event 保存時は `createScheduleItem(routineId=null)` + `setTagForEntity` で完了済イベントを Calendar に挿入
  - **Frontend**: `FreeSessionSaveDialog.tsx` 新規（label 入力 / Role=Task → TaskTree autocomplete 検索 / Role=Event → CalendarTagSelector / 「次回から表示しない」localStorage 永続化）/ `WorkScreen.tsx` に「Free セッション開始」ボタン追加 + `pendingFreeSave` 監視で SaveDialog 自動表示 + `freeSessionSaveDialogEnabled === false` 時の auto-discard / `TimerSettings.tsx` に「Pomodoro 有効/無効」「保存ダイアログ表示」トグル / `pomodoroSettings.ts` 新規（react-refresh の `only-export-components` 制約回避で 4 つの localStorage 関数を分離）
- **Phase C — WikiTag 未登録 + Events ソート**:
  - **TagFilterOverlay**: `UNTAGGED_FILTER_ID = "__untagged__"` sentinel + `showUntaggedOption` prop 追加。tags モード時に「(Untagged)」エントリを最上部に表示
  - **DailySidebar / MaterialsSidebar**: `tagFilteredMemos` / `tagFilteredNotes` で `UNTAGGED_FILTER_ID` 選択時はタグ assign 0 件のみ抽出する分岐を追加 / 各 TagFilterOverlay 呼び出しに `showUntaggedOption` prop を付与
  - **EventList**: 全面再実装で排他的ソート 4 軸（`date-desc / date-asc / title-asc / tag`）を localStorage `eventsListSort` に永続化 / `tag` モードでは CalendarTag.order 順でグルーピング表示 + 末尾に Untagged バケツ / CalendarTag フィルタ連動（`activeFilterTagId`: number → 該当タグ / "untagged" → 未登録のみ） / 行内に CalendarTag のドット表示
- **過去ドキュメント修正**:
  - `tier-1-core.md` Tasks セクションから V60 で撤去済の `task_tags / task_tag_definitions` 言及を削除 + 他機能連携の `WikiTags（タグ付与・検索）` を `CalendarTags（単一タグ付与・フィルタ）` に置換 + 「**WikiTags は対象外**（Task は RichTextEditor を持たないため UI 経由のタグ付与経路がない）」を明記 / Cloud Sync 未対応テーブル一覧から `task_tags` を削除
  - `tier-2-supporting.md` WikiTags Purpose / Boundary / AC1 / Dependencies から Tasks を除外し、「タグ管理は CalendarTags が担当」を明記
- **新規ファイル**: `frontend/src/components/Schedule/CalendarTagsPanel.tsx` / `CalendarTagSelector.tsx` / `frontend/src/components/Work/FreeSessionSaveDialog.tsx` / `frontend/src/hooks/useCalendarTagFilter.ts` / `frontend/src/utils/pomodoroSettings.ts` / `.claude/2026-04-25-sidebar-tags-free-pomodoro.md`（実装プラン、Phase A/B/C 完了 / Phase D 未着手で IN_PROGRESS）
- **Verification**: `cd frontend && npx tsc -b` 0 errors / `npm run test` 257/257 passed（CalendarTagsPanel / EventList の Optional Provider 化により従来テストが Provider なしでも動作） / `cd src-tauri && cargo check` 通過 / 変更 22 ファイル + 新規 5 コードファイル + 1 プランファイル に対する eslint clean
- **session-verifier で発見・修正したパターン**:
  - `react-refresh/only-export-components` 違反 → `pomodoroSettings.ts` への関数 export 分離で解消
  - `react-hooks/set-state-in-effect` 違反 → `useState(() => ...)` 初期化に置換 / 不要な `useEffect(() => setName(tag.name))` の削除
  - 未使用 `useEffect` import / `react-hooks/refs` ルール対応

#### 残課題

- **Phase D — Sidebar Links**: V67 migration / `sidebar_links` table / system_commands (browser detect / app launch / /Applications enumerate) / LeftSidebar UI（Analytics と Settings の間に表示） / Add Dialog（URL or App 選択 + 絵文字） / Settings ブラウザ選択 / Mobile Drawer 統合（`kind='app'` はグレーアウト） / Cloud Sync (D1 0005)
- **Phase A 残 — CalendarTags Cloud Sync**: `cloud/db/migrations/0004_calendar_tags.sql` + Workers VERSIONED_TABLES / RELATION_TABLES_WITH_UPDATED_AT 追加 / Desktop ↔ iOS 双方向同期検証
- **手動 UI 確認**: `cargo tauri dev` で Schedule rightSidebar に「Tags」パネル表示 / Event/Task 詳細で 1:1 タグ選択 / Free セッション開始 → 停止 → SaveDialog 表示 → Task または Event として保存 → TaskTree / Calendar に出現を確認
- **i18n**: 新規 UI テキストは `t("...", "fallback")` の fallback 付きで動作するが、`ja.json` / `en.json` への明示的キー追加は別タスクで実施

---

### 2026-04-25 - リファクタリング Phase 2-3a TaskDetailPanel 分割完了（4 sibling files 抽出）

#### 概要

Phase 2 の最初の巨大コンポーネント分割。`frontend/src/components/Tasks/TaskDetail/TaskDetailPanel.tsx` を 947→55 行に縮約し、内部の 4 サブコンポーネントを sibling ファイルに抽出。`InlineEditableHeading` は `components/shared/EditableTitle`（controlled input）と用途違いのため別名で sibling 化、外部の 3 import 経路（`TaskTreeView`, `ScheduleTasksContent`）は path 不変。動作影響ゼロ、`tsc -b` 通過 + Vitest 257/257（pre-existing sidebar-tags + free-pomodoro WIP を stash した clean state で確認）。1 commit (`661b370`)。Phase 2-3 残 3 コンポーネント (ScheduleTimeGrid 1220 / OneDaySchedule 1165 / TagGraphView 1443) は次セッション以降、1 セッション 1 ファイル + 手動 UI 検証必須。

#### 変更点

- **InlineEditableHeading.tsx**(76 行) 新設 — 旧 local `EditableTitle` (TaskDetailPanel.tsx 内部関数) を抽出、`shared/EditableTitle.tsx`（controlled input）との用途違いを明示するため rename。click-to-edit で `<h2>` ↔ `<input>` を内部 state で切替するヘディングコンポーネント。Enter/blur 保存、Escape キャンセル、trim 後空文字なら revert
- **DebouncedTextarea.tsx**(62 行) 新設 — 旧 local `DebouncedTextarea`（500ms debounce + on-unmount flush）を抽出。Task / Folder 両エディタの description 入力で共有
- **TaskSidebarContent.tsx**(244 行) 新設 — 旧 local `TaskSidebarContent` を抽出。breadcrumb（先祖アイコン編集）/ status icon / inline title / WikiTagList / RoleSwitcher（task↔event/note/daily 変換）/ priority / DateTimeRange / reminder / time memo / 削除ボタン。`TaskRoleSwitcherRow` は使用箇所 1 つのため file 内 inline 維持
- **FolderSidebarContent.tsx**(536 行) 新設 — 旧 local `FolderSidebarContent` を抽出。breadcrumb + folder icon picker / inline title / Schedule トグル / MiniCalendarGrid / DebouncedTextarea (memo) / 3-tier 子ノード一覧（child folders → child tasks → complete folders）。Complete folder の子は line-through 装飾、子の status トグルで confetti + sound effect
- **TaskDetailPanel.tsx** 947 → 55 行 — `useTaskTreeContext` から最低限の data + handlers を取得し、`!node` → TaskDetailEmpty / `node.type === "task"` → TaskSidebarContent / else → FolderSidebarContent にディスパッチするだけ。外部 import 不変（`TaskTreeView.tsx:7` / `ScheduleTasksContent.tsx:6` の path `./TaskDetail/TaskDetailPanel` が引き続き有効）
- **行数推移**: 947 → 55 + 76 + 62 + 244 + 536 = 973 行（+26 行は doc コメント + 各ファイルの import 重複分。型 / 責任 / テスト容易性のトレードで受領）
- **Verification**: `cd frontend && npx tsc -b` exit 0 / `npm run test` 257/257 passed（CalendarTagsPanel 関連 13 失敗は事前検証で sidebar-tags WIP 由来と確認、stash 後 clean state で全件 pass）

#### 残課題

- **Phase 2-3b ScheduleTimeGrid** (1220 行) — DnD + grid layer 多数、最も複雑。`ScheduleTimeGrid/{index,GridLayer,EventLayer,DragHandlers,Hooks}.tsx` の sub-directory 構造を計画
- **Phase 2-3c OneDaySchedule** (1165 行) — 1 関数内に多数の useState/useCallback。`useDayFlowFilters` / `useDayFlowDialogs` カスタムフック抽出 + render 専念 component の構造に
- **Phase 2-3d TagGraphView** (1443 行) — force layout + canvas 描画 + interaction が混在
- **Phase 2-1 migrations.rs / 2-2 TauriDataService.ts**: WIP（sidebar-tags-free-pomodoro）が両ファイルに +103 / +30 行追加中で衝突するため、WIP commit 後でないと着手不可
- **手動 UI 確認**: TaskDetail サイドバーの 6 機能（task 編集 / folder 編集 / breadcrumb 先祖アイコン編集 / inline title / RoleSwitcher 変換 / 子フォルダ展開）が次回 `cargo tauri dev` で回帰なしか確認

---

### 2026-04-25 - リファクタリング Phase 1 完了（Cloud sync split / Provider tree 抽出 / row_to_json 統合 / SAFETY コメント）

#### 概要

Phase 0 完了直後に Phase 1 を 1 セッションで全 4 step（1-1〜1-4）完遂。Cloud Worker の責務分離 + セキュリティ強化、Frontend Provider tree 抽出、Rust 側の row→JSON 重複統合と SQL 識別子補間の SAFETY コメント明示化。3 commits（cloud / frontend / rust）。`tsc -b` 通過 / `cargo check --lib` 通過 / `wrangler deploy --dry-run` で bundle 199.95 KiB / 38.82 KiB gzip / Vitest 257/257 pass（pre-existing sidebar-tags WIP を stash した clean state で確認）。動作影響ゼロのリファクタ。

#### 変更点

- **Phase 1-1 Cloud sync.ts 責務分割**: `cloud/src/routes/sync.ts` 459 行を `routes/sync/index.ts`（Hono オーケストレータ）/ `routes/sync/shared.ts`（toCamelCase / quoteCol / topoSortByParent / `buildStampStatement` ヘルパ）/ `routes/sync/versioned.ts`（VERSIONED*TABLES の pull/push + schedule_items 重複排除 / tasks topo sort）/ `routes/sync/relations.ts`（relation tables の pull/push、`RELATION_PARENT_JOINS` table-driven config 化）+ `cloud/src/config/syncTables.ts`（VERSIONED_TABLES / PRIMARY_KEYS / RELATION*\*\_TABLES / RELATION_PARENT_JOINS / SYNC_PAGE_SIZE 集約）+ `cloud/src/utils/schema.ts`（zod `PushBodySchema` で /sync/push body 検証）の 6 ファイル分割。`buildStampStatement` で versioned / relation の両 push 経路に重複していた server_updated_at UPDATE 文の組み立てを 1 箇所に集約
- **Phase 1-1 セキュリティ強化**: `cloud/src/middleware/auth.ts` の Bearer token 比較を `===` から SHA-256 + `crypto.subtle.timingSafeEqual` に置換。タイミング攻撃で SYNC_TOKEN の長さや先頭一致バイトが漏洩する経路を遮断。raw-SQL 識別子補間箇所すべて（`SELECT * FROM ${table}` / `INSERT INTO ${table}` / 等）に `// SAFETY:` コメントで whitelist source を明記
- **Phase 1-2 Provider tree 抽出**: `frontend/src/main.tsx` 97→38 行。新設 `frontend/src/providers/DesktopProviders.tsx`（15 層）/ `MobileProviders.tsx`（10 層）に Provider 木を移送、外殻（ErrorBoundary / Theme / Toast / Sync）のみ main.tsx に残置。両ファイルに「order is load-bearing — see CLAUDE.md §6.2」と Provider 順依存性を明記。**ドキュメント乖離発見**: CLAUDE.md §6.2 では「Mobile は WikiTag を省く」と記載されているが、実コード（旧 main.tsx 含む）は Mobile でも WikiTagProvider を含む。今回は既存挙動踏襲（=テスト 257/257 維持）、CLAUDE.md 修正は別タスクで処理予定
- **Phase 1-3 Rust row_to_json 統合**: `src-tauri/src/db/row_converter.rs` を新設し `pub fn row_to_json(row, col_names) -> serde_json::Value` を集約。`db/helpers.rs:130` と `sync/sync_engine.rs:181` の byte-equivalent な local fn を削除し re-import に切替。NULL/INTEGER/REAL/TEXT/BLOB → JSON Value のマッピング契約を 1 箇所で文書化
- **Phase 1-4 SQL injection 防御の明示化**: `sync_engine.rs::collect_all` の VERSIONED_TABLES / RELATION_TABLES_WITH_UPDATED_AT 反復ループ直前に `// SAFETY: const slice 反復、never from caller input` コメント追加（lines 94 / 100 周辺）。`db/helpers.rs::next_order` の doc-comment に「callers MUST pass a static table-name literal」契約を明記。`debug_assert!(is_known_table)` は構造的に冗長（呼出元はすべて const slice or repository 内静的リテラル）と判断し不採用
- **Verification**: `cloud && npx tsc --noEmit` 通過 / `cloud && wrangler deploy --dry-run` bundle 成功（199.95 KiB / gzip 38.82 KiB） / `frontend && npx tsc -b` 通過 / `frontend && npm run test` 257/257 pass（CalendarTagsPanel 関連の 10 件失敗は pre-existing sidebar-tags WIP 由来 → WIP stash 後 clean state で全件 pass 確認） / `src-tauri && cargo check --lib` 通過
- **commits（3 本）**: `599133e refactor(cloud): split sync.ts into versioned/relations/shared + zod + timing-safe auth` (10 files / +759/-462) / `ecbc192 refactor(frontend): extract DesktopProviders / MobileProviders from main.tsx` (3 files / +122/-68) / `63799a6 refactor(rust): consolidate row_to_json into db::row_converter + SAFETY comments` (4 files / +60/-38)
- **計画書見立てとの乖離記録**: 当初計画 -500〜-800 行に対し実績 +373 行。理由は (1) zod / timing-safe / 6 ファイル分割の各先頭に module purpose / SAFETY コメント追加 / RELATION_PARENT_JOINS の table-driven 化で増加 (2) `buildStampStatement` の重複解消は -10 行程度のみ。LOC 増加と引き換えに型 + SAFETY 契約 + 単一責任の三点が明文化されたため、減ではなく構造改善として受領

#### 残課題

- **Phase 2 (中期 4-6 セッション、推定 -1500〜-2500 行)**: `migrations.rs` (2328 行) を V1-V30 / V31-V60 / V61-V64 の 3 分割 / `TauriDataService.ts` (1453 行) を domain ごとに分割 / 巨大コンポーネント 4 件分割 / Calendar Mobile-Desktop 統合
- **Phase 3 (長期 6-10 セッション、推定 -2000〜-4000 行)**: Rust 27 repository の `row_to_model` 統一 trait 化 / Issue 012 cursor pagination 本実装 / `Schedule/` rename / 論理キー UNIQUE migration（V65+）
- **手動 UI 確認**: `cargo tauri dev` 起動で Provider tree 抽出後の Desktop / Mobile 両方の動作確認（Schedule / Calendar / Timer / Audio / WikiTag）
- **既存 lint 116 問題**: 別セッションで対応継続
- **CLAUDE.md §6.2 と実コードの WikiTag 乖離**: 別タスクで「文書を実コードに合わせる or 実コードを文書に合わせる」を判定

---

### 2026-04-25 - リファクタリング Phase 0 完了（@deprecated 整理 + formatTime 統合 + tiptap XSS 緩和 + MEMORY.md 整理）

#### 概要

3 subsystem (Frontend / Rust / Cloud) を中粒度で並列分析し、4-Phase の段階的リファクタリング計画を策定。Phase 0 (Quick Wins) として @deprecated 4 件削除 / formatTime 真の重複 1 箇所統合 / tiptapText.ts の innerHTML XSS 経路の DOMParser 化 / MEMORY.md §バグの温床の重複行削除を実行。動作影響ゼロ、検証は `tsc -b` 通過 / Vitest 255 passed (31 files) / `@deprecated` grep 0 件。-58 行 / 7 ファイル変更 / 5 commits（origin/main から 5 commits ahead、push 未実施）。当初 Frontend Explore agent が報告した「formatTime 重複 18+ 箇所」は実態 1 箇所のみで、4 シグネチャの責務違い別関数が並存しているだけと精査で判明し、agent ベースの DRY 検出はシグネチャ照合をしないため過剰検出する旨を `code-inventory.md §3.1` と `refactoring-plan.md` Phase 0-2 に記録。

#### 変更点

- **新規 doc 2 ファイル**: `.claude/2026-04-25-refactoring-plan.md`（Phase 0-3 実行計画 / Status: IN_PROGRESS / Phase 0 完了マーク + 規模感テーブルに実績反映）+ `.claude/docs/code-inventory.md`（Active / Frozen / Duplicate / Risk Hotspot 棚卸し / Active Issue 0 / Monitoring 1 / Fixed 8 を反映、§3.1 で formatter 統合の見積もり乖離を記録）
- **Phase 0-1 @deprecated 4 件削除**: `frontend/src/context/ScheduleContextValue.ts` を完全削除（参照ゼロ確認後）+ `context/index.ts` re-export 削除 / `components/Tasks/Schedule/DayFlow/GroupFrame.tsx` の `onDoubleClick` prop と関連 onDoubleClick handler を削除（caller `ScheduleTimeGrid.tsx` / `MobileDayflowGrid.tsx` ともに onClick のみ使用）/ `components/shared/UndoRedo/UndoRedoButtons.tsx` の `domain` prop 削除（caller `TitleBar.tsx` / `MobileLayout.tsx` 双方とも `domains` 複数形のみ使用）。grep で `@deprecated` 4→0 件
- **Phase 0-2 formatTime ローカル関数統合**: `components/Schedule/ScheduleItemEditPopup.tsx:52` のローカル `formatTime(h, m)` を削除し `utils/timeGridUtils.ts::formatTime` から import に置換。当初計画「dateFormat.ts 新設で 18+ 箇所統合」は精査結果（4 シグネチャの別関数並存: `(dateStr)` / `(h, m)` / `(seconds)` / Pomodoro Context method）により縮小、真の重複 1 箇所のみ統合
- **Phase 0-3 tiptapText.ts XSS 緩和**: `utils/tiptapText.ts::getContentPreview` の JSON parse 失敗時 fallback を `tmp.innerHTML = content` から `DOMParser.parseFromString(content, "text/html")` ベースに変更。`<img onerror>` / `<script>` / `<iframe>` 経由の attribute / inline JS 経路を inert document 化で除去。well-formed legacy HTML の動作は不変
- **Phase 0-4 MEMORY.md §バグの温床 整理**: 旧行 102-112 を削除（行 103-111 は行 90-100 の単純重複コピー、行 112 「Cloud D1 migration 未適用」は 2026-04-24 の migration 0003 適用済で陳腐化）。17 → 16 ユニーク項目に
- **Verification**: `npx tsc -b` 通過 / `npm run test` 255/255 pass (31 files、`tiptapText.test.ts` 13 件 / `sectionDomains.test.ts` 8 件 / `timerReducer.test.ts` 32 件含む既存テストすべて) / `grep @deprecated frontend/src` 0 件 / 手動 UI 確認は次セッション dev 起動時
- **commits（5 本）**: `76c6591` docs(plan + inventory) +562 行 / `991b5bf` refactor(@deprecated 削除) -44 行 / `36b2de7` refactor(formatTime 統合) -3 行 / `cd8d59e` fix(tiptapText XSS) +0/-0 / `4f2d552` docs(MEMORY.md dedup) -11 行
- **教訓 (`code-inventory.md §3.1` / `refactoring-plan.md` Phase 0-2 に記録)**: agent ベースの DRY 違反検出はシグネチャまで照合しないため過剰検出する。formatTime「18+ 箇所」と Frontend Explore agent が報告したが、実態は 4 シグネチャの責務違い別関数並存で **真の重複は 1 箇所のみ**だった。リファクタリング計画は実装着手時に必ず精査する運用が要る

#### 残課題

- **Phase 1 (別セッション)**: Cloud `routes/sync.ts` 責務分割（Issue 012 cursor pagination の前提地ならし）/ `frontend/src/main.tsx` Provider tree 共通化（`<DesktopProviders>` / `<MobileProviders>` 抽出）/ Rust `helpers.rs` と `sync_engine.rs:177` の `row_to_json` 重複統合 (`db/row_converter.rs` 新設) / SQL injection whitelist の SAFETY コメント明示化（推定 -500〜-800 行）
- **Phase 2-3 (中長期)**: `migrations.rs` (2328 行) を V1-V30 / V31-V60 / V61-V64 に 3 分割 / `TauriDataService.ts` (1453 行) を domain ごとに分割 / 巨大コンポーネント 4 件（ScheduleTimeGrid / OneDaySchedule / TagGraphView / TaskDetailPanel）を index + サブコンポーネント構造に / Calendar Mobile-Desktop 統合（`useCalendarViewLogic` + shared component）/ Rust 27 repository の `row_to_model` 統一 trait 化 / 012 cursor pagination 本実装 / `Schedule/` → `ScheduleList/` rename / 論理キー UNIQUE migration（V65+）
- **手動 UI 確認**: Schedule UI / Mobile Calendar / Timer 表示で時刻フォーマット崩れなし確認（次回 `cargo tauri dev` 時）
- **既存 lint 116 問題の解消**: 別セッションで対応継続（本 Phase スコープ外）
- **`git push`**: ユーザー判断で未実施（origin/main から 5 commits ahead）

