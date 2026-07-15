import type { TaskNode, NodeType, TaskStatus } from "../types/taskTree";

/*
 * Pure TaskNode <-> 2-row (items_meta + tasks_payload) mappers (DU-B-2).
 *
 * Historical context: DU-A migrated the legacy `public.tasks` single-table
 * shape (0003) into the unified items_meta (role discriminator) +
 * tasks_payload (per-role business columns) split (0008). The 0009
 * migration further hardens parent_item_id with a composite FK that
 * blocks cross-role parenting at the DB layer.
 *
 * What this module owns:
 *   - The 2-row shape (`ItemsMetaRow` / `TasksPayloadRow`) for SELECTs.
 *   - The 2-row WRITE shape (no `parent_item_role` — it is a generated
 *     stored column the client cannot supply).
 *   - SELECT column lists for items_meta (role=task) + tasks_payload.
 *   - `rowsToTaskNode` / `taskNodeToRows` (INSERT) / `taskUpdatesToPatches`
 *     (UPDATE). All pure: zero `new Date()`, zero Supabase, zero I/O.
 *
 * What this module does NOT own:
 *   - The orphan-cleanup `try/catch` after a failed payload INSERT
 *     (R2 → DU-B-3 SupabaseTasksService.createTask).
 *   - The descendants-first hard-delete order for permanentDelete (Tauri
 *     parity now that the composite FK is `ON DELETE NO ACTION`, v3-rev2).
 *   - The `items_meta.updated_at = now()` bump call itself — but this
 *     module's `taskUpdatesToPatches` ALWAYS emits the bump into
 *     `metaPatch.updated_at` regardless of which payload columns changed,
 *     so SupabaseTasksService cannot accidentally forget it (DB-Q2 / R3).
 *
 * Carries NO `@supabase/supabase-js` dependency: the roundtrip harness
 * runs under plain Node ESM. The 0008 + 0009 migrations are the SSOT for
 * column types and nullability — keep this file in lockstep with them.
 */

// ---------------------------------------------------------------------------
// 1. Row shapes (matches 0008 + 0009 schema verbatim)
// ---------------------------------------------------------------------------

/**
 * Row shape of `public.items_meta` for role='task'. `role` is a CHECK
 * column with 5 allowed values; this mapper is the Tasks-only view, so
 * `role` is narrowed to the `'task'` literal. `user_id` is server-derived
 * (RLS default `auth.uid()`) and clients never write it.
 */
