# Code Inventory — Life Editor

> 2026-04-25 作成。Frontend / Rust Backend / Cloud の **アクティブ / 凍結 / 重複 / 削除候補** を棚卸し。リファクタリング計画 → [`.claude/2026-04-25-refactoring-plan.md`](../2026-04-25-refactoring-plan.md)

---

## 0. サマリ

| 領域          | ファイル数 | 総行数  | 最大ファイル                          | 備考                        |
| ------------- | ---------- | ------- | ------------------------------------- | --------------------------- |
| Frontend (TS) | 603        | ~89,015 | `services/TauriDataService.ts` (1453) | 19 file >500 行             |
| Rust Backend  | 80         | ~13,817 | `db/migrations.rs` (2328)             | V1-V64 単一ファイル         |
| Cloud (CF)    | 4          | ~459    | `routes/sync.ts` (459)                | 単一ファイル責務集中        |
| @deprecated   | 4 件       | -       | -                                     | 全て解析済み (§4)           |
| Active Issue  | 0 件       | -       | -                                     | Monitoring 1 (006), Fixed 8 |

---

## 1. Active（必要・現役）

### 1.1 Frontend エントリ + Provider 階層

| File                         | 行数 | 役割                                               |
| ---------------------------- | ---- | -------------------------------------------------- |
| `frontend/src/main.tsx`      | 97   | Provider tree (Desktop 17 + Mobile 11)。共通化対象 |
| `frontend/src/App.tsx`       | 254  | Desktop entry。SectionId 切替                      |
| `frontend/src/MobileApp.tsx` | 257  | Mobile entry。Optional Provider 経由               |

### 1.2 Tier 1 コア機能（CLAUDE.md §8）

| 機能              | Frontend 主要 path                                    | Backend repository                               |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Tasks (TaskTree)  | `components/Tasks/` + `hooks/useTask*.ts`             | `task_repository.rs`                             |
| Schedule          | `components/Schedule/` + `components/Tasks/Schedule/` | `schedule_item_repository.rs`                    |
| Notes             | `components/Notes/` + `extensions/`                   | `note_repository.rs` + `note_link_repository.rs` |
| Daily             | `components/Daily*` + `hooks/useDaily.ts`             | `daily_repository.rs`                            |
| Database (汎用)   | `components/Database/`                                | `database_repository.rs`                         |
| MCP Server        | `mcp-server/` (今回スコープ外)                        | -                                                |
| Cloud Sync        | `context/SyncContext.tsx`                             | `sync/sync_engine.rs`                            |
| Terminal + Claude | `components/Terminal/`                                | `terminal/pty_manager.rs`                        |

### 1.3 Tier 2 補助機能

`components/{Materials,WikiTags,Settings,Trash,CommandPalette,common}/` + 対応 Provider/hook。全て参照あり、Active。

### 1.4 共有基盤

- `components/shared/` — UI 共有（`UndoRedo/`, `RichTextEditor.tsx` 607 行 含む）
- `components/Tasks/Schedule/shared/` — Schedule 内 Calendar/DayFlow/Routine 共通
- `services/{DataService.ts, TauriDataService.ts, dataServiceFactory.ts}` — IPC 抽象化
- `utils/undoRedo/` — UndoRedo
- `context/index.ts` — 17 Provider 集約

### 1.5 Rust commands（37 ファイル）

`src-tauri/src/commands/*` — 全て `lib.rs::generate_handler!` に登録済（150+ コマンド）。**未登録・未使用ファイルなし**。

### 1.6 Rust db repository（27 ファイル）

`src-tauri/src/db/*_repository.rs` — テーブルごとに 1 ファイル。全て active。

---

## 2. Frozen（凍結だが現役コード）

> CLAUDE.md §8 で Tier 3 「凍結」とラベルされているが、UI から到達可能で削除はリスク高。整理対象であり削除対象ではない。

