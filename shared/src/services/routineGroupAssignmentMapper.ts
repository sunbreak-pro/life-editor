import type { RoutineGroupAssignment } from "../types/routineGroup";

/*
 * Pure RoutineGroupAssignment <-> `public.routine_group_assignments` row
 * mappers (Phase 2 S4-1). NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: RELATION + soft-delete, NO version. The V69 junction
 * carries `is_deleted`/`deleted_at` (an unassign replicates via delta
 * sync — Issue 008 soft-delete-aware relation) but no `version` column;
 * delta sync pages it by `updated_at`. UNIQUE(routine_id, group_id) is a
 * DB constraint (a routine joins a group at most once) — not modelled in
 * the mapper, enforced by 0006.
 *
 * Every RoutineGroupAssignment field is required by the type, so this is
 * a straight bijection — there is no JSON / number[] coercion here and
 * no optional-vs-absent ambiguity.
 */

/**
 * SELECTED row shape of `public.routine_group_assignments`
 * (0006_schedule_full_schema.sql). `user_id` is server-derived (RLS
 * default `auth.uid()`). No `version` column (relation table).
 */
export interface RoutineGroupAssignmentRow {
  id: string;
  user_id: string;
  routine_id: string;
  group_id: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

/**
 * Writable subset of a row. Excludes `user_id` only (RLS-derived).
 */
export type RoutineGroupAssignmentWriteRow = Omit<
  RoutineGroupAssignmentRow,
  "user_id"
>;

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule).
 */
export const ROUTINE_GROUP_ASSIGNMENT_SELECT_COLUMNS =
  "id, user_id, routine_id, group_id, created_at, updated_at, " +
  "is_deleted, deleted_at";

/**
 * DB row -> domain RoutineGroupAssignment. Straight bijection (every
 * field required by the type, no coercion).
 */
export function rowToRoutineGroupAssignment(
  row: RoutineGroupAssignmentRow,
): RoutineGroupAssignment {
  return {
    id: row.id,
    routineId: row.routine_id,
    groupId: row.group_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

/**
 * Domain RoutineGroupAssignment -> full writable DB row (minus
 * server-derived user_id). Used for INSERT/UPSERT.
 */
export function routineGroupAssignmentToRow(
  a: RoutineGroupAssignment,
): RoutineGroupAssignmentWriteRow {
  return {
    id: a.id,
    routine_id: a.routineId,
    group_id: a.groupId,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
    is_deleted: a.isDeleted,
    deleted_at: a.deletedAt,
  };
}

/**
 * Build a snake_case patch from a partial RoutineGroupAssignment update.
 * Only keys PRESENT on `updates` are emitted (Issue 020 partial-payload
 * safety). The relation's only mutable surface beyond create/delete is
 * the soft-delete flip (unassign = is_deleted=true + deleted_at). `id` /
 * `routine_id` / `group_id` / `created_at` are immutable through this
 * path (the pair is the logical identity).
 */
export function routineGroupAssignmentUpdatesToPatch(
  updates: Partial<Pick<RoutineGroupAssignment, "isDeleted" | "deletedAt">>,
): Partial<RoutineGroupAssignmentWriteRow> {
  const patch: Partial<RoutineGroupAssignmentWriteRow> = {};
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    patch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  return patch;
}
