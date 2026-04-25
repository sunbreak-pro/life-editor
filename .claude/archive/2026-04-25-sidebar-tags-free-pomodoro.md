# Plan: Sidebar Links + CalendarTags UI 化 + Pomodoro Free + WikiTag 未登録フィルタ

| Field   | Value                                                                                 |
| ------- | ------------------------------------------------------------------------------------- |
| Status  | COMPLETED 2026-04-25 (Phase A/B/C/D all done)                                         |
| Created | 2026-04-25                                                                            |
| Project | /Users/newlife/dev/apps/life-editor                                                   |
| Tracker | `.claude/MEMORY.md` 進行中                                                            |
| Affects | DB (V65/V66) / Tauri commands / DataService / Schedule / Timer / Sidebar / Cloud Sync |

---

## Context

### Why

ユーザー要件（4 件）の同時着手:

1. **Sidebar Links**: LeftSidebar に Web URL / Mac アプリ起動リンクを登録できる新セクションを追加
2. **CalendarTags UI 化 + Task 対応**: 実装済みだが UI 露出ゼロの CalendarTags を Schedule rightSidebar に表示。Task / Event 双方に**単一タグ**で付与可能にする
3. **Pomodoro Free モード**: 無制限ストップウォッチを実装し、停止時に Task 完了履歴 / Event として保存できる
4. **WikiTag 未登録フィルタ + Events ソート**: TagFilterOverlay に「(未登録)」を追加。Events リストに排他的ソートを実装

### Constraints

- **CalendarTags は in-memory のみで未稼働**: マイグレーションがなく、データロスを気にせず DB スキーマを新設可能
- **Tasks は WikiTag 対象外**（RichEditor を持たないため）: 過去の `tier-1-core.md` / `tier-2-supporting.md` の誤記は本セッションで既に修正済
- **Timer 系は Cloud Sync 対象外**（Tier 1 boundary）: Free セッション保存も同様
- **Mobile (iOS) は WikiTagProvider / FileExplorer / Audio 等を省略**: Sidebar Links の iOS 表示は Drawer 内、アプリ系リンクは**グレーアウト**

### Non-Goals

- 既存 WikiTag 体系の変更（Tasks 非対応であることを明確化するのみ）
- Pomodoro Free セッションの Cloud 同期
- macOS 以外（Windows/Linux）でのアプリ起動 / ブラウザ検出
- Sidebar Links のフォルダ階層化（Phase 2 で検討）

---

## Architecture Decisions

### A1. CalendarTags の DB スキーマ（V65）

```sql
CREATE TABLE calendar_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  text_color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  server_updated_at TEXT
);

CREATE TABLE calendar_tag_assignments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('task','schedule_item')),
  entity_id TEXT NOT NULL,
  tag_id TEXT NOT NULL REFERENCES calendar_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  server_updated_at TEXT,
  UNIQUE(entity_type, entity_id)  -- 1:1 制約（要件 2-4）
);
CREATE INDEX idx_calendar_tag_assignments_tag ON calendar_tag_assignments(tag_id);
CREATE INDEX idx_calendar_tag_assignments_entity ON calendar_tag_assignments(entity_type, entity_id);
```

### A2. Sidebar Links の DB スキーマ（V65 同梱）

```sql
CREATE TABLE sidebar_links (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('url','app')),
  name TEXT NOT NULL,
  target TEXT NOT NULL,                -- URL or .app 絶対パス
  emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  server_updated_at TEXT
);
```

### A3. Pomodoro Free モード（V66）

```sql
ALTER TABLE timer_sessions ADD COLUMN label TEXT;
-- session_type に 'free' を許容（CHECK 制約は元々無し）
```

`localStorage` で UI 設定を保持:

- `pomodoroEnabled`: Pomodoro 機能の有効/無効（default: true）
- `freeSessionSaveDialogEnabled`: 停止時のダイアログ表示（default: true、「次回から表示しない」で false に）

### A4. デフォルトブラウザ検出

Rust 側で macOS の `/Applications/{Google Chrome,Safari,Firefox,Microsoft Edge}.app` の存在を `std::path::Path::exists` で確認 → 検出された候補のみ Settings UI に列挙。

### A5. Sidebar Links の構造的位置

LeftSidebar:

```
[mainMenuItems 5項目]   ← schedule / materials / connect / work / analytics
[--- divider ---]
[Sidebar Links]         ← ★新規（Analytics と Settings の間、可変長）
[+ Add Link button]     ← ホバー時表示
[--- divider ---]
[footer: Settings / Tips]   ← 既存フッター固定
```

