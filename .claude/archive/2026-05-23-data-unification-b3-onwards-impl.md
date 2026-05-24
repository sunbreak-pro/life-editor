---
Status: COMPLETED — 2026-05-24 DU-B-3〜B-6 完了。SupabaseTasksService 9 メソッド本実装 + vitest + web 動作確認すべて達成。親計画書 2026-05-23-data-unification-b-tasks.md（同時 archive 済）と統合管理。
Created: 2026-05-23
Task: Data Unification DU-B-3〜B-6 詳細実装（SupabaseTasksService 9 メソッド本実装 / vitest 追加 / web 動作確認 / docs 更新）
Project path: /Users/newlife/dev/apps/life-editor
Branch: data-unification/items-meta-redesign
Parent SSOT: .claude/docs/vision/plans/2026-05-23-data-unification-b-tasks.md（DU-B 子計画書 v3-rev3 + R9）
Grandparent SSOT: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md（親計画書 v3）
DU-A 子計画書（完了済）: .claude/archive/2026-05-23-data-unification-a-db-schema.md
継承する章: 親計画書「採用アーキテクチャ」「DB 設計詳細」「列化判定マトリクス」「Pattern A Provider 再設計案」/ DU-B 子計画書「ユーザー確定事項 DB-Q1/Q2/Q3」「Risks R1-R9」「Recovery Playbook R1-R8」「Non-goals」
---

# Plan: Data Unification DU-B-3 〜 DU-B-6 詳細実装

## このフェーズのゴール

DU-B-2 まで完了した状態 (mapper 2 行分割 + roundtrip 緑 + SupabaseTasksService 9 メソッド stub) を起点に、DU-B の残 4 ステップを完走させ、DU-B 子計画書の DoD 11 項目すべてを満たす。完了時に DU-B 子計画書 + 本詳細実装計画書を `archive/` に移動 → DU-C (Events + Routine) 着手判断。

## DU-B-2 まで完了の確認 (チェックポイント)

次セッション着手前に以下が事実であることを確認:

- [x] HEAD: `98d99b9` (data-unification/items-meta-redesign push 済)
- [x] 0009 v3-rev3 + 0010 が本番 Supabase apply 済
- [x] check-rls.sql で sentinel `___RLS_GATE_OK___` + offender 0
- [x] Security advisor: 既知 WARN 1 件のみ (`auth_leaked_password_protection`)
- [x] Performance advisor: items_meta + tasks_payload で `auth_rls_initplan` WARN 0
- [x] `shared/src/services/taskMapper.ts` 2 行分割 API (rowsToTaskNode / taskNodeToRows / taskUpdatesToPatches)
- [x] `taskMapper.roundtrip.ts` 20 アサーション全 PASS
- [x] `SupabaseTasksService` 9 メソッドは `_pendingRewrite` throw stub
- [x] `cd shared && npx tsc -b` 緑 / vitest 71/71 緑
- [x] **DU-B-3 着手前ユーザー承認** (本詳細計画書のレビュー)

---

# DU-B-3 詳細: SupabaseTasksService 9 メソッド本実装

## 入口前提

DU-B-2 完了 + ユーザーが本詳細計画書を承認。

## 出口検証 (子計画書 DU-B-3 行 + 本計画書 R8 spot check)

- [ ] `cd shared && npx tsc -b` 緑
- [ ] `shared/src/services/SupabaseDataService.ts` の `SupabaseTasksService` 9 メソッドが items_meta + tasks_payload 経由で動作
- [ ] `_pendingRewrite` throw stub + `_unused_*` phantom フィールド全削除
- [ ] **R2 検出 SQL = 0 行**（createTask 強制失敗テスト後の孤児 items_meta 0 件確認）
- [ ] **updated_at bump 検証**: updateTask 呼出前後で items_meta.updated_at が動く（payload 単独更新でも）
- [ ] **9 メソッド各 1 回実行後の同期確認**（items_meta ↔ tasks_payload で updated_at 同時更新 + is_deleted 同時反転 + 孤児なし）
- [ ] **R8 spot check**: TS 型と DB 列名・型の一致を SQL Editor で目視