| 機能            | 主要 path                                                                                            | 行数  | 状態                                     |
| --------------- | ---------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------- |
| Paper Boards    | `components/Ideas/Connect/Paper/{PaperCanvasView,PaperSidebar}.tsx` + `hooks/usePaperBoard.ts` (725) | 1436+ | `ConnectView.tsx` から参照、UI 到達可    |
| Analytics       | `components/Analytics/` + `utils/analyticsAggregation.ts` (879)                                      | 1500+ | `App.tsx` SectionId=`analytics` から参照 |
| Cognitive       | （該当 hook なし、grep 0 件）                                                                        | -     | 未着手 / 残骸なし                        |
| NotebookLM      | （該当 hook なし、grep 0 件）                                                                        | -     | 未着手 / 残骸なし                        |
| Google Calendar | （ICS 検討中、未実装）                                                                               | -     | 未着手                                   |
| Google Drive    | （MCP 代替で未実装）                                                                                 | -     | 未着手                                   |

**判断**: Cognitive / NotebookLM / Google 系は未着手で残骸ゼロ。Paper Boards / Analytics は機能凍結だが UI から消すと作者の N=1 体験が壊れるため、**archive せず維持**。ただし `components/Analytics/` の depth と `usePaperBoard.ts` 725 行は Phase 3 で簡素化候補。

---

## 3. Duplicate（重複ロジック）

> Frontend agent / Rust agent の指摘ベース。**統合候補** であって削除候補ではない。

### 3.1 日付・時刻 formatter（**当初の見積もりと実態の乖離**）

当初は「重複 18+ 箇所」と推定したが、Phase 0 着手時の精査で **責務の異なる別関数が同名で並存しているだけ** と判明。`formatTime` は **4 種の異なるシグネチャ** で存在する:

| 関数                                | シグネチャ               | 責務                                     |
| ----------------------------------- | ------------------------ | ---------------------------------------- |
| `utils/formatRelativeDate.ts:36`    | `(dateStr): string`      | ISO 文字列 → 24h ローカライズ ("14:30")  |
| `utils/timeGridUtils.ts:4`          | `(hour, minute): string` | 数値ペア → "HH:MM" (Schedule グリッド用) |
| `context/TimerContext.tsx:199`      | `(seconds): string`      | 秒数 → "MM:SS" (Pomodoro)                |
| `ScheduleItemEditPopup.tsx:52` (旧) | `(h, m): string`         | timeGridUtils と完全同一の **真の重複**  |

`formatDateHeading` も同様、`utils/dateKey.ts:44` (`Saturday, April 25, 2026` 形式) と `components/Schedule/EventList.tsx:15` (`2026-04-25 (Sat)` 形式) は **出力フォーマットが完全に異なる別関数**。

**実際の重複**: `ScheduleItemEditPopup.tsx:52::formatTime` の **1 箇所のみ**（Phase 0-2 で `utils/timeGridUtils.ts` に統合済）。残りは責務違いで統合不可。

**教訓**: agent ベースの DRY 違反検出は **シグネチャまで照合しない**と過剰検出する。共通化判断は読み込み必須。

### 3.2 debounce

| File                                         | 概要            |
| -------------------------------------------- | --------------- |
| `frontend/src/hooks/useDebounce.ts`          | 値の debounce   |
| `frontend/src/hooks/useDebouncedCallback.ts` | 関数の debounce |

**判断**: 異なる責務（値 vs 関数）。**統合不要、命名で意図明確化済み**。

### 3.3 row_to_model 変換（Rust）

`src-tauri/src/db/*_repository.rs` 25+ ファイルで `row_to_*` 系の変換コードが個別実装。`row_to_json` は `helpers.rs:80-91` と `sync/sync_engine.rs:177` で**重複定義**。

**統合先**: `db/row_converter.rs` 新設（Phase 2）。

### 3.4 Calendar / Schedule View の Mobile/Desktop 分岐

