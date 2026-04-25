---
Status: COMPLETED
Created: 2026-04-25
Completed: 2026-04-25
Task: MEMORY.md → "Routine Tag廃止 + Group化"
Project: /Users/newlife/dev/apps/life-editor
Verification: cargo test (23 pass) / npm run test (276 pass) / tsc -b clean / cloud tsc clean
---

# Plan: Routine Tag 廃止 + Group 中心の Routine 紐付け再設計

## Context

### 動機

現状の Routine ↔ Tag ↔ Group の三角関係が複雑で、UI 上も Tag が独立した「分類用概念」として残っているが、実態は Group 所属の代理表現になっている。Tag を完全に廃止し、Routine が直接 Group に所属する単純な構造へ再設計する。

### 確定要件

1. **完全廃止**:
   - `routine_tag_definitions`（テーブル + 3 件のデフォルトデータ）
   - `routine_tag_assignments`（Routine ↔ Tag ジャンクション）
   - `routine_group_tag_assignments`（Group ↔ Tag ジャンクション）
   - 関連する型・hook・component・command・i18n キー

2. **追加**:
   - `Routine.frequencyType` に `"group"` を追加（既存: `"daily" | "weekdays" | "interval"`）
   - `routine_group_assignments` テーブル新設（CalendarTag 方式: `id PK / routine_id / group_id / version / updated_at + Cloud Sync 列`）
   - `Routine.groupIds: string[]`（複数 Group 所属可）
   - `frequencyType="group"` の Routine は所属 Group の frequency 設定を継承して実行日を決定
     - **複数 Group 所属時は OR**: いずれかの Group が「今日実行」なら実行
   - `RoutineEditDialog` の frequencyType selector に `"group"` を追加し、選択時に既存 Group 一覧から複数選択 + その場で新規 Group 作成 が可能な UI を追加

3. **温存**:
   - `routine_groups` テーブル（id / name / color / frequency_type / frequency_days / frequency_interval / frequency_start_date など）
   - 既存の Group 単独管理 UI（`RoutineManagementOverlay` 内の Group セクション）

### 制約・前提

- N=1 ユーザー（作者本人）。既存 Tag データは破棄して構わない
- Cloud Sync 対応必須（D1 0007 同時投入）
- Mobile Routine UI には Tag 機能は元々ない or 軽微なため大改修不要
- 既存の `migrations.rs` LATEST_USER_VERSION は 68 → **V69** に上げる

### Non-Goals

- 既存 Tag データの保全・移行（drop でロスト）
- Tag の代替となる新しい分類軸の導入（Group のみ）
- Group の階層化・ネスト

---

## Steps

### Phase 1: DB Migration

- [ ] 1.1 `src-tauri/src/db/migrations/v61_plus.rs` に V69 ブロック追加
  - DROP TABLE: `routine_tag_definitions`, `routine_tag_assignments`, `routine_group_tag_assignments`
  - DROP INDEX: `idx_rta_routine`, `idx_rta_tag`, `idx_rgta_group`, `idx_rgta_tag`
  - CREATE TABLE: `routine_group_assignments(id PK, routine_id, group_id, version, updated_at, server_updated_at, is_deleted, deleted_at)` + UNIQUE(routine_id, group_id)
  - CREATE INDEX: `idx_rga_routine`, `idx_rga_group`
- [ ] 1.2 `src-tauri/src/db/migrations/mod.rs` の `LATEST_USER_VERSION` を 69 に更新
- [ ] 1.3 `src-tauri/src/db/migrations/full_schema.rs` を最新スキーマに合わせて更新（routine_tag 関連 CREATE 削除 + routine_group_assignments CREATE 追加）
- [ ] 1.4 D1 migration `cloud/db/migrations/0007_drop_routine_tags_add_group_assignments.sql` 新規作成
  - DROP routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments
  - CREATE routine_group_assignments（Cloud 側スキーマ）
- [ ] 1.5 動作確認: `sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"` が 69 になり、テーブルが期待通り変化していること

### Phase 2: Backend Rust（DB Layer）

- [ ] 2.1 削除: `src-tauri/src/db/routine_tag_repository.rs` ファイル全体
- [ ] 2.2 `src-tauri/src/db/routine_group_repository.rs` から tag assignment 関連関数を削除（`fetch_all_tag_assignments`, `set_tags_for_group`）
- [ ] 2.3 新規: `src-tauri/src/db/routine_group_assignment_repository.rs`
  - `fetch_all() -> Vec<RoutineGroupAssignment>`
  - `fetch_for_routine(routine_id) -> Vec<RoutineGroupAssignment>`
  - `set_groups_for_routine(routine_id, group_ids: &[String])` （差分 upsert + soft delete + version bump）
  - `delta_query(since: i64) -> Vec<RoutineGroupAssignment>`（Cloud Sync 用）
  - `apply_remote(records: &[RoutineGroupAssignment])`（LWW）
