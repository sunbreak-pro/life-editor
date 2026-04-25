# HISTORY.md - 変更履歴

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

---

### 2026-04-25 - Calendar Events パネル UX 修正 + DayCell Routine アイコン整理

#### 概要

ユーザー報告 3 件の Calendar UI バグ・UX 改善を 1 セッションで対応。(1) Events アイテムクリック時の `ScheduleItemPreviewPopup` で「終日」トグルを切り替えるたびパネルが閉じる問題を修正。(2) 終日 OFF 後の時間変更が反映されないように見える根本原因が `TimeDropdown` のポータル経由クリックで親 `BasePreviewPopup` の `useClickOutside` が誤発火する仕様だったため、ポータル側で native mousedown を `stopPropagation()`。(3) DayCell 右上の Routine (Repeat) アイコンボタンを撤去し、`+` ボタンの "Routine" メニューから既存の `RoutineManagementOverlay` を直接開く形に再配線（旧仕様: `createRoutine("Untitled routine")` で無条件作成された routine が全カレンダーセルに散らばっていた）。実装計画書を伴わない小規模 UX 修正、session-verifier 全 6 ゲート PASS。

#### 変更点

- **Issue #1 — Events パネル閉鎖防止** — `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx::onUpdateAllDay` から `setScheduleItemPreview(null)` を撤去 (line 866-869)。`updateScheduleItem(scheduleItemPreview.item.id, { isAllDay })` の optimistic update が `monthlyScheduleItems` を更新 → `liveScheduleItem` が新 item を解決 → `<ScheduleItemPreviewPopup>` が re-render するだけで、トグル後もパネルは開いたまま。後続の time picker 表示確認が同セッション内で可能になる
- **Issue #2 — TimeDropdown ポータルでのクリックアウト誤発火回避** — `frontend/src/components/shared/TimeDropdown.tsx` のドロップダウン (`createPortal(<div ref={dropdownRef}>...</div>, document.body)`) は React tree 上は親 popup 配下だが DOM tree 上は body 直下のため、`BasePreviewPopup::useClickOutside` (document mousedown listener + `ref.current.contains(target)` 判定) が portal 内クリックを「外」と誤判定して親パネルを閉じていた。`isOpen=true` 時のみ `dropdownRef.current` に native `addEventListener("mousedown", e => e.stopPropagation())` を仕込む `useEffect` を追加し、cleanup で `removeEventListener`。document までバブルしないため click-outside listener 自体が発火しない。WHY コメント (4 行) を添付し portal の React-tree vs DOM-tree 乖離を明記
- **Issue #3 — DayCell Routine アイコン削除 + `+` メニューから RoutineManagementOverlay へ再配線**:
  - `frontend/src/components/Tasks/Schedule/Calendar/DayCell.tsx`: `Repeat` import / `onOpenRoutineManagement?: () => void` prop / セル右上の Routine ボタン (`<button title="Routine"><Repeat size={12} /></button>`) を撤去。残るのは `+` ボタンと day number と routineCompletion バー
  - `frontend/src/components/Tasks/Schedule/Calendar/MonthlyView.tsx`: `onOpenRoutineManagement` prop と DayCell への pass-through を削除（DayCell が必要としないため）
  - `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx`: `useScheduleContext()` の destructure から未使用化した `createRoutine` を削除 / `<MonthlyView>` への `onOpenRoutineManagement` 渡しを削除 / `<CreateItemPopover onSelectRoutine={...}>` を `createRoutine("Untitled routine")` 直接呼びから `onOpenRoutineManagement?.()` 起動に変更。`onOpenRoutineManagement` 未提供時は三項で `undefined` を渡し、`CreateItemPopover.BASE_ITEMS.filter(({ key }) => handlers[key] !== undefined)` の既存仕様で "Routine" 項目自体が非表示になる一貫性を保つ