iOS MobileLayout:

- Drawer 内に表示（bottom tab bar には影響なし）
- `kind='app'` のリンクはグレーアウト + タップ時 Toast「iOS では起動できません」

### A6. CalendarTags UI の配置

Schedule セクション全体の rightSidebar に `CalendarTagsPanel` を配置（Calendar / DayFlow / Tasks / Events 4 タブ全部で共通表示）:

- セクション 1: タグ管理（作成・名前変更・色変更・削除・並び替え）
- セクション 2: タグフィルタ（排他的選択 + 「未登録」 + 「すべて表示」）

タグ付与 UI:

- Event 詳細パネル / Task 詳細パネル に「Tag」セレクター（プルダウン or chip クリッカブル）
- Task 行 / Event 行にタグドット（color 円）を表示

### A7. Pomodoro Save Dialog のフロー

```
[Free停止ボタン] → ダイアログ出現
  ├─ [破棄] → timer_sessions のみ INSERT （label = null, role = null）
  └─ [保存] → 入力フォーム
       ├─ 名称 (text input)
       ├─ Role (Task / Event)
       ├─ Role=Task: 親 Task 検索 (autocomplete from TaskTree, 直近完了優先)
       ├─ Role=Event: CalendarTag 選択 (登録 / 未登録)
       └─ [✓ 次回から表示しない]
     → timer_sessions INSERT (label, session_type='free')
       + Task 作成 (status=DONE, parent_id=選択, completedAt=completed_at) or
       + schedule_items INSERT (routine_id=NULL, scheduled_at=started_at, ends_at=completed_at)
       + CalendarTag assignment (Event の場合)
```

---

## Implementation Order

依存関係から **2 → 3 → 4 → 1** の順:

1. **Phase A: CalendarTags 基盤**（要件 2）— DB / Backend / Schedule rightSidebar UI / Task 対応
2. **Phase B: Pomodoro Free**（要件 3）— Free モード実装 / Save Dialog（Phase A の CalendarTags を Event 保存で利用）
3. **Phase C: WikiTag 未登録 + Events ソート**（要件 4）— TagFilterOverlay 拡張 / EventList ソート（Phase A の CalendarTags フィルタと統合）
4. **Phase D: Sidebar Links**（要件 1）— DB / Backend / LeftSidebar UI / Settings ブラウザ選択 / Cloud Sync（独立タスク、最後でも先でも可）

---

## Phase A: CalendarTags 基盤

### Steps

- [ ] A1. `src-tauri/src/db/migrations.rs` に V65 を追加: `calendar_tags` / `calendar_tag_assignments` テーブル作成 + index
- [ ] A2. `src-tauri/src/repositories/calendar_tag_repository.rs` 新規作成（CRUD + assignment set/clear）
- [ ] A3. `src-tauri/src/commands/calendar_tag_commands.rs` 新規作成（IPC コマンド 8 件程度）
- [ ] A4. `src-tauri/src/lib.rs` の `generate_handler!` に登録
- [ ] A5. `frontend/src/services/DataService.ts` に CalendarTag 系メソッドを定義
- [ ] A6. `frontend/src/services/TauriDataService.ts` に invoke ブリッジを実装
- [ ] A7. `frontend/src/context/CalendarTagsContext.tsx` を DB-backed に書き換え（既存は in-memory）
- [ ] A8. `frontend/src/hooks/useCalendarTagAssignments.ts` を 1:1 構造に変更（Map<entityKey, tagId>）
- [ ] A9. `frontend/src/components/Schedule/RightSidebar/CalendarTagsPanel.tsx` 新規作成（タグ管理 + フィルタ）
- [ ] A10. `frontend/src/components/Schedule/RightSidebar/RightSidebar.tsx` を更新し全タブで Panel 表示
- [ ] A11. Event 詳細パネルにタグセレクター追加
- [ ] A12. Task 詳細パネル / TaskRow にタグセレクター + ドット表示追加
- [x] A13. `cloud/db/migrations/0004_calendar_tags_v65.sql` 新規作成（D1 用: `calendar_tag_definitions` に created_at/updated_at/version/is_deleted/deleted_at/server_updated_at 追加 + `calendar_tag_assignments` を新スキーマに rebuild）
- [x] A14. `cloud/src/config/syncTables.ts` 更新: `calendar_tag_assignments` を `RELATION_TABLES_WITH_UPDATED_AT` に昇格、`RELATION_PARENT_JOINS` から削除、`RELATION_PK_COLS` に `["id"]` 追加
- [ ] A15. Vitest: CalendarTags Provider / Panel の振る舞いテスト
- [ ] A16. cargo test: repository CRUD テスト

