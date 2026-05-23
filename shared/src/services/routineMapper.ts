import type { RoutineNode, FrequencyType } from "../types/routine";

/*
 * Pure RoutineNode <-> `public.routines` row mappers (Phase 2 S4-1).
 * Carries NO `@supabase/supabase-js` dependency (same rationale as
 * taskMapper / dailyMapper / noteMapper): the round-trip harness stays
 * runnable under plain Node ESM and the field-by-field contract is
 * isolated for review/testing.
 *
 * SYNC CLASS: VERSIONED + soft-delete. routines has `version` +
 * `is_deleted` + `deleted_at`; the data layer bumps `version` and uses
 * soft-delete (TrashView-restorable, CLAUDE.md §4.4).
 *
 * frequency_days CONTRACT: the DB column is `text` holding a JSON array
 * string ("[0,1,...]" — Issue: a real array type would force PostgREST
 * array coercion). RoutineNode.frequencyDays is `number[]`. This mapper
 * is the ONLY place the JSON.parse/stringify happens (round-trip covers
 * the array <-> string bijection). A malformed string falls back to []
 * rather than throwing — a corrupt frequency must not brick the list.
 *
 * groupIds is NOT a routines column — it is populated by joining
 * routine_group_assignments (handled in the DataService layer, S4-2), so
 * it is intentionally absent from RoutineRow and the mapper does not
 * materialise it (rowToRoutine omits it; the round-trip cases never set
 * it). reminderEnabled/reminderOffset are optional on the type but the
 * columns are NOT NULL-with-default / nullable respectively, so they are
 * always materialised by rowToRoutine (default false / number|undefined).
 */

const FREQUENCY_TYPES: ReadonlySet<string> = new Set([
  "daily",
  "weekdays",
  "interval",
  "group",
]);

/**
 * Narrow a DB `frequency_type` value to the `FrequencyType` union. The
 * 0006 CHECK constraint enforces this at the DB layer; this is
 * defence-in-depth so a corrupt/legacy row surfaces a clear error
 * instead of a silent type lie.
 */
export function toFrequencyType(value: string): FrequencyType {
  if (FREQUENCY_TYPES.has(value)) return value as FrequencyType;
  throw new Error(
    `routines: invalid frequency_type "${value}" ` +
      `(expected daily|weekdays|interval|group)`,
  );
}

/**
 * Parse the `frequency_days` JSON array string to `number[]`. Defensive:
 * a non-array / malformed payload yields [] (a corrupt frequency must
 * not brick rendering; matches the Tauri repo `unwrap_or_default()`).
 */
export function parseFrequencyDays(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number");
  } catch {
    return [];
  }
}

/**
 * SELECTED row shape of `public.routines` (0006_schedule_full_schema.sql).
 * snake_case, nullable where the column is nullable. `user_id` is
 * server-derived (RLS default `auth.uid()`) — clients never write it.
 * `frequency_days` is the JSON array STRING. `version` is bumped by the
 * data layer on every mutation (LWW input).
 */
export interface RoutineRow {
  id: string;
  user_id: string;
  title: string;
  is_archived: boolean;
  order: number;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
  frequency_type: string;
  frequency_days: string;
  frequency_interval: number | null;
  frequency_start_date: string | null;
  is_visible: boolean;
  start_time: string | null;
  end_time: string | null;
  reminder_enabled: boolean;
  reminder_offset: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Writable subset of a row. Excludes `user_id` only (RLS-derived). Used
 * for INSERT/UPSERT payloads.
 */
export type RoutineWriteRow = Omit<RoutineRow, "user_id">;

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule). `"order"` is quoted
 * (SQL reserved word). Any routines read path MUST use this exact list.
 */
export const ROUTINE_SELECT_COLUMNS =
  'id, user_id, title, is_archived, "order", is_deleted, deleted_at, ' +
  "version, frequency_type, frequency_days, frequency_interval, " +
  "frequency_start_date, is_visible, start_time, end_time, " +
  "reminder_enabled, reminder_offset, created_at, updated_at";