## 実装方針

### 0. 共通: bump ヘルパー集約 (R3 設計補強)

```typescript
// SupabaseTasksService 内に private メソッド
private async bumpItemsMetaUpdatedAt(itemId: string, now: string): Promise<void> {
  const { error } = await this.client
    .from("items_meta")
    .update({ updated_at: now })
    .eq("id", itemId);
  if (error) throw new Error(`bumpItemsMetaUpdatedAt failed: ${error.message}`);
}
```

すべての write メソッド (createTask / updateTask / syncTaskTree / softDeleteTask / restoreTask / permanentDeleteTask) で **必ずこのヘルパーを通る**設計。code review チェックリストに「9 メソッドの bump 経路カバレッジ」を入れる。

ただし、mapper の `taskUpdatesToPatches` が既に `metaPatch.updated_at = now` を含むので、updateTask は metaPatch を items_meta UPDATE するだけで bump 完了 (ヘルパー不要)。**ヘルパー必要なのは「mapper を通らない直接 UPDATE 経路」のみ** (softDelete / restore 等)。

### 1. fetchTaskTree(): Promise<TaskNode[]>

**SQL 戦略**: 2 クエリ (items_meta SELECT → tasks_payload SELECT) で JOIN-in-app。理由: PostgREST の `.select("*, tasks_payload(*)")` で nested select も可能だが、role=task の絞り込みと型推論の明快さで 2 クエリの方が読みやすい。

```typescript
async fetchTaskTree(): Promise<TaskNode[]> {
  // 1. role=task かつ未削除の items_meta を取得
  const { data: metas, error: metaErr } = await this.client
    .from("items_meta")
    .select(ITEMS_META_TASK_COLUMNS)
    .eq("role", "task")
    .eq("is_deleted", false);
  if (metaErr) throw new Error(`fetchTaskTree items_meta: ${metaErr.message}`);
  if (!metas || metas.length === 0) return [];

  // 2. 対応する tasks_payload を一括取得
  const ids = metas.map(m => m.id);
  const { data: payloads, error: pErr } = await this.client
    .from("tasks_payload")
    .select(TASKS_PAYLOAD_COLUMNS)
    .in("item_id", ids);
  if (pErr) throw new Error(`fetchTaskTree tasks_payload: ${pErr.message}`);

  // 3. JOIN in app + 孤児 items_meta は除外 (R2 後始末)
  const payloadById = new Map(payloads?.map(p => [p.item_id, p]) ?? []);
  return metas
    .filter(m => payloadById.has(m.id))
    .map(m => rowsToTaskNode(m as ItemsMetaRow, payloadById.get(m.id)! as TasksPayloadRow));
}
```

### 2. fetchDeletedTasks(): Promise<TaskNode[]>

`fetchTaskTree` と同型、`.eq("is_deleted", true)` に変更。Trash UI 用。

### 3. createTask(node: TaskNode): Promise<TaskNode>

**R2 try/catch 必須** (DB-Q1 hard delete):

```typescript
async createTask(node: TaskNode): Promise<TaskNode> {
  const userId = await this.getUserId();
  const { meta, payload } = taskNodeToRows(node, userId);

  // 1. items_meta INSERT
  const { data: metaRow, error: metaErr } = await this.client
    .from("items_meta")
    .insert(meta)
    .select(ITEMS_META_TASK_COLUMNS)
    .single();
  if (metaErr) throw new Error(`createTask items_meta: ${metaErr.message}`);

  // 2. tasks_payload INSERT (失敗時は items_meta を hard delete)
  try {
    const { data: pRow, error: pErr } = await this.client
      .from("tasks_payload")
      .insert(payload)
      .select(TASKS_PAYLOAD_COLUMNS)
      .single();
    if (pErr) throw new Error(`createTask tasks_payload: ${pErr.message}`);

    return rowsToTaskNode(metaRow as ItemsMetaRow, pRow as TasksPayloadRow);
  } catch (err) {
    // 孤児 items_meta 防止: hard delete (DB-Q1 / Blocker-1 v2 改訂)
    await this.client.from("items_meta").delete().eq("id", meta.id);
    throw err;
  }
}
```