### Files

| File                                                                  | Operation   | Notes                 |
| --------------------------------------------------------------------- | ----------- | --------------------- |
| `src-tauri/src/db/migrations.rs`                                      | Edit        | V65 追加              |
| `src-tauri/src/repositories/calendar_tag_repository.rs`               | Create      | CRUD + assignment     |
| `src-tauri/src/commands/calendar_tag_commands.rs`                     | Create      | IPC コマンド          |
| `src-tauri/src/lib.rs`                                                | Edit        | handler 登録          |
| `frontend/src/types/calendarTag.ts`                                   | Edit        | 既存型を 1:1 用に整理 |
| `frontend/src/services/DataService.ts`                                | Edit        | interface 拡張        |
| `frontend/src/services/TauriDataService.ts`                           | Edit        | invoke 実装           |
| `frontend/src/context/CalendarTagsContext.tsx`                        | Edit        | DB-backed 化          |
| `frontend/src/context/CalendarTagsContextValue.ts`                    | Edit        | shape 更新            |
| `frontend/src/hooks/useCalendarTagAssignments.ts`                     | Edit        | 1:1 構造化            |
| `frontend/src/hooks/useCalendarTagsContext.ts`                        | (no change) |                       |
| `frontend/src/components/Schedule/RightSidebar/CalendarTagsPanel.tsx` | Create      | UI 本体               |
| `frontend/src/components/Schedule/RightSidebar/RightSidebar.tsx`      | Edit        | Panel 統合            |
| `frontend/src/components/Schedule/Events/EventDetailPanel.tsx`        | Edit        | タグセレクター        |
| `frontend/src/components/Tasks/TaskDetailPanel.tsx`                   | Edit        | タグセレクター        |
| `frontend/src/components/Tasks/TaskRow.tsx`                           | Edit        | ドット表示            |
| `cloud/db/migrations/0004_calendar_tags.sql`                          | Create      | D1 マイグレーション   |
| `cloud/src/routes/sync.ts`                                            | Edit        | sync 対象追加         |

### Verification

- [ ] `sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"` が `65` を返す
- [ ] CalendarTagsPanel でタグを作成 → 名前 / 色を変更 → 削除できる（DB 永続化）
- [ ] Event をクリック → タグセレクターで選択 → リロードしてもタグが維持される
- [ ] 同 Event に別タグを再選択すると **既存タグが置換される**（複数同時付与にならない）
- [ ] Task についても同様に 1:1 で付与・置換できる
- [ ] フィルタで「タグ A」を選択すると、Calendar / DayFlow / Tasks / Events 全タブに A タグの付いたアイテムだけが表示される
- [ ] Cloud Sync で Desktop → iOS にタグとアサインメントが伝搬する
- [ ] cargo test 全 pass / Vitest 全 pass / `tsc -b` 0 error

---

## Phase B: Pomodoro Free モード + Save Dialog

### Steps

- [ ] B1. `src-tauri/src/db/migrations.rs` に V66 を追加: `ALTER TABLE timer_sessions ADD COLUMN label TEXT`
- [ ] B2. `frontend/src/context/TimerContext.tsx` に `'free'` セッションタイプを追加（無制限カウントアップ、duration を停止時に確定）
- [ ] B3. `frontend/src/components/Timer/FreeSessionButton.tsx` 新規作成（Pomodoro Widget 内に「Free 開始」ボタン）
- [ ] B4. `frontend/src/components/Timer/FreeSessionSaveDialog.tsx` 新規作成（停止時に出現、Task / Event / 破棄 を選択）
- [ ] B5. ダイアログ内 `TaskAutocompleteInput` 新規作成（既存の TaskTree から検索 + 直近完了 5 件を上部表示）
- [ ] B6. ダイアログ内 `CalendarTagSelector` を Phase A から再利用
- [ ] B7. 「次回から表示しない」を `localStorage.freeSessionSaveDialogEnabled` で記録、再読込で復活させる Settings 経路を用意
- [ ] B8. `frontend/src/components/Settings/PomodoroSettings.tsx` に「Pomodoro を有効にする」「保存ダイアログを表示」トグル追加
- [ ] B9. 保存処理:
  - role=Task: `getDataService().createTask({ title, status: 'DONE', parent_id, completed_at })` 呼び出し
  - role=Event: `getDataService().createScheduleItem({ title, scheduled_at: started_at, ends_at: completed_at, routine_id: null })` + assignment 設定