- **Verification**: `cd frontend && npx tsc -b` 0 error / `npx vitest run` 35 files / 283 tests / 0 failed / 変更 4 ファイルの ESLint 新規エラー 0（TimeDropdown line 138 の `react-hooks/refs "Cannot access refs during render"` は私の変更前から既存、`git stash` で baseline を確認: 旧 line 125 で同一エラー） / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: Calendar Events 終日トグル → 連続的にトグル ON/OFF してもパネルが閉じない / 終日 OFF 後に start/end TimeDropdown を選択してもパネルが閉じず時刻が反映される / DayCell の `+` ボタン → "Routine" → `RoutineManagementOverlay` が開く
- **既存の "Untitled routine" 行**: 旧仕様で DB に既に作成された Untitled routine 行は手動で trash へ送る必要あり（生成経路は塞いだだけで、既存データには触れない）
- **アンステージ変更の取り扱い**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Schedule/CalendarTagsPanel.tsx` 他 ~17 ファイルが working tree に残存。本コミットは Calendar UX 関連 4 ファイル + .claude/ のみに絞る

---

### 2026-04-25 - Cmd+K コマンドパレット統合（セクション動的アイテム + Sidebar Links + UI 拡大）

#### 概要

ユーザー要件「現在の検索フィールドや Component / hooks を Cmd+K で開くコマンドパレットと統合したい」に対する実装。要件は (1) 必ず表示するのは 6 セクション + 追加した Sidebar リンクアイテム、(2) 各セクションを開いているものに応じた動的アイテムを上乗せ、(3) パネルを大きく中央寄りに、(4) RightSidebar の検索フィールドは削除しアイコンのみ残す、の 4 点。事前確認（Q1: 既存コマンド「そのまま残す」/ Q2: 一気に全 6 セクション対応 / Q3: 680px×480px×pt-12vh で OK / Q4: 検索アイコンを Cmd+K トリガに変更）に基づき、UI 拡大 → Sidebar Links 注入 → セクション別動的コマンド hook 新設 → 10 箇所の `<SearchBar>` を `<SearchTrigger>` に置換 の 4 段階で実装。`tsc -b` 0 error / vitest 283/283 pass / `npm run build` 成功。本実装は実装計画書を伴わず、事前 Q&A での合意ベースで進行。

#### 変更点

- **CommandPalette UI 拡大** — `frontend/src/components/CommandPalette/CommandPalette.tsx` のパネル `max-w-[520px]` → `max-w-[680px]` (約 +30% 幅)、コマンドリスト `max-h-[320px]` → `max-h-[480px]` (約 +50% 高)、起動位置 `pt-[15vh]` → `pt-[12vh]` で中央寄り。検索 input / カテゴリ見出し / アイテム配色等は既存維持。

- **Sidebar Links を Links カテゴリに動的注入** — `frontend/src/hooks/useAppCommands.ts` で `useSidebarLinksContext()` を購読し、`!isDeleted` リンクを Navigation 直後（Settings deep links より前）に挿入: `id: \`sidebar-link-${link.id}\``/`title: link.emoji ? "{emoji} {name}" : link.name`/`category: "Links"`/`icon: link.kind === "app" ? AppWindow : LinkIcon`/`action: () => void openLink(link)`。`useMemo`の deps に`sidebarLinks, openLink` を追加。既存 6 セクション (Schedule/Materials/Connect/Work/Analytics/Settings) + Settings deep links 8 件 + Task / Timer / View commands は要件通りそのまま残置。