### 4. updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode>

mapper の `taskUpdatesToPatches` で metaPatch + payloadPatch を生成 → 順に UPDATE。

```typescript
async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
  const userId = await this.getUserId();
  const now = new Date().toISOString();
  const { metaPatch, payloadPatch } = taskUpdatesToPatches(updates, userId, now);

  // 1. items_meta UPDATE (metaPatch は必ず updated_at を含む = DB-Q2)
  const { error: metaErr } = await this.client
    .from("items_meta")
    .update(metaPatch)
    .eq("id", id);
  if (metaErr) throw new Error(`updateTask items_meta: ${metaErr.message}`);

  // 2. tasks_payload UPDATE (空でない場合のみ)
  if (Object.keys(payloadPatch).length > 0) {
    const { error: pErr } = await this.client
      .from("tasks_payload")
      .update(payloadPatch)
      .eq("item_id", id);
    if (pErr) throw new Error(`updateTask tasks_payload: ${pErr.message}`);
  }

  // 3. 更新後の row を取得して TaskNode 復元
  const [{ data: meta }, { data: payload }] = await Promise.all([
    this.client.from("items_meta").select(ITEMS_META_TASK_COLUMNS).eq("id", id).single(),
    this.client.from("tasks_payload").select(TASKS_PAYLOAD_COLUMNS).eq("item_id", id).single(),
  ]);
  return rowsToTaskNode(meta as ItemsMetaRow, payload as TasksPayloadRow);
}
```

### 5. syncTaskTree(nodes: TaskNode[]): Promise<void>

複数 TaskNode を一括 UPSERT。`upsert(...).select()` で。

```typescript
async syncTaskTree(nodes: TaskNode[]): Promise<void> {
  const userId = await this.getUserId();
  const rowsPairs = nodes.map(n => taskNodeToRows(n, userId));

  // 1. items_meta 一括 UPSERT
  const { error: metaErr } = await this.client
    .from("items_meta")
    .upsert(rowsPairs.map(r => r.meta), { onConflict: "id" });
  if (metaErr) throw new Error(`syncTaskTree items_meta: ${metaErr.message}`);

  // 2. tasks_payload 一括 UPSERT
  const { error: pErr } = await this.client
    .from("tasks_payload")
    .upsert(rowsPairs.map(r => r.payload), { onConflict: "item_id" });
  if (pErr) throw new Error(`syncTaskTree tasks_payload: ${pErr.message}`);
}
```

### 6. softDeleteTask(id: string): Promise<void>

items_meta の is_deleted + deleted_at + updated_at を一括 UPDATE。tasks_payload は触らない (cascade ではない、items_meta の soft-delete は payload 行を残す)。

```typescript
async softDeleteTask(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await this.client
    .from("items_meta")
    .update({ is_deleted: true, deleted_at: now, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(`softDeleteTask: ${error.message}`);
}
```

### 7. restoreTask(id: string): Promise<void>

softDelete の逆操作。

```typescript
async restoreTask(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await this.client
    .from("items_meta")
    .update({ is_deleted: false, deleted_at: null, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(`restoreTask: ${error.message}`);
}
```

### 8. permanentDeleteTask(id: string): Promise<void>

**composite FK NO ACTION 前提 (DB-Q3 v3-rev2 確定)**: 子がいる親の DELETE は PG が拒否する。**descendants 再帰削除**を実装 (Tauri 同型)。

```typescript
async permanentDeleteTask(id: string): Promise<void> {
  // 1. 全 Task を取得 (再帰収集のため)
  const all = await this.fetchTaskTree();
  const allDeleted = await this.fetchDeletedTasks();
  const pool = [...all, ...allDeleted];

  // 2. id を root とする descendants 全 id を収集 (子 → 孫 → ...)
  const descendantIds = collectDescendantIds(id, pool);  // shared/src/utils/getDescendantTasks.ts を再利用
  const idsToDelete = [id, ...descendantIds];

  // 3. 子から順に DELETE (NO ACTION 制約を満たす順序)
  //    深さ降順でソート (子が先、親が後)
  const sortedByDepth = sortByDepthDesc(idsToDelete, pool);
  for (const did of sortedByDepth) {
    const { error } = await this.client.from("items_meta").delete().eq("id", did);
    if (error) throw new Error(`permanentDeleteTask ${did}: ${error.message}`);
    // 0008 cascade で tasks_payload も自動消去
  }
}
```

