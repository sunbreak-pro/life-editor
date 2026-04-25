# HISTORY.md - 変更履歴

### 2026-04-25 - Q2 機能パッチ Phase D 完了 + Phase A Cloud Sync 着地（Sidebar Links + CalendarTags D1 追従）

#### 概要

計画書 `.claude/2026-04-25-sidebar-tags-free-pomodoro.md` の最終 2 タスクを 1 セッションで実装し、計画書を archive へ移動。Phase A 残 (CalendarTags Cloud Sync) は D1 migration 0004 で `calendar_tag_definitions` を Cloud Sync 対応 (created_at/updated_at/version/is_deleted/server_updated_at) + `calendar_tag_assignments` を新スキーマに rebuild、`syncTables.ts` で `RELATION_TABLES_WITH_UPDATED_AT` に昇格 (entity_type が task/schedule_item の二択で単一親 JOIN が一意でないため`RELATION_PARENT_JOINS` から削除)。Phase D (Sidebar Links) は V67 migration で `sidebar_links` テーブル新設、Rust 側 repository / commands / system_commands 拡張 / lib.rs handler 登録、Frontend は Pattern A 4 ファイル + 2 component (Item / AddDialog) + LeftSidebar 統合 + BrowserSettings + MobileApp Drawer 統合 + Cloud Sync 7 接点 (sync_engine / VERSIONED_TABLES / D1 0005)。検証: cargo test 19/19 / vitest 257→264 (新規 useSidebarLinks.test.ts 7 test) / tsc -b + cargo check + cloud tsc 全 clean。**全 Phase 完了** (`COMPLETED 2026-04-25` で archive 移動)。

#### 変更点

- **Phase A 残 — CalendarTags Cloud Sync**:
  - `cloud/db/migrations/0004_calendar_tags_v65.sql` 新規 — `calendar_tag_definitions` に `created_at/updated_at/version/is_deleted/deleted_at/server_updated_at` を nullable で ALTER ADD + UPDATE 経由 backfill (D1 の ALTER は constant default のみのため二段階)、`calendar_tag_assignments` を `_v2` 経由で `id PK / entity_type CHECK / entity_id / tag_id / updated_at / server_updated_at` に rebuild、旧 schedule_item 行は `MIN(tag_id)` で 1:1 collapse + `entity_type='schedule_item'` で migrate、INDEX 4 本再構築
  - `cloud/src/config/syncTables.ts` — `calendar_tag_assignments` を `RELATION_TABLES_NO_UPDATED_AT` から `RELATION_TABLES_WITH_UPDATED_AT` に移し、`RELATION_PK_COLS` に `["id"]` 追加、`RELATION_PARENT_JOINS` から `calendar_tag_assignments` を削除 (entity_type が task/schedule_item の二択で単一親 JOIN が一意でない構造的事情を意図コメントで明記)
