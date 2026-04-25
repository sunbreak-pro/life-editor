# HISTORY.md - 変更履歴

### 2026-04-25 - Cloud Sync 本番 deploy + D1 migration 全適用 + 0006 hotfix で `calendar_tag_assignments` legacy schema 解消

#### 概要

前セッションで作成された 0006 hotfix migration の適用と、Worker 04-17 deploy → 最新化を含む Cloud Sync 本番反映を 1 セッションで実施。Desktop UI で `Connection failed` を発端に、Cloudflare の知識整理 → SYNC_TOKEN ローテーション (`wrangler secret put`) → curl POST /auth/verify で 200 確認 → D1 migration 0003/0004/0005 順次 apply → `npm run deploy` で Worker を 8 commits 分最新化 (auth timing-safe / sync routes split / Known Issues 011-014 修正反映)。Sync Now 実行で 500 を観測、`wrangler tail` で `D1_ERROR: no such column: server_updated_at at offset 63` を捕捉、`pragma_table_info` 一括検証で sync 対象 15 テーブル中 `calendar_tag_assignments` のみ legacy schema 残存と特定。0006 を適用し V65 shape (`id PK + entity_type + entity_id + tag_id + updated_at + server_updated_at`) に rebuild 完了。原因（D1 transactional rollback 保証下での部分適用）は特定不能、Known Issue 016 起票候補。本セッションでのコード変更は `cloud/db/migrations/0006_fix_cta_server_updated_at.sql` の rebuild 版書き換え 1 ファイルのみ、他は本番 state の修復作業。

#### 変更点

- **`cloud/db/migrations/0006_fix_cta_server_updated_at.sql` 書き換え** — 前セッションで作成された ALTER 単独版を rebuild 完全版に書き換え。`PRAGMA table_info` で 旧 schema (`schedule_item_id, tag_id` 複合 PK + `updated_at` 列なし) と判明したため、ALTER ベースの修復は不可能。0004 の `_v2` rebuild セクション（CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE FROM old + DROP + RENAME + 3 INDEX）を独立 migration として抽出
- **本番 D1 migration 適用**: `cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/{0003,0004,0005,0006}.sql` を順次実行。検証 `pragma_table_info` 一括クエリで sync 対象 15 テーブル全てに `server_updated_at` 列が揃ったことを確認 (0006 適用後)
- **本番 Worker 最新化**: `npm run deploy` で 04-17 → 最新 (`599133e refactor(cloud): split sync.ts ...` 含む 8 commits) を反映。auth が timing-safe SHA-256 化、sync routes が `versioned.ts` / `relations.ts` / `shared.ts` に分割、`calendar_tag_assignments` の `RELATION_TABLES_WITH_UPDATED_AT` 昇格などが反映
- **SYNC_TOKEN ローテーション**: 旧 token 不明のため `wrangler secret put SYNC_TOKEN` で新規 hex 64 文字を再投入。curl POST `/auth/verify` で `{"valid":true,"serverTime":...}` 確認後、Desktop UI 側にも同 token を貼って Connect 成功
- **副次: Cloudflare 知識整理** — 本セッションの初動で「Cloudflare の役割が分からない」要件あり、web-researcher で 2025-2026 最新情報を調査・要約 (Workers / D1 / KV / R2 / DO / Queues / Wrangler / 料金 free vs paid / Smart Placement / Containers Beta / Pages 統合)。本リポジトリには未保存（チャット内のみ）
- **Verification**: 0006 適用後に `pragma_table_info('calendar_tag_assignments')` で 7 列 (id / entity_type / entity_id / tag_id / created_at / updated_at / server_updated_at) を確認 / Worker tail で 500 が止むことを確認 (Sync Now 実走による最終確認は user 側で残課題)

#### 残課題

