import type { RoutineGroup } from "../types/routineGroup";
// `.js` extension is deliberate: this is a RUNTIME (value) import of a
// sibling mapper, and the compiled dist must resolve under plain Node
// ESM so scheduleMapper.roundtrip.js runs standalone (same rationale as
// the roundtrip harness header / dailyMapper.roundtrip.ts). tsc + vitest
// (esbuild) tolerate an extensionless path; Node ESM does not.
import { toFrequencyType, parseFrequencyDays } from "./routineMapper.js";

/*
 * Pure RoutineGroup <-> `public.routine_groups` row mappers
 * (Phase 2 S4-1). NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: VERSIONED but PHYSICAL-delete. routine_groups has
 * `version` (sync LWW input) but NO is_deleted/deleted_at — the frontend
 * never soft-deletes a group, and 0006 deliberately omits those columns
 * to keep the schema aligned with the canonical contract (the S2/S3
 * "frontend type is the contract" rule). RoutineGroup has no
 * isDeleted/deletedAt field, so the mapper is a straight bijection
 * (plus the frequency_days JSON coercion shared with routineMapper).
 */

/**
 * SELECTED row shape of `public.routine_groups`
 * (0006_schedule_full_schema.sql). `user_id` is server-derived (RLS
 * default `auth.uid()`). `frequency_days` is the JSON array STRING.
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

/**
 * Writable subset of a row. Excludes `user_id` only (RLS-derived).
 */
export type RoutineGroupWriteRow = Omit<RoutineGroupRow, "user_id">;

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule). `"order"` is quoted.
 */
export const ROUTINE_GROUP_SELECT_COLUMNS =
  'id, user_id, name, color, "order", version, frequency_type, ' +
  "frequency_days, frequency_interval, frequency_start_date, " +
  "is_visible, created_at, updated_at";

/**
 * DB row -> domain RoutineGroup. Every RoutineGroup field is required by
 * the type, so this is a straight bijection — the only non-trivial
 * coercion is `frequency_days` JSON string -> number[] (shared with
 * routineMapper).
 */
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

/**
 * Domain RoutineGroup -> full writable DB row (minus server-derived
 * user_id). `frequencyDays` number[] -> JSON string. `version` defaults
 * to 1; callers that bump it set it explicitly / via the patch builder.
 */
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

/**
 * Build a snake_case patch from a partial RoutineGroup update. Only keys
 * PRESENT on `updates` are emitted (Issue 020 partial-payload safety).
 * `version` / `created_at` / `id` are NOT mutable through this path.
 */
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