- **Phase D — Sidebar Links + Browser/App settings**:
  - **DB V67**: `src-tauri/src/db/migrations/v61_plus.rs` に `sidebar_links` テーブル新設 (id PK + kind('url'\|'app') CHECK + name + target + emoji + sort_order + version + LWW columns + 3 INDEX) / `migrations/mod.rs` の `LATEST_USER_VERSION = 67` にバンプ + `v67_creates_sidebar_links_table` 統合テスト追加
  - **Rust**: `src-tauri/src/db/sidebar_link_repository.rs` 新規 (CRUD + reorder, 5 unit test) / `src-tauri/src/commands/sidebar_link_commands.rs` 新規 (5 IPC: fetch_all / create / update / delete / reorder) / `src-tauri/src/commands/system_commands.rs` 拡張で `BROWSER_CANDIDATES` const (Chrome/Safari/Firefox/Edge/Arc/Brave) + `system_list_browsers` (`/Applications/*.app` 存在チェックで installed のみ返却) + `system_list_applications` (`/Applications` 列挙、ソート済) + `system_open_url(url, browser_id?)` (browser_id 指定時は `open -a path url`、未指定/未インストール時は `open::that` で system default に fallback) + `system_open_app(app_path)` を追加。すべて `#[cfg(target_os = "macos")]` ガード、iOS では空配列 / `Err("Launching applications is only supported on macOS")` 返却 / `lib.rs` handler に 9 件登録 / `commands/mod.rs` + `db/mod.rs` に新 module 追加
  - **Cloud Sync**: `src-tauri/src/sync/types.rs` の `SyncPayload` に `sidebar_links` field 追加、`src-tauri/src/sync/sync_engine.rs` の `VERSIONED_TABLES` に `("sidebar_links", "id")` 追加 + `collect_local_changes` に `query_changed("sidebar_links")` 行追加 + `get_payload_field` / `set_payload_field` の match arm 追加 / `cloud/db/migrations/0005_sidebar_links.sql` 新規 (server_updated_at + 4 INDEX) / `cloud/src/config/syncTables.ts` の `VERSIONED_TABLES` + `PRIMARY_KEYS` に `sidebar_links` 追加
  - **Frontend types & DataService**: `frontend/src/types/sidebarLink.ts` 新規 (SidebarLink / SidebarLinkKind / SidebarLinkUpdate / BrowserInfo / InstalledApp) / `frontend/src/services/DataService.ts` interface に 9 メソッド追加 (fetchSidebarLinks / createSidebarLink / updateSidebarLink / deleteSidebarLink / reorderSidebarLinks / listBrowsers / listApplications / systemOpenUrl / systemOpenApp) / `frontend/src/services/TauriDataService.ts` に invoke ブリッジ実装
  - **Frontend Context (Pattern A)**: `frontend/src/hooks/useSidebarLinks.ts` 新規 (DB-backed hook + browser preference 管理 + optimistic UI で createLink/updateLink/deleteLink/reorderLinks をロールバック付き実装、saved browser id が未インストール時に `null` fallback、setDefaultBrowserId は `defaultBrowser` キーに setAppSetting/removeAppSetting 経由永続化) / `SidebarLinksContextValue.ts` (createContext + UseSidebarLinksValue 型 alias) / `SidebarLinksContext.tsx` (Provider) / `useSidebarLinksContext.ts` (createContextHook) / `context/index.ts` に 3 export 追加
  - **Components**: `frontend/src/components/Layout/SidebarLinkItem.tsx` 新規 (emoji or fallback Globe/AppWindow icon + name truncate + ホバー時 `⋯` 右クリックメニュー (edit/delete) + disabled prop で iOS グレーアウト対応) / `SidebarLinkAddDialog.tsx` 新規 (kind トグル + name input + URL/App 切替で動的 input、App モード時のみ `listApplications` を遅延 fetch + 検索フィルタ + 選択時に target+name 自動補完、emoji input 4 文字制限、createPortal で modal 描画) / `LeftSidebar.tsx` 統合 (mainMenuItems の下に「Links」セクション + ホバー時 `+` ボタン、空時は「No links yet」placeholder、dialog state は `mode='closed'|'add'|'edit'` で管理)
  - **Settings**: `frontend/src/components/Settings/BrowserSettings.tsx` 新規 (検出ブラウザのみラジオ表示、「System default」も選択肢として並列、未検出時は説明 message のみ) / `SystemSettings.tsx` の Tray の下に `<BrowserSettings />` を組み込み
  - **Mobile**: `frontend/src/MobileApp.tsx` の `MobileLeftDrawer` 直下に常時セクション追加 (`sidebarLinks.length > 0` の条件付き)、`SidebarLinkItem` を再利用 (`disabled={link.kind === 'app'}` で App はグレーアウト)、URL クリック時は `openLink` → `setDrawerOpen(false)`、App クリック時は Toast「iOS では起動できません」、edit/delete もデスクトップ案内の Toast を表示
  - **Provider 階層**: `DesktopProviders` の `ShortcutConfigProvider` 内側に `SidebarLinksProvider` / `MobileProviders` の `WikiTagProvider` 内側に `SidebarLinksProvider` / `test/renderWithProviders.tsx` の `ShortcutConfigProvider` 内側にも追加 (Vitest が Provider を要求するため)
  - **i18n**: `ja.json` / `en.json` 両方に `sidebarLinks.*` (sectionTitle / add / addTitle / editTitle / empty / kindLabel / kindUrl / kindApp / nameLabel / namePlaceholderUrl / namePlaceholderApp / urlLabel / appLabel / appSearchPlaceholder / appNoResults / emojiLabel / itemMenu / iosAppUnsupported / editOnDesktop) 19 keys + `settings.browser.*` (title / description / systemDefault / none) 4 keys を追加
  - **CLAUDE.md 更新**: §2 機能差分表の Mobile 省略 Provider 行を「Audio / ScreenLock / FileExplorer / CalendarTags / ShortcutConfig（WikiTag / SidebarLinks は Mobile でも有効）」に修正 (旧記述では WikiTag が省略扱いだったが実コードと不整合) / §4.1 直近 migration 行に `V67(sidebar_links 新規)` 追記 + 現行 v66 → v67 / §4.1 Cloud D1 専用行に `2026-04-25 適用 migration 0004 で V65 に追従` + `2026-04-25 適用 migration 0005 で V67 に追従` を追加 / §6.2 Provider 順序を Sync 追加 + `→ SidebarLinks` を末尾に追記、Mobile 省略 Provider のリストも修正
  - **新規テスト**: `frontend/src/hooks/useSidebarLinks.test.ts` 新規 (vi.mock で DataService をスタブ、7 cases: 初期化で links/browsers/saved browser を読み込む / saved browser が未インストール時に null fallback / createLink で state 追加 / openLink('url') が systemOpenUrl を defaultBrowserId 付きで呼ぶ / openLink('app') が systemOpenApp を呼ぶ / setDefaultBrowserId(null) で removeAppSetting / deleteLink がエラー時にロールバック)
