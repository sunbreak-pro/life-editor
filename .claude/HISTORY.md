# HISTORY.md - 変更履歴

### 2026-04-26 - リファクタリング計画 Phase 2-4 / 3-1 / 3-4 完遂 + 検証用実装計画書作成

#### 概要

ユーザー要望「`.claude/2026-04-25-refactoring-plan.md` を読み込んで未実装のリファクタリングを実装して。またその後にリファクタリング検証のための実装計画書も作成して」を受け、前セッションで deferred とされた 3 Phase を Auto mode で 1 セッション内に完遂。**Phase 3-1** (Rust 26 ファイル) は FromRow trait + query_all/query_one helpers を導入し 33+ の `fn row_to_X` を `impl FromRow for X` に移行 — 4 並列 sub-agent で機械的書き換えを高速実行。**Phase 2-4 / 3-4** は Mobile/Desktop の Context vs Service層差で完全 UI 統合は regression リスク高と判定し、純粋ロジックのみ抽出する保守的アプローチに変更（Phase 2-3b/d と同方針）— `utils/calendarGrid.ts` 新設で `buildCalendarGrid` / `addDays` / `getMondayOf` / `getWeekDates` を共通化、4 ファイル (Mobile 3 + useCalendar) の duplicate 関数群を削除。検証用実装計画書 `.claude/2026-04-26-refactoring-verification-plan.md` を 9 ステップ + 6 リスク + 段階的 rollback 手順で作成。実装プラン `2026-04-25-refactoring-plan.md` は全 Phase 完了に伴い `.claude/archive/` へ移動。session-verifier 全 6 ゲート PASS。

#### 変更点

- **Phase 3-1 — FromRow trait + 26 repository 移行 (Rust)**:
  - `src-tauri/src/db/row_converter.rs`: `FromRow` trait (`fn from_row(&Row) -> Result<Self>`) + `query_all<T: FromRow, P: Params>` + `query_one<T: FromRow, P: Params>` ヘルパを追加。`row_to_json` (column-agnostic JSON converter) は既存維持
  - 24 repository ファイル + sidebar_link を移行: `calendar_repository.rs` / `calendar_tag_repository.rs` / `daily_repository.rs` / `database_repository.rs` (4 model) / `note_connection_repository.rs` / `note_link_repository.rs` / `note_repository.rs` / `paper_board_repository.rs` (3 model) / `playlist_repository.rs` (2 model) / `pomodoro_preset_repository.rs` / `routine_group_assignment_repository.rs` / `routine_group_repository.rs` / `routine_repository.rs` / `schedule_item_repository.rs` / `sidebar_link_repository.rs` / `sound_repository.rs` (4 model) / `task_repository.rs` / `template_repository.rs` / `time_memo_repository.rs` / `timer_repository.rs` / `wiki_tag_connection_repository.rs` / `wiki_tag_group_repository.rs` (2 model) / `wiki_tag_repository.rs` (2 model)
  - 各ファイル: `fn row_to_X(&Row) -> Result<X> { ... body ... }` → `impl FromRow for X { fn from_row(...) -> Result<Self> { ... 既存 body 完全保持 ... } }` に置換、callers の `prepare → query_map → collect` を `query_all(conn, sql, params)` に / `prepare → query_row` を `query_one(conn, sql, params)` に / Option 返却の match 付きパターンを `match query_one::<T, _>(conn, sql, params) { ... }` に変換
  - エッジケース: `note_link_repository::fetch_backlinks` は query_map 内で `BacklinkHit` 組立カスタムロジックがあるため closure 内で `NoteLink::from_row(row)?` 置換のみ (closure pattern 4) / transaction 内 (`tx.query_map`) は SQL 経由のため対象外で保持 / SQL 文字列・パラメータ・ロジックは全件無変更
  - SQL injection 観点不変: `prepare_cached` 化は性能劣化検証時の対応として verification plan §R-1 / S-8 に記載
- **Phase 2-4 — Calendar 共通ロジック抽出**:
  - `frontend/src/utils/calendarGrid.ts` 新設 (59 行): `buildCalendarGrid({year, month, weekStartsOn: 0|1, fixedRows?})` で月グリッド計算を統一 (Sunday 始まり / Monday 始まり両対応、`fixedRows: 6` で 42 セル固定 or 自動 7 倍数 padding) / `addDays(date, days)` / 補助 export `CalendarGridDay` / `CalendarGridOptions`
  - `frontend/src/utils/calendarGrid.test.ts` 新設 (8 tests): Sunday/Monday 始まり両モード / fixedRows 有無 / 月境界 (2026 年 2 月 = 月初 Sun, 28 日) / うるう年 / addDays 月跨ぎ
  - `frontend/src/hooks/useCalendar.ts`: 30 行の `calendarDays` useMemo (Sunday 始まり、6 行 padding) を `buildCalendarGrid({year, month, weekStartsOn: 0, fixedRows: 6})` 1 行呼び出しに置換
  - `frontend/src/components/Mobile/MobileCalendarView.tsx`: 12 行の inline `calendarDays` (Monday 始まり、`{date, inMonth}`) を `buildCalendarGrid({year, month, weekStartsOn: 1})` に置換、destructure rename `{date, isCurrentMonth: inMonth}` で内部 prop 互換維持。等価性検証: dow=0(Sun) → 旧 startDow=-1→6 / 新 startPad=(0+6)%7=6 ✅ / dow=1 / dow=6 全て一致