- [ ] B10. Vitest: TimerContext Free モード / SaveDialog の振る舞いテスト

### Files

| File                                                      | Operation   | Notes                 |
| --------------------------------------------------------- | ----------- | --------------------- |
| `src-tauri/src/db/migrations.rs`                          | Edit        | V66 追加              |
| `frontend/src/context/TimerContext.tsx`                   | Edit        | Free モード追加       |
| `frontend/src/types/timer.ts`                             | Edit        | SessionType に 'free' |
| `frontend/src/components/Timer/FreeSessionButton.tsx`     | Create      | 開始ボタン            |
| `frontend/src/components/Timer/FreeSessionSaveDialog.tsx` | Create      | 保存モーダル          |
| `frontend/src/components/Timer/TaskAutocompleteInput.tsx` | Create      | 親 Task 選択          |
| `frontend/src/components/Settings/PomodoroSettings.tsx`   | Edit/Create | 設定トグル            |
| `frontend/src/components/Pomodoro/PomodoroWidget.tsx`     | Edit        | Free ボタン統合       |

### Verification

- [ ] Pomodoro Widget で「Free 開始」→ ストップウォッチ進行 → 「停止」→ 保存ダイアログ出現
- [ ] 「破棄」を選ぶと timer_sessions に `session_type='free', label=null` で記録され、Task / Event は作られない
- [ ] 「保存」→ Role=Task → 親 Task 選択 → Task が status=DONE で作成され TaskTree に出現
- [ ] 「保存」→ Role=Event → タグ「未登録」で保存 → schedule_items に挿入され Calendar に表示される
- [ ] 「次回から表示しない」をチェック → 次回停止時にダイアログ非表示で自動破棄、Settings から再有効化可能
- [ ] Settings の「Pomodoro を有効にする」OFF → Pomodoro Widget が非表示になる
- [ ] Vitest 全 pass

---

## Phase C: WikiTag 未登録 + Events ソート

### Steps

- [ ] C1. `frontend/src/components/shared/TagFilterOverlay.tsx` に「(未登録)」エントリ追加（filter 関数でタグ assign 0 件のもののみ抽出）
- [ ] C2. `MaterialsSidebar` (Notes) / `DailySidebar` (Daily) で「未登録」が機能することを確認（Tasks 側は WikiTag フィルタ自体未実装なので対象外）
- [ ] C3. `frontend/src/components/Schedule/EventList.tsx` にソートドロップダウン追加（排他的、軸 5 種）:
  - 日付昇順
  - 日付降順（default）
  - タイトル ABC 順
  - CalendarTag 別グルーピング
  - タグ未登録のみ
- [ ] C4. ソート選択は localStorage に保存（`eventsListSort`）
- [ ] C5. Vitest: TagFilterOverlay 「未登録」 / EventList ソートのテスト

### Files

| File                                                       | Operation | Notes              |
| ---------------------------------------------------------- | --------- | ------------------ |
| `frontend/src/components/shared/TagFilterOverlay.tsx`      | Edit      | 「未登録」エントリ |
| `frontend/src/components/Schedule/EventList.tsx`           | Edit      | ソート機能         |
| `frontend/src/components/Schedule/EventListSortSelect.tsx` | Create    | ドロップダウン     |

### Verification

- [ ] Materials サイドバーで「(未登録)」を選ぶ → タグの付いていない Note のみ表示
- [x] Daily サイドバーで同様に動作
- [ ] Events タブのソート切替で 5 種類が排他的に動作
- [ ] ソート選択がリロード後も維持される
- [ ] Vitest 全 pass

---

## Phase D: Sidebar Links + Browser/App Settings

### Steps