export interface ItemsMetaRow {
  id: string;
  user_id: string;
  role: "task";
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Row shape of `public.tasks_payload`. `parent_item_role` is a generated
 * STORED column (`generated always as ('task')`); it is readable via
 * SELECT but PG rejects it from INSERT/UPDATE statements (SQLSTATE
 * 42601). The WRITE type below strips it.
 */
export interface TasksPayloadRow {
  item_id: string;
  user_id: string;
  parent_item_id: string | null;
  /** Generated stored column — SELECT-only. */
  parent_item_role: "task";
  task_type: "folder" | "task" | null;
  folder_type: "normal" | "complete" | null;
  start_at: string | null;
  due_at: string | null;
  status: TaskStatus | null;
  is_expanded: boolean;
  content: string | null;
  work_duration_minutes: number | null;
  color: string | null;
  icon: string | null;
  time_memo: string | null;
  priority: 1 | 2 | 3 | 4 | null;
  reminder_enabled: boolean;
  reminder_offset: number | null;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  is_all_day: boolean;
  completed_at: string | null;
  original_parent_id: string | null;
  sort_order: number;
}

/**
 * Writable subset for INSERT. `user_id` is the only items_meta column
 * the client must supply (RLS default would fill it, but explicit is
 * safer for cross-device parity); `created_at` / `updated_at` are left
 * to the column DEFAULT `now()` on first INSERT.
 */
export type ItemsMetaInsertRow = Omit<
  ItemsMetaRow,
  "created_at" | "updated_at"
>;

/**
 * Writable subset for INSERT/UPDATE on tasks_payload. `parent_item_role`
 * is a generated stored column and PG rejects any client-supplied value
 * for it — keep it OFF the write type by construction (type-level guard,
 * not runtime check). DU-B-3 callers should not be able to even type
 * the field.
 */
export type TasksPayloadWriteRow = Omit<TasksPayloadRow, "parent_item_role">;

/** UPDATE patch for items_meta. `id` / `user_id` / `role` / `created_at`
 * are never patched. `updated_at` is ALWAYS present (bump responsibility,
 * see `taskUpdatesToPatches`). */
export type ItemsMetaUpdatePatch = Partial<
  Omit<ItemsMetaRow, "id" | "user_id" | "role" | "created_at">
>;

/** UPDATE patch for tasks_payload. `item_id` / `user_id` /
 * `parent_item_role` are never patched. */
export type TasksPayloadUpdatePatch = Partial<
  Omit<TasksPayloadRow, "item_id" | "user_id" | "parent_item_role">
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists (literal strings to keep query intent reviewable)
// ---------------------------------------------------------------------------

/**
 * SELECT column list for `items_meta` rows of role='task'. The role
 * filter is the caller's responsibility (e.g. `.eq('role', 'task')`).
 */
export const ITEMS_META_TASK_COLUMNS =
  "id, user_id, role, title, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

/**
 * SELECT column list for `tasks_payload`. Includes `parent_item_role`
 * (the generated column) so callers can verify the FK invariant if
 * they want; INSERT/UPDATE paths must not include it (use
 * `TasksPayloadWriteRow`).
 */
export const TASKS_PAYLOAD_COLUMNS =
  "item_id, user_id, parent_item_id, parent_item_role, task_type, " +
  "folder_type, start_at, due_at, status, is_expanded, content, " +
  "work_duration_minutes, color, icon, time_memo, priority, " +
  "reminder_enabled, reminder_offset, scheduled_at, scheduled_end_at, " +
  "is_all_day, completed_at, original_parent_id, sort_order";

// ---------------------------------------------------------------------------
// 3. Runtime validators (defence-in-depth; CHECK constraints already enforce
//    these at the DB layer, but a corrupt/legacy row should fail loud).
// ---------------------------------------------------------------------------

// NODE_TYPES still includes the legacy "folder" value: the DB column keeps
// it (rollback), and a folder row must be *recognisable* (isLegacyFolderRow)
// even though it can no longer be materialised as a distinct NodeType.
const NODE_TYPES: ReadonlySet<string> = new Set(["folder", "task"]);
const TASK_STATUSES: ReadonlySet<string> = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
]);
const PRIORITIES: ReadonlySet<number> = new Set([1, 2, 3, 4]);

/**
 * Narrow a DB `task_type` value to the `NodeType` union.
 *
 * life-tags S3 (#225): NodeType is now single-valued ("task"). The DB column
 * still carries a legacy "folder" value for rows created before the
 * retirement; those rows are excluded upstream by the fetch filter
 * (`isLegacyFolderRow` / SupabaseDataService.fetchTaskTree), so this narrower
 * normally only ever sees "task" | null. A stray "folder" that reaches here
 * is coerced to "task" (defence-in-depth — it has already been filtered out
 * of every UI-facing fetch). A genuinely unknown value still throws.
 */
export function toNodeType(value: string | null): NodeType {
  if (value === null) return "task"; // legacy / unset → task
  if (NODE_TYPES.has(value)) return "task"; // "task" | legacy "folder" → task
  throw new Error(
    `tasks_payload: invalid task_type "${value}" (expected folder|task)`,
  );
}