- [ ] 2.4 `src-tauri/src/db/routine_repository.rs` の `RoutineNode` 構造体に `group_ids: Vec<String>` 追加。fetch 時に LEFT JOIN で取得、create/update 時に `set_groups_for_routine` を呼び出す
- [ ] 2.5 `src-tauri/src/db/mod.rs` で新 repository を pub mod

### Phase 3: Backend Rust（Commands）

- [ ] 3.1 削除: `src-tauri/src/commands/routine_tag_commands.rs` ファイル全体
- [ ] 3.2 `src-tauri/src/commands/routine_group_commands.rs` から tag assignment commands 削除（`db_routine_groups_fetch_all_tag_assignments`, `db_routine_groups_set_tags_for_group`）
- [ ] 3.3 新規: `src-tauri/src/commands/routine_group_assignment_commands.rs`
  - `db_routine_group_assignments_fetch_all`
  - `db_routine_group_assignments_set_for_routine(routine_id, group_ids)`
- [ ] 3.4 `src-tauri/src/commands/routine_commands.rs` の create/update に `groupIds` パラメータ追加
- [ ] 3.5 `src-tauri/src/commands/mod.rs` に新 module 登録、削除 module 撤去
- [ ] 3.6 `src-tauri/src/lib.rs` の `generate_handler!` を更新（routine*tag*_ 8 個 削除、routine*group_assignment*_ 2 個 追加）

### Phase 4: Backend Rust（Cloud Sync）

- [ ] 4.1 `src-tauri/src/sync/sync_engine.rs` 修正
  - delta query / collect_all / apply 行から `routine_tag_definitions`, `routine_tag_assignments`, `routine_group_tag_assignments` を削除
  - `routine_group_assignments` を追加（CalendarTag と同様に `RELATION_TABLES_WITH_UPDATED_AT` 扱い）
- [ ] 4.2 `src-tauri/src/sync/types.rs` の SyncPayload / TableName enum を更新
- [ ] 4.3 `cloud/src/` の Cloudflare Worker 側 sync handler が動的にテーブル名を扱う実装か、固定リスト含むか確認 → 必要なら更新

### Phase 5: Frontend Types

- [ ] 5.1 削除: `frontend/src/types/routineTag.ts`
- [ ] 5.2 `frontend/src/types/routine.ts` の `FrequencyType` に `"group"` 追加、`RoutineNode` に `groupIds?: string[]` 追加
- [ ] 5.3 `frontend/src/types/routineGroup.ts` の `RoutineGroupTagAssignment` interface 削除、新規 `RoutineGroupAssignment` interface 追加（id / routineId / groupId / version / updatedAt / isDeleted）
- [ ] 5.4 `frontend/src/types/calendarItem.ts` の `routineGroup?: RoutineGroup` 参照は維持（影響確認のみ）

### Phase 6: Frontend Service

- [ ] 6.1 `frontend/src/services/DataService.ts`
  - 削除: `fetchRoutineTags`, `createRoutineTag`, `updateRoutineTag`, `deleteRoutineTag`, `fetchAllRoutineTagAssignments`, `setTagsForRoutine`, `fetchAllRoutineGroupTagAssignments`, `setTagsForRoutineGroup`
  - 追加: `fetchAllRoutineGroupAssignments`, `setGroupsForRoutine(routineId, groupIds)`
  - 修正: `createRoutine` / `updateRoutine` の引数に `groupIds?: string[]`
- [ ] 6.2 `frontend/src/services/TauriDataService.ts` で 6.1 と同じ実装

### Phase 7: Frontend Hook / Provider

- [ ] 7.1 削除: `frontend/src/hooks/useRoutineTags.ts`, `useRoutineTagAssignments.ts`, `useRoutineGroupTagAssignments.ts`
- [ ] 7.2 新規: `frontend/src/hooks/useRoutineGroupAssignments.ts`（Map<routineId, groupId[]> 管理 + setGroupsForRoutine）
- [ ] 7.3 `frontend/src/context/RoutineContextValue.ts` の interface 更新（tag 系 state 削除、groupAssignments 追加）
- [ ] 7.4 `frontend/src/context/RoutineContext.tsx` の Provider で hook 入れ替え
- [ ] 7.5 `frontend/src/hooks/useRoutines.ts` で groupIds の扱いを追加