- **Phase 3-4 — Schedule 共通 hook 抽出**:
  - `calendarGrid.ts` に `getMondayOf(date)` (Mon = 月曜、Sun → 6 日前へ) / `getWeekDates(monday)` (7 日 array) を追加
  - `MobileCalendarStrip.tsx`: local `getMonday` / `formatDateStr` / `addDays` / `getWeekDates` 4 関数 (約 24 行) を削除、共有版 import に置換
  - `MobileScheduleView.tsx`: `loadWeekItems` の inline week-range 計算 (15 行) を `const monday = getMondayOf(...); const sunday = addDays(monday, 6)` 2 行に圧縮、local `todayStr()` 削除して `getTodayKey` lazy init pattern に
  - `MobileCalendarView.tsx`: local `todayStr()` 削除、`getTodayKey` 直接利用
  - `formatDateStr` (3 ファイルの duplicate) → `formatDateKey` (utils/dateKey.ts の正規版) に統一
- **検証用実装計画書 `.claude/2026-04-26-refactoring-verification-plan.md` 作成 (9 Steps + 6 Risks)**:
  - **S-1〜S-3**: Rust 単体 (cargo build/test/clippy) → IPC 統合 (11 ドメインの fetch 経路) → Cloud Sync round-trip (5000 行超 pagination 確認)
  - **S-4〜S-6**: Calendar Mobile (Monday 始まり / スワイプ / chip) / Calendar Desktop (Sunday 始まり / 6 行固定 / Weekly Grid) / Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
  - **S-7**: buildCalendarGrid 境界ケース (月初 Sun/Mon/Sat / うるう年 / getMondayOf(日曜) → 6 日前)
  - **S-8**: 性能 spot-check (`query_all` の prepare 毎回呼び出し → 1000 ノード fetch_tree benchmark / Calendar 月遷移体感)
  - **S-9**: ドキュメント更新 + plan archive
  - **R-1〜R-6**: 性能劣化リスク (prepare_cached 化で対応) / 週初日混乱 / hidden caller / Cloud Sync 副次破壊 / 例外パターン許容 / 境界ケース見落とし
  - 各 Phase 独立 rollback 手順 + DB migration 不要のため schema rollback 不要
- **計画書アーカイブ**:
  - `.claude/2026-04-25-refactoring-plan.md` の Status を `IN_PROGRESS (...)` から `COMPLETED (Phase 0-3 全完了 2026-04-26)` に更新、Phase 2-4 / 3-1 / 3-4 の `[ ]` を `[x]` に + 完了内容を追記
  - `.claude/archive/` に移動 (`mv ./2026-04-25-refactoring-plan.md ./archive/`)
- **Verification**: `cd frontend && npx tsc -b` 0 error / `npm run test` 40 files / 332/332 tests pass (前回 324 + 新規 8 = `calendarGrid.test.ts`) / `cd frontend && npm run build` Vite production 7.9s clean / `cd src-tauri && cargo build --lib` 0 warnings / `cargo test --lib` 25/25 pass (1 ignored bench) / `cargo clippy --lib` 私の変更ファイルで新規警告 0 (3 件の `too_many_arguments` は `pub fn create()` の既存シグネチャに対する pre-existing 警告、本セッション関与なし) / Frontend ESLint 0 / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: 検証用実装計画書 `2026-04-26-refactoring-verification-plan.md` の S-2〜S-6 を実機で実施 (a) IPC 経由 11 ドメイン fetch / (b) Cloud Sync round-trip 5000 行超 / (c) Calendar Mobile (Monday 始まり / スワイプ / chip) / (d) Calendar Desktop (Sunday 始まり / 6 行) / (e) Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
- **性能 spot-check**: `query_all` / `query_one` で毎回 `conn.prepare()` を呼ぶため、大量データで劣化の可能性。劣化確認時は `prepare_cached` 化で API 互換のまま対応 (検証 plan §R-1 / S-8)
- **アンステージ変更**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Mobile/MobileNoteView.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `commands/claude_commands.rs` / `terminal/pty_manager.rs` 他 ~13 ファイルが working tree に残存。本コミットは Phase 2-4 / 3-1 / 3-4 関連 33 ファイル (Rust 26 + Frontend 7) + .claude/ のみに絞る

---

### 2026-04-26 - リファクタリング計画 Phase 2-2/2-3b/2-3c/2-3d/3-2/3-3/3-5 集中実施

#### 概要