/**
 * True when a tasks_payload row is a legacy folder (task_type = 'folder').
 * life-tags S3 retired the folder node type, but prod still has a handful of
 * such rows (active + soft-deleted) until the user runs the data migration.
 * The fetch paths use this to exclude them from the materialised TaskNode set
 * so they never surface as phantom nodes. A NULL task_type is NOT a folder
 * (legacy / unset rows default to a plain task).
 */
export function isLegacyFolderRow(
  payload: Pick<TasksPayloadRow, "task_type">,
): boolean {
  return payload.task_type === "folder";
}

export function toStatus(value: string | null): TaskStatus | undefined {
  if (value === null) return undefined;
  if (TASK_STATUSES.has(value)) return value as TaskStatus;
  throw new Error(
    `tasks_payload: invalid status "${value}" (expected NOT_STARTED|IN_PROGRESS|DONE)`,
  );
}

export function toPriority(value: number | null): 1 | 2 | 3 | 4 | null {
  if (value === null) return null;
  if (PRIORITIES.has(value)) return value as 1 | 2 | 3 | 4;
  throw new Error(`tasks_payload: invalid priority ${value} (expected 1..4)`);
}

// ---------------------------------------------------------------------------
// 4. SELECT: 2 rows -> TaskNode
// ---------------------------------------------------------------------------

/**
 * Materialise a domain TaskNode from one items_meta row (role='task') +
 * its matching tasks_payload row. Optional fields are only set when the
 * underlying column is non-null so `taskNodeToRows ∘ rowsToTaskNode`
 * round-trips without manufacturing `undefined`-vs-absent differences.
 * NOT-NULL columns (is_expanded / is_deleted / is_all_day /
 * reminder_enabled / version) are always materialised.
 *
 * Naming mapping (TS camelCase <-> DB snake_case + 2-table split):
 *   meta.title           <- title
 *   meta.is_deleted      <- isDeleted
 *   meta.deleted_at      <- deletedAt
 *   meta.created_at      <- createdAt
 *   meta.updated_at      <- updatedAt
 *   meta.version         <- version
 *   payload.parent_item_id <- parentId
 *   payload.task_type    <- type             (S3: only 'task' now; legacy
 *                                             'folder' rows are excluded
 *                                             upstream — see isLegacyFolderRow)
 *   payload.sort_order   <- order            (DU-A m1 rename)
 *   payload.is_expanded  <- isExpanded
 *   payload.is_all_day   <- isAllDay
 *   payload.reminder_enabled <- reminderEnabled
 *   payload.reminder_offset  <- reminderOffset
 *   payload.scheduled_at     <- scheduledAt
 *   payload.scheduled_end_at <- scheduledEndAt
 *   payload.completed_at     <- completedAt
 *   payload.work_duration_minutes <- workDurationMinutes
 *   payload.time_memo        <- timeMemo
 *   payload.{content,color,icon,priority,status} pass-through
 *   payload.{start_at,due_at}  — NOT YET surfaced (no TaskNode field;
 *     reserved for future scheduling work, written as NULL by
 *     `taskNodeToRows`).
 */