**ヘルパー候補**: `sortByDepthDesc` は新規 (shared/src/utils/ に追加)。または、深さでなく「他から parent として参照されていないものから順」のトポロジカルソート。

### 9. migrateTasksToBackend(nodes: TaskNode[]): Promise<void>

DU-B-2 で no-op stub 化済。本実装でも no-op 維持 (web 既存挙動)。

```typescript
async migrateTasksToBackend(_nodes: TaskNode[]): Promise<void> {
  // no-op: web 側は SyncProvider が単方向同期するため、明示的 migrate 不要
}
```

## 設計判断: getUserId() の実装

```typescript
private async getUserId(): Promise<string> {
  const { data: { user }, error } = await this.client.auth.getUser();
  if (error || !user) throw new Error("not authenticated");
  return user.id;
}
```

毎回 auth 呼び出しを避けたければ、SupabaseDataService コンストラクタで cache する設計も可。DU-B-3 では simple 実装 → DU-B-5 動作確認で速度問題が出たら最適化。

## 監査計画

| 監査                | 観点                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `security-reviewer` | trans rollback / SQL 注入境界 (PostgREST builder 経由なので注入耐性高い) / try/catch hard delete の race condition / permanentDeleteTask の bulk delete の権限漏れ |
| `role-qa`           | 9 メソッド契約遵守 (DataService interface 一致) / bump enforcement 全経路 / R2 try/catch / R3 bump 漏れなし / R8 spot check 設計 / Tauri 同型維持                  |

並列起動。両方 APPROVE → commit + push → ユーザー SQL Editor 検証 4 件依頼 → DU-B-3 完了。

## Risks (DU-B-3 固有)

| ID    | リスク                                                                                                    | 緩和                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| RB3-1 | createTask の items_meta INSERT 成功 → payload INSERT 失敗 → catch 内 hard delete も失敗 (NW 断線) → 孤児 | R2 Recovery Playbook の日次/週次検出 SQL で回収                                                                                          |
| RB3-2 | updateTask の items_meta UPDATE 成功 → payload UPDATE 失敗 → metadata だけ進む                            | 1 トランザクション化が PostgREST では困難。失敗時に items_meta.updated_at を戻す補償 transaction は実装しない (実害低、再 update で復元) |
| RB3-3 | permanentDeleteTask の Bulk DELETE で 1 件失敗 → 中途状態                                                 | 失敗時はそのまま throw、ユーザーに「再実行」を促す。pool が変更されていれば次回 fetchTaskTree で descendants 再収集                      |
| RB3-4 | sortByDepthDesc の実装ミスで親が先に削除 → FK violation                                                   | 単体テスト (vitest) で 3 段階以上の深さ + 兄弟 + 孤児候補のケースを必須化 (DU-B-4 で)                                                    |

## Step 完了時の commit メッセージ規約

