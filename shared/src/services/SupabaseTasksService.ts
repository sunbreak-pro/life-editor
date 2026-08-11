import { type SupabaseClient } from "@supabase/supabase-js";
import type { TaskNode } from "../types/taskTree";
// DU-B-3: full SupabaseTasksService rewrite over items_meta +
// tasks_payload. Pure mapping lives in taskMapper.ts; this file is the
// I/O layer only. Re-exports at the bottom of SupabaseDataService.ts keep
// one stable surface for host modules and the round-trip harness.
import {
  ITEMS_META_TASK_COLUMNS,
  TASKS_PAYLOAD_COLUMNS,
  rowsToTaskNode,
  taskNodeToRows,
  taskUpdatesToPatches,
  isLegacyFolderRow,
  type TasksPayloadRow,
} from "./taskMapper";
import type { ItemsMetaRow } from "./itemsMeta";
import { collectDescendantIds } from "../utils/getDescendantTasks";
import { sortByDepthDesc } from "../utils/sortByDepthDesc";
import { fetchAllPages, fetchByIdChunks } from "./postgrestFetchAll";
import {
  getAuthedUserId,
  livePayloadInnerJoin,
} from "./supabaseServiceHelpers";

/*
 * Tasks domain (DU-B-3). Full 9-method rewrite over the items_meta
 * (role='task') + tasks_payload 2-row split introduced in migration
 * 0008 and hardened by 0009 (composite FK + parent_item_role generated
 * stored). Pure mapping lives in taskMapper.ts; this class is the I/O
 * layer only.
 *
 * Write-path invariants enforced here (parent SSOT:
 * docs/vision/plans/2026-05-21-data-unification-items-meta.md +
 * 2026-05-23-data-unification-b-tasks.md):
 *
 *   - DB-Q1 hard-delete on createTask payload failure (R2): a successful
 *     items_meta INSERT followed by a failed tasks_payload INSERT would
 *     leave an orphan meta row that no other code path can reach (role=
 *     task without a payload is not surfaced by fetchTaskTree). The
 *     try/catch hard-deletes the orphan so the next operation starts
 *     from a clean state and Cloud Sync LWW does not propagate a
 *     half-born row.
 *
 *   - DB-Q2 updated_at bump (R3): items_meta.updated_at is the LWW
 *     cursor for Sync; tasks_payload has no own updated_at. Every write
 *     path that touches a row MUST bump items_meta.updated_at, including
 *     payload-only updates and soft-delete / restore. The mapper's
 *     taskUpdatesToPatches always sets metaPatch.updated_at; soft /
 *     restore set it explicitly; permanentDelete physically removes the
 *     row so a bump is moot.
 *
 *   - DB-Q3 composite FK ON DELETE NO ACTION (v3-rev2):
 *     permanentDeleteTask deletes descendants before their parent so PG
 *     never rejects a parent DELETE while a child payload still
 *     references it. The order is computed by sortByDepthDesc against
 *     the union of live + trashed pool so trashed children of a
 *     soft-deleted root are also purged in the right order.
 *
 * migrateTasksToBackend is a deliberate no-op on web (Supabase-native;
 * nothing to migrate). Kept to satisfy the DataService interface.
 */