export function rowsToTaskNode(
  meta: ItemsMetaRow,
  payload: TasksPayloadRow,
): TaskNode {
  if (meta.id !== payload.item_id) {
    throw new Error(
      `taskMapper: row mismatch — meta.id="${meta.id}" but payload.item_id="${payload.item_id}"`,
    );
  }
  if (meta.role !== "task") {
    throw new Error(
      `taskMapper: items_meta.role expected "task" but got "${meta.role}"`,
    );
  }

  const node: TaskNode = {
    id: meta.id,
    type: toNodeType(payload.task_type),
    title: meta.title,
    parentId: payload.parent_item_id,
    order: payload.sort_order,
    createdAt: meta.created_at,
  };

  const status = toStatus(payload.status);
  if (status !== undefined) node.status = status;
  node.isExpanded = payload.is_expanded;
  node.isDeleted = meta.is_deleted;
  if (meta.deleted_at !== null) node.deletedAt = meta.deleted_at;
  if (payload.completed_at !== null) node.completedAt = payload.completed_at;
  // items_meta.updated_at is NOT NULL — always surface it.
  node.updatedAt = meta.updated_at;
  if (payload.scheduled_at !== null) node.scheduledAt = payload.scheduled_at;
  if (payload.scheduled_end_at !== null)
    node.scheduledEndAt = payload.scheduled_end_at;
  node.isAllDay = payload.is_all_day;
  if (payload.content !== null) node.content = payload.content;
  if (payload.work_duration_minutes !== null)
    node.workDurationMinutes = payload.work_duration_minutes;
  if (payload.color !== null) node.color = payload.color;
  if (payload.icon !== null) node.icon = payload.icon;
  if (payload.time_memo !== null) node.timeMemo = payload.time_memo;
  node.version = meta.version;
  node.priority = toPriority(payload.priority);
  node.reminderEnabled = payload.reminder_enabled;
  if (payload.reminder_offset !== null)
    node.reminderOffset = payload.reminder_offset;

  return node;
}

// ---------------------------------------------------------------------------
// 5. INSERT: TaskNode -> { meta, payload }
// ---------------------------------------------------------------------------

/**
 * Project a TaskNode into the 2 INSERT rows. `created_at` /
 * `updated_at` are deliberately NOT included on the meta row — let the
 * column DEFAULT `now()` handle the first write (DB-Q2 only applies on
 * UPDATE). The payload row excludes `parent_item_role` by type
 * construction (generated stored column).
 *
 * DU-B-3 callers must INSERT items_meta first, then tasks_payload (FK
 * `tasks_payload.item_id -> items_meta.id` enforces this order). If the
 * payload INSERT fails, the caller must hard-delete the orphan
 * items_meta row (R2 Recovery Playbook — v2 改訂: NOT soft-delete, to
 * avoid polluting other devices' TrashView with a same-session ghost).
 */
export function taskNodeToRows(
  node: TaskNode,
  userId: string,
): { meta: ItemsMetaInsertRow; payload: TasksPayloadWriteRow } {
  const meta: ItemsMetaInsertRow = {
    id: node.id,
    user_id: userId,
    role: "task",
    title: node.title,
    is_deleted: node.isDeleted ?? false,
    deleted_at: node.deletedAt ?? null,
    version: node.version ?? 1,
  };

  const payload: TasksPayloadWriteRow = {
    item_id: node.id,
    user_id: userId,
    parent_item_id: node.parentId,
    // S3: NodeType is single-valued, so task_type is always 'task' and
    // folder_type is always NULL for client-written rows. The columns
    // survive for rollback / legacy-row detection only.
    task_type: node.type,
    folder_type: null,
    // start_at / due_at have no TaskNode field yet — write NULL so an
    // UPSERT fully specifies the row without clobbering future data.
    start_at: null,
    due_at: null,
    status: node.status ?? null,
    is_expanded: node.isExpanded ?? false,
    content: node.content ?? null,
    work_duration_minutes: node.workDurationMinutes ?? null,
    color: node.color ?? null,
    icon: node.icon ?? null,
    time_memo: node.timeMemo ?? null,
    priority: node.priority ?? null,
    reminder_enabled: node.reminderEnabled ?? false,
    reminder_offset: node.reminderOffset ?? null,
    scheduled_at: node.scheduledAt ?? null,
    scheduled_end_at: node.scheduledEndAt ?? null,
    is_all_day: node.isAllDay ?? false,
    completed_at: node.completedAt ?? null,
    original_parent_id: null,
    sort_order: node.order,
  };

  return { meta, payload };
}

// ---------------------------------------------------------------------------
// 6. UPDATE: Partial<TaskNode> -> { metaPatch, payloadPatch }
// ---------------------------------------------------------------------------

