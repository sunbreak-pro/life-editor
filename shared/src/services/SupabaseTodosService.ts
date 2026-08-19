import { type SupabaseClient } from "@supabase/supabase-js";
import type { TodosDataService } from "./DataService";
import type { TodoNode } from "../types/todoTree";
// DU-B-3: full SupabaseTodosService rewrite over items_meta +
// tasks_payload. Pure mapping lives in todoMapper.ts; this file is the
// I/O layer only. Re-exports at the bottom of SupabaseDataService.ts keep
// one stable surface for host modules and the round-trip harness.
import {
  ITEMS_META_TASK_COLUMNS,
  TASKS_PAYLOAD_COLUMNS,
  rowsToTodoNode,
  todoNodeToRows,
  todoUpdatesToPatches,
  isLegacyFolderRow,
  type TasksPayloadRow,
} from "./todoMapper";
import type { ItemsMetaRow } from "./itemsMeta";
import { collectDescendantIds } from "../utils/getDescendantTodos";
import { sortByDepthDesc } from "../utils/sortByDepthDesc";
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import {
  getAuthedUserId,
  livePayloadInnerJoin,
} from "./supabaseServiceHelpers";
import { requireSingleRow, requireRowPair } from "./postgrestSingle";

/*
 * Todos domain (DU-B-3). Full 9-method rewrite over the items_meta
 * (role='task') + tasks_payload 2-row split introduced in migration
 * 0008 and hardened by 0009 (composite FK + parent_item_role generated
 * stored). Pure mapping lives in todoMapper.ts; this class is the I/O
 * layer only.
 *
 * Write-path invariants enforced here (parent SSOT:
 * docs/vision/plans/2026-05-21-data-unification-items-meta.md +
 * 2026-05-23-data-unification-b-todos.md):
 *
 *   - DB-Q1 hard-delete on createTodo payload failure (R2): a successful
 *     items_meta INSERT followed by a failed tasks_payload INSERT would
 *     leave an orphan meta row that no other code path can reach (role=
 *     todo without a payload is not surfaced by fetchTodoTree). The
 *     try/catch hard-deletes the orphan so the next operation starts
 *     from a clean state and Cloud Sync LWW does not propagate a
 *     half-born row.
 *
 *   - DB-Q2 updated_at bump (R3): items_meta.updated_at is the LWW
 *     cursor for Sync; tasks_payload has no own updated_at. Every write
 *     path that touches a row MUST bump items_meta.updated_at, including
 *     payload-only updates and soft-delete / restore. The mapper's
 *     todoUpdatesToPatches always sets metaPatch.updated_at; soft /
 *     restore set it explicitly; permanentDelete physically removes the
 *     row so a bump is moot.
 *
 *   - DB-Q3 composite FK ON DELETE NO ACTION (v3-rev2):
 *     permanentDeleteTodo deletes descendants before their parent so PG
 *     never rejects a parent DELETE while a child payload still
 *     references it. The order is computed by sortByDepthDesc against
 *     the union of live + trashed pool so trashed children of a
 *     soft-deleted root are also purged in the right order.
 *
 *   - #1099 role guard on every items_meta UPDATE: #625 converts an item
 *     between Todo and Event while KEEPING its id (D-20260810-sched-2), so
 *     `items_meta.id` alone stopped being a safe address. An undo entry, a
 *     queued toast action or a stale detail panel still holding the id would
 *     otherwise fire a Todo write at a row that is now an Event. Adding
 *     `.eq("role", "task")` turns that into a zero-row miss instead of a
 *     cross-role write. #996 (PR #1080) closed the Event/Routine side; this
 *     is the Todo side. NOTE the role literal is "task", not "todo" — the
 *     domain was renamed but the discriminator value stayed put (#831).
 *
 * migrateTodosToBackend is a deliberate no-op on web (Supabase-native;
 * nothing to migrate). Kept to satisfy the DataService interface.
 */