### Phase 8: Frontend UI

- [ ] 8.1 削除:
  - `frontend/src/components/Tasks/Schedule/Routine/RoutineTagManager.tsx`
  - `RoutineTagEditPopover.tsx`
  - `RoutineTagSelector.tsx`
  - `RoutineGroupTagPicker.tsx`
- [ ] 8.2 `FrequencySelector.tsx` に `"group"` option 追加
- [ ] 8.3 `RoutineEditDialog.tsx` 修正:
  - tags / initialTagIds 関連 prop を削除
  - frequencyType state に "group" を許可
  - frequencyType="group" 時に Group 複数選択 UI を表示（既存 Group チェックボックス + 「+ 新規 Group 作成」ボタン）
  - 「+ 新規 Group 作成」押下で同 Dialog 内に Group 作成フォーム展開（name / color / frequencyType / frequencyDays / frequencyInterval / frequencyStartDate を入力 → 作成 → 自動選択）
  - 保存時に groupIds を含めて Routine update を呼び出す
- [ ] 8.4 新規: `RoutineGroupSelector.tsx`（Routine の Group 多重選択 sub-component）
- [ ] 8.5 新規: `RoutineGroupCreateForm.tsx`（Dialog 内 inline 作成フォーム）
- [ ] 8.6 `RoutineManagementOverlay.tsx` から Tag 管理セクション削除
- [ ] 8.7 Routine 実行日決定ロジック更新（`routineFrequency.ts` / `routineScheduleSync.ts`）
  - `frequencyType === "group"` の場合、`groupIds` で参照する Group 群の frequency を OR 評価

### Phase 9: i18n

- [ ] 9.1 `frontend/src/i18n/locales/en.json`:
  - 削除: `routineTag`, `noTaggedRoutines`, タグ関連ヘルプテキスト
  - 追加: `schedule.frequencyTypeGroup`, `routineGroup.assignToGroup`, `routineGroup.createNew`, etc.
- [ ] 9.2 `frontend/src/i18n/locales/ja.json` 同様

### Phase 10: Tests

- [ ] 10.1 `frontend/src/hooks/useRoutineGroupComputed.test.ts` 修正（groupTagAssignments → groupIds 参照に変更、または削除して test 再構成）
- [ ] 10.2 `src-tauri/src/db/migrations/mod.rs` のテストに V69 想定追加
- [ ] 10.3 routine*tag*\* 関連テストファイルがあれば削除

### Phase 11: 検証

- [ ] 11.1 `cargo check` (src-tauri) で型エラーなし
- [ ] 11.2 frontend `tsc -b` で型エラーなし
- [ ] 11.3 `cd frontend && npm run test` で test 成功
- [ ] 11.4 `cargo tauri dev` で起動 → 既存 Routine が表示される（Tag は消えている）
- [ ] 11.5 frequencyType="group" の Routine を作成 → 既存 Group 選択 → 保存 → カレンダーに正しく出現
- [ ] 11.6 frequencyType="group" 選択時 → 「+ 新規 Group 作成」 → Group 作成 → そのまま選択 → Routine 保存 → 動作確認
- [ ] 11.7 Cloud Sync を一度走らせて D1 0007 が適用されること、routine_group_assignments が同期されること

---

## Files

