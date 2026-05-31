import type { RoutineGroup } from "../types/routineGroup";
// `.js` extension is deliberate: this is a RUNTIME (value) import of a
// sibling mapper, and the compiled dist must resolve under plain Node
// ESM so scheduleMapper.roundtrip.js runs standalone (same rationale as
// the roundtrip harness header). tsc + vitest
// (esbuild) tolerate an extensionless path; Node ESM does not.
import { toFrequencyType, parseFrequencyDays } from "./routineMapper.js";

/*
 * Pure RoutineGroup <-> `public.routine_groups` row mappers (DU-C-2).
 * NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: VERSIONED but PHYSICAL-delete-aware. The 0008 schema gives
 * `routine_groups` a dedicated table (NOT a payload — routine groups are
 * not items, so no items_meta row) with `version` + `is_deleted` +
 * `deleted_at`. The Phase 2 RoutineGroup TS type has NO isDeleted/
 * deletedAt field (groups were physically-deleted in 0006); DU-C-2
 * preserves that frontend contract by NOT surfacing the new soft-delete
 * columns into the domain object. The service layer (DU-C-4) will
 * filter `is_deleted = false` on every SELECT.
 *
 * COLUMN RENAME: 0006 "order" → 0008 sort_order (same rule as
 * tasks_payload / routines_payload). The legacy mapper used the quoted
 * SQL keyword `"order"`; the new mapper uses `sort_order`. Both old/new
 * field-name shapes are exported for back-compat (DU-C-4 service rewrite
 * removes the legacy aliases).
 *
 * DB-Q2: `routine_groups` carries its own `updated_at` column (no
 * items_meta indirection — it is a dedicated table). The patch builder
 * still ALWAYS bumps `updated_at` so Cloud Sync's LWW cursor advances
 * even for a single-column update; the rule is identical to the
 * items_meta side of taskMapper / routineMapper / scheduleItemMapper.
 */

// ---------------------------------------------------------------------------
// 1. Row shape (matches 0008 schema verbatim)
// ---------------------------------------------------------------------------

/**
 * SELECTED row shape of `public.routine_groups` (0008 dedicated table).
 * `user_id` is server-derived (RLS default `auth.uid()`).
 * `frequency_days` is the JSON array STRING. `sort_order` replaces the
 * 0006 `"order"` (SQL reserved word).
 */