| Desktop                                                         | Mobile                                              | 共通率                           |
| --------------------------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| `components/Tasks/Schedule/Calendar/CalendarView.tsx` (1175 行) | `components/Mobile/MobileCalendarView.tsx` (823 行) | ~70%                             |
| `components/Schedule/ScheduleSection.tsx` (750 行)              | `components/Mobile/MobileScheduleView.tsx` (489 行) | 推定 60%                         |
| Desktop Work UI (複数 file)                                     | `components/Mobile/MobileWorkView.tsx` (710 行)     | SessionTabs / Timer 部分が共通可 |

**推定**: hook 抽出 + shared component で 1500-2000 行削減可能。Phase 2-3 対象。

### 3.5 Cloud sync.ts の 3 ブロック重複

`cloud/src/routes/sync.ts:317-404` で VERSIONED / RELATION_WITH / RELATION_NO の INSERT + UPDATE stamping SQL が 3 ブロックハードコード。table 名ループ化で 80+ 行削減（Phase 1）。

---

## 4. Suspected Dead / @deprecated

### 4.1 @deprecated マーク（全 4 件）

| File:Line                                             | 内容                                     | 対応                            |
| ----------------------------------------------------- | ---------------------------------------- | ------------------------------- |
| `context/ScheduleContextValue.ts:23`                  | 旧 ScheduleContext 統合型                | 参照 0 確認後削除               |
| `context/index.ts:29`                                 | 上記の re-export                         | 同上                            |
| `components/Tasks/Schedule/DayFlow/GroupFrame.tsx:15` | `onDoubleClick` prop（`onClick` で代替） | 全使用箇所 onClick へ移行後削除 |
| `components/shared/UndoRedo/UndoRedoButtons.tsx:8`    | `domain` prop（`domains` で代替）        | 単一形式へ統一後削除            |

### 4.2 完全な dead code 候補

中粒度の grep 検索範囲では**確定的な dead file は検出されず**。Phase 3 で `knip` か `ts-prune` を一時導入して網羅検出するのが効率的（CLAUDE.md と矛盾しない範囲で）。

### 4.3 注意ファイル（凍結との境界）

- `components/Analytics/` — 凍結扱いだが SectionId=`analytics` から到達。**現役**
- `components/Ideas/Connect/Paper/` — 凍結扱いだが `ConnectView.tsx` から到達。**現役**
- `mocks/taskTree.ts` — テスト用 / 開発用 mock。`tests/` から参照確認推奨

---

## 5. Large File（保守性ホットスポット）

### 5.1 Frontend Top 10（>500 行）

| File                                                             | 行数 | 分割優先度                                     |
| ---------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `services/TauriDataService.ts`                                   | 1453 | **High**: domain ごとに 300-400 行 ×4-5 に分割 |
| `components/Ideas/Connect/TagGraphView.tsx`                      | 1443 | High: layout / interaction / render を分離     |
| `components/Tasks/Schedule/DayFlow/ScheduleTimeGrid.tsx`         | 1220 | **High**: 子コンポーネント抽出 + context 化    |
| `components/Tasks/Schedule/Calendar/CalendarView.tsx`            | 1175 | High: Mobile 共通化と並行で分割                |
| `components/Tasks/Schedule/DayFlow/OneDaySchedule.tsx`           | 1165 | High                                           |
| `components/Tasks/TaskDetail/TaskDetailPanel.tsx`                | 947  | High: 内部 sub-component を独立 file 化        |
| `utils/analyticsAggregation.ts`                                  | 879  | Med: aggregation 種類別に分割                  |
| `components/Mobile/MobileCalendarView.tsx`                       | 823  | High（Calendar 共通化）                        |
| `components/Ideas/Connect/ConnectSidebar.tsx`                    | 770  | Med                                            |
| `components/Tasks/Schedule/Routine/RoutineManagementOverlay.tsx` | 765  | Med                                            |

### 5.2 Rust Top 5