- **セクション別動的アイテム hook を新設** — `frontend/src/hooks/useSectionCommands.ts` 新規。`{ activeSection, scheduleTab, setActiveSection, setScheduleTab, setSelectedTaskId, setSelectedNoteId, setDailyDate }` を引数に取り、`useTaskTreeContext().nodes` / `useDailyContext().dailies` / `useNoteContext().notes` / `useScheduleContext().routines + scheduleItems` を集約して動的 Command[] を返す。`MAX_ITEMS_PER_GROUP = 30`。**Schedule + tasks**: `nodes.filter(task && !isDeleted && scheduledAt).sort(scheduledAt desc).slice(0, 30)` で `category: "Schedule · Tasks"` / icon: CheckSquare / action: section=schedule + tab=tasks + selectedTaskId をセット。**Schedule + events**: `scheduleItems.filter(!routineId).sort(date desc)` で `category: "Schedule · Events"` / icon: CalendarClock / action: section=schedule + tab=events。**Schedule + calendar/dayflow**: routines + non-routine events + scheduled tasks の合算（各最大 30、`category: "Schedule · Calendar"`）。**Materials**: `notes.filter(!isDeleted).sort(updatedAt desc)` を `category: "Materials · Notes"` / icon: StickyNote / action: `localStorage.MATERIALS_TAB="notes"` + section=materials + setSelectedNoteId、`dailies.filter(!isDeleted).sort(date desc)` を `category: "Materials · Daily"` / icon: BookOpen / action: `localStorage.MATERIALS_TAB="daily"` + section=materials + `setDailyDate(d.date)`（DailyContext の `setSelectedDate` は `string` を取るため `dateKey` をそのまま渡す）。Connect / Work / Analytics / Settings は今回パスし既存ナビ + Settings deep links + Sidebar Links に集約。

- **App.tsx で baseCommands と sectionCommands を統合** — `frontend/src/App.tsx` で `useAppCommands(...)` を `baseCommands` に rename、`useSectionCommands({ activeSection, scheduleTab, setActiveSection, setScheduleTab, setSelectedTaskId, setSelectedNoteId, setDailyDate })` を呼び `const commands = [...sectionCommands, ...baseCommands]` で結合。動的セクション群を上に置くため、Cmd+K 直後にコンテキスト依存のアイテムが先頭表示される。

- **RightSidebar の検索フィールドを Cmd+K トリガに置換** — 新規 `frontend/src/components/shared/SearchTrigger.tsx`: Search アイコン (lucide-react) + tooltip / aria-label に `commandPalette.openSearch` (fallback "Search (⌘K)") を持つ 28px のボタン。クリックで `window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))` のみ実行。新規 `frontend/src/constants/events.ts::OPEN_COMMAND_PALETTE_EVENT = "life-editor:open-command-palette"`。`App.tsx` に `useEffect(() => { const handler = () => setIsCommandPaletteOpen(true); window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handler); return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handler); }, [])` を追加。