/**
 * Build snake_case PATCH objects for items_meta + tasks_payload from a
 * partial TaskNode update. Only keys explicitly present on `updates`
 * are emitted so a partial UPDATE never clobbers untouched columns.
 *
 * DB-Q2 contract — `metaPatch.updated_at = now` is ALWAYS set,
 * regardless of which payload columns the caller changed. Reason: Sync
 * uses `items_meta.updated_at` as its LWW cursor, and tasks_payload has
 * no own `updated_at` column (single-owner via the 1:1 FK). If a caller
 * patches only payload columns and forgets to bump meta, other devices
 * will never pull the change. Centralising the bump here makes "forgot
 * to bump" structurally impossible — see `taskMapper.test.ts` for the
 * regression case.
 *
 * `now` is injected (not `new Date().toISOString()`) so:
 *   - the mapper stays pure / side-effect-free (testability);
 *   - SupabaseTasksService can supply a single consistent timestamp for
 *     a batch operation.
 */
export function taskUpdatesToPatches(
  updates: Partial<TaskNode>,
  userId: string,
  now: string,
): { metaPatch: ItemsMetaUpdatePatch; payloadPatch: TasksPayloadUpdatePatch } {
  // -- meta side --
  // DB-Q2: ALWAYS bump updated_at, even if the caller is only patching
  // payload columns. This is the single point of enforcement.
  const metaPatch: ItemsMetaUpdatePatch = { updated_at: now };
  if ("title" in updates && updates.title !== undefined)
    metaPatch.title = updates.title;
  if ("isDeleted" in updates) metaPatch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) metaPatch.deleted_at = updates.deletedAt ?? null;
  if ("version" in updates && updates.version !== undefined)
    metaPatch.version = updates.version;

  // -- payload side --
  const payloadPatch: TasksPayloadUpdatePatch = {};
  // `userId` is currently only used if the caller updates row identity
  // (it never does on this code path) — keep the parameter in the
  // signature for future symmetry with `taskNodeToRows` and to make the
  // mapper self-documenting about *whose* update it is.
  void userId;

  if ("type" in updates && updates.type !== undefined)
    payloadPatch.task_type = updates.type;
  if ("parentId" in updates)
    payloadPatch.parent_item_id = updates.parentId ?? null;
  if ("order" in updates && updates.order !== undefined)
    payloadPatch.sort_order = updates.order;
  if ("status" in updates) payloadPatch.status = updates.status ?? null;
  if ("isExpanded" in updates)
    payloadPatch.is_expanded = updates.isExpanded ?? false;
  if ("completedAt" in updates)
    payloadPatch.completed_at = updates.completedAt ?? null;
  if ("scheduledAt" in updates)
    payloadPatch.scheduled_at = updates.scheduledAt ?? null;
  if ("scheduledEndAt" in updates)
    payloadPatch.scheduled_end_at = updates.scheduledEndAt ?? null;
  if ("isAllDay" in updates)
    payloadPatch.is_all_day = updates.isAllDay ?? false;
  if ("content" in updates) payloadPatch.content = updates.content ?? null;
  if ("workDurationMinutes" in updates)
    payloadPatch.work_duration_minutes = updates.workDurationMinutes ?? null;
  if ("color" in updates) payloadPatch.color = updates.color ?? null;
  if ("icon" in updates) payloadPatch.icon = updates.icon ?? null;
  if ("timeMemo" in updates) payloadPatch.time_memo = updates.timeMemo ?? null;
  // S3: folderType / originalParentId are no longer TaskNode fields, so no
  // update path emits folder_type / original_parent_id patches.
  if ("priority" in updates) payloadPatch.priority = updates.priority ?? null;
  if ("reminderEnabled" in updates)
    payloadPatch.reminder_enabled = updates.reminderEnabled ?? false;
  if ("reminderOffset" in updates)
    payloadPatch.reminder_offset = updates.reminderOffset ?? null;

  return { metaPatch, payloadPatch };
}
