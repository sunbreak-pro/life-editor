import type { TaskNode, NodeType, TaskStatus } from "../types/taskTree";

/*
 * Pure TaskNode <-> `public.tasks` row mappers. Extracted from
 * SupabaseDataService so they carry NO `@supabase/supabase-js` /
 * supabaseClient dependency: that keeps the round-trip harness runnable
 * under plain Node ESM (no Vite, no bundler) and isolates the
 * field-by-field contract for review/testing.
 */

/**
 * Row shape of `public.tasks` (0003_tasks_full_schema.sql). snake_case,
 * nullable where the column is nullable. `user_id` is server-derived
 * (RLS default `auth.uid()`) — clients never write it.
 */
export interface TaskRow {
  id: string;
  user_id: string;
  type: string | null;
  title: string;
  parent_id: string | null;
  order: number;
  status: string | null;
  is_expanded: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string | null;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  is_all_day: boolean;
  due_date: string | null;
  content: string | null;
  work_duration_minutes: number | null;
  color: string | null;
  icon: string | null;
  time_memo: string | null;
  version: number;
  folder_type: string | null;
  original_parent_id: string | null;
  priority: number | null;
  reminder_enabled: boolean;
  reminder_offset: number | null;
}

/**
 * Writable subset of a row (no `user_id` — RLS derives it from the JWT;
 * no `due_date` — TaskNode has no corresponding field, the column keeps
 * its DB default). Used for INSERT/UPDATE/UPSERT payloads.
 */
export type TaskWriteRow = Omit<TaskRow, "user_id" | "due_date">;

export const TASK_COLUMNS =
  'id, user_id, type, title, parent_id, "order", status, is_expanded, ' +
  "is_deleted, deleted_at, created_at, completed_at, updated_at, " +
  "scheduled_at, scheduled_end_at, is_all_day, due_date, content, " +
  "work_duration_minutes, color, icon, time_memo, version, folder_type, " +
  "original_parent_id, priority, reminder_enabled, reminder_offset";

// --- Runtime validators (replace the Phase 1 `as TaskNode[...]` casts) ---

const NODE_TYPES: ReadonlySet<string> = new Set(["folder", "task"]);
const TASK_STATUSES: ReadonlySet<string> = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
]);
const FOLDER_TYPES: ReadonlySet<string> = new Set(["normal", "complete"]);
const PRIORITIES: ReadonlySet<number> = new Set([1, 2, 3, 4]);

/**
 * Narrow a DB `type` value to the `NodeType` union. The 0003 CHECK
 * constraint enforces this at the DB layer; this is defence-in-depth so a
 * corrupt/legacy row surfaces a clear error instead of a silent type lie.
 */
export function toNodeType(value: string | null): NodeType {
  if (value === null) return "task"; // legacy rows without an explicit type
  if (NODE_TYPES.has(value)) return value as NodeType;
  throw new Error(`tasks: invalid type "${value}" (expected folder|task)`);
}

export function toStatus(value: string | null): TaskStatus | undefined {
  if (value === null) return undefined;
  if (TASK_STATUSES.has(value)) return value as TaskStatus;
  throw new Error(
    `tasks: invalid status "${value}" (expected NOT_STARTED|IN_PROGRESS|DONE)`,
  );
}

export function toFolderType(
  value: string | null,
): "normal" | "complete" | undefined {
  if (value === null) return undefined;
  if (FOLDER_TYPES.has(value)) return value as "normal" | "complete";
  throw new Error(`tasks: invalid folder_type "${value}"`);
}

export function toPriority(value: number | null): 1 | 2 | 3 | 4 | null {
  if (value === null) return null;
  if (PRIORITIES.has(value)) return value as 1 | 2 | 3 | 4;
  throw new Error(`tasks: invalid priority ${value} (expected 1..4)`);
}

/**
 * DB row -> domain TaskNode. Optional TaskNode fields are only set when
 * the column is non-null so `taskNodeToRow ∘ rowToTaskNode` round-trips
 * without manufacturing `undefined`-vs-absent differences. NOT-NULL
 * columns (is_*, version) are always materialised.
 */