- **10 箇所の `<SearchBar>` 置換 + dead code 整理** — `<SearchBar value={searchQuery} onChange={setSearchQuery} ... />` を `<SearchTrigger className="px-3 pt-2 pb-1" />` に置換した上で、対応する dead code を削除:
  - `frontend/src/components/Schedule/ScheduleSidebarContent.tsx`: SearchBar 1 箇所 → SearchTrigger。Props `searchQuery` / `onSearchQueryChange` / `searchPlaceholder` / `searchSuggestions` / `onSearchSuggestionSelect` を削除し `showSearchTrigger?: boolean` 1 つに集約
  - `frontend/src/components/Schedule/ScheduleSection.tsx`: `sidebarSearchQuery` state / `setSidebarSearchQuery` / `searchPlaceholder useMemo` / `searchSuggestions useMemo (~100 行)` / `handleSearchSuggestionSelect useCallback` を全削除。`<ScheduleSidebarContent showSearchTrigger>` に変更、子の `CalendarView` には `searchQuery=""` 固定、`ScheduleTasksContent` / `ScheduleEventsContent` には `sidebarSearchQuery=""` 固定（中身の filter は no-op になり実質的に Cmd+K に集約）。`SearchSuggestion` import も削除
  - `frontend/src/components/Ideas/DailySidebar.tsx`: SearchBar 2 箇所（searching / default 分岐）→ SearchTrigger。`setSearchQuery` を destructure 落とし、`suggestions useMemo` + `handleSuggestionSelect useCallback` 削除、`useCallback` / `SearchSuggestion` import も削除
  - `frontend/src/components/Ideas/MaterialsSidebar.tsx`: SearchBar 2 箇所 → SearchTrigger。同パターンで `setSearchQuery` 落とし + `suggestions` + `handleSuggestionSelect` 削除 + 関連 import 整理
  - `frontend/src/components/Ideas/Connect/ConnectSidebar.tsx`: SearchBar 1 箇所 → SearchTrigger。Props `onQueryChange` (interface には残置、destructure から除外) + `suggestions useMemo` + `handleSuggestionSelect useCallback` 削除
  - `frontend/src/components/Ideas/Connect/Paper/PaperSidebar.tsx`: SearchBar 2 箇所 → SearchTrigger。同パターン
  - `frontend/src/components/Work/WorkMusicContent.tsx`: SearchBar 1 箇所（`rightAction={SortDropdown}` 持ち）→ `<div className="flex items-center gap-2">` で `<SearchTrigger />` + spacer + `<SortDropdown />` の横並び再構成。`searchQuery` state 全削除（filter / soundSuggestions useMemo の dead code 一掃）+ `handleSuggestionSelect` 削除 + `SearchSuggestion` import 削除
  - `frontend/src/components/Settings/Settings.tsx`: SearchBar 2 箇所 (trash 検索 / 一般 sidebar 検索) → SearchTrigger。`searchQuery` state / `setTrashSearchQuery` を destructure 落とし。`useSettingsSearch` 呼び出し / `settingsNavigators useMemo` / `handleSettingsSearchSelect useCallback` を削除し import からも `useSettingsSearch` / `useMemo` を撤去（Cmd+K の Settings deep links 8 件で代替）
- **検証**: `cd frontend && npx tsc --noEmit` Exit 0 / `cd frontend && npm run test -- --run` 35 test files / 283 tests / 0 failures / `cd frontend && npm run build` Exit 0 (`tsc -b && vite build`)。session-verifier は本セッションでは未実行（次のセッションで走らせる）

#### 残課題

- **手動 UI 検証**: Cmd+K で 6 セクション + Sidebar Links + Schedule タブ別動的アイテム + Materials の最近のノート / Daily が表示・遷移できるか / RightSidebar の Search アイコンクリックでパレットが開くか / 拡大したパネルサイズ・位置の見栄えを確認
- **Connect / Work / Analytics / Settings の動的アイテム**: 今回は基本ナビ + Settings deep links のみで、各セクション固有の動的アイテム (Tags / Boards / Pomodoro presets 等) は未対応。要望が出たら `useSectionCommands` の switch を拡張
- **Routine Tag → Group 移行との並行**: 同セッションタイミングで別の作業者が Routine Tag→Group 移行（V69 + D1 0007）を進めており、その変更が working tree に未コミット状態で残っている。本コミットは Cmd+K 関連 14 ファイルに絞り、Routine 関連の 30+ ファイル変更には触らない

---

### 2026-04-25 - Routine Tag 廃止 + Group 中心の再設計（V69 + D1 0007）

#### 概要

Routine の Tag 機能（`routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments`）を完全廃止し、Routine ↔ RoutineGroup を直接 junction で結ぶ新モデルに移行。Routine の `frequencyType` に `"group"` を追加し、`group` を選んだ Routine は所属 Group の frequency 設定（daily / weekdays / interval）を OR で継承する。EditRoutineDialog で frequency=group を選択時、既存 Group 多重選択 + その場で新規 Group 作成（name + color + frequency 全部入力）を inline で行えるように実装。Backend / Cloud Sync / UI / i18n / テストを 8 Phase で完了。計画書 `.claude/2026-04-25-routine-group-migration.md` を archive 移動。

#### 変更点