/**
 * DB row -> domain RoutineNode. `frequency_days` JSON string -> number[]
 * (the only non-trivial coercion). reminderEnabled is always
 * materialised (NOT NULL-with-default column); reminderOffset only when
 * the nullable column is non-null so `routineToRow ∘ rowToRoutine`
 * round-trips without manufacturing `undefined`-vs-absent diffs.
 * `groupIds` is NOT a routines column (populated via the rga join in the
 * DataService layer) so it is deliberately not set here.
 */
export function rowToRoutine(row: RoutineRow): RoutineNode {
  const node: RoutineNode = {
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    isArchived: row.is_archived,
    isVisible: row.is_visible,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    order: row.order,
    frequencyType: toFrequencyType(row.frequency_type),
    frequencyDays: parseFrequencyDays(row.frequency_days),
    frequencyInterval: row.frequency_interval,
    frequencyStartDate: row.frequency_start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  node.reminderEnabled = row.reminder_enabled;
  if (row.reminder_offset !== null) node.reminderOffset = row.reminder_offset;

  return node;
}

/**
 * Domain RoutineNode -> full writable DB row (minus server-derived
 * user_id). `frequencyDays` number[] -> JSON string. Absent optional
 * fields map to their column null/default so an UPSERT fully specifies
 * the row. `version` defaults to 1; callers that bump it pass it through
 * `routineUpdatesToPatch` or set it explicitly.
 */
export function routineToRow(node: RoutineNode): RoutineWriteRow {
  return {
    id: node.id,
    title: node.title,
    is_archived: node.isArchived,
    order: node.order,
    is_deleted: node.isDeleted,
    deleted_at: node.deletedAt,
    version: 1,
    frequency_type: node.frequencyType,
    frequency_days: JSON.stringify(node.frequencyDays),
    frequency_interval: node.frequencyInterval,
    frequency_start_date: node.frequencyStartDate,
    is_visible: node.isVisible,
    start_time: node.startTime,
    end_time: node.endTime,
    reminder_enabled: node.reminderEnabled ?? false,
    reminder_offset: node.reminderOffset ?? null,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  };
}

/**
 * Build a snake_case patch from a partial RoutineNode update. Only keys
 * PRESENT on `updates` are emitted so a partial update never clobbers
 * untouched columns (Issue 020 partial-payload safety). `frequencyDays`
 * is JSON-stringified here too. Mutable surface mirrors the Tauri
 * `routine_repository::update` whitelist (title/times/visibility/
 * archive/order/frequency*). `version` / `created_at` / `id` are NOT
 * mutable through this path.
 */
export function routineUpdatesToPatch(
  updates: Partial<
    Pick<
      RoutineNode,
      | "title"
      | "startTime"
      | "endTime"
      | "isArchived"
      | "isVisible"
      | "isDeleted"
      | "deletedAt"
      | "order"
      | "frequencyType"
      | "frequencyDays"
      | "frequencyInterval"
      | "frequencyStartDate"
      | "reminderEnabled"
      | "reminderOffset"
    >
  >,
): Partial<RoutineWriteRow> {
  const patch: Partial<RoutineWriteRow> = {};
  if ("title" in updates && updates.title !== undefined)
    patch.title = updates.title;
  if ("startTime" in updates) patch.start_time = updates.startTime ?? null;
  if ("endTime" in updates) patch.end_time = updates.endTime ?? null;
  if ("isArchived" in updates && updates.isArchived !== undefined)
    patch.is_archived = updates.isArchived;
  if ("isVisible" in updates && updates.isVisible !== undefined)
    patch.is_visible = updates.isVisible;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    patch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
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
  if ("reminderEnabled" in updates && updates.reminderEnabled !== undefined)
    patch.reminder_enabled = updates.reminderEnabled;
  if ("reminderOffset" in updates)
    patch.reminder_offset = updates.reminderOffset ?? null;
  return patch;
}