- [x] D1. `src-tauri/src/db/migrations.rs` に V65 同梱で `sidebar_links` テーブル追加（Phase A と同じ migration version）
- [x] D2. `src-tauri/src/repositories/sidebar_link_repository.rs` 新規作成
- [x] D3. `src-tauri/src/commands/sidebar_link_commands.rs` 新規作成（CRUD + reorder）
- [x] D4. `src-tauri/src/commands/system_commands.rs` 新規作成:
  - `system_open_url(url, browser_id?)` — `open -a "Google Chrome.app" <url>` 等
  - `system_open_app(app_path)` — `open -a <path>` または直接 exec
  - `system_list_applications()` — `/Applications/*.app` を列挙
  - `system_list_browsers()` — Chrome/Safari/Firefox/Edge の存在チェック
- [x] D5. `src-tauri/src/lib.rs` の handler 登録
- [x] D6. `frontend/src/services/DataService.ts` / `TauriDataService.ts` 拡張
- [x] D7. `frontend/src/types/sidebarLink.ts` 新規作成
- [x] D8. `frontend/src/context/SidebarLinksContext.tsx` 新規作成（Pattern A 3 ファイル構成）
- [x] D9. `frontend/src/hooks/useSidebarLinks.ts` 新規作成
- [x] D10. `frontend/src/components/Layout/LeftSidebar.tsx` を更新:
  - mainMenuItems の下、フッター（Settings/Tips）の上にリンクセクション追加
  - 右クリックメニュー（編集 / 削除 / 並び替え）+ 「+」ボタン
- [x] D11. `frontend/src/components/Layout/SidebarLinkItem.tsx` 新規作成（emoji + name + クリックで開く）
- [x] D12. `frontend/src/components/Layout/SidebarLinkAddDialog.tsx` 新規作成（URL or App 選択 + emoji ピッカー）
- [x] D13. `frontend/src/components/Layout/MobileLayout.tsx` の Drawer にリンクセクション追加（kind='app' はグレーアウト + Toast）
- [x] D14. `frontend/src/components/Settings/BrowserSettings.tsx` 新規作成:
  - `system_list_browsers()` で検出されたブラウザのみラジオ表示
  - 選択を `app_settings.default_browser` に保存
- [x] D15. `cloud/db/migrations/0005_sidebar_links.sql` 新規作成
- [x] D16. `cloud/src/routes/sync.ts` に `sidebar_links` 追加
- [x] D17. Vitest: SidebarLinksContext / Add Dialog のテスト
- [x] D18. cargo test: system_commands の単体テスト（mock /Applications）

### Files

| File                                                      | Operation | Notes            |
| --------------------------------------------------------- | --------- | ---------------- |
| `src-tauri/src/db/migrations.rs`                          | Edit      | V65 同梱         |
| `src-tauri/src/repositories/sidebar_link_repository.rs`   | Create    |                  |
| `src-tauri/src/commands/sidebar_link_commands.rs`         | Create    |                  |
| `src-tauri/src/commands/system_commands.rs`               | Create    | open/list 系     |
| `src-tauri/src/lib.rs`                                    | Edit      | handler 登録     |
| `frontend/src/types/sidebarLink.ts`                       | Create    |                  |
| `frontend/src/services/DataService.ts`                    | Edit      |                  |
| `frontend/src/services/TauriDataService.ts`               | Edit      |                  |
| `frontend/src/context/SidebarLinksContext.tsx`            | Create    |                  |
| `frontend/src/context/SidebarLinksContextValue.ts`        | Create    |                  |
| `frontend/src/hooks/useSidebarLinksContext.ts`            | Create    |                  |
| `frontend/src/components/Layout/LeftSidebar.tsx`          | Edit      | リンクセクション |
| `frontend/src/components/Layout/SidebarLinkItem.tsx`      | Create    |                  |
| `frontend/src/components/Layout/SidebarLinkAddDialog.tsx` | Create    |                  |
| `frontend/src/components/Layout/MobileLayout.tsx`         | Edit      | Drawer リンク    |
| `frontend/src/components/Settings/BrowserSettings.tsx`    | Create    | ブラウザ選択     |
| `cloud/db/migrations/0005_sidebar_links.sql`              | Create    |                  |
| `cloud/src/routes/sync.ts`                                | Edit      | sync 対象追加    |

### Verification

- [ ] LeftSidebar の「+」ボタンから URL リンクを追加 → 即座にサイドバーに出現
- [ ] サイドバーのリンクをクリック → 設定したブラウザで URL が開く
- [ ] Settings でブラウザを Chrome → Safari に変更 → 次回クリックから Safari で開く
- [ ] 未インストールのブラウザは Settings 一覧に出ない
- [ ] /Applications 一覧から `.app` を選択 → アプリリンクを追加 → クリックでアプリ起動
- [ ] iOS の Drawer でリンクが表示され、`kind='app'` リンクはグレーアウトされタップ時 Toast「iOS では起動できません」
- [ ] Cloud Sync で Desktop ↔ iOS にリンクが伝搬する
- [ ] 右クリックメニューで編集 / 削除 / 並び替えが可能
- [ ] cargo test 全 pass / Vitest 全 pass / `tsc -b` 0 error