```
feat(du-b): DU-B-3 — SupabaseTasksService 9 methods on items_meta + tasks_payload

- createTask: try/catch + hard delete on payload failure (R2)
- updateTask: taskUpdatesToPatches + dual UPDATE; bump on payload-only
- syncTaskTree: dual upsert (onConflict: id / item_id)
- softDeleteTask / restoreTask: items_meta only
- permanentDeleteTask: descendants-first DELETE (NO ACTION FK premise)
- migrateTasksToBackend: kept as no-op
- bumpItemsMetaUpdatedAt helper for non-mapper write paths (R3)
- _pendingRewrite stub + _unused_* phantom fields removed
- DU-B-3 verification: orphan SQL = 0, bump confirmation, sync confirmation,
  R8 spot check on column/type alignment

Audits (security-reviewer + role-qa parallel): APPROVE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# DU-B-4 詳細: shared/tests/taskMapper.test.ts 新規追加

## 入口前提

DU-B-3 完了 + commit/push 済。

## 出口検証

- [ ] `cd shared && npm run test` で taskMapper.test.ts が緑
- [ ] vitest 全件 (既存 71 + 新規追加分) 緑

## 必須テストケース (子計画書 + R8 spot check 補強)

### 1. roundtrip 5 ステータス

`taskNodeToRows` → `rowsToTaskNode` で元の TaskNode と一致。5 ケース:

- NOT_STARTED (minimal task)
- IN_PROGRESS (fully populated: scheduledAt + reminderEnabled + workDurationMinutes + content + tags)
- DONE (completedAt + isDeleted=false)
- folder type='folder' folderType='normal' (children を持つ Task)
- folder type='folder' folderType='complete' (DONE 子を集める特殊フォルダ)

### 2. updated_at bump enforcement (DB-Q2)

- `taskUpdatesToPatches({ title: "X" }, uid, "2026-05-23T12:00:00Z").metaPatch.updated_at === "2026-05-23T12:00:00Z"`
- `taskUpdatesToPatches({ status: "DONE" }, uid, now).metaPatch.updated_at === now` (payload 単独更新でも bump)
- `taskUpdatesToPatches({}, uid, now).metaPatch.updated_at === now` (空 update でも bump)

### 3. parent_item_role 型ガード (TS 静的)

`AssertNoParentRole<TasksPayloadWriteRow>` が tsc 緑 = `parent_item_role` 不在の確認。`taskNodeToRows(node, uid).payload` の runtime `hasOwnProperty("parent_item_role") === false` を assert。

### 4. soft-delete patch shape

`taskUpdatesToPatches({ isDeleted: true, deletedAt: "...", updatedAt: "..." }, uid, now).metaPatch` が `{ is_deleted: true, deleted_at: ..., updated_at: now }` を含む + `payloadPatch` が空。

### 5. order ↔ sort_order 変換 (R7)

- write: `taskNodeToRows({ ...node, order: 5 }, uid).payload.sort_order === 5`
- read: `rowsToTaskNode(meta, { ...payload, sort_order: 7 }).order === 7`
- patch: `taskUpdatesToPatches({ order: 9 }, uid, now).payloadPatch.sort_order === 9`

### 6. (新規) DU-B-3 RB3-4 緩和: descendants 再帰収集ロジック

shared/src/utils/getDescendantTasks.ts (既存) + `sortByDepthDesc` (DU-B-3 新規追加) のテストケース:

- 3 段階ツリー (root → A → A1, A2 / B → B1)
- root を起点に descendants 収集 → [A, A1, A2, B, B1]
- depth desc ソート → [A1, A2, B1, A, B] or 同等の「親が後」順序
- 孤児 (parent 不在) は含めない

## 監査計画

`role-qa` のみ (テストの必須ケース網羅性確認)。

## Step 完了時の commit メッセージ

```
test(du-b): DU-B-4 — taskMapper + sortByDepthDesc vitest with 5 must-cover cases

Adds shared/tests/taskMapper.test.ts with 5 mandatory cases:
- roundtrip 5 statuses
- DB-Q2 updated_at bump enforcement (3 sub-cases)
- parent_item_role type guard runtime check
- soft-delete patch shape
- order ↔ sort_order translation (3 paths)