ユーザー要望「.claude/2026-04-25-refactoring-plan.md の未完了タスクを完了させて」を受け、Auto mode で 1 セッション内に Phase 2-2 (TauriDataService 分割) / 2-3b (ScheduleTimeGrid pure logic 抽出) / 2-3c (OneDaySchedule hook 抽出) / 2-3d (TagGraphView storage 抽出) / 3-3 (Schedule → ScheduleList rename) / 3-2 (cursor pagination 本実装、Issue #012) / 3-5 (UNIQUE 制約 audit) を完了。手動 UI 検証必須の Phase 2-4 (Calendar 統合) / Phase 3-4 (Schedule View 統合)、および 27 ファイルにわたる大規模 trait 化の Phase 3-1 (Rust row_to_model) は本セッションでは見送り。session-verifier 全 6 ゲート PASS、324/324 vitest tests pass (新規 36 件追加)、cargo build / test clean。実装計画書は IN_PROGRESS のままで archive せず継続。

#### 変更点

- **Phase 2-2 — TauriDataService 1502 → 52 行 + 19 ドメインモジュール** (`0f49dc5`):
  - `frontend/src/services/data/{tasks,timer,sound,daily,notes,calendars,routines,scheduleItems,playlists,wikiTags,timeMemos,paper,databases,files,sidebar,system,templates,sync,misc}.ts` を 19 モジュールに分割。各モジュールは const オブジェクトで `tauriInvoke` ラッパーを export
  - `TauriDataService.ts` は composition root として spread + `Object.assign(this, composed)` + class/interface declaration merging で `DataService` 型互換維持。後方互換: `dataServiceFactory.ts` の `new TauriDataService()` 50+ consumer は無改変
  - session-verifier の Gate 2 で `@typescript-eslint/no-unsafe-declaration-merging` 検出 → class 自体を撤去し `tauriDataService` const singleton に置換 (`8149fd6`)。`dataServiceFactory.ts` は const を直接参照、`services/index.ts` は const を re-export
- **Phase 2-3b — ScheduleTimeGrid 1221 → 926 行** (`b3e7a21`):
  - 純粋ロジック (`layoutAllItems` / `rangesOverlap` / `computeGroupFrames` / `detectRoutineTaskSplit` / `adjustItemsForRoutineSplit`、型 `UnifiedItem` / `ComputedGroupFrame`、定数 `HOURS` / `GUTTER_WIDTH` / `MIN_ITEM_HEIGHT` / `GROUP_HEADER_HEIGHT`) を `scheduleTimeGridLayout.ts` (326 行) に抽出
  - 当初計画の JSX サブディレクトリ分割 (GridLayer/EventLayer/DragHandlers/Hooks) は手動 UI 検証必須のため見送り、純粋関数のみ抽出する保守的アプローチ
- **Phase 2-3c — OneDaySchedule 1276 → 1172 行 + hook 2 件抽出** (`70b7b14`):
  - `useDayFlowFilters.ts` (97 行): フィルタ state + `filteredScheduleItems` / `filteredDayTasks` / `allDayTasks2` / `allDayScheduleItems` / `timedScheduleItems` / `hasAllDayItems` の memoized 派生
  - `useDayFlowDialogs.ts` (223 行): 8 つの popover/preview/menu state + 3 つのハンドラ (`handleRequestRoutineDelete` / `handleDismissOnly` / `handleArchiveRoutine`)。依存 mutation は引数で注入
  - `dayFlowFilters.ts` (16 行): `DAY_FLOW_FILTER_TABS` / `DayFlowFilterTab` 定数を分離。`OneDaySchedule.tsx` から re-export し `ScheduleSection.tsx` の既存 import path 維持
  - session-verifier で `setRoutinePicker` / `setNotePicker` の 4 件 missing-deps 警告検出 → useCallback の deps 配列に setter を追加 (state setter は安定だが、destructured オブジェクト経由のため ESLint が安定性を判定できず) (`8149fd6`)
- **Phase 2-3d — TagGraphView 1443 → 1414 行** (`865cc77`):
  - localStorage helpers (`loadPositions` / `savePositions` / `loadViewport` / `saveViewport` / `isSpecialFilterId` / `VIRTUAL_LINK_EDGES_HIDDEN_ID` 定数) を `tagGraphStorage.ts` (45 行) に抽出
  - React Flow 内部と密結合の JSX サブディレクトリ分割 (ForceLayout/Renderer/Interactions/Hooks) は手動 UI 検証必須のため見送り
- **Phase 3-3 — components/Schedule → ScheduleList rename** (`550e55f`):
  - `git mv frontend/src/components/Schedule frontend/src/components/ScheduleList` で 13 ファイル一括 rename
  - 外部 import 4 箇所更新: `App.tsx` (×2) / `useTaskDetailHandlers.ts` / `useSectionCommands.ts` / `Work/FreeSessionSaveDialog.tsx`
  - `Tasks/TaskDetail/*` の `../Schedule/shared/` import は `Tasks/Schedule/` を参照する別ディレクトリのため変更不要
  - Plan の "alias re-export 1 週間維持" は省略 — 端末 / claude history 等の外部参照は確認した限り無し
- **Phase 3-2 — cursor pagination 本実装 (Issue #012)** (`62d144f`):
  - Server (`cloud/src/routes/sync/versioned.ts`): `pullVersionedDelta` が batch 内の最大 `server_updated_at` を `nextSince` として返却 (戻り値型に `nextSince: string` を追加)。`/sync/changes` のレスポンスに同梱
  - Client (`src-tauri/src/commands/sync_commands.rs::sync_trigger`): 単発 fetch を `loop { fetch_changes(cursor); apply; if !has_more break; cursor = next_since; }` ループ化。`sync_last_synced_at` は全 page 完了後にのみ永続化 (中断時の再開保証)
  - `SyncPayload` (`src-tauri/src/sync/types.rs`) に `next_since: String` 追加 (旧サーバ互換: `#[serde(default)]` で空文字 fallback、空時は break して安全に終了)
  - 多重 break ガード: `has_more=false` / `next_since` 空 / cursor 進行なし のいずれかで終了 (無限ループ防止)
  - LIMIT=5000 (`SYNC_PAGE_SIZE`) は Phase 1-1 で既に `cloud/src/config/syncTables.ts` に切り出し済
- **Phase 3-5 — UNIQUE 制約 audit (no migration needed)** (`7645d2d`):
  - `src-tauri/src/db/migrations/full_schema.rs` 全 relation テーブルを audit。`sound_tag_assignments` / `routine_tag_assignments` / `wiki_tag_assignments` / `wiki_tag_group_members` / `routine_group_tag_assignments` / `calendar_tag_assignments` は全て `PRIMARY KEY` 複合キーで重複防止済、`wiki_tag_connections (source_tag_id, target_tag_id)` / `note_connections (source_note_id, target_note_id)` / `time_memos (date, hour)` / `database_cells (row_id, property_id)` / `note_aliases.alias` / `dailies.date` / 各 `*_definitions.name` は UNIQUE 既存
  - 唯一未制約な箇所は `note_links` (source/target/heading/block_id/link_type) だが、「同一ノート間に異なる heading を指す複数リンク」が正当ユースケースのため UNIQUE 化は要件 vague で見送り (V63 の schedule_items のように具体的問題発見時に別途対処)
  - 結論: Plan の「関連テーブルが UNIQUE 不足」前提が古い情報 (Phase 1 / Phase 2-1 の migration v60〜v67 で既に網羅されていた)。**migration 追加不要**
- **session-verifier 検出修正 + 新規テスト** (`8149fd6`):
  - TauriDataService class → const 化 (declaration merging 解消)
  - OneDaySchedule の useCallback deps に `setRoutinePicker` / `setNotePicker` 追加 (4 箇所)
  - 新規テスト 36 件: `scheduleTimeGridLayout.test.ts` (19 件: rangesOverlap / layoutAllItems / computeGroupFrames / detectRoutineTaskSplit / adjustItemsForRoutineSplit) / `tagGraphStorage.test.ts` (9 件: localStorage round-trips + isSpecialFilterId) / `useDayFlowFilters.test.ts` (8 件: フィルタ state + memoized 派生 via @testing-library/react)
- **計画書 (`.claude/2026-04-25-refactoring-plan.md`) 更新**: Status 行を `IN_PROGRESS (Phase 0 ✅ / Phase 1 ✅ / Phase 2-1 ✅ / Phase 2-2 ✅ / Phase 2-3a-d ✅ / Phase 3-2 ✅ / Phase 3-3 ✅ / Phase 3-5 ✅ AUDIT / Phase 2-4, 3-1, 3-4 deferred)` に更新。各 Phase の完了内容を Files / Verification / Notes として追記。**実装プランは Phase 2-4 / 3-1 / 3-4 が pending のため archive せず継続**
- **Verification**: `cd frontend && npx tsc -b` 0 error / `cd frontend && npm run test` 39 files / 324 passed (前回 288 + 新規 36) / `cd cloud && npx tsc --noEmit` clean / `cd src-tauri && cargo build --lib` clean / `cargo test --lib sync` 2/2 passed / 私の変更行で新規 lint 0 (残 114 lint problems は全て本セッション未触の既存問題、b860d04 baseline 同等) / session-verifier 全 6 ゲート PASS

#### 残課題

- **Phase 2-4 (Calendar Mobile/Desktop 統合)**: `CalendarView.tsx` (1168 行、month/week 両モード、多数の Context 依存) と `MobileCalendarView.tsx` (823 行、独自 UI) の差分大、Plan 自身が iOS 実機テスト必須と明記。手動 UI 検証なしでは regression 不可避のため別セッションで実施
- **Phase 3-1 (Rust row_to_model RowConverter trait)**: 27 ファイルにわたる個別 row*to*\* fn を trait impl に移行する大規模 refactoring (推定 -1500 行 = Plan 自身も "6-10 セッション" 想定の中核作業)。各 repo に微妙な差異 (joins / JSON serialize / snake↔camel) があり、機械的置換不可
- **Phase 3-4 (Schedule View Mobile/Desktop 統合)**: 2-4 と同じ UI 検証問題のため別セッションで実施
- **手動 UI 検証**: (a) Schedule (DayFlow / Calendar / Routine) の操作回帰なし / (b) Cmd+K / Sidebar Links 等の関連経路 / (c) Cloud Sync の cursor pagination 動作 (Worker deploy 後、5000 行超のテーブルがあれば実走確認)
- **Worker deploy 必須**: Phase 3-2 のサーバー側変更 (cloud/src/routes/sync/{index,versioned}.ts) は本番反映が必要。`cd cloud && npm run deploy`
- **アンステージ変更**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` 他 ~13 ファイルが working tree に残存。本一連の commit は refactoring 関連 + `.claude/` のみに絞っている

---

### 2026-04-26 - WikiTag カラーピッカー文字色/プリセット即閉鎖バグ + ネスト枠 UI 修正

#### 概要

ユーザー報告: WikiTag (TipTap inline / WikiTagList chip) の編集パネルでカラーピッカーのプリセット色 / 文字色タブをクリックすると色が変わらず即パネルが閉じる + ピッカーの幅が固定 (190px) で WikiTag 編集パネル (208px) と合わず二重枠の不格好 UI。**真因 (バグ)**: `WikiTagList.tsx` / `WikiTagView.tsx` の編集パネル上部入力 `<input autoFocus>` が `onBlur` で `handleEditSave` → `setEditing(false)` を呼ぶ。macOS WebKit では `<button>` クリックで focus が button に移らず `e.relatedTarget = null`、`editRef.current.contains(null)` が false → 即 save → panel 閉じる → click event は to なし。実装計画書を伴わない小規模バグ修正。session-verifier 全 6 ゲート PASS。

#### 変更点

- **`UnifiedColorPicker.tsx` バグ修正 + UI prop 追加** — `frontend/src/components/shared/UnifiedColorPicker.tsx`:
  - 全 interactive ボタン (Background/Text タブ 2 個・12 プリセット色・"Default" リセット) に `onMouseDown={(e) => e.preventDefault()}` を追加。`<input autoFocus>` を持つ親パネル (WikiTagList / WikiTagView) でクリック時に input が blur せず `handleEditSave` 経由の panel 閉鎖が発生しない。macOS WebKit が `<button>` クリックで focus を移さない仕様 (`e.relatedTarget = null`) に対する標準対処パターン
  - `embedded?: boolean` prop 新設。`inline + embedded=true` 時は picker 自身の `bg-notion-bg border border-notion-border rounded-md shadow-sm w-[190px]` 固定スタイルを捨て `w-full` で親コンテナいっぱいに伸長。親が既に bordered container を提供している場合の二重枠を解消
  - preset grid に `justify-items-center` を追加。embedded で grid 幅が拡大した際もボタンが各セル内で中央寄せされる
- **WikiTag 編集パネル 2 箇所で `embedded` 適用**:
  - `frontend/src/components/WikiTags/WikiTagList.tsx`: chip クリック時の編集ポップアップ内 `<UnifiedColorPicker inline embedded />` で外枠 `w-52 + p-2` の中にピッカーがフィット
  - `frontend/src/extensions/WikiTagView.tsx`: TipTap inline WikiTag クリック時の `wiki-tag-edit-popup` (CSS で 13rem) 内 `<UnifiedColorPicker inline embedded />` 同様
- **新規テスト** — `frontend/src/components/shared/UnifiedColorPicker.test.tsx` (4 件):
  - "calls onChange when a preset color is clicked" — `userEvent.click(getByLabelText("#3b82f6"))` で `onChange("#3b82f6")` が呼ばれる
  - "preset button mousedown calls preventDefault so a focused input above does not blur" — `dispatchEvent(new MouseEvent("mousedown"))` 後に `event.defaultPrevented === true`
  - "text-color reset button (Default) preventDefault on mousedown" — Text タブ + Default ボタン両方の mousedown で preventDefault
  - "embedded mode drops the wrapping border/background and uses w-full" — `inline` のみと `inline embedded` で `firstChild.className` が `border + w-[190px]` ↔ `w-full` 切替を assert
- **検証**: `cd frontend && npx tsc -b` 0 error / `npx vitest run` 35 files / 288 tests / 0 failed (新規 4 件) / 変更ファイル 3 件のうち WikiTagList.tsx:68 の `react-hooks/purity` `Math.random` lint 警告は既存コード (commit d9ebdff0, 2026-03-09) で本セッション未触の handleCreate イベントハンドラ false positive 寄り (event handler は render path 外のため実害なし) / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) note 内 inline WikiTag をクリック → 編集ポップアップでプリセット色 12 個 / Background タブ / Text タブ / Default リセットボタン全てクリックで panel 開いたまま色変化 / (b) WikiTag chip 同じく / (c) ピッカーが panel 幅いっぱいに広がり二重枠が消える
- **アンステージ変更の取り扱い**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Mobile/MobileNoteView.tsx` / `Ideas/NoteTreeNode.tsx` / `claude_commands.rs` / `pty_manager.rs` 他 ~7 ファイルが working tree に残存。本コミットは UnifiedColorPicker 4 ファイル (実装 1 + 新規テスト 1 + WikiTag 2) + .claude/ のみに絞る
- **WikiTagList.tsx:68 既存 lint 警告**: 別タスクで一括対応 (event handler 内の Math.random は実害なし、purity rule false positive)

---

### 2026-04-25 - UnifiedColorPicker 共通化 + UI 透明度ポリシー策定 + Routine UI 群修正

#### 概要

ユーザー要望ベースの一連の UI/UX クリーンアップを 1 セッションで実施。実装計画書なしのアドホック修正群。フェーズは (a) Routine 4 バグ修正 → (b) Routine 削除時 ErrorBoundary クラッシュの根本原因 (`bulkCreateScheduleItems` 戻り値型不一致) 修正 → (c) CalendarTags のカラーピッカーを共通化 → (d) ユーザーから「CalendarTags の元実装ベースで全 UnifiedColorPicker 利用箇所を共通化、Mac 標準のコンパクト感、WikiTags の textColor タブも含める」要件追加で `UnifiedColorPicker.tsx` を全面書き換え (API 互換維持で 12 利用箇所は変更不要) → (e) ユーザー指摘から「主要 UI コンテナ背景に透明度を使わない」ポリシーを vision/CLAUDE.md に明文化 + 透明 UI 5 箇所修正、の流れ。session-verifier 全 6 ゲート PASS。

#### 変更点

- **Routine UI 4 バグ修正**:
  - `frontend/src/components/Tasks/Schedule/Routine/FrequencySelector.tsx` に `hideGroupOption?: boolean` prop 追加。`RoutineGroupEditDialog.tsx` で `hideGroupOption` を渡し、Group 自身は frequency=group を選べない（Group 自体が Group に入ることはできない仕様の UI 反映）。個別 Routine 編集側 (`RoutineEditDialog`) では従来通り "Group" 選択可能を維持
  - `frontend/src/components/Schedule/ScheduleSidebarContent.tsx` の Calendar 右サイドバーで `SearchTrigger` と `FolderDropdown` を縦並び 2 ブロックから flex 1 ブロックに統合 (検索アイコン + 残り幅で flex-1 のフォルダドロップダウン)
  - `frontend/src/components/Schedule/CalendarTagsPanel.tsx` のタイトルを `t("calendarTags.title", "Tags")` から `t("calendarTags.scheduleTitle", "Schedule Tags")` に変更、新規追加インライン UI のはみ出しを `flex-1 min-w-0` + 各ボタン/swatch に `shrink-0` で防止 + gap を `gap-1.5` → `gap-1` に圧縮
- **Routine 削除時 ErrorBoundary クラッシュの真因修正**:
  - 症状: Dayflow 内 Routine を「今回だけ削除」しただけで `Try again` 画面に落ちる。`NaN is an invalid value for the left css style property` + `Spread syntax requires ...iterable not be null or undefined — useScheduleItemsRoutineSync.ts:74` が連続発生
  - 真因: Rust 側 `db_schedule_items_bulk_create` は `Result<(), String>` を返すのに、TS 側 `DataService.bulkCreateScheduleItems` は `Promise<ScheduleItem[]>` と宣言していた。`await bulkCreate()` が undefined を返し → `[...prev, ...undefined]` で Spread エラー → `ScheduleItemsProvider` が ErrorBoundary 行き → 副次的に NaN left CSS エラーも発生
  - 修正: `frontend/src/services/DataService.ts` と `frontend/src/services/TauriDataService.ts` の `bulkCreateScheduleItems` 戻り値型を `Promise<void>` に変更。`frontend/src/hooks/useScheduleItemsRoutineSync.ts:71` と `frontend/src/hooks/useDayFlowColumn.ts:106` で `await bulkCreate(toCreate)` 後にローカルで `toCreate.map(c => ({ id, date, title, startTime, endTime, completed: false, completedAt: null, routineId: c.routineId, templateId: null, memo: null, noteId: null, content: null, isDeleted: false, isDismissed: false, reminderEnabled: c.reminderEnabled ?? false, reminderOffset: c.reminderOffset, createdAt: nowIso, updatedAt: nowIso }))` で `ScheduleItem[]` を組み立てて state に追加
- **Routine 削除 ContextMenu の NaN left CSS 修正 (前段)**:
  - 症状: Dayflow Timegrid アイテムの右クリック → 削除でダイアログ position が NaN になり描画失敗
  - 原因: `onRequestRoutineDelete(item, {} as React.MouseEvent)` で空オブジェクトを渡しており `e.clientX/Y` が undefined → `setRoutineDeleteTarget({ position: { x: undefined, y: undefined } })` → `RoutineDeleteConfirmDialog` の `style.left = Math.min(undefined, ...) = NaN`
  - 修正: 4 ファイル (`ScheduleItemBlock.tsx` / `ScheduleTimeGrid.tsx` / `OneDaySchedule.tsx` / `DualDayFlowLayout.tsx`) で `onRequestRoutineDelete` のシグネチャを `(item, e: React.MouseEvent)` から `(item, position: { x: number; y: number })` に変更。context menu 経由削除時は `contextMenu.position`、preview popup 経由は `schedulePreview.position`、swipe action 経由は `{ x: e.clientX, y: e.clientY }` を渡す
- **`UnifiedColorPicker.tsx` 全面書き換え**:
  - 旧: `react-colorful` の `HexColorPicker` (大型カラー領域) + Hex 入力 + プリセット + tab 切替 + debounced onChange (`useDebouncedCallback` 500ms)
  - 新: CalendarTags 元実装ベースの preset 円形 grid (12 色 6 列 × 2 行 / w-6 h-6 / ring-1 + Check on selected) + native `<input type="color">` (Custom 色) + showTextColor 時の Background/Text タブ + click-outside auto close
  - API 完全互換 (`color` / `onChange` / `mode "preset-only" | "preset-full"` / `presets` / `showTextColor` / `textColor` / `effectiveTextColor` / `onTextColorChange` / `inline` / `onClose` 維持) で利用側 12 箇所 (`PaperFrameNode` / `CalendarTagsPanel` / `RoutineGroupEditDialog` / `RoutineEditDialog` / `BubbleToolbar` / `SoundTagEditor` / `SoundTagManager` / `NotesView` / `WikiTagView` / `WikiTagList` / `TagGraphView` 等) は変更不要
  - 透明度修正: `bg-notion-bg-popover` (CSS 変数未定義 → 透明落ち) → `bg-notion-bg` (定義済み不透明)
  - 幅: `w-[156px]` (preset 重なり) → `w-[190px]` (w-6 + gap-1.5 + p-2 で重なり解消)
  - preset: 18 色 9 列 → 12 色 6 列 × 2 行 にスリム化 (red/orange/amber/lime/emerald/cyan/blue/indigo/violet/pink/rose/slate)
- **UI 透明度ポリシー策定**:
  - `.claude/docs/vision/coding-principles.md §5` 新設: 規約 (主要 UI コンテナ背景は完全不透明) / 許容例外 (ホバー feedback / モーダルバックドロップ / アクセント薄塗り / 装飾線 / disabled / 影) / 禁止例 (`bg-notion-bg-popover` / 半透明本体 + backdrop-blur) / 修正パターン表 / 検出 grep コマンド
  - `.claude/CLAUDE.md §6.4` の設計規約一文に「主要 UI コンテナ背景に透明度禁止」追記 + vision §5 リンク (auto-load されるため将来のセッションで自動適用)
  - 透明 UI 5 箇所修正:
    - `frontend/src/components/Layout/SidebarLinkItem.tsx:103` (leftSidebar 3点メニュー Edit/Delete、ユーザー指摘) — `bg-notion-bg-popover` → `bg-notion-bg`
    - `frontend/src/components/Schedule/CalendarTagSelector.tsx:76` (Calendar Tag セレクタドロップダウン) — 同上
    - `frontend/src/components/Schedule/CalendarTagsPanel.tsx:112` (Schedule Tags の Rename/Delete メニュー) — 同上
    - `frontend/src/components/Work/FreeSessionSaveDialog.tsx:195` (フリーセッション保存の親タスク検索結果) — 同上
    - `frontend/src/components/shared/TipsPanel.tsx:61` (Tips パネル本体) — `bg-notion-bg-secondary/70 backdrop-blur-sm` → `bg-notion-bg-secondary` (完全不透明 + backdrop blur 削除)
- **CalendarTagsPanel 一時実装の差し戻し**: 一連の作業途中でユーザーから「元の独自実装に戻し、それを共通化して使い回す」要件が出たため、CalendarTagsPanel に一時的に追加していた DEFAULT_NEW_TAG_COLOR / startAdd の独自 popover ロジックは UnifiedColorPicker の API 互換書き換えで実質的に共通版へ統合された (CalendarTagsPanel は内部で UnifiedColorPicker を呼ぶだけになり、見た目は元の grid + native picker、実装は共通)
- **Verification**: `tsc -b` 0 error / vitest 35 files / 284 tests / 0 failed (前回比 +1 file = `lucideIconRegistry.test.ts`、+1 test) / 既存 lint 102 errors はすべて変更前から残存 (私の修正行で新規エラー 0、`useDebouncedCallback.ts` / `useDragOverIndicator.ts` / `usePaperBoard.ts` 等の MEMORY.md 既知 finding) / session-verifier 全 6 ゲート PASS

#### 残課題

- **D1 migration 0007 + Worker deploy は前セッション残課題のまま** (本セッションでは触らず)
- **手動 UI 検証**: (a) Routine UI 4 件の動作確認 / (b) Dayflow Routine 削除「今回だけ」「ルーティン全体」両方でクラッシュしないこと / (c) UnifiedColorPicker の見た目を 12 利用箇所すべてで目視確認 (CalendarTags / WikiTags textColor タブ / BubbleToolbar / SoundTags / Notes 色 / PaperFrame / TagGraph / RoutineGroup color など) / (d) leftSidebar の 3 点メニュー / Calendar Tag セレクタ / Schedule Tags メニュー / FreeSession 親タスク検索 / TipsPanel が完全不透明になっていること
- **既存 Tier 3 の透明度判断を保留**: `Ideas/DailyView.tsx:194` / `Ideas/NotesView.tsx:324` のロックオーバーレイ (`backdrop-blur-sm bg-notion-bg/30`) は ScreenLock 機能の意図的半透明として残置 / `MiniTodayFlow.tsx` / `Toast.tsx` の `bg-white/XX` ホバーは方針上 OK (notion-hover 統一余地あり、別タスク化)
- **i18n 既存問題**: `calendarTags.*` キー群は元から ja/en に未登録でフォールバック値運用。今回追加した `calendarTags.scheduleTitle` も同パターン踏襲 (新規違反なし、既存問題)
- **mockDataService.ts:343** の `bulkCreateScheduleItems: vi.fn().mockResolvedValue([])` は新シグネチャ `Promise<void>` に対し `[]` を返すが型上互換、tests pass のため放置 (clean にするなら `mockResolvedValue(undefined)`)

---

### 2026-04-25 - Routine 削除のゴースト復活問題 + DayFlow 時間変更の Undo/Redo 全日付対応

#### 概要

ユーザー報告 2 件の Routine 関連バグ。(1) "Untitled routine" を削除しても他の日付で残ったり、削除ボタンを押していないのに突然消える。(2) DayFlow TimeGrid で routine bar をドラッグして時間変更し「ルーティンテンプレート更新」を押した後、Undo/Redo が現在表示中の日付しか戻さない。ユーザーが「根本原因が同じかも」と直感した通り、**両方とも routine の変更が複数日付の `schedule_items` に正しく伝播しない**という共通テーマだが、メカニズムは別系統（症状 A は Cloud Sync delta path 不整合、症状 B は UndoRedoManager の domain 単位 pop と未登録 IPC アクション）と判明。Rust DB layer + Frontend hooks/UI/型/テスト 9 ファイルを 1 セッションで対応。session-verifier 全 6 ゲート PASS。実装計画書を伴わない小規模バグ修正。

#### 変更点

- **症状 A 真因 — `routine_repository::soft_delete` が schedule_items を物理 DELETE していた**:
  - `src-tauri/src/db/routine_repository.rs::soft_delete` を `DELETE FROM schedule_items WHERE routine_id = ?1 AND completed = 0` から `UPDATE schedule_items SET is_deleted = 1, deleted_at = datetime('now'), version = version + 1, updated_at = datetime('now') WHERE routine_id = ?1 AND completed = 0 AND is_deleted = 0` に書き換え。物理 DELETE は Cloud Sync の `is_deleted=1 + version+1 + updated_at` delta path に乗らないため → Cloud に delete マーカーが残らない → iOS が依然として items を保持し続け Cloud に push し続ける → Desktop が pull で resurrect → ゴースト item が他の日付に出現。後から iOS が遅れて soft-delete を処理した際に「突然消える」現象も同源。`AND is_deleted = 0` 条件追加は再実行時の version 二重 bump 防止
  - `src-tauri/src/db/routine_repository.rs` 末尾に `#[cfg(test)] mod tests` 新設。`soft_delete_marks_routine_and_uncompleted_schedule_items_without_physical_delete`（routine + 2 件の uncompleted item を作って soft_delete → 全 row が DB 上に残り `is_deleted=1` になっていることを確認）と `soft_delete_preserves_completed_schedule_items`（completed item は soft-delete されず deleted_ids に含まれないことを確認）の 2 件追加。`fresh_conn() = Connection::open_in_memory() + run_migrations` の sidebar_link_repository pattern 踏襲
- **症状 A 防御層 — frontend 側の defensive guard**:
  - `frontend/src/utils/routineScheduleSync.ts::shouldCreateRoutineItem` 冒頭に `if (routine.isDeleted) return false;` を追加（既存の `isArchived || !isVisible` ガードより前）。万が一 sync 中の race で `isDeleted=true` の routine が `routines` 配列に紛れ込んでも再生成されない
  - `frontend/src/hooks/useScheduleItemsRoutineSync.ts::syncScheduleItemsWithRoutines` で `routineMap.get(item.routineId)` lookup 後の guard を `if (!routine) return item;` から `if (!routine || routine.isDeleted) return item;` に拡張
  - `frontend/src/utils/routineScheduleSync.test.ts` に `soft-deleted routines never fire (defensive guard against ghost regeneration)` を追加（`isDeleted: true` の routine が daily / group 両方で fire しないことを確認）
- **症状 B 真因 — 3 アクションが独立 push されており UndoRedoManager の domain 単位 pop で 1 ドメインしか戻らない**:
  - `OneDaySchedule.tsx::handleUpdateScheduleItemTime` → `RoutineTimeChangeDialog::onApplyToRoutine` の流れで「現在日 scheduleItem 更新（push: scheduleItem ドメイン）」「routine 自体の更新（push: routine ドメイン）」「`updateFutureScheduleItemsByRoutine` IPC 直叩き（**undo 未登録**）」が独立して実行されており、`UndoRedoManager.undoLatest(["scheduleItem","routine"])` は `_seq` 最大の 1 ドメインしか pop しない仕様のため未来日更新は永久に戻らない
- **症状 B 修正 — skipUndo オプション追加 + 1 つの grouped undo entry に統合**:
  - `frontend/src/hooks/useScheduleItemsCore.ts::updateScheduleItem` に `options?: { skipUndo?: boolean }` 引数追加（既存の `deleteScheduleItem` と同パターン）。`if (prev)` を `if (prev && !options?.skipUndo)` に変更
  - `frontend/src/hooks/useRoutines.ts::updateRoutine` に同様の `options?: { skipUndo?: boolean }` 追加
  - `frontend/src/context/ScheduleItemsContextValue.ts` の `updateScheduleItem` シグネチャに `options?: { skipUndo?: boolean }` を反映（RoutineContextValue は `ReturnType<typeof useRoutines>` で自動継承）
  - `frontend/src/components/Tasks/Schedule/DayFlow/OneDaySchedule.tsx`:
    - `useUndoRedo` import + `const { push } = useUndoRedo();` 追加 / `logServiceError` import 追加
    - `handleUpdateScheduleItemTime`: routine item の場合のみ `updateScheduleItem(id, { startTime, endTime }, { skipUndo: isRoutineItem })` で適用（dialog 選択待ち。drag 自体の undo entry は dialog 選択後に push）
    - `RoutineTimeChangeDialog::onApplyToRoutine` を全面書き換え。`fetchScheduleItemsByRoutineId(routineId)` で全 routine items を取得 → `i.date >= fromDate && !i.completed && !i.isDeleted` で未来日のみ filter → 当日 item の値は `change.prevStartTime/prevEndTime` で上書きして **before snapshot** 配列を作成。`updateRoutine(skipUndo:true)` + `updateFutureScheduleItemsByRoutine` IPC を順次実行後、`push("routine", { label: "Apply routine time change", undo, redo })` で 1 件の grouped entry を登録。undo は `updateRoutine(prev, skipUndo:true)` + `updateScheduleItem(itemId, prev, skipUndo:true)`（当日 item は local state に存在するので revert で UI 反映）+ snapshot 内の各未来日 item に対し `getDataService().updateScheduleItem(fi.id, fi)` IPC を for-await で順次 revert（未来日 item は current 表示外なので local state 更新不要、次の loadItemsForDate / loadScheduleItemsForMonth が DB から最新を取得）。redo は forward 3 アクションの再実行
    - `onThisOnly`: drag は skipUndo で適用済みなので、対応する scheduleItem entry を `push("scheduleItem", { undo: → updateScheduleItem(prev,skipUndo), redo: → updateScheduleItem(new,skipUndo) })` で後追い登録
    - `onCancel`: `updateScheduleItem(prev, skipUndo:true)` で local + DB を pre-drag 値に戻すだけ。push なし（drag 自体「無かったこと」に）
- **検証**: `tsc -b` 0 error / `cargo check` clean / `vitest run` 35 files / 284 tests / 0 failed (新規 1 件) / `cargo test --lib` 25 passed (新規 2 件) / 変更 7 ファイルの ESLint 新規エラー 0（OneDaySchedule.tsx の `react-refresh/only-export-components` は git stash baseline で line 51→53 shift のみと確認、本変更で発生せず）/ session-verifier 全 6 ゲート PASS

#### 残課題

- **Desktop パッケージ版の更新**: Rust 側 `routine_repository::soft_delete` の振る舞いが変わったため、`/Applications/Life Editor.app` を `cargo tauri build` の出力で置換しないと旧 binary は依然として物理 DELETE する。session-verifier 完了済みなのでビルド/置換は次セッションで実施
- **手動 UI 検証**:
  - **症状 A**: Desktop で routine 削除 → 全日付 Calendar / DayFlow から即座に消える / iOS と sync しても再出現しない（D1 / Cloud Sync が `is_deleted=1 + version+1` を伝播するか）
  - **症状 B**: DayFlow TimeGrid で routine bar をドラッグ → "Apply to routine" → 別日付に移動して時刻反映確認 → 元日付に戻って Undo → **全日付**で元の時刻に戻る / Redo で再適用される
- **既存 DB の "Untitled routine" 行**: 旧仕様で生成された Untitled routine は手動で trash 送り必要（生成経路は塞いだだけで、既存データには触れない）
- **アンステージ変更の取り扱い**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/*.tsx` / `Schedule/CalendarTagsPanel.tsx` 他 ~17 ファイルが working tree に残存。本コミットは Routine bug fix 関連 9 ファイル + .claude/ のみに絞る