- **Phase 1 — DB Migration V69 / D1 0007**:
  - `src-tauri/src/db/migrations/v61_plus.rs` に V69 ブロック追加: `DROP TABLE IF EXISTS routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments` + `CREATE TABLE routine_group_assignments(id PK / routine_id FK CASCADE / group_id FK CASCADE / created_at / updated_at NOT NULL / is_deleted / deleted_at, UNIQUE(routine_id, group_id))` + 3 INDEX (`idx_rga_routine` / `idx_rga_group` / `idx_rga_updated_at`)。CalendarTag V65 と同じ pattern（id PK + own updated_at + soft-delete）。
  - `src-tauri/src/db/migrations/mod.rs::LATEST_USER_VERSION` を 68 → 69 に更新、orphan list に `routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments` を追加、`v69_drops_routine_tag_tables_and_creates_group_assignments` + `v69_upgrade_path_drops_seeded_routine_tag_data` の 2 統合テスト追加。
  - `cloud/db/migrations/0007_drop_routine_tags_add_group_assignments.sql` 新規 — D1 側 mirror、`server_updated_at` 列付き + 4 INDEX。Apply 順序: migration FIRST → Worker deploy SECOND。
- **Phase 2 — Backend DB Layer**:
  - 削除: `src-tauri/src/db/routine_tag_repository.rs` 全廃。
  - 修正: `src-tauri/src/db/routine_group_repository.rs` から `fetch_all_tag_assignments` / `set_tags_for_group` 削除。
  - 新規: `src-tauri/src/db/routine_group_assignment_repository.rs` — `fetch_all` (`is_deleted=0` のみ返却) / `set_groups_for_routine(conn, routine_id, group_ids[])` (差分 upsert + soft-delete 復活 + parent routine の version+1 / updated_at bump) を `helpers::now()` + `new_uuid()` で実装。CalendarTag pattern 踏襲。
  - `src-tauri/src/db/mod.rs` の mod 宣言を入れ替え。
- **Phase 3 — Backend Commands & lib.rs**:
  - 削除: `src-tauri/src/commands/routine_tag_commands.rs` 全廃。
  - 修正: `src-tauri/src/commands/routine_group_commands.rs` から `db_routine_groups_fetch_all_tag_assignments` / `db_routine_groups_set_tags_for_group` 削除。
  - 新規: `src-tauri/src/commands/routine_group_assignment_commands.rs` — `db_routine_group_assignments_fetch_all` + `db_routine_group_assignments_set_for_routine(routine_id, group_ids)`。
  - `src-tauri/src/commands/mod.rs` mod 宣言入れ替え + `src-tauri/src/lib.rs::generate_handler!` から routine*tag*_ 6 個 + routine*groups の tag 関連 2 個を削除、新規 routine_group_assignment*_ 2 個を追加（IPC 4 点同期完了）。
- **Phase 4 — Cloud Sync 同期対象更新**:
  - `src-tauri/src/sync/types.rs::SyncPayload` から `routine_tag_assignments` / `routine_group_tag_assignments` / `routine_tag_definitions` フィールド削除、`routine_group_assignments: Vec<Value>` 追加。
  - `src-tauri/src/sync/sync_engine.rs` の delta query / collect_all / apply 各箇所から旧 3 テーブルを削除し `routine_group_assignments` を CalendarTag と同じく自己 `updated_at` ベースの delta query で扱う。`ROUTINE_GROUP_ASSIGNMENTS_TABLE` const + `insert_or_replace` 経由で apply。
  - `cloud/src/config/syncTables.ts` の `RELATION_TABLES_WITH_UPDATED_AT` に `routine_group_assignments` 追加、`RELATION_TABLES_NO_UPDATED_AT` から旧 3 テーブルを削除し `calendar_tag_definitions` のみ残す。`RELATION_PK_COLS` に `routine_group_assignments: ["id"]` 追加。`RELATION_PARENT_JOINS` を空配列化（routine*tag*\* 廃止に伴い parent-join 経路自体が不要に）。`TAG_DEFINITION_TABLES` から `routine_tag_definitions` 削除。