- **計画書 archive**: `.claude/2026-04-25-sidebar-tags-free-pomodoro.md` の Status を `COMPLETED 2026-04-25 (Phase A/B/C/D all done)` に更新、Phase D 全 18 step を `[x]` チェック、Status Updates に Phase A 残 + Phase D 完了行を追記してから `.claude/archive/` へ移動
- **Verification**: `cd src-tauri && cargo test` 19 passed / 1 ignored / 0 failed (新規 v67_creates_sidebar_links_table + 5 sidebar_link_repository test 含む) / `cd frontend && npx vitest run` 264 passed / 0 failed (32 test files) / `cd frontend && npx tsc -b` 0 error / `cd cloud && npx tsc --noEmit` 0 error / `cd src-tauri && cargo check` clean / `npm run lint` 変更ファイル 0 error
- **Rollout 順序 (重要)**: D1 migration を Worker deploy より先に適用すること。逆順だと旧 schema に新 Worker が当たり sidebar_links / calendar_tag_assignments delta が 500。`cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0004_calendar_tags_v65.sql` → `--file=./db/migrations/0005_sidebar_links.sql` → `npm run deploy`

#### 残課題

- **deploy & 手動 UI 検証**: 上記 Rollout 順序の実行 / Desktop で V67 自動 apply 確認 / LeftSidebar の Links セクション表示 + `+` で URL/App リンク追加 + 既定ブラウザ切替で起動先が変わる / `/Applications/*.app` 一覧から登録できる / iOS Drawer で `kind='app'` がグレーアウト + Toast 出る / Desktop ↔ iOS 双方向 sync で sidebar_links / calendar_tag_assignments が伝搬する
- **計画書アーカイブ済**: archive/2026-04-25-sidebar-tags-free-pomodoro.md

---

### 2026-04-25 - sync_engine V65 follow-up fix（calendar_tag_assignments delta query を新スキーマ対応）

#### 概要

/session-verifier Gate 3 で `sync::sync_engine::tests::collect_local_changes_*` 2 件の失敗を発見。Q2 patch (1847e4c) の V65 migration が `calendar_tag_assignments` を `(entity_type, entity_id, tag_id)` + 自身の `updated_at` 持ちに再構築したが、Desktop の `sync_engine.rs::collect_local_changes` が旧スキーマ前提の `cta.schedule_item_id` JOIN を保持していたため `no such column` で sync が破綻していた。CTA 自身の `updated_at` を delta cursor とする query に書き換え（task-typed CTA も同時に拾えるよう JOIN 撤去）。`cargo test --lib` 11/13 → 13/13 pass。1 commit (`58609b3`)。

#### 変更点

- **`src-tauri/src/sync/sync_engine.rs::collect_local_changes`**: 旧 `SELECT cta.* FROM calendar_tag_assignments cta INNER JOIN schedule_items si ON cta.schedule_item_id = si.id WHERE datetime(si.updated_at) > datetime(?1)` を `SELECT * FROM calendar_tag_assignments WHERE datetime(updated_at) > datetime(?1)` に置換。V65 で CTA に `updated_at` カラムが追加され、毎 INSERT/UPDATE で stamp されるため、parent JOIN 経由で間接的に delta を判定する必要がなくなった。さらに V65 では CTA が `entity_type IN ('task','schedule_item')` を取るため、schedule_items への JOIN だけでは task-typed CTA を拾えない問題も同時に解消
- **意図コメント追加**: 「CTA has its own updated_at (V65 rebuild), so delta against the CTA row itself rather than its parent. The CTA may belong to either a schedule_item or a task (entity_type), and a JOIN-based query can no longer key off a single parent table.」を query 直前に明記
- **Verification**: `cargo test --lib sync::sync_engine` 2/2 passed（before: 0/2 with `no such column: cta.schedule_item_id`） / 全体 lib test 13 passed; 1 ignored / 0 failed

#### 残課題

- **Cloud 側の同種修正**: `cloud/src/config/syncTables.ts:97-100` も同じ stale `schedule_item_id` JOIN を持ち（`{ table: "calendar_tag_assignments", parent: "schedule_items", fk: "schedule_item_id", parentPk: "id" }`）、CalendarTags Cloud Sync (D1 migration 0004) 着地時に併修必要。MEMORY.md「Q2 機能パッチ Phase A 残 — CalendarTags Cloud Sync」に組み込み済み

---

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