export class SupabaseTasksService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Bump items_meta.updated_at for write paths that do NOT route through
   * the mapper (which auto-injects updated_at into metaPatch). Used only
   * by code paths that touch items_meta directly without taskUpdates.
   * NOTE: currently inlined into softDelete / restore so the bump and
   * the state change happen in one UPDATE — kept here as the canonical
   * helper for future single-column writes.
   */
  private async bumpItemsMetaUpdatedAt(
    itemId: string,
    now: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .update({ updated_at: now })
      .eq("id", itemId);
    if (error)
      throw new Error(`bumpItemsMetaUpdatedAt failed: ${error.message}`);
  }

  /**
   * Read all live tasks. Two SELECTs (items_meta then tasks_payload)
   * joined in-app: the role=task filter and the explicit shape match
   * keep query intent reviewable, and a missing payload row (R2
   * orphan) is silently dropped from the result so a half-born row
   * never surfaces in the UI. The orphan is still detectable via the
   * R2 detection SQL in db-conventions.md.
   *
   * life-tags S3 (#225): legacy folder rows (task_type='folder') are
   * excluded here client-side (isLegacyFolderRow). Filtering in-app
   * rather than query-side (`.neq`) is deliberate — a PostgREST
   * inequality would also drop NULL task_type rows (NULL comparison),
   * silently hiding plain legacy tasks. A task whose parentId points at
   * an excluded folder still surfaces (orphan tolerance): its own
   * task_type is 'task', so only the folder row itself is dropped.
   */
  async fetchTaskTree(): Promise<TaskNode[]> {
    const metaRows = await fetchAllPages<ItemsMetaRow>(
      (from, to) =>
        this.client
          .from("items_meta")
          .select(ITEMS_META_TASK_COLUMNS)
          .eq("role", "task")
          .eq("is_deleted", false)
          .order("id")
          .range(from, to),
      "fetchTaskTree items_meta",
    );
    if (metaRows.length === 0) return [];

    const ids = metaRows.map((m) => m.id);
    const payloadRows = await fetchByIdChunks<TasksPayloadRow>(ids, (chunk) =>
      fetchAllPages(
        (from, to) =>
          this.client
            .from("tasks_payload")
            .select(TASKS_PAYLOAD_COLUMNS)
            .in("item_id", chunk)
            .order("item_id")
            .range(from, to),
        "fetchTaskTree tasks_payload",
      ),
    );
    const payloadById = new Map<string, TasksPayloadRow>();
    for (const p of payloadRows) payloadById.set(p.item_id, p);

    const out: TaskNode[] = [];
    for (const m of metaRows) {
      const p = payloadById.get(m.id);
      if (!p) continue; // R2 orphan: meta without payload — skip
      if (isLegacyFolderRow(p)) continue; // S3: exclude legacy folder rows
      out.push(rowsToTaskNode(m, p));
    }
    return out;
  }

  /**
   * Count live, unfinished tasks without pulling a single row (#511).
   *
   * The Materials/Todo badge only ever needed a number, but it used to
   * ride on fetchTaskTree() — two paginated SELECTs carrying every column
   * of every task, re-run on each tasks-domain bump. `count: 'exact'` +
   * `head: true` asks PostgREST for the Content-Range header alone, so
   * the response has no body.
   *
   * The predicate reproduces the old in-app derivation clause for clause
   * (badge meaning: materials/materialsCounts.ts):
   *
   *   - role='task' + is_deleted=false — live tasks (what fetchTaskTree
   *     filters on, and what the old `!n.isDeleted` re-checked).
   *   - INNER JOIN on tasks_payload — drops R2 orphans, matching
   *     fetchTaskTree's `if (!p) continue`.
   *   - task_type IS NULL OR <> 'folder' — S3 legacy folder rows
   *     (isLegacyFolderRow). The NULL leg is required: a bare `neq` in
   *     PostgREST also drops NULL rows, which would silently hide every
   *     plain legacy task — the exact trap fetchTaskTree's comment warns
   *     about for the query-side filter.
   *   - status IS NULL OR <> 'DONE' — "still to do". Same NULL trap:
   *     toStatus(null) is undefined, and `undefined !== "DONE"` counted.
   *
   * The old `n.type === "task"` clause has no counterpart on purpose: it
   * could never be false, because toNodeType coerces legacy 'folder' to
   * "task" and the folder rows are already excluded above.
   */
  async countUnfinishedTasks(): Promise<number> {
    const { count, error } = await this.client
      .from("items_meta")
      .select(
        `id, ${livePayloadInnerJoin(
          "tasks_payload",
          "tasks_payload_item_id_fkey",
        )}`,
        { count: "exact", head: true },
      )
      .eq("role", "task")
      .eq("is_deleted", false)
      .or("task_type.is.null,task_type.neq.folder", {
        referencedTable: "tasks_payload",
      })
      .or("status.is.null,status.neq.DONE", {
        referencedTable: "tasks_payload",
      });
    if (error) throw new Error(`countUnfinishedTasks failed: ${error.message}`);
    return count ?? 0;
  }

  /**
   * Trashed counterpart of fetchTaskTree (Trash UI). Legacy folder rows
   * (task_type='folder') are excluded client-side too (S3 #225 — prod
   * has soft-deleted folders that must not surface in Trash).
   */
  async fetchDeletedTasks(): Promise<TaskNode[]> {
    const metaRows = await fetchAllPages<ItemsMetaRow>(
      (from, to) =>
        this.client
          .from("items_meta")
          .select(ITEMS_META_TASK_COLUMNS)
          .eq("role", "task")
          .eq("is_deleted", true)
          .order("id")
          .range(from, to),
      "fetchDeletedTasks items_meta",
    );
    if (metaRows.length === 0) return [];

    const ids = metaRows.map((m) => m.id);
    const payloadRows = await fetchByIdChunks<TasksPayloadRow>(ids, (chunk) =>
      fetchAllPages(
        (from, to) =>
          this.client
            .from("tasks_payload")
            .select(TASKS_PAYLOAD_COLUMNS)
            .in("item_id", chunk)
            .order("item_id")
            .range(from, to),
        "fetchDeletedTasks tasks_payload",
      ),
    );
    const payloadById = new Map<string, TasksPayloadRow>();
    for (const p of payloadRows) payloadById.set(p.item_id, p);

    const out: TaskNode[] = [];
    for (const m of metaRows) {
      const p = payloadById.get(m.id);
      if (!p) continue;
      if (isLegacyFolderRow(p)) continue; // S3: exclude legacy folder rows
      out.push(rowsToTaskNode(m, p));
    }
    return out;
  }

  /**
   * Insert items_meta then tasks_payload. The mapper guarantees the
   * INSERT shape; the try/catch implements R2's hard-delete recovery
   * (DB-Q1): if the payload INSERT fails for ANY reason (network, FK
   * violation on parent_item_id, RLS rejection), the meta row is
   * physically removed so no orphan persists. The hard-delete itself
   * may also fail (e.g. NW dropped after the first INSERT); in that
   * case the throw escapes the catch and the daily R2 detection SQL
   * (Recovery Playbook) sweeps the orphan up later.
   */
  async createTask(node: TaskNode): Promise<TaskNode> {
    const userId = await getAuthedUserId(this.client);
    const { meta, payload } = taskNodeToRows(node, userId);

    const { data: metaRow, error: metaErr } = await this.client
      .from("items_meta")
      .insert(meta)
      .select(ITEMS_META_TASK_COLUMNS)
      .single();
    if (metaErr) throw new Error(`createTask items_meta: ${metaErr.message}`);

    try {
      const { data: payloadRow, error: pErr } = await this.client
        .from("tasks_payload")
        .insert(payload)
        .select(TASKS_PAYLOAD_COLUMNS)
        .single();
      if (pErr) throw new Error(`createTask tasks_payload: ${pErr.message}`);
      return rowsToTaskNode(
        metaRow as unknown as ItemsMetaRow,
        payloadRow as unknown as TasksPayloadRow,
      );
    } catch (err) {
      // R2 hard-delete: remove the orphan meta. A failure here is
      // logged via the thrown error context but does NOT mask the
      // original payload-INSERT failure (rethrow err, not cleanupErr).
      await this.client.from("items_meta").delete().eq("id", meta.id);
      throw err;
    }
  }

  /**
   * Mapper-driven dual UPDATE. metaPatch ALWAYS carries updated_at
   * (DB-Q2 enforcement is in taskUpdatesToPatches, not here). payload
   * UPDATE is skipped when payloadPatch is empty so a metadata-only
   * change (e.g. title) doesn't issue a no-op tasks_payload write.
   * The final read joins the two rows back into a TaskNode — atomic
   * row-snapshot from the caller's perspective even though PostgREST
   * cannot wrap the two writes in a transaction.
   */
  async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    const userId = await getAuthedUserId(this.client);
    const now = new Date().toISOString();
    const { metaPatch, payloadPatch } = taskUpdatesToPatches(
      updates,
      userId,
      now,
    );

    // items_meta UPDATE (metaPatch.updated_at is guaranteed present).
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id);
    if (metaErr) throw new Error(`updateTask items_meta: ${metaErr.message}`);

    if (Object.keys(payloadPatch).length > 0) {
      const { error: pErr } = await this.client
        .from("tasks_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (pErr) throw new Error(`updateTask tasks_payload: ${pErr.message}`);
    }

    // Read-back both rows to materialise the returned TaskNode. Parallel
    // SELECTs because they are independent and small.
    const [
      { data: metaRow, error: metaReadErr },
      { data: payloadRow, error: payloadReadErr },
    ] = await Promise.all([
      this.client
        .from("items_meta")
        .select(ITEMS_META_TASK_COLUMNS)
        .eq("id", id)
        .single(),
      this.client
        .from("tasks_payload")
        .select(TASKS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
    ]);
    if (metaReadErr)
      throw new Error(`updateTask read items_meta: ${metaReadErr.message}`);
    if (payloadReadErr)
      throw new Error(
        `updateTask read tasks_payload: ${payloadReadErr.message}`,
      );
    return rowsToTaskNode(
      metaRow as unknown as ItemsMetaRow,
      payloadRow as unknown as TasksPayloadRow,
    );
  }

  /**
   * Bulk UPSERT for tree-structural rebuilds (DnD reorders that touch
   * many siblings). Two PostgREST upserts keyed on `id` / `item_id`
   * respectively. Each call to the mapper supplies a fresh meta+payload
   * pair, so an UPSERT against an existing row overwrites every column
   * including version — callers that need version-aware merging must
   * compose updateTask instead.
   */
  async syncTaskTree(nodes: TaskNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const userId = await getAuthedUserId(this.client);
    const now = new Date().toISOString();
    const rowsPairs = nodes.map((n) => taskNodeToRows(n, userId));

    // DB-Q2 enforcement on the UPSERT-as-UPDATE branch. taskNodeToRows
    // omits `updated_at` from the meta INSERT row because the items_meta
    // column has `DEFAULT now()` — which only fires on a real INSERT. A
    // PostgREST upsert that hits an existing row becomes a straight
    // UPDATE, and items_meta has no UPDATE-side trigger to refresh
    // updated_at (migration 0008). Without an explicit bump here, a
    // syncTaskTree-driven structural change (e.g. a DnD reorder that
    // rewrites every sibling) would leave updated_at stale and Sync's
    // LWW cursor would never propagate the move. Spread `updated_at:
    // now` so the bump is structural, not caller-dependent.
    const { error: metaErr } = await this.client.from("items_meta").upsert(
      rowsPairs.map((r) => ({ ...r.meta, updated_at: now })),
      { onConflict: "id" },
    );
    if (metaErr) throw new Error(`syncTaskTree items_meta: ${metaErr.message}`);

    const { error: pErr } = await this.client.from("tasks_payload").upsert(
      rowsPairs.map((r) => r.payload),
      { onConflict: "item_id" },
    );
    if (pErr) throw new Error(`syncTaskTree tasks_payload: ${pErr.message}`);
  }

  /**
   * Flip is_deleted=true on items_meta with the matching deleted_at +
   * updated_at bump (DB-Q2). tasks_payload is left untouched: the 1:1
   * FK keeps the payload reachable via the trashed meta, and a restore
   * needs the payload columns intact.
   */
  async softDeleteTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`softDeleteTask: ${error.message}`);
  }

  /** Inverse of softDeleteTask. updated_at is bumped (DB-Q2). */
  async restoreTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`restoreTask: ${error.message}`);
  }

  /**
   * Physical purge with descendants-first ordering (DB-Q3). The
   * composite FK introduced by 0009 is ON DELETE NO ACTION: PG rejects
   * a parent DELETE while a child payload still references it. The
   * pool is live + trashed so a trashed root with trashed children is
   * also purged in a single call. tasks_payload rows are cleaned up by
   * the 0008 ON DELETE CASCADE FK to items_meta — only items_meta
   * needs explicit DELETE statements.
   */
  async permanentDeleteTask(id: string): Promise<void> {
    const [live, deleted] = await Promise.all([
      this.fetchTaskTree(),
      this.fetchDeletedTasks(),
    ]);
    const pool = [...live, ...deleted];

    // collectDescendantIds includes `id` itself in the returned Set.
    const descendantIds = collectDescendantIds(id, pool);
    const idsToDelete = sortByDepthDesc([...descendantIds], pool);

    for (const did of idsToDelete) {
      const { error } = await this.client
        .from("items_meta")
        .delete()
        .eq("id", did);
      if (error)
        throw new Error(`permanentDeleteTask ${did}: ${error.message}`);
    }
  }

  /**
   * Web no-op stub (user-confirmed). On Tauri this migrated local
   * SQLite tasks into the cloud backend; the web build is Supabase-
   * native so there is nothing to migrate. Kept to satisfy the
   * DataService interface and any caller that invokes it
   * unconditionally.
   */
  async migrateTasksToBackend(_nodes: TaskNode[]): Promise<void> {
    void _nodes;
    void this.client; // explicit no-op — bound method but does not touch DB
  }
}

export const PHASE2_TASKS_METHODS = new Set<string>([
  "fetchTaskTree",
  "countUnfinishedTasks",
  "fetchDeletedTasks",
  "createTask",
  "updateTask",
  "syncTaskTree",
  "softDeleteTask",
  "restoreTask",
  "permanentDeleteTask",
  "migrateTasksToBackend",
]);