Plus sortByDepthDesc unit tests for DU-B-3 RB3-4 mitigation
(3-level tree + sibling + orphan handling).
```

---

# DU-B-5 詳細: web/ Tasks タブ golden path 動作確認

## 入口前提

DU-B-3 + DU-B-4 完了。

## 出口検証

- [ ] web/ 起動 (`cd web && npm run dev` or 既存スクリプト)
- [ ] golden path 全成功 (下記 6 手順)
- [ ] console error 0
- [ ] R2 検出 SQL = 0 行 (動作確認後の孤児 0)

## golden path 手順 (ユーザー手動)

1. **作成**: Tasks タブで「+ 新規タスク」 → タイトル「DU-B-5 test root」入力 → Enter
2. **子タスク追加**: 1 で作った行に右クリック / 「+」ボタン → 「DU-B-5 test child」追加
3. **ステータス 3 段階切替**: ○ → ◐ → ● → ○ (1 周)
4. **期限設定**: 「DU-B-5 test child」に scheduledAt = 明日 14:00 を設定
5. **DnD 並び替え**: root を Drag → 別の root の下に Drop (兄弟並び替え)
6. **DnD 階層移動**: child を Drag → 別の root の中に Drop (parent 変更)
7. **削除**: 「DU-B-5 test root」を softDelete → Trash で確認 → permanentDelete

各操作後に Supabase SQL Editor で:

```sql
select m.id, m.title, m.is_deleted, m.updated_at, p.task_type, p.status, p.parent_item_id, p.sort_order
from items_meta m
left join tasks_payload p on p.item_id = m.id
where m.role = 'task' and m.created_at > now() - interval '10 minutes'
order by m.created_at desc;
```

で実 DB 状態を確認 (任意、bug 疑い時)。

## 監査計画

ユーザー手動 golden path のみ。サブエージェント不要。

## Step 完了時の commit

通常コードへの変更なし (DU-B-5 は動作確認のみ)。MEMORY/HISTORY 更新のみ commit。

---

# DU-B-6 詳細: docs 更新

## 入口前提

DU-B-3 + DU-B-4 + DU-B-5 完了。

## 出口検証

- [ ] CLAUDE.md §4.3 (id 戦略) に composite FK パターンの 1 行追記
- [ ] `docs/vision/db-conventions.md` に payload mapper 規約 + DB-Q2 mapper bump 責務 + DU-B 確定 3 件追記
- [ ] `docs/known-issues/` に 4 件追加 (PG GENERATED + composite FK + SET NULL 不可 / Supabase SQL Editor postgres role / check-rls.sh CLI v2.101 不能 / 2BP01 依存連鎖)
- [ ] `docs/known-issues/INDEX.md` に 4 件 grep 可能 entry 追加

## CLAUDE.md §4.3 更新案 (1 行追加)

```markdown
### 4.3 ID 戦略

- TaskNode: `<type>-<timestamp+counter>`（例 `task-1710201234566`） / DailyNode: `daily-<YYYY-MM-DD>` / その他: `generateId(prefix)` = `<prefix>-<uuid>`。全 String
- **同 role 内親子の DB-level 強制 (DU-B 確定)**: `items_meta.(id, role)` UNIQUE + payload に `parent_item_role` generated stored 列 + composite FK で cross-role parent を物理的に不可能化。詳細 → `docs/vision/plans/2026-05-21-data-unification-items-meta.md`「parent_item_id 設計判断」
```

## db-conventions.md 更新案 (新規 § 追加)

```markdown
## § Payload Mapper 規約 (Data Unification 後)

### 2 行分割マッピング (items_meta + payload)

5 role すべてで、TS の 1 ドメイン型 (TaskNode 等) は **items_meta 1 行 + 種別 payload 1 行**にマップされる。mapper は次の 3 関数で構成:

- `rowsToType(meta, payload): Type` — 2 行 → TS 型
- `typeToRows(node, userId): { meta, payload }` — TS 型 → 2 行 (INSERT 用)
- `typeUpdatesToPatches(updates, userId, now): { metaPatch, payloadPatch }` — Partial 更新

### DB-Q2: updated_at bump は mapper 責務

LWW cursor を所有する `items_meta.updated_at` は **payload 単独更新時でも必ず bump** する。`typeUpdatesToPatches` は `metaPatch.updated_at = now` を無条件注入する設計。`now` は呼び出し側から注入 (mapper 純粋性 + テスト可能性)。

### generated 列の書き込み禁止

`parent_item_role` 等の generated stored 列は INSERT/UPDATE で値指定不可 (PG 仕様)。Write 用型 (例: `TasksPayloadWriteRow`) は型レベルで除外する (`AssertNoGeneratedCol` conditional type)。
```

## known-issues 4 件追加

新規ファイル:

- `docs/known-issues/0XX-pg-generated-composite-fk-set-null-forbidden.md`
- `docs/known-issues/0XX-supabase-sql-editor-postgres-role-auth-uid-null.md`
- `docs/known-issues/0XX-check-rls-sh-cli-v2-101-csv-deprecated.md`
- `docs/known-issues/0XX-pg-2bp01-dependency-chain-on-redrop.md`

各ファイルのスケルトン:

```markdown
# <Title>