- **Phase 5-6 — Types / Service**:
  - 削除: `frontend/src/types/routineTag.ts` 全廃。
  - `frontend/src/types/routine.ts::FrequencyType` に `"group"` 追加、`RoutineNode` に `groupIds?: string[]` フィールド追加（DB 上は junction、frontend 上は導出フィールド）。
  - `frontend/src/types/routineGroup.ts` から `RoutineGroupTagAssignment` 削除、`RoutineGroupAssignment` interface 新設（id / routineId / groupId / createdAt / updatedAt / isDeleted / deletedAt）。
  - `frontend/src/services/DataService.ts` interface から `fetchRoutineTags` / `createRoutineTag` / `updateRoutineTag` / `deleteRoutineTag` / `fetchAllRoutineTagAssignments` / `setTagsForRoutine` / `fetchAllRoutineGroupTagAssignments` / `setTagsForRoutineGroup` の 8 メソッド削除、`fetchAllRoutineGroupAssignments() / setGroupsForRoutine(routineId, groupIds)` の 2 メソッド追加。
  - `frontend/src/services/TauriDataService.ts` を同シグネチャに更新（invoke ブリッジ）。
- **Phase 7 — Hook / Context**:
  - 削除: `frontend/src/hooks/useRoutineTags.ts` / `useRoutineTagAssignments.ts` / `useRoutineGroupTagAssignments.ts` の 3 hook 全廃。
  - 新規: `frontend/src/hooks/useRoutineGroupAssignments.ts` — `Map<routineId, groupId[]>` 管理 + `setGroupsForRoutine` (optimistic update + UndoRedo + DataService 永続化) + `getGroupIdsForRoutine` / `getRoutineIdsForGroup` / `removeRoutineAssignments`。初期ロード中の書き込みガード + cancelled flag による async cleanup。
  - `frontend/src/hooks/useRoutineGroupComputed.ts` を `routineGroupAssignments: Map<string, string[]>` を直接消費する形に書き換え（旧: tag set intersection → 新: 直接メンバーシップ参照）。
  - `frontend/src/context/RoutineContextValue.ts` / `RoutineContext.tsx` の Provider 構成を新 hook で組み直し、`deleteRoutine` のラッパー（undo で prevGroupIds を復元）も新 API に追従。
  - `frontend/src/utils/routineScheduleSync.ts::shouldCreateRoutineItem` を新セマンティクス（`frequencyType==="group"` 時に Group 群の frequency を OR 評価、Group 未割当なら fire しない / それ以外は routine 自体の frequency を使い group は無視）に書き換え + `tagAssignments` 引数を全シグネチャから除去。`useScheduleItemsRoutineSync.ts` 全 callsite を追従。
- **Phase 8 — UI**:
  - 削除: `frontend/src/components/Tasks/Schedule/Routine/{RoutineTagManager, RoutineTagEditPopover, RoutineTagSelector, RoutineGroupTagPicker}.tsx` 4 ファイル全廃。
  - `FrequencySelector.tsx` のタイプ切替ボタンに `"group"` を追加（`flex-wrap` で折り返し対応）。
  - `RoutineEditDialog.tsx` を全面書き換え: `tags` / `initialTagIds` / `onCreateTag` props を撤去し、`routineGroups` / `initialGroupIds` / `onCreateGroup` を受け取る形に変更。`frequencyType==="group"` 選択時に inline サブパネルが展開され、(a) 既存 Group をピル UI で多重選択 / (b) 「+ 新規 Group 作成」で同 Dialog 内に Group 作成フォーム（name / color picker / frequency selector）が展開され、作成成功時に自動選択。"group" の Routine 保存時は frequencyDays/Interval/StartDate を null/[] で永続化。
  - `RoutineGroupEditDialog.tsx` から tag picker 完全撤去、メンバー一覧は `memberRoutines` prop からのみ取得（旧: 選択 tag からの動的計算は廃止）。Group 自体の `frequencyType` が `"group"` を取らないよう coerce。
  - `RoutineManagementOverlay.tsx` から「Tag 管理」ボタン + RoutineTagManager + tag 関連 props 全撤去、Routine 行の tag chips を group chips に置換、`onCreateRoutineGroup` を inline 引数で受け取り `onCreateGroup` callback として RoutineEditDialog に渡す。
  - `Schedule/ScheduleSidebarContent.tsx` / `Schedule/ScheduleItemEditPopup.tsx` / `Tasks/Schedule/Calendar/CalendarView.tsx` / `Tasks/Schedule/DayFlow/{OneDaySchedule, CompactDateNav, DualDayFlowLayout}.tsx` / `hooks/useDayFlowColumn.ts` / `context/ScheduleItemsContext.tsx` の 8 ファイルから `routineTags` / `tagAssignments` / `setTagsForRoutine` / `createRoutineTag` 等の参照を一掃し、`routineGroupAssignments` / `setGroupsForRoutine` / `createRoutineGroup` を新 API として接続。filter UI も tag chips → group chips 一本化。