export function rowToTaskNode(row: TaskRow): TaskNode {
  const node: TaskNode = {
    id: row.id,
    type: toNodeType(row.type),
    title: row.title,
    parentId: row.parent_id,
    order: row.order,
    createdAt: row.created_at,
  };

  const status = toStatus(row.status);
  if (status !== undefined) node.status = status;
  node.isExpanded = row.is_expanded;
  node.isDeleted = row.is_deleted;
  if (row.deleted_at !== null) node.deletedAt = row.deleted_at;
  if (row.completed_at !== null) node.completedAt = row.completed_at;
  if (row.updated_at !== null) node.updatedAt = row.updated_at;
  if (row.scheduled_at !== null) node.scheduledAt = row.scheduled_at;
  if (row.scheduled_end_at !== null) node.scheduledEndAt = row.scheduled_end_at;
  node.isAllDay = row.is_all_day;
  if (row.content !== null) node.content = row.content;
  if (row.work_duration_minutes !== null)
    node.workDurationMinutes = row.work_duration_minutes;
  if (row.color !== null) node.color = row.color;
  if (row.icon !== null) node.icon = row.icon;
  if (row.time_memo !== null) node.timeMemo = row.time_memo;
  node.version = row.version;
  const folderType = toFolderType(row.folder_type);
  if (folderType !== undefined) node.folderType = folderType;
  if (row.original_parent_id !== null)
    node.originalParentId = row.original_parent_id;
  node.priority = toPriority(row.priority);
  node.reminderEnabled = row.reminder_enabled;
  if (row.reminder_offset !== null) node.reminderOffset = row.reminder_offset;

  return node;
}

/**
 * Domain TaskNode -> full DB row (minus server-derived columns). Absent
 * optional fields map to their column null/default so an UPSERT fully
 * specifies the row (`syncTaskTree` relies on this for bulk persist).
 */
export function taskNodeToRow(node: TaskNode): TaskWriteRow {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    parent_id: node.parentId,
    order: node.order,
    status: node.status ?? null,
    is_expanded: node.isExpanded ?? false,
    is_deleted: node.isDeleted ?? false,
    deleted_at: node.deletedAt ?? null,
    created_at: node.createdAt,
    completed_at: node.completedAt ?? null,
    updated_at: node.updatedAt ?? null,
    scheduled_at: node.scheduledAt ?? null,
    scheduled_end_at: node.scheduledEndAt ?? null,
    is_all_day: node.isAllDay ?? false,
    content: node.content ?? null,
    work_duration_minutes: node.workDurationMinutes ?? null,
    color: node.color ?? null,
    icon: node.icon ?? null,
    time_memo: node.timeMemo ?? null,
    version: node.version ?? 1,
    folder_type: node.folderType ?? null,
    original_parent_id: node.originalParentId ?? null,
    priority: node.priority ?? null,
    reminder_enabled: node.reminderEnabled ?? false,
    reminder_offset: node.reminderOffset ?? null,
  };
}

/**
 * Build a snake_case patch from a partial TaskNode update. Only keys
 * present on `updates` are emitted so a partial update never clobbers
 * untouched columns.
 */
export function taskUpdatesToPatch(
  updates: Partial<TaskNode>,
): Partial<TaskWriteRow> {
  const patch: Partial<TaskWriteRow> = {};
  if ("type" in updates && updates.type !== undefined)
    patch.type = updates.type;
  if ("title" in updates && updates.title !== undefined)
    patch.title = updates.title;
  if ("parentId" in updates) patch.parent_id = updates.parentId ?? null;
  if ("order" in updates && updates.order !== undefined)
    patch.order = updates.order;
  if ("status" in updates) patch.status = updates.status ?? null;
  if ("isExpanded" in updates) patch.is_expanded = updates.isExpanded ?? false;
  if ("isDeleted" in updates) patch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  if ("createdAt" in updates && updates.createdAt !== undefined)
    patch.created_at = updates.createdAt;
  if ("completedAt" in updates)
    patch.completed_at = updates.completedAt ?? null;
  if ("updatedAt" in updates) patch.updated_at = updates.updatedAt ?? null;
  if ("scheduledAt" in updates)
    patch.scheduled_at = updates.scheduledAt ?? null;
  if ("scheduledEndAt" in updates)
    patch.scheduled_end_at = updates.scheduledEndAt ?? null;
  if ("isAllDay" in updates) patch.is_all_day = updates.isAllDay ?? false;
  if ("content" in updates) patch.content = updates.content ?? null;
  if ("workDurationMinutes" in updates)
    patch.work_duration_minutes = updates.workDurationMinutes ?? null;
  if ("color" in updates) patch.color = updates.color ?? null;
  if ("icon" in updates) patch.icon = updates.icon ?? null;
  if ("timeMemo" in updates) patch.time_memo = updates.timeMemo ?? null;
  if ("version" in updates && updates.version !== undefined)
    patch.version = updates.version;
  if ("folderType" in updates) patch.folder_type = updates.folderType ?? null;
  if ("originalParentId" in updates)
    patch.original_parent_id = updates.originalParentId ?? null;
  if ("priority" in updates) patch.priority = updates.priority ?? null;
  if ("reminderEnabled" in updates)
    patch.reminder_enabled = updates.reminderEnabled ?? false;
  if ("reminderOffset" in updates)
    patch.reminder_offset = updates.reminderOffset ?? null;
  return patch;
}
