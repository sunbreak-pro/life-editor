# HISTORY (chat-main)

### 2026-05-23 - Schedule 無限ループ修正（RoutineScheduleSync no-op 化）

#### 概要

DU-C/D pending stubs 投入後のユーザー実機検証で「Routine 生成時にコンソールエラーが永遠に吐き出される」バグが顕在化。原因を特定して `web/src/schedule/RoutineScheduleSync.tsx` を DU-C 完了まで no-op 化することで根本撤去。

#### 変更点

- **Frontend / web**: `web/src/schedule/RoutineScheduleSync.tsx` の useEffect + `useScheduleItemsRoutineSync` 呼び出しを全削除して `return null` 化（87 → 70 行）
- **Root cause 記録**: 無限ループ経路 6 ステップ（createRoutine → setRoutines optimistic → effect 発火 → ensure → bulkCreate stub throw → **catch 外**の `if (toCreate.length > 0) notifyChanged()` 発火 → loadDate → setItems(新空配列) → context 新参照 → 再 render → effect 再発火 → ループ）と DU-C 完了時の復活手順をコンポーネント先頭コメントに保存
- **検証**: shared `npx tsc -b` 緑 / shared `npm test` 91/91 緑 / web `npm run build` 緑（929 kB）
- **session-verifier**: 全 6 Gate PASS（Types / Lint / Tests / Coverage skip / Structural / Bug Scan）

### 2026-05-23 - DU-C/D pending stubs（8 services 一時 no-op）

#### 概要

`0007_drop_legacy_item_tables.sql` で旧 9 テーブルが drop され、Tasks 以外の Service が `notes` / `routines` / `schedule_items` 等の dropped table を叩いて `Could not find the table 'public.<name>' in the schema cache` エラーで web 起動が壊れていた問題を、8 Service の stub 化（fetch → [] / null、write → 明示 throw）で短期対応。実 DB には `items_meta + <role>_payload` が既に揃っていることを Supabase MCP `list_tables` で確認済（dailies_payload / notes_payload / routines_payload / events_payload など）。

#### 変更点

- **Shared services**: `SupabaseDataService.ts` の Daily / Notes / NoteLink / NoteConnection / Routines / RoutineGroups / RoutineGroupAssignments / ScheduleItems 8 Service を stub クラスに置換（3257 → 1774 行、head/tail splice）
- **共通ヘルパー**: `_pendingDuRewrite(method, domain)` で明示エラーメッセージ + 計画書パスを統一
- **Tasks / Calendars**: DU-B-3 実装と既存 Calendar 系は無変更
- **検証**: shared `tsc -b` / `npm test` 91/91 / web `npm run build` 全緑

### 2026-05-23 - fix(tasks): TaskTreeView DnD into-folder

#### 概要

DU-B-5 ユーザー検証で「folder の中に DnD で入れられない（並び替えと中→外は OK）」と報告。バックエンド (`updateTask` の parentId 変更経路) は無罪、frontend `web/src/tasks/TaskTreeView.tsx:198-205` の `handleDragEnd` が `moveNodeInto` を意図的に呼んでいなかった（"out of this minimal UI's scope" コメント付き）ことが判明。Notes 側 `useNoteTreeDnd` 相当の 3 zone（above/inside/below）判定を移植して修正。

#### 変更点

- **Frontend / web**: `TaskTreeView.tsx` に `computeFolderPosition` + `getPointerY` helper + 3 zone 判定付き `handleDragEnd` を実装
- **挙動**: folder 上 25% = above（moveNode）/ 中央 50% = inside（moveNodeInto）/ 下 25% = below（折りたたみは moveNode、展開済みは moveNodeInto）。task drop は上下半分判定
- **DB / shared 無変更**: `useTaskTreeMovement.moveNodeInto` は既存実装、`updateTask` の parentId UPDATE 経路も DU-B-3 で動作確認済

### 2026-05-23 - DU-B-6 partial（db-conventions §10 + known-issues 021-024）

#### 概要

DU-B-1 / B-2 / B-3 で得た知見を恒久ドキュメント化。`db-conventions.md` に Payload Mapper 規約（10.1 2 行分割マッピング、10.2 DB-Q2 bump、10.3 generated 列の書き込み禁止、10.4 composite FK パターン、10.5 R2 orphan recovery、10.6 DB-Q1/Q2/Q3 サマリ）を新規 §10 として追加。known-issues に 4 件追加（PG generated + composite FK + SET NULL 不可 / Supabase SQL Editor postgres role auth.uid NULL / Supabase CLI v2.101 CSV 出力 / PG 2BP01 依存連鎖）。

#### 変更点

- **Docs / vision**: `.claude/docs/vision/db-conventions.md` 末尾に §10 Payload Mapper 規約を新設
- **Docs / known-issues**: 021/022/023/024 を新規追加 + `INDEX.md` の Fixed セクション + Category 別インデックス + Status 集計を更新（19 件 → 並行チャットの 025 追加で 20 件）
- **保留**: CLAUDE.md §4.3 一行追記は並行チャットの CLAUDE.md 編集との干渉回避で別タイミング。計画書 archive 移動も DU-B 全体クローズ時に実施

### 2026-05-23 - DU-B-4 taskMapper + sortByDepthDesc vitest

#### 概要

DU-B-3 で実装した `taskMapper` の 2 行分割 API と `sortByDepthDesc` ユーティリティに対する vitest を追加。子計画書 §DU-B-4 の 5 必須ケース（roundtrip 5 shape / DB-Q2 bump 3 sub-case / parent_item_role 型ガード / soft-delete patch shape / order ↔ sort_order 3 path）+ sortByDepthDesc 6 ケース（3-level tree leaf-first / sibling 安定性 / orphan / cycle 終端 / empty / single root）を追加。テスト数 71 → 91。

#### 変更点

- **Shared tests**: `shared/tests/taskMapper.test.ts`（14 case）/ `shared/tests/sortByDepthDesc.test.ts`（6 case）新規追加
- **検証**: `npx tsc -b` 緑 / `npm test` 91/91 緑

> 古いエントリは [`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照（DU-B-3 SupabaseTasksService 9 methods 本実装 ほか）