---

## Cross-Phase Verification

- [ ] **マイグレーション整合性**: Phase A と Phase D は V65 を同時に追加するため、片方ずつ commit する場合は migration version を再採番（A=V65 / D=V66 / Pomodoro=V67 等）
- [ ] **Cloud Sync 全テーブル整合性**: D1 側の migration 順序（0004 calendar_tags → 0005 sidebar_links）と Workers の VERSIONED_TABLES 配列が一致
- [ ] **iOS ビルド**: `cargo tauri ios build` が成功し、Xcode で archive 可能
- [ ] **既存テストの非退行**: Vitest 227+ pass / cargo test 10+ pass / eslint clean / `tsc -b` 0 error
- [ ] **CLAUDE.md 更新**: 直近 migration 行に V65/V66/V67 を追記、§4.1 のドメインリストに `calendar_tags` / `sidebar_links` を追加
- [ ] **Tier Map 更新**: tier-1-core.md / tier-2-supporting.md に Sidebar Links（Tier 2 候補）/ CalendarTags（Schedule 内サブ機能）を反映

---

## Risks & Mitigations

| Risk                                                                                               | Mitigation                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 既存 CalendarTagsContext を使っているコンポーネントが多数 in-memory 構造に依存                     | Provider shape を 1:1 化する際、後方互換のための adapter は作らず、参照側を一括書き換え（in-memory のため実質未使用 = 影響なし）      |
| timer_sessions の Cloud Sync 未対応により Free セッションが端末別になる                            | Tier 1 boundary に従い意図通り。マルチデバイスでの実績統計は Phase 2 で検討                                                           |
| macOS 以外（Windows/Linux）で `system_open_app` が失敗する                                         | Tauri ターゲットを macOS / iOS に限定する project 方針なので問題なし。ただし Rust 側で OS チェック + Result::Err 返却で graceful fail |
| ブラウザ検出: ユーザーが `/Applications` 以外（`/Users/x/Applications`）にインストールしている場合 | Phase 1 では `/Applications` のみサポート、Phase 2 で `~/Applications` も追加検討                                                     |
| Sidebar Links が iOS の Drawer で増えすぎてスクロールが必要                                        | sort_order を尊重し、最大表示は scroll 可能に。リミット制限は設けない                                                                 |

---

## Open Questions（実装中に確認）

- Phase A: Task 行のタグドット表示位置（タイトル左？右？）→ 既存 TaskRow の余白次第で実装時判断
- Phase B: Free セッション保存時の名称デフォルト値（空？「Untitled」？日付？）→ デフォルト空、placeholder で日付提示
- Phase D: Sidebar Links の右クリックメニュー UI（context menu ライブラリ既存？）→ 既存利用、なければ Headless UI Menu

---

## Status Updates

- 2026-04-25: DRAFT 作成
- 2026-04-25: Phase A/B/C 実装完了（CalendarTags 1:1 + Task 対応 / Pomodoro Free + SaveDialog / WikiTag 未登録 + Events ソート）。Phase D（Sidebar Links）と Phase A の Cloud Sync は未着手
- 2026-04-25: Phase A 残課題（Cloud Sync）完了。D1 migration 0004 で `calendar_tag_definitions` に sync 用列追加 + `calendar_tag_assignments` を新スキーマに rebuild。`syncTables.ts` で `calendar_tag_assignments` を `RELATION_TABLES_WITH_UPDATED_AT` に昇格。残るは Phase D（Sidebar Links）のみ
- 2026-04-25: Phase D 完了。V67 migration (`sidebar_links` テーブル) + repository/commands/system_open_url|app|list_browsers|list_applications + DataService 拡張 + SidebarLinksContext (Pattern A) + SidebarLinkItem / AddDialog / LeftSidebar 統合 + BrowserSettings + MobileApp Drawer 統合 + Cloud Sync (D1 0005 + syncTables.ts + sync_engine.rs)。検証: cargo test 19/19 / vitest 257/257 / tsc -b 0 error。**全 Phase 完了**