**Status**: Documented (DU-B-1, 2026-05-23)
**Symptom**: ...
**Root Cause**: ...
**Workaround**: ...
**Prevention**: ...
**References**: DU-B-1 outbox / 0009 / 0010 / Supabase docs
```

## 監査計画

`role-qa` のみ (docs 整合性確認)。

## Step 完了時の commit

```
docs(du-b): DU-B-6 — CLAUDE.md + db-conventions + 4 known-issues

Documents DU-B-1 / B-2 / B-3 learnings as permanent project knowledge:
- CLAUDE.md §4.3: composite FK pattern for same-role parenting
- db-conventions.md: 2-row mapper rules + DB-Q2 bump responsibility
  + generated column write prohibition
- known-issues/: 4 PG/Supabase gotchas discovered during DU-B-1 apply

DU-B all 11 DoD items satisfied. Ready for DU-C kickoff judgment.
```

---

# DU-B 全体完了時のタスク

- [ ] DU-B 子計画書 `2026-05-23-data-unification-b-tasks.md` を `.claude/archive/` に移動 (Status=COMPLETED)
- [ ] 本詳細計画書も `.claude/archive/` に移動 (Status=COMPLETED)
- [ ] MEMORY.md の進行中エントリ → DU-C 着手判断待ちに
- [ ] HISTORY.md に DU-B 全体完了の総括エントリ
- [ ] outbox `chat-web-migration.md` に DU-B 完了報告 + DU-C kickoff 申し送り
- [ ] 親計画書 v3 の Phase 分割表 DU-B 行に「COMPLETED」マーク追記

---

# 次フェーズ (DU-C/D/E/F) 概要

| Phase | スコープ                             | DU-B からの踏襲                                                                   |
| ----- | ------------------------------------ | --------------------------------------------------------------------------------- |
| DU-C  | Events role + Routine + RoutineGroup | composite FK パターン + parent EXISTS + initplan キャッシュ化 + bump ヘルパー集約 |
| DU-D  | Notes role + Daily + 階層 DnD        | DU-B の Tasks 階層構造 + composite FK (notes_payload.parent_item_role='note')     |
| DU-E  | Calendar 2 ビュー (月 + 3 日)        | items_meta 横断 SELECT + role multi-select                                        |
| DU-F  | WikiTag/WikiLink + Provider 改名     | wiki_tag_assignments / wiki_tag_connections の items_meta FK + TasksProvider 改名 |

詳細は DU-B 完了時に「DU-C 着手判断」セッションで子計画書作成。

---

# 監査 / 計画書間連携

- **本詳細計画書は DU-B 子計画書 v3-rev3 のサブ SSOT**。Step ごとの具体的実装方針を含む。
- DU-B 子計画書 v3-rev3 は DU-B 全体の不変前提 (DB-Q1/Q2/Q3 + Risks R1-R9 + Recovery Playbook R1-R8 + Non-goals + DoD)。
- 本計画書の Step 別 commit が完了次第、DU-B 子計画書のチェックボックスを更新。
- 全 Step 完了で両計画書を archive。

# Verification (本詳細計画書自体の検証)

- [ ] Status / Created / Branch / Parent / Grandparent が冒頭に揃っている
- [ ] DU-B-3 〜 DU-B-6 が各 Step ごとに「入口前提 / 出口検証 / 実装方針 / 監査計画 / commit メッセージ規約」で揃っている
- [ ] DU-B-3 の 9 メソッド実装方針が SQL クエリレベルまで具体化
- [ ] DU-B-4 の必須テストケース 5 種 + 補強 1 種
- [ ] DU-B-5 の golden path 手順 7 段
- [ ] DU-B-6 の docs 更新案 3 ファイル + known-issues 4 件
- [ ] DU-B 全体完了時のクローズ手順 6 件
- [ ] 次フェーズ (DU-C/D/E/F) 概要
- [ ] ユーザー承認 (次セッション着手前)