| File                                                                   | Operation       | Notes                                              |
| ---------------------------------------------------------------------- | --------------- | -------------------------------------------------- |
| `src-tauri/src/db/migrations/v61_plus.rs`                              | Modify          | V69 ブロック追加                                   |
| `src-tauri/src/db/migrations/mod.rs`                                   | Modify          | LATEST_USER_VERSION = 69、テスト調整               |
| `src-tauri/src/db/migrations/full_schema.rs`                           | Modify          | tag 系 CREATE 削除 + group_assignments CREATE 追加 |
| `cloud/db/migrations/0007_drop_routine_tags_add_group_assignments.sql` | Create          | D1 migration                                       |
| `src-tauri/src/db/routine_tag_repository.rs`                           | Delete          | 全廃                                               |
| `src-tauri/src/db/routine_group_repository.rs`                         | Modify          | tag 関連関数除去                                   |
| `src-tauri/src/db/routine_group_assignment_repository.rs`              | Create          | 新 repo                                            |
| `src-tauri/src/db/routine_repository.rs`                               | Modify          | groupIds 対応                                      |
| `src-tauri/src/db/mod.rs`                                              | Modify          | mod 宣言更新                                       |
| `src-tauri/src/commands/routine_tag_commands.rs`                       | Delete          | 全廃                                               |
| `src-tauri/src/commands/routine_group_commands.rs`                     | Modify          | tag commands 削除                                  |
| `src-tauri/src/commands/routine_commands.rs`                           | Modify          | groupIds パラメータ                                |
| `src-tauri/src/commands/routine_group_assignment_commands.rs`          | Create          | 新 commands                                        |
| `src-tauri/src/commands/mod.rs`                                        | Modify          | mod 更新                                           |
| `src-tauri/src/lib.rs`                                                 | Modify          | generate_handler! 更新                             |
| `src-tauri/src/sync/sync_engine.rs`                                    | Modify          | 同期対象テーブル更新                               |
| `src-tauri/src/sync/types.rs`                                          | Modify          | TableName / SyncPayload                            |
| `cloud/src/*`                                                          | Modify (要確認) | Worker 側の sync handler                           |
| `frontend/src/types/routineTag.ts`                                     | Delete          | 全廃                                               |
| `frontend/src/types/routine.ts`                                        | Modify          | FrequencyType + groupIds                           |
| `frontend/src/types/routineGroup.ts`                                   | Modify          | RoutineGroupTagAssignment 削除、新 type 追加       |
| `frontend/src/services/DataService.ts`                                 | Modify          | API 入れ替え                                       |
| `frontend/src/services/TauriDataService.ts`                            | Modify          | 実装入れ替え                                       |
| `frontend/src/hooks/useRoutineTags.ts`                                 | Delete          | 全廃                                               |
| `frontend/src/hooks/useRoutineTagAssignments.ts`                       | Delete          | 全廃                                               |
| `frontend/src/hooks/useRoutineGroupTagAssignments.ts`                  | Delete          | 全廃                                               |
| `frontend/src/hooks/useRoutineGroupAssignments.ts`                     | Create          | 新 hook                                            |
| `frontend/src/hooks/useRoutines.ts`                                    | Modify          | groupIds 対応                                      |
| `frontend/src/context/RoutineContextValue.ts`                          | Modify          | type 入れ替え                                      |
| `frontend/src/context/RoutineContext.tsx`                              | Modify          | Provider 入れ替え                                  |
| `frontend/src/components/Tasks/Schedule/Routine/RoutineTagManager.tsx` | Delete          | 全廃                                               |
| `RoutineTagEditPopover.tsx`                                            | Delete          | 同                                                 |
| `RoutineTagSelector.tsx`                                               | Delete          | 同                                                 |
| `RoutineGroupTagPicker.tsx`                                            | Delete          | 同                                                 |
| `RoutineEditDialog.tsx`                                                | Modify          | frequencyType="group" 対応 + Group 選択 UI         |
| `FrequencySelector.tsx`                                                | Modify          | "group" option 追加                                |
| `RoutineGroupSelector.tsx`                                             | Create          | Group 多重選択                                     |
| `RoutineGroupCreateForm.tsx`                                           | Create          | Dialog 内 inline 作成                              |
| `RoutineManagementOverlay.tsx`                                         | Modify          | Tag セクション削除                                 |
| `frontend/src/utils/routineFrequency.ts` (or 同等)                     | Modify          | "group" type の実行日判定                          |
| `frontend/src/i18n/locales/en.json`                                    | Modify          | tag 削除 + group キー追加                          |
| `frontend/src/i18n/locales/ja.json`                                    | Modify          | 同上                                               |
| `frontend/src/hooks/useRoutineGroupComputed.test.ts`                   | Modify          | テスト追従                                         |

---

## Verification

- [ ] `sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"` → 69
- [ ] `sqlite3 ... ".tables"` で `routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments` が存在しない
- [ ] `sqlite3 ... ".schema routine_group_assignments"` で期待スキーマが出力される
- [ ] `cargo check` パス
- [ ] `cd frontend && tsc -b` パス
- [ ] `cd frontend && npm run test` パス
- [ ] `cargo tauri dev` 起動成功
- [ ] 既存 Routine が起動後に正しく表示される（Tag UI は消失）
- [ ] FrequencyType=Group の Routine を作成し、所属 Group の frequency に従ってカレンダーに出現する（複数 Group 所属時は OR で出現）
- [ ] EditRoutine Dialog 内で「+ 新規 Group 作成」 → 同フローで Group が作られ自動選択される
- [ ] Cloud Sync 実行後 D1 user_version が 7 に更新され、`routine_group_assignments` が同期される

---

## Implementation Order

Migration → DB repo → Commands → Sync → DataService → Hook/Context → UI → i18n → Test → 動作確認

Backend を先に固めることで Frontend からは完成済み API を呼び出すだけになり、型エラーで進捗が分かりやすくなる。