- **手動 UI 検証**: Desktop で Sync Now → Last error が消えること、Connected 表示で sidebar_links / calendar_tag_assignments / dailies / notes が iOS と双方向に伝搬すること
- **Known Issue 016 起票候補**: D1 0004 multi-statement migration が transactional rollback 下で部分適用された原因の調査・記録。再現条件不明、`docs/known-issues/_TEMPLATE.md` ベースで Active 起票が妥当。session 中に特定できた事実: (a) 0004 の calendar_tag_definitions ALTER 部分は適用された / (b) calendar_tag_assignments rebuild 部分は未適用のまま残った / (c) wrangler の transactional rollback 保証メッセージと矛盾する状態
- **計画書アーカイブなし**: 本セッションは production state 修復のみで実装計画書を伴わない作業

---

### 2026-04-25 - Work UX 補強（History タブ + 完了 Toast）+ V68 FREE CHECK バグ修正 + D1 0004 apply

#### 概要

ユーザー報告「Work で作業時間を記録する UI/UX がない」に対する Explore 調査で、`timer_sessions` への保存は機能しているが「保存されたセッションを見る場所が無い」のが本質的不足と判明。Work タブに History タブを追加し、Pomodoro 完了時の Toast を実装。さらに Free session ボタンが `CHECK constraint failed` で起動不能だった既存バグ (Phase B 計画書では CHECK 制約 "元々無し" と誤認していたが full_schema.rs に存在) を V68 migration で修正。Sync 500 の原因は D1 の `calendar_tag_assignments` が旧スキーマ (schedule_item_id, tag_id PK) のまま残っており、新クライアントの新スキーマ push が失敗していたため、修復用 migration `0006_fix_cta_server_updated_at.sql` を作成 + `0004` を D1 remote に apply 完了。Worker deploy は user 実行待ち。検証: cargo test 21 passed / vitest 268 passed / tsc -b + cargo check + 変更ファイル ESLint 全 clean。

#### 変更点

- **🐛 V68 migration: timer_sessions.session_type CHECK に 'FREE' 追加**:
  - `src-tauri/src/db/migrations/v61_plus.rs` に V68 ブロック追加 — `sqlite_master.sql` を読んで `'FREE'` を含むかで `needs_rebuild` 判定 (冪等)、必要なら `timer_sessions_v2` を新 CHECK で create → `INSERT SELECT` で全行コピー → `DROP` + `RENAME` + `idx_timer_sessions_task` 再作成
  - `src-tauri/src/db/migrations/full_schema.rs` の `timer_sessions.session_type CHECK` 行を `('WORK','BREAK','LONG_BREAK','FREE')` に同期 (fresh DB は full_schema → V61 jump → V66 (label) → V68 (CHECK 確認 = skip) を通る)
  - `src-tauri/src/db/migrations/mod.rs` の `LATEST_USER_VERSION = 67 → 68` バンプ + 統合テスト 2 件追加 (`v68_allows_free_session_type`: FREE での INSERT が CHECK を通る / `v68_preserves_existing_timer_sessions_during_rebuild`: V65 状態の DB に WORK 行を仕込んで migration 後に row 保持を確認)
  - **背景**: Phase B で TS / Rust に "FREE" を追加したが DB 側 CHECK の更新を見落とし、Free session ボタンを押した瞬間に `CHECK constraint failed: session_type IN ('WORK','BREAK','LONG_BREAK')` で起動不能だった
- **A: Work History タブ**:
  - `frontend/src/components/Work/WorkHistoryContent.tsx` 新規 — `getDataService().fetchTimerSessions()` を mount 時 1 回 fetch (cancelled flag で cleanup)、`useTaskTreeContext().nodes` から task 名を解決、直近 14 日の `WORK` / `FREE` 完了セッションを日別バケットに集計 (date desc + within-day time desc)、各日に「件数 · 合計時間」表示、セッション行に sessionType 色ドット + task title (or label or "Free session") + `HH:MM · sessionTypeLabel` + `formatDuration(sec)`、上部に「Last 7 days: {合計}」サマリーカード、空時 placeholder 表示
  - `frontend/src/components/Work/WorkScreen.tsx` — `WORK_TABS` に `{ id: "history", labelKey: "work.tabHistory", icon: HistoryIcon }` を Timer と Music の間に追加、`activeTab === "history"` の分岐で `<WorkHistoryContent />` を render