- **Phase 9-11 — i18n / Tests / 検証**:
  - `frontend/src/i18n/locales/en.json` / `ja.json` から `schedule.routineTag` / `noTaggedRoutines` / `manageTags` / `createTag` / `tagName` / `deleteTagConfirm` / `routineGroup.assignedTags` / `routineGroup.noTags` / `routineGroup.frequencyOverrideWarning` 等の tag 関連キーを削除し、`schedule.frequencyGroup` / `routineGroup.assignToGroup` / `routineGroup.createNew` / `routineGroup.noGroupsHint` / `routineGroup.untitled` / `routineGroup.create` を ja+en に追加。
  - `frontend/src/hooks/useRoutineGroupComputed.test.ts` を新 API（`routineGroupAssignments: Map<string, string[]>`）に追従、6 ケース更新。
  - 新規: `frontend/src/utils/routineScheduleSync.test.ts` — `shouldCreateRoutineItem` の V69 group セマンティクスに対する 7 ケース（daily / weekdays が group 影響受けない / group OR / no groups で fire しない / hidden group skip / archived 不発火 / interval が group 無視）。
- **Verification**: `cd src-tauri && cargo test --lib` 23 passed (`v69_*` 2 件含む) / `cd frontend && npx vitest run` 283 passed (新規 routineScheduleSync.test.ts 7 + 既存 276) / `tsc -b` (frontend) は私の変更ファイルで 0 error / `npx tsc --noEmit` (cloud) clean / `cargo check` clean / 変更ファイル ESLint 0 error。session-verifier 全 6 ゲート PASS。
- **計画書 archive**: `.claude/2026-04-25-routine-group-migration.md` の Status を `COMPLETED` に更新後、`.claude/archive/` へ移動。
- **コミット範囲分離**: ユーザーの並行作業（CommandPalette / SearchTrigger / Sidebar 検索 refactor 関連の TS6133 / TS2304 が `App.tsx` / `ScheduleSection.tsx` / `Settings.tsx` / `*Sidebar.tsx` 等に残存）は本セッション範囲外のため未ステージ。本コミットは Routine Tag→Group 移行の 41 ファイル + plan archive に限定。

#### 残課題

- **D1 migration 0007 適用 + Worker deploy**: `cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0007_drop_routine_tags_add_group_assignments.sql` → `npm run deploy` の順序で本番反映（逆順だと旧 schema に新 Worker が当たり 500）。
- **手動 UI 検証**: Desktop で V69 自動 apply 確認（`PRAGMA user_version` = 69 / `routine_tag_*` テーブル消失 / `routine_group_assignments` 新設）→ 既存 Routine が表示される（Tag UI 消失）→ frequencyType=Group 選択 + 既存 Group 多重選択保存でカレンダーに正しく出現 → 「+ 新規 Group 作成」flow で inline 作成 + 自動選択 → Cloud Sync で iOS と双方向に伝搬。
- **ユーザー並行作業の TS エラー解消**: 別コミットで対応（CommandPalette / SearchTrigger / SectionCommands 関連の `sidebarSearchQuery` undefined / 未使用変数）。

