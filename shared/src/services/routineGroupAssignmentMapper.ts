import type { RoutineGroupAssignment } from "../types/routineGroup";

/*
 * Pure RoutineGroupAssignment <-> `public.routine_group_assignments` row
 * mappers (DU-C-2). NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: RELATION + soft-delete, NO version. The junction carries
 * `is_deleted` + `deleted_at` (Issue 008 soft-delete-aware relation
 * — an unassign replicates via delta sync) and no `version` column;
 * delta sync pages it by `updated_at`. The 0008 schema partial UNIQUE
 * `(routine_item_id, group_id) WHERE is_deleted = false` enforces a
 * routine joins a group at most once (a soft-deleted row may be re-
 * created).
 *
 * COLUMN RENAME (0006 → 0008): `routine_id` → `routine_item_id` (FK now
 * targets items_meta(id), not the legacy routines table). The legacy
 * mapper used `routine_id`; the V2 API uses `routine_item_id`. The
 * domain `RoutineGroupAssignment.routineId` stays the same — only the
 * DB column rename is plumbed through.
 *
 * COLUMN DROP (0006 → 0008): the 0008 schema has NO `created_at` column
 * (the relation lifecycle is `(updated_at, is_deleted)` only). The
 * domain `RoutineGroupAssignment.createdAt` is kept on the type for
 * back-compat but the V2 mapper synthesises it from `updated_at` (best-
 * effort — first INSERT has updated_at == effective createdAt). DU-C-4
 * service rewrite will drop createdAt from the domain type once UI
 * surfaces no longer reference it.
 *
 * DB-Q2: the relation has NO items_meta indirection but still bumps
 * `updated_at` on every patch (Cloud Sync LWW cursor + delta query).
 */

// ---------------------------------------------------------------------------
// V2 (DU-C-2) — 0008 schema (routine_item_id FK to items_meta, no created_at)
// ---------------------------------------------------------------------------

/**
 * SELECTED row shape of `public.routine_group_assignments` (0008
 * schema — DU-C-2). `user_id` is server-derived (RLS default
 * `auth.uid()`). No `version` column (relation table). No `created_at`
 * (the relation lifecycle is updated_at + is_deleted only).
 */
export interface RoutineGroupAssignmentRowV2 {
  id: string;
  user_id: string;
  routine_item_id: string;
  group_id: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

/** Writable subset for INSERT/UPSERT (server-derived `user_id` is filled
 *  by RLS default; `updated_at` may be left to the column DEFAULT
 *  `now()` on first INSERT, or supplied explicitly for batch parity). */
export type RoutineGroupAssignmentWriteRowV2 = Omit<
  RoutineGroupAssignmentRowV2,
  "user_id"
>;

/** UPDATE patch. `id` / `user_id` / `routine_item_id` / `group_id` are
 *  immutable through this path (the pair is the logical identity).
 *  `updated_at` is ALWAYS present (DB-Q2 enforcement). */
export type RoutineGroupAssignmentUpdatePatchV2 = Partial<
  Omit<
    RoutineGroupAssignmentRowV2,
    "id" | "user_id" | "routine_item_id" | "group_id"
  >
>;

export const ROUTINE_GROUP_ASSIGNMENTS_COLUMNS =
  "id, user_id, routine_item_id, group_id, updated_at, " +
  "is_deleted, deleted_at";

/**
 * DB row -> domain RoutineGroupAssignment. `createdAt` is synthesised
 * from `updated_at` (0008 schema has no created_at column — see file
 * header). `routineId` <- `routine_item_id` rename.
 */
export function rowToRoutineGroupAssignmentV2(
  row: RoutineGroupAssignmentRowV2,
): RoutineGroupAssignment {
  return {
    id: row.id,
    routineId: row.routine_item_id,
    groupId: row.group_id,
    // 0008 has no created_at column. Best-effort: synthesise from
    // updated_at (first INSERT: updated_at == effective createdAt).
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
  };
}

/**
 * Domain RoutineGroupAssignment -> writable DB row (minus user_id).
 * `createdAt` is intentionally dropped (no DB column). `updated_at` is
 * passed through (caller bumps it via the patch builder).
 */
export function routineGroupAssignmentToRowV2(
  a: RoutineGroupAssignment,
): RoutineGroupAssignmentWriteRowV2 {
  return {
    id: a.id,
    routine_item_id: a.routineId,
    group_id: a.groupId,
    updated_at: a.updatedAt,
    is_deleted: a.isDeleted,
    deleted_at: a.deletedAt,
  };
}

/**
 * Build a snake_case patch from a partial RoutineGroupAssignment update.
 * The relation's only mutable surface is the soft-delete flip (unassign
 * = is_deleted=true + deleted_at). DB-Q2: `updated_at` is ALWAYS emitted.
 * `now` is injected (mapper stays pure).
 */
export function routineGroupAssignmentUpdatesToPatchV2(
  updates: Partial<Pick<RoutineGroupAssignment, "isDeleted" | "deletedAt">>,
  now: string,
): RoutineGroupAssignmentUpdatePatchV2 {
  const patch: RoutineGroupAssignmentUpdatePatchV2 = { updated_at: now };
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    patch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  return patch;
}