- **C: Pomodoro 完了 Toast**:
  - `frontend/src/hooks/useSessionCompletionToast.ts` 新規 — `useTimerContext().completedSessions` を `useRef` で前回値保持 + useEffect で増加検出 (timerReducer は WORK 完了時のみ increment するので WORK 限定で発火)、`useToast().showToast("success", "✓ Recorded {min}min to {task}")` を呼ぶ。task title 不在時は `"✓ Recorded {min}min"`。Strict Mode の double effect でも prevRef 書き戻しが冪等
  - `WorkScreen.tsx` / `frontend/src/components/Mobile/MobileWorkView.tsx` の両方で `useSessionCompletionToast()` を呼ぶ
  - `frontend/src/hooks/useSessionCompletionToast.test.ts` 新規 (4 cases: 初回レンダーで発火しない / 増加で task 名付き Toast / activeTask null で task 名なし Toast / 同値で発火しない)
- **🐛 Sync 500 対処 (D1 schema 不整合)**:
  - 原因: D1 remote に `sidebar_links` は前回作成済だが、`calendar_tag_assignments` が旧 PK スキーマ (schedule_item_id, tag_id) のまま残っており、最新 client の `INSERT INTO calendar_tag_assignments (id, entity_type, entity_id, ...)` が `no such column` で失敗 → batch 全ロールバック → 500
  - `cloud/db/migrations/0006_fix_cta_server_updated_at.sql` 新規 — 0004 の CTA rebuild セクションだけを独立 migration として抽出 (CREATE `_v2` → `INSERT OR IGNORE SELECT` で旧行を MIN(tag_id) collapse + `entity_type='schedule_item'` 移行 → DROP/RENAME → 3 INDEX)。`CREATE TABLE IF NOT EXISTS` で安全側
  - `wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0004_calendar_tags_v65.sql` を実行 → `changed_db: true / rows_written: 40` で apply 成功
  - **Worker deploy は user 実行待ち** (`cd cloud && npm run deploy`)。最新 `syncTables.ts` は CTA を `RELATION_TABLES_WITH_UPDATED_AT` に昇格しているため deploy しないと D1 修復後も誤動作する可能性
- **i18n**: `work.tabHistory` (`History` / `履歴`) / `work.history.{last7Days, empty}` / `work.toast.{recordedToTask, recordedFreeWork}` を `en.json` + `ja.json` 両方に追加
- **Verification**: `cd src-tauri && cargo test` 21 passed / 1 ignored / 0 failed (新規 V68 統合テスト 2 件含む) / `cd frontend && npx vitest run` 268 passed / 0 failed (32→33 test files、新規 useSessionCompletionToast.test.ts 4 件) / `cd frontend && npx tsc -b` 0 error / `cd src-tauri && cargo check` clean / 変更ファイル ESLint 0 error / session-verifier 全 6 ゲート PASS

#### 残課題

- **Worker deploy 未実行**: `cd cloud && npm run deploy` は user 実行待ち (D1 への直接 apply は許可ポリシーで拒否されるため)。deploy しないと最新 `syncTables.ts` の `RELATION_TABLES_WITH_UPDATED_AT` 昇格が反映されず、D1 0004/0006 適用後も誤動作の可能性
- **Desktop パッケージ版 V68 未到達**: `/Applications/Life Editor.app` は dev binary でなければ古い CHECK 制約のまま。Free session を試すには `cargo tauri dev` か `cargo tauri build` で更新が必要
- **手動 UI 検証**: Work タブ History 画面で過去セッション一覧表示 / Pomodoro 25min 完了で右下に Toast 出る / Free session 開始 → 停止 → SaveDialog 表示 (CHECK 制約エラー無し) を確認

---

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