---

### 2026-04-25 - Materials/iOS Notes アイテム名表示クリーンアップ

#### 概要

ユーザー報告 2 件の単発バグ修正。(1) Desktop Materials 右サイドバーで、ノートのアイテム名が「タイトル名」と「本文中の最初の見出し」の混在表示になっていた → 常に title を使う形に統一。(2) iOS Notes リストで Tag 名のピルや Pin (Heart) アイコンがタイトル名を圧迫していた → Pin を Note アイコン位置に移動 (Desktop と同パターン)、Tag ピルを撤去して `+N` バッジのみ残しタイトルとの隣接を回避、Lock アイコンは右端に再配置、Favorites セクションの本文プレビュー (24 文字) を撤去。実装計画書を伴わない小規模 UI 修正、検証は session-verifier 全 6 ゲート PASS。

#### 変更点

- **Desktop `frontend/src/components/Ideas/NoteTreeNode.tsx`** — タイトル span 内の `(node.type !== "folder" && extractFirstHeading(node.content)) || node.title || "Untitled"` を `node.title || "Untitled"` に簡略化 (本文先頭見出しのフォールバックを撤去)。未使用となった `extractFirstHeading` import を削除。`utils/tiptapText.ts::extractFirstHeading` の export 自体は test 利用があるため残置 (production 参照は 0)
- **iOS `frontend/src/components/Mobile/materials/MobileNoteTreeItem.tsx` 全面再構成** — Note/Folder アイコン部 (`isFolder ? Folder : StickyNote`) を `isFolder ? Folder : isPinned ? Heart : StickyNote` の三項に変更し Pin (Heart) を icon position に移動 (Desktop の `NoteTreeNode.tsx` と同パターン) / 旧 visibleTags (最大 2 件) のピルレンダリング `tags.slice(0, 2).map(...)` を撤去し、`tagCount = wikiCtx?.getTagsForEntity(node.id).length ?? 0` を計算して `+{tagCount}` バッジ 1 つのみタイトル後ろに表示 / Lock アイコンを右端に再配置 (renderExtra 自体を削除したため実質 li 末尾) / `renderExtra?: (node) => ReactNode` prop と `{renderExtra?.(node)}` 呼び出しを撤去
- **`frontend/src/components/Mobile/materials/MobileNoteTree.tsx`** — `renderExtra` prop を Props インターフェースから削除 + 子 `MobileNoteTreeItem` および再帰 `MobileNoteTree` への伝播を撤去
- **`frontend/src/components/Mobile/MobileNoteView.tsx`** — Favorites セクション (`pinnedNotes.map`) で `MobileNoteTreeItem` に渡していた `renderExtra={() => <span>{extractPlainText(note.content).slice(0, 24)}</span>}` を完全削除 / 同ファイル内 private 関数 `extractPlainText(content: string): string` (try parse JSON → block.content[].text join → slice 120) を不要になったため削除
- **検証**: tsc -b 0 error / vitest 268/268 pass / 自セッション 4 ファイルの ESLint 0 error。残 4 件の lint error はすべて `NoteTreeNode.tsx:293` の既存 `iconRef.current?.getBoundingClientRect()` (IconPicker anchorRect 用、react-hooks/refs `Cannot access refs during render`) で MEMORY.md「Frontend 既存 lint 116 問題の一括解消」既知 finding。session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: iOS シミュレータ / Tauri build で Materials サイドバーと Mobile Notes リストの表示を目視確認 (アイコン位置・タグバッジ・Lock 配置・タイトル切り取り挙動)
- **アンステージ変更の取り扱い**: 別セッション由来の `Layout/SidebarLinkAddDialog.tsx` / `Layout/SidebarLinkItem.tsx` / `Layout/lucideIconRegistry.ts` (新規) が working tree に残存。本セッションでは触らず (Q2 Phase D の続きと推測)、別 commit で扱う想定