export class SupabaseTodosService implements TodosDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Bump items_meta.updated_at for write paths that do NOT route through
   * the mapper (which auto-injects updated_at into metaPatch). Used only
   * by code paths that touch items_meta directly without todoUpdates.
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
      .eq("id", itemId)
      .eq("role", "task");
    if (error)
      throw new Error(`bumpItemsMetaUpdatedAt failed: ${error.message}`);
  }

  /**
   * Read all live todos. Two SELECTs (items_meta then tasks_payload)
   * joined in-app: the role=todo filter and the explicit shape match
   * keep query intent reviewable, and a missing payload row (R2
   * orphan) is silently dropped from the result so a half-born row
   * never surfaces in the UI. The orphan is still detectable via the
   * R2 detection SQL in db-conventions.md.
   *
   * life-tags S3 (#225): legacy folder rows (task_type='folder') are
   * excluded here client-side (isLegacyFolderRow). Filtering in-app
   * rather than query-side (`.neq`) is deliberate — a PostgREST
   * inequality would also drop NULL task_type rows (NULL comparison),
   * silently hiding plain legacy todos. A todo whose parentId points at
   * an excluded folder still surfaces (orphan tolerance): its own
   * task_type is 'task', so only the folder row itself is dropped.
   */
  async fetchTodoTree(): Promise<TodoNode[]> {
    return fetchMetaFirstJoin<ItemsMetaRow, TasksPayloadRow, TodoNode>({
      client: this.client,
      role: "task",
      isDeleted: false,
      metaColumns: ITEMS_META_TASK_COLUMNS,
      metaLabel: "fetchTodoTree items_meta",
      payloadTable: "tasks_payload",
      payloadColumns: TASKS_PAYLOAD_COLUMNS,
      payloadLabel: "fetchTodoTree tasks_payload",
      keep: (p) => !isLegacyFolderRow(p), // S3: exclude legacy folder rows
      toDomain: rowsToTodoNode,
    });
  }

  /**
   * Count live, unfinished todos without pulling a single row (#511).
   *
   * The Materials/Todo badge only ever needed a number, but it used to
   * ride on fetchTodoTree() — two paginated SELECTs carrying every column
   * of every todo, re-run on each todos-domain bump. `count: 'exact'` +
   * `head: true` asks PostgREST for the Content-Range header alone, so
   * the response has no body.
   *
   * The predicate reproduces the old in-app derivation clause for clause
   * (badge meaning: materials/materialsCounts.ts):
   *
   *   - role='task' + is_deleted=false — live todos (what fetchTodoTree
   *     filters on, and what the old `!n.isDeleted` re-checked).
   *   - INNER JOIN on tasks_payload — drops R2 orphans, matching
   *     fetchTodoTree's `if (!p) continue`.
   *   - task_type IS NULL OR <> 'folder' — S3 legacy folder rows
   *     (isLegacyFolderRow). The NULL leg is required: a bare `neq` in
   *     PostgREST also drops NULL rows, which would silently hide every
   *     plain legacy todo — the exact trap fetchTodoTree's comment warns
   *     about for the query-side filter.
   *   - status IS NULL OR <> 'DONE' — "still to do". Same NULL trap:
   *     toStatus(null) is undefined, and `undefined !== "DONE"` counted.
   *
   * The old `n.type === "task"` clause has no counterpart on purpose: it
   * could never be false, because toNodeType coerces legacy 'folder' to
   * "task" and the folder rows are already excluded above.
   */
  async countUnfinishedTodos(): Promise<number> {
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
    if (error) throw new Error(`countUnfinishedTodos failed: ${error.message}`);
    return count ?? 0;
  }

  /**
   * Trashed counterpart of fetchTodoTree (Trash UI). Legacy folder rows
   * (task_type='folder') are excluded client-side too (S3 #225 — prod
   * has soft-deleted folders that must not surface in Trash).
   */
  async fetchDeletedTodos(): Promise<TodoNode[]> {
    return fetchMetaFirstJoin<ItemsMetaRow, TasksPayloadRow, TodoNode>({
      client: this.client,
      role: "task",
      isDeleted: true,
      metaColumns: ITEMS_META_TASK_COLUMNS,
      metaLabel: "fetchDeletedTodos items_meta",
      payloadTable: "tasks_payload",
      payloadColumns: TASKS_PAYLOAD_COLUMNS,
      payloadLabel: "fetchDeletedTodos tasks_payload",
      keep: (p) => !isLegacyFolderRow(p), // S3: exclude legacy folder rows
      toDomain: rowsToTodoNode,
    });
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
  async createTodo(node: TodoNode): Promise<TodoNode> {
    const userId = await getAuthedUserId(this.client);
    const { meta, payload } = todoNodeToRows(node, userId);

    const metaRow = await requireSingleRow<ItemsMetaRow>(
      this.client
        .from("items_meta")
        .insert(meta)
        .select(ITEMS_META_TASK_COLUMNS)
        .single(),
      "createTodo items_meta",
    );

    try {
      const payloadRow = await requireSingleRow<TasksPayloadRow>(
        this.client
          .from("tasks_payload")
          .insert(payload)
          .select(TASKS_PAYLOAD_COLUMNS)
          .single(),
        "createTodo tasks_payload",
      );
      return rowsToTodoNode(metaRow, payloadRow);
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
   * (DB-Q2 enforcement is in todoUpdatesToPatches, not here). payload
   * UPDATE is skipped when payloadPatch is empty so a metadata-only
   * change (e.g. title) doesn't issue a no-op tasks_payload write.
   * The final read joins the two rows back into a TodoNode — atomic
   * row-snapshot from the caller's perspective even though PostgREST
   * cannot wrap the two writes in a transaction.
   */
  async updateTodo(id: string, updates: Partial<TodoNode>): Promise<TodoNode> {
    const userId = await getAuthedUserId(this.client);
    const now = new Date().toISOString();
    const { metaPatch, payloadPatch } = todoUpdatesToPatches(
      updates,
      userId,
      now,
    );

    // items_meta UPDATE (metaPatch.updated_at is guaranteed present).
    // The role filter (#1099) makes a converted row a zero-row miss rather
    // than a cross-role write. This one method does not END at the miss,
    // though: the read-back below rejects either way, so the caller learns
    // the item moved instead of receiving a stale node. Which error it gets
    // depends on whether conversion's best-effort payload drop landed — a
    // missing tasks_payload row fails `requireRowPair`, a stray one reaches
    // `rowsToTodoNode` and trips assertItemsMetaPair on role. The void write
    // paths (softDelete / restore) have no read-back and therefore do end at
    // the silent miss, which is the right outcome for a stale undo entry.
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id)
      .eq("role", "task");
    if (metaErr) throw new Error(`updateTodo items_meta: ${metaErr.message}`);

    // No role filter needed on the payload table: `tasks_payload` only ever
    // holds task rows, and conversion drops the row for the id it moves
    // (SupabaseItemConversionService "drop tasks_payload"). A stray row left
    // by a failed best-effort drop is an orphan the db-conventions §10.5
    // detection query owns, not something a WHERE clause here can fix.
    if (Object.keys(payloadPatch).length > 0) {
      const { error: pErr } = await this.client
        .from("tasks_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (pErr) throw new Error(`updateTodo tasks_payload: ${pErr.message}`);
    }

    // Read-back both rows to materialise the returned TodoNode. Parallel
    // SELECTs because they are independent and small.
    const [metaRow, payloadRow] = await requireRowPair<
      ItemsMetaRow,
      TasksPayloadRow
    >(
      this.client
        .from("items_meta")
        .select(ITEMS_META_TASK_COLUMNS)
        .eq("id", id)
        .single(),
      "updateTodo read items_meta",
      this.client
        .from("tasks_payload")
        .select(TASKS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
      "updateTodo read tasks_payload",
    );
    return rowsToTodoNode(metaRow, payloadRow);
  }

  /**
   * Bulk UPSERT for tree-structural rebuilds (DnD reorders that touch
   * many siblings). Two PostgREST upserts keyed on `id` / `item_id`
   * respectively. Each call to the mapper supplies a fresh meta+payload
   * pair, so an UPSERT against an existing row overwrites every column
   * including version — callers that need version-aware merging must
   * compose updateTodo instead.
   */
  async syncTodoTree(nodes: TodoNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const userId = await getAuthedUserId(this.client);
    const now = new Date().toISOString();
    const rowsPairs = nodes.map((n) => todoNodeToRows(n, userId));

    // DB-Q2 enforcement on the UPSERT-as-UPDATE branch. todoNodeToRows
    // omits `updated_at` from the meta INSERT row because the items_meta
    // column has `DEFAULT now()` — which only fires on a real INSERT. A
    // PostgREST upsert that hits an existing row becomes a straight
    // UPDATE, and items_meta has no UPDATE-side trigger to refresh
    // updated_at (migration 0008). Without an explicit bump here, a
    // syncTodoTree-driven structural change (e.g. a DnD reorder that
    // rewrites every sibling) would leave updated_at stale and Sync's
    // LWW cursor would never propagate the move. Spread `updated_at:
    // now` so the bump is structural, not caller-dependent.
    const { error: metaErr } = await this.client.from("items_meta").upsert(
      rowsPairs.map((r) => ({ ...r.meta, updated_at: now })),
      { onConflict: "id" },
    );
    if (metaErr) throw new Error(`syncTodoTree items_meta: ${metaErr.message}`);

    const { error: pErr } = await this.client.from("tasks_payload").upsert(
      rowsPairs.map((r) => r.payload),
      { onConflict: "item_id" },
    );
    if (pErr) throw new Error(`syncTodoTree tasks_payload: ${pErr.message}`);
  }

  /**
   * Flip is_deleted=true on items_meta with the matching deleted_at +
   * updated_at bump (DB-Q2). tasks_payload is left untouched: the 1:1
   * FK keeps the payload reachable via the trashed meta, and a restore
   * needs the payload columns intact.
   */
  async softDeleteTodo(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("role", "task");
    if (error) throw new Error(`softDeleteTodo: ${error.message}`);
  }

  /** Inverse of softDeleteTodo. updated_at is bumped (DB-Q2). */
  async restoreTodo(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id)
      .eq("role", "task");
    if (error) throw new Error(`restoreTodo: ${error.message}`);
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
  async permanentDeleteTodo(id: string): Promise<void> {
    const [live, deleted] = await Promise.all([
      this.fetchTodoTree(),
      this.fetchDeletedTodos(),
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
        throw new Error(`permanentDeleteTodo ${did}: ${error.message}`);
    }
  }

  /**
   * Web no-op stub (user-confirmed). On Tauri this migrated local
   * SQLite todos into the cloud backend; the web build is Supabase-
   * native so there is nothing to migrate. Kept to satisfy the
   * DataService interface and any caller that invokes it
   * unconditionally.
   */
  async migrateTodosToBackend(_nodes: TodoNode[]): Promise<void> {
    void _nodes;
    void this.client; // explicit no-op — bound method but does not touch DB
  }
}

export const PHASE2_TODOS_METHOD_NAMES = [
  "fetchTodoTree",
  "countUnfinishedTodos",
  "fetchDeletedTodos",
  "createTodo",
  "updateTodo",
  "syncTodoTree",
  "softDeleteTodo",
  "restoreTodo",
  "permanentDeleteTodo",
  "migrateTodosToBackend",
] as const;

export type TodosMethodName = (typeof PHASE2_TODOS_METHOD_NAMES)[number];

export const PHASE2_TODOS_METHODS: ReadonlySet<string> = new Set(
  PHASE2_TODOS_METHOD_NAMES,
);