export interface RoutineGroupRowV2 {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  version: number;
  frequency_type: string;
  frequency_days: string;
  frequency_interval: number | null;
  frequency_start_date: string | null;
  is_visible: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Writable subset for INSERT/UPSERT (server-derived `user_id` is
 *  filled by RLS default; `created_at` / `updated_at` may be left to
 *  the column DEFAULT `now()` on first INSERT). */
export type RoutineGroupWriteRowV2 = Omit<RoutineGroupRowV2, "user_id">;

/** UPDATE patch. `id` / `user_id` / `created_at` are never patched.
 *  `updated_at` is ALWAYS present (DB-Q2 enforcement). */
export type RoutineGroupUpdatePatchV2 = Partial<
  Omit<RoutineGroupRowV2, "id" | "user_id" | "created_at">
>;

// ---------------------------------------------------------------------------
// 2. SELECT column list (current — 0008 dedicated)
// ---------------------------------------------------------------------------

export const ROUTINE_GROUPS_COLUMNS =
  "id, user_id, name, color, sort_order, version, frequency_type, " +
  "frequency_days, frequency_interval, frequency_start_date, is_visible, " +
  "is_deleted, deleted_at, created_at, updated_at";

// ---------------------------------------------------------------------------
// 3. SELECT: row -> RoutineGroup
// ---------------------------------------------------------------------------

/**
 * DB row -> domain RoutineGroup. `frequency_days` JSON string ->
 * number[] (the only non-trivial coercion, shared with routineMapper).
 *
 * The Phase 2 RoutineGroup type has no isDeleted/deletedAt — those are
 * filtered at the SELECT site (`WHERE is_deleted = false`). The mapper
 * still tolerates a soft-deleted row for completeness (returns the same
 * domain shape — the caller decides whether to include it).
 */
export function rowToRoutineGroupV2(row: RoutineGroupRowV2): RoutineGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isVisible: row.is_visible,
    order: row.sort_order,
    frequencyType: toFrequencyType(row.frequency_type),
    frequencyDays: parseFrequencyDays(row.frequency_days),
    frequencyInterval: row.frequency_interval,
    frequencyStartDate: row.frequency_start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// 4. INSERT: RoutineGroup -> row
// ---------------------------------------------------------------------------

/**
 * Domain RoutineGroup -> full writable DB row (minus server-derived
 * user_id). `frequencyDays` number[] -> JSON string. `version` defaults
 * to 1; callers that bump it set it explicitly via the patch builder.
 * `is_deleted` defaults to false on a fresh INSERT.
 */
export function routineGroupToRowV2(
  group: RoutineGroup,
): RoutineGroupWriteRowV2 {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
    sort_order: group.order,
    version: 1,
    frequency_type: group.frequencyType,
    frequency_days: JSON.stringify(group.frequencyDays),
    frequency_interval: group.frequencyInterval,
    frequency_start_date: group.frequencyStartDate,
    is_visible: group.isVisible,
    is_deleted: false,
    deleted_at: null,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// 5. UPDATE: Partial<RoutineGroup> -> patch (with DB-Q2 bump)
// ---------------------------------------------------------------------------

/**
 * Build a snake_case patch from a partial RoutineGroup update. Only
 * keys PRESENT on `updates` are emitted (Issue 020 partial-payload
 * safety). `version` / `created_at` / `id` are NOT mutable through
 * this path.
 *
 * DB-Q2: `updated_at` is ALWAYS emitted (Cloud Sync LWW cursor
 * advance). `now` is injected for purity/testability.
 *
 * The mutable surface also exposes `isDeleted` / `deletedAt` so the
 * service layer can soft-delete a group (the Phase 2 RoutineGroup type
 * does not surface these on the domain object — see file header).
 */
export function routineGroupUpdatesToPatchV2(
  updates: Partial<
    Pick<
      RoutineGroup,
      | "name"
      | "color"
      | "isVisible"
      | "order"
      | "frequencyType"
      | "frequencyDays"
      | "frequencyInterval"
      | "frequencyStartDate"
    >
  > & { isDeleted?: boolean; deletedAt?: string | null },
  now: string,
): RoutineGroupUpdatePatchV2 {
  const patch: RoutineGroupUpdatePatchV2 = { updated_at: now };
  if ("name" in updates && updates.name !== undefined)
    patch.name = updates.name;
  if ("color" in updates && updates.color !== undefined)
    patch.color = updates.color;
  if ("isVisible" in updates && updates.isVisible !== undefined)
    patch.is_visible = updates.isVisible;
  if ("order" in updates && updates.order !== undefined)
    patch.sort_order = updates.order;
  if ("frequencyType" in updates && updates.frequencyType !== undefined)
    patch.frequency_type = updates.frequencyType;
  if ("frequencyDays" in updates && updates.frequencyDays !== undefined)
    patch.frequency_days = JSON.stringify(updates.frequencyDays);
  if ("frequencyInterval" in updates)
    patch.frequency_interval = updates.frequencyInterval ?? null;
  if ("frequencyStartDate" in updates)
    patch.frequency_start_date = updates.frequencyStartDate ?? null;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    patch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  return patch;
}

// ---------------------------------------------------------------------------
// 6. Back-compat shims (LEGACY — DU-C-4 will remove after the service is
//    rewritten to call the V2 API directly).
// ---------------------------------------------------------------------------

/**
 * @deprecated Legacy 0006-shape RoutineGroup row. Uses the SQL reserved
 * word `order` (not `sort_order`) and lacks the 0008 soft-delete columns.
 * DU-C-4 will remove this once `SupabaseRoutineGroupsService` calls the
 * V2 API directly.
 */
export interface RoutineGroupRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  order: number;
  version: number;
  frequency_type: string;
  frequency_days: string;
  frequency_interval: number | null;
  frequency_start_date: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

/** @deprecated See `RoutineGroupRow`. */
export type RoutineGroupWriteRow = Omit<RoutineGroupRow, "user_id">;

/** @deprecated Use `ROUTINE_GROUPS_COLUMNS` instead. */
export const ROUTINE_GROUP_SELECT_COLUMNS =
  'id, user_id, name, color, "order", version, frequency_type, ' +
  "frequency_days, frequency_interval, frequency_start_date, " +
  "is_visible, created_at, updated_at";

/** @deprecated Use `rowToRoutineGroupV2(row)` instead. */
export function rowToRoutineGroup(row: RoutineGroupRow): RoutineGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isVisible: row.is_visible,
    order: row.order,
    frequencyType: toFrequencyType(row.frequency_type),
    frequencyDays: parseFrequencyDays(row.frequency_days),
    frequencyInterval: row.frequency_interval,
    frequencyStartDate: row.frequency_start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** @deprecated Use `routineGroupToRowV2(group)` instead. */
export function routineGroupToRow(group: RoutineGroup): RoutineGroupWriteRow {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
    order: group.order,
    version: 1,
    frequency_type: group.frequencyType,
    frequency_days: JSON.stringify(group.frequencyDays),
    frequency_interval: group.frequencyInterval,
    frequency_start_date: group.frequencyStartDate,
    is_visible: group.isVisible,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
  };
}

/** @deprecated Use `routineGroupUpdatesToPatchV2(updates, now)` instead. */
export function routineGroupUpdatesToPatch(
  updates: Partial<
    Pick<
      RoutineGroup,
      | "name"
      | "color"
      | "isVisible"
      | "order"
      | "frequencyType"
      | "frequencyDays"
      | "frequencyInterval"
      | "frequencyStartDate"
    >
  >,
): Partial<RoutineGroupWriteRow> {
  const patch: Partial<RoutineGroupWriteRow> = {};
  if ("name" in updates && updates.name !== undefined)
    patch.name = updates.name;
  if ("color" in updates && updates.color !== undefined)
    patch.color = updates.color;
  if ("isVisible" in updates && updates.isVisible !== undefined)
    patch.is_visible = updates.isVisible;
  if ("order" in updates && updates.order !== undefined)
    patch.order = updates.order;
  if ("frequencyType" in updates && updates.frequencyType !== undefined)
    patch.frequency_type = updates.frequencyType;
  if ("frequencyDays" in updates && updates.frequencyDays !== undefined)
    patch.frequency_days = JSON.stringify(updates.frequencyDays);
  if ("frequencyInterval" in updates)
    patch.frequency_interval = updates.frequencyInterval ?? null;
  if ("frequencyStartDate" in updates)
    patch.frequency_start_date = updates.frequencyStartDate ?? null;
  return patch;
}