| File                                         | 行数 | 分割優先度                                             |
| -------------------------------------------- | ---- | ------------------------------------------------------ |
| `src-tauri/src/db/migrations.rs`             | 2328 | **High**: V1-V30 / V31-V60 / V61-V64 の 3 ファイル     |
| `src-tauri/src/commands/data_io_commands.rs` | 530  | Med: export / import / reset を分離                    |
| `src-tauri/src/db/paper_board_repository.rs` | 509  | Low（凍結機能）                                        |
| `src-tauri/src/sync/sync_engine.rs`          | 499  | Med: collect_local_changes / apply_remote_changes 分離 |
| `src-tauri/src/commands/files_commands.rs`   | 451  | Low                                                    |

### 5.3 Cloud

| File                       | 行数 | 分割優先度                                                   |
| -------------------------- | ---- | ------------------------------------------------------------ |
| `cloud/src/routes/sync.ts` | 459  | **High**: `routes/versioned.ts` / `routes/relations.ts` 分割 |

---

## 6. Risk Hotspot（MEMORY.md 由来 + 本調査追加）

| Hotspot                                                                | 領域       | 既知 Issue / 出典     |
| ---------------------------------------------------------------------- | ---------- | --------------------- |
| timestamp 形式混在 (helpers::now() vs SQL `datetime('now')`)           | Rust DB    | 013                   |
| 論理キー UNIQUE 欠落 (tasks/dailies/notes/routines)                    | Rust DB    | MEMORY.md §バグの温床 |
| LWW 衝突解決が ID 単独 (`ON CONFLICT(id)`)                             | Rust sync  | MEMORY.md §バグの温床 |
| sync pagination 半実装 (`hasMore` のみ、cursor なし)                   | Rust+Cloud | 012 (未着手)          |
| `tsc --noEmit` at frontend root が無効                                 | Frontend   | feedback memory 済    |
| innerHTML XSS リスク (`utils/tiptapText.ts:18`)                        | Frontend   | **本調査新規**        |
| `format!("...{}...")` で table 名注入箇所 (whitelist 化済だが警告無し) | Rust       | **本調査新規**        |
| Bearer token 比較が timing-safe でない (`cloud/middleware/auth.ts:14`) | Cloud      | **本調査新規**        |
| D1 batch 失敗時のクライアント response 形式未定義                      | Cloud      | **本調査新規**        |
| Provider tree 16 層ネスト (`main.tsx`)                                 | Frontend   | **本調査新規**        |

---

## 7. 機能重複の意図的二重化（残すべきもの）

混乱しやすいが**正当な分離**:

- `components/Schedule/` (top-level) vs `components/Tasks/Schedule/`
  - 前者: 「予定リスト/編集」（EventList / ScheduleSection / EventDetailPanel）
  - 後者: 「Calendar / DayFlow / Routine UI」
  - **判断**: 役割は分離している。ただし命名で混乱するため Phase 3 で `components/Schedule/` を `components/ScheduleList/` などへ rename 検討
- `App.tsx` vs `MobileApp.tsx`
  - 別 entry が必要（Provider tree が異なる、Optional Provider 必須）
  - main.tsx 内の Provider 階層共通化は別タスク
- `useDebounce` vs `useDebouncedCallback`
  - 値 vs 関数、責務違い

---

## 8. Phase 3 で再評価すべき項目

- **Tier 3 凍結機能の archive**: Paper Boards / Analytics の UI 撤去を作者が決断するか
- **`knip` / `ts-prune` 導入**: 本 inventory では grep ベース。網羅性が必要なら導入検討
- **150+ IPC コマンドの typed struct 移行（S-2）**: MEMORY.md §保留 で停滞中

---

## 9. 出典

- Frontend 中粒度 Explore agent (2026-04-25)
- Rust Backend 中粒度 Explore agent (2026-04-25)
- Cloud 中粒度 Explore agent (2026-04-25)
- `.claude/MEMORY.md` §バグの温床
- `.claude/docs/known-issues/INDEX.md`
- `wc -l` / `find` / `grep` 直接スキャン
