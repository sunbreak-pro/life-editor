import type { RoutineNode, FrequencyType } from "../types/routine";
import {
  ITEMS_META_COLUMNS,
  assertItemsMetaPair,
  toItemsMetaInsertRow,
  toItemsMetaPatch,
  type ItemsMetaRow,
  type ItemsMetaInsertRow,
  type ItemsMetaUpdatePatch,
  type ItemsMetaPatchInput,
} from "./itemsMeta";

/*
 * Pure RoutineNode <-> 2-row (items_meta + routines_payload) mappers
 * (DU-C-2). Same pattern as `todoMapper.ts`: a domain `RoutineNode` is
 * persisted as ONE row in `public.items_meta` (role='routine') + ONE row
 * in `public.routines_payload`. The mapper is the SSOT for the 2-row
 * shape; the data service does the 2 INSERT / 2 UPDATE / 2 SELECT
 * orchestration.
 *
 * Historical context: Phase 2 stored Routines in a single `public.routines`
 * table (0006). DU-A (0008) introduced items_meta as the authority row
 * for every item (5 roles) and split per-role columns into
 * `*_payload` tables. The single-row mappers (`RoutineRow` /
 * `rowToRoutine` / `routineToRow` / `routineUpdatesToPatch`) were kept as
 * back-compat shims so DU-C-3 (SupabaseRoutinesService rewrite) could land
 * independently of DU-C-2 (this file); the service has called the 2-row API
 * ever since, and the shims were deleted in #670 C3 PR 1. The 2-row API
 * below is the only mapper surface — there is nothing to migrate onto.
 *
 * What this module owns (DU-C-2):
 *   - The 2-row shape (`ItemsMetaRoutineRow` / `RoutinesPayloadRow`).
 *   - SELECT column lists for items_meta (role='routine') +
 *     routines_payload (current-shape 19 cols; the parent-plan-shape
 *     fields — frequency/interval/weekdays_json/start_at/end_at/
 *     template_* — are present in DB but stay optional/unused on the
 *     write path until DU-D consolidates the contract).
 *   - `rowsToRoutineNode` / `routineNodeToRows` / `routineUpdatesToPatches`.
 *   - `frequency_days` JSON <-> number[] coercion.
 *   - DB-Q2 enforcement: `metaPatch.updated_at = now` is ALWAYS emitted
 *     by `routineUpdatesToPatches`, regardless of which payload column
 *     the caller patched (same rule as `todoUpdatesToPatches`).
 *
 * What this module does NOT own:
 *   - The orphan-cleanup `try/catch` after a failed payload INSERT
 *     (R2 → DU-C-3 SupabaseRoutinesService.createRoutine).
 *   - The Routine→Event cascade soft-delete (the events_payload trigger
 *     keys off items_meta.id = events_payload.item_id, NOT off
 *     routine_item_id — so the service must soft-delete the
 *     routine-generated event items_meta rows in app code; DU-C-3).
 *
 * Carries NO `@supabase/supabase-js` dependency: this module is pure.
 * The 0008 migration is the SSOT for column types and nullability —
 * keep this file in lockstep with it.
 */

// ---------------------------------------------------------------------------
// 0. Shared frequency_type / frequency_days helpers.
// ---------------------------------------------------------------------------

const FREQUENCY_TYPES: ReadonlySet<string> = new Set([
  "daily",
  "weekdays",
  "interval",
]);

/**
 * Narrow a DB `frequency_type` value to the `FrequencyType` union. The
 * 0008 CHECK constraint enforces this at the DB layer; this is
 * defence-in-depth so a corrupt/legacy row surfaces a clear error
 * instead of a silent type lie.
 *
 * The retired "group" value is handled one level up by
 * `normaliseFrequency` — it is legal in the DB (DDL ゼロ) but not in the
 * domain union, so it must never reach here.
 */
export function toFrequencyType(value: string): FrequencyType {
  if (FREQUENCY_TYPES.has(value)) return value as FrequencyType;
  throw new Error(
    `routines: invalid frequency_type "${value}" ` +
      `(expected daily|weekdays|interval)`,
  );
}

/**
 * Read the frequency pair (type + days) off a DB row.
 *
 * #352 §5 決定3 removed the "group" frequency, but the 0008 CHECK still
 * allows the value, so a pre-removal row can still be read back. Such a
 * row normalises to `weekdays` with an EMPTY day set = a routine that
 * never fires — exactly what a group-typed routine did before removal
 * (group management UI never shipped, so it had no resolvable group and
 * `shouldCreateRoutineItem` always returned false). Throwing instead
 * would brick the whole routine list on one legacy row.
 */
export function normaliseFrequency(
  frequencyType: string,
  frequencyDaysRaw: string,
): { frequencyType: FrequencyType; frequencyDays: number[] } {
  if (frequencyType === "group") {
    return { frequencyType: "weekdays", frequencyDays: [] };
  }
  return {
    frequencyType: toFrequencyType(frequencyType),
    frequencyDays: parseFrequencyDays(frequencyDaysRaw),
  };
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

// ---------------------------------------------------------------------------
// 1. 2-row shapes (matches 0008 schema verbatim — DU-C-2)
// ---------------------------------------------------------------------------

/**
 * items_meta shapes for role='routine' — aliases of the canonical
 * generics in `itemsMeta` (the 5 role mappers carried byte-identical
 * copies).
 */
export type ItemsMetaRoutineRow = ItemsMetaRow<"routine">;
export type ItemsMetaRoutineInsertRow = ItemsMetaInsertRow<"routine">;
export type ItemsMetaRoutineUpdatePatch = ItemsMetaUpdatePatch;

/**
 * Row shape of `public.routines_payload`. The 0008 schema carries TWO
 * naming sets:
 *   - parent-plan (DU-A) shape: frequency / interval / weekdays_json /
 *     start_at / end_at / template_*  (all nullable, kept for the future
 *     contract consolidation; the mapper writes them as `null` for now
 *     so UPSERTs fully specify the row).
 *   - current shape (0006 port, the正本): frequency_type / frequency_days
 *     / frequency_interval / frequency_start_date / is_visible /
 *     start_time / end_time / reminder_enabled / reminder_offset /
 *     is_archived / sort_order. This is what the mapper materialises
 *     into RoutineNode.
 */
export interface RoutinesPayloadRow {
  item_id: string;
  user_id: string;
  // parent-plan (DU-A) shape — read-only placeholders for round-trip
  // round-tripping. The mapper never surfaces these on `RoutineNode`
  // and always writes them as null until DU-D unifies the contract.
  frequency: string | null;
  interval: number | null;
  weekdays_json: string | null;
  start_at: string | null;
  end_at: string | null;
  template_start_time: string | null;
  template_end_time: string | null;
  template_memo: string | null;
  template_reminder_offset_min: number | null;
  // current-shape (正本) columns
  is_archived: boolean;
  frequency_type: string;
  frequency_days: string;
  frequency_interval: number | null;
  frequency_start_date: string | null;
  is_visible: boolean;
  start_time: string | null;
  end_time: string | null;
  reminder_enabled: boolean;
  reminder_offset: number | null;
  sort_order: number;
}

/**
 * Writable subset for INSERT/UPDATE on routines_payload. No generated
 * columns exist on routines_payload (unlike tasks_payload's
 * `parent_item_role`), so this is just an alias for parity with
 * `TasksPayloadWriteRow`.
 */
export type RoutinesPayloadWriteRow = RoutinesPayloadRow;

/** UPDATE patch for routines_payload. `item_id` / `user_id` are never
 * patched. */
export type RoutinesPayloadUpdatePatch = Partial<
  Omit<RoutinesPayloadRow, "item_id" | "user_id">
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists (literal strings to keep query intent reviewable)
// ---------------------------------------------------------------------------

/** Role-scoped alias of `ITEMS_META_COLUMNS` for Routines call sites. */
export const ITEMS_META_ROUTINE_COLUMNS = ITEMS_META_COLUMNS;

/**
 * SELECT column list for `routines_payload`. Lists BOTH naming sets
 * (parent-plan + current) so future contract consolidation in DU-D can
 * happen without changing the data path; the current-shape columns are
 * the only ones materialised into `RoutineNode`.
 */
export const ROUTINES_PAYLOAD_COLUMNS =
  "item_id, user_id, frequency, interval, weekdays_json, start_at, end_at, " +
  "template_start_time, template_end_time, template_memo, " +
  "template_reminder_offset_min, is_archived, frequency_type, " +
  "frequency_days, frequency_interval, frequency_start_date, is_visible, " +
  "start_time, end_time, reminder_enabled, reminder_offset, sort_order";

// ---------------------------------------------------------------------------
// 3. SELECT: 2 rows -> RoutineNode
// ---------------------------------------------------------------------------

/**
 * Materialise a domain RoutineNode from one items_meta row
 * (role='routine') + its matching routines_payload row. Optional fields
 * are only set when the underlying column is non-null so
 * `routineNodeToRows ∘ rowsToRoutineNode` round-trips without
 * manufacturing `undefined`-vs-absent differences.
 *
 * NOT-NULL columns (is_archived / is_visible / is_deleted /
 * reminder_enabled / version / sort_order / frequency_type /
 * frequency_days) are always materialised. `frequency_days` JSON string
 * -> number[] (the only non-trivial coercion).
 *
 * Naming mapping (TS camelCase <-> DB snake_case + 2-table split):
 *   meta.title           <- title
 *   meta.is_deleted      <- isDeleted
 *   meta.deleted_at      <- deletedAt
 *   meta.created_at      <- createdAt
 *   meta.updated_at      <- updatedAt
 *   meta.version         <- version
 *   payload.is_archived  <- isArchived
 *   payload.is_visible   <- isVisible
 *   payload.sort_order   <- order                 (DU-A m1 rename)
 *   payload.frequency_type     <- frequencyType
 *   payload.frequency_days     <- frequencyDays  (JSON <-> number[])
 *   payload.frequency_interval <- frequencyInterval
 *   payload.frequency_start_date <- frequencyStartDate
 *   payload.start_time         <- startTime
 *   payload.end_time           <- endTime
 *   payload.reminder_enabled   <- reminderEnabled
 *   payload.reminder_offset    <- reminderOffset
 */
export function rowsToRoutineNode(
  meta: ItemsMetaRoutineRow,
  payload: RoutinesPayloadRow,
): RoutineNode {
  assertItemsMetaPair("routineMapper", "routine", meta, payload);

  const frequency = normaliseFrequency(
    payload.frequency_type,
    payload.frequency_days,
  );

  const node: RoutineNode = {
    id: meta.id,
    title: meta.title,
    startTime: payload.start_time,
    endTime: payload.end_time,
    isArchived: payload.is_archived,
    isVisible: payload.is_visible,
    isDeleted: meta.is_deleted,
    deletedAt: meta.deleted_at,
    order: payload.sort_order,
    frequencyType: frequency.frequencyType,
    frequencyDays: frequency.frequencyDays,
    frequencyInterval: payload.frequency_interval,
    frequencyStartDate: payload.frequency_start_date,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };

  // reminder_enabled is NOT NULL with default — always materialise.
  node.reminderEnabled = payload.reminder_enabled;
  if (payload.reminder_offset !== null)
    node.reminderOffset = payload.reminder_offset;

  return node;
}

// ---------------------------------------------------------------------------
// 4. INSERT: RoutineNode -> { meta, payload }
// ---------------------------------------------------------------------------

/**
 * Project a RoutineNode into the 2 INSERT rows. `created_at` /
 * `updated_at` are NOT included on the meta INSERT row — the column
 * DEFAULT `now()` handles the first write (DB-Q2 only applies on
 * UPDATE).
 *
 * DU-C-3 callers must INSERT items_meta first, then routines_payload
 * (FK `routines_payload.item_id -> items_meta.id` enforces this order).
 * If the payload INSERT fails, the caller must hard-delete the orphan
 * items_meta row (R2 Recovery Playbook — same rule as DU-B-3
 * SupabaseTodosService.createTodo).
 *
 * Parent-plan (DU-A) shape columns are written as `null` — they exist in
 * the schema for future contract consolidation but the current TS
 * contract does not surface them on RoutineNode.
 */
export function routineNodeToRows(
  node: RoutineNode,
  userId: string,
): { meta: ItemsMetaRoutineInsertRow; payload: RoutinesPayloadWriteRow } {
  // RoutineNode's isDeleted / deletedAt are required, so the helper's
  // `?? false` / `?? null` are unreachable here — same row either way.
  const meta: ItemsMetaRoutineInsertRow = toItemsMetaInsertRow({
    id: node.id,
    userId,
    role: "routine",
    title: node.title,
    isDeleted: node.isDeleted,
    deletedAt: node.deletedAt,
  });

  const payload: RoutinesPayloadWriteRow = {
    item_id: node.id,
    user_id: userId,
    // parent-plan (DU-A) shape — write null until DU-D consolidates.
    frequency: null,
    interval: null,
    weekdays_json: null,
    start_at: null,
    end_at: null,
    template_start_time: null,
    template_end_time: null,
    template_memo: null,
    template_reminder_offset_min: null,
    // current-shape columns (正本)
    is_archived: node.isArchived,
    frequency_type: node.frequencyType,
    frequency_days: JSON.stringify(node.frequencyDays),
    frequency_interval: node.frequencyInterval,
    frequency_start_date: node.frequencyStartDate,
    is_visible: node.isVisible,
    start_time: node.startTime,
    end_time: node.endTime,
    reminder_enabled: node.reminderEnabled ?? false,
    reminder_offset: node.reminderOffset ?? null,
    sort_order: node.order,
  };

  return { meta, payload };
}

// ---------------------------------------------------------------------------
// 5. UPDATE: Partial<RoutineNode> -> { metaPatch, payloadPatch }
// ---------------------------------------------------------------------------

/**
 * Build snake_case PATCH objects for items_meta + routines_payload from
 * a partial RoutineNode update. Only keys explicitly present on
 * `updates` are emitted so a partial UPDATE never clobbers untouched
 * columns (Issue 020 partial-payload safety).
 *
 * DB-Q2 contract — `metaPatch.updated_at = now` is ALWAYS set,
 * regardless of which payload columns the caller changed. Reason: Cloud
 * Sync uses `items_meta.updated_at` as its LWW cursor, and
 * routines_payload has no own `updated_at` column (single-owner via the
 * 1:1 FK). If a caller patches only payload columns and forgets to bump
 * meta, other devices will never pull the change. Centralising the bump
 * here makes "forgot to bump" structurally impossible — see
 * `routineMapper.test.ts` for the regression case.
 *
 * `now` is injected (not `new Date().toISOString()`) so:
 *   - the mapper stays pure / side-effect-free (testability);
 *   - SupabaseRoutinesService can supply a single consistent timestamp
 *     for a batch operation.
 */
export function routineUpdatesToPatches(
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
      | "version"
    >
  >,
  userId: string,
  now: string,
): {
  metaPatch: ItemsMetaRoutineUpdatePatch;
  payloadPatch: RoutinesPayloadUpdatePatch;
} {
  // -- meta side --
  // DB-Q2's `updated_at` bump lives in `toItemsMetaPatch` (#890). Routines
  // SKIP a present-but-undefined `isDeleted` rather than normalising it to
  // false the way todo / note / daily do — kept by not assigning the key.
  const metaFields: ItemsMetaPatchInput = {};
  if ("title" in updates) metaFields.title = updates.title;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    metaFields.isDeleted = updates.isDeleted;
  if ("deletedAt" in updates) metaFields.deletedAt = updates.deletedAt;
  if ("version" in updates) metaFields.version = updates.version;
  const metaPatch: ItemsMetaRoutineUpdatePatch = toItemsMetaPatch(
    metaFields,
    now,
  );

  // -- payload side --
  void userId;
  const payloadPatch: RoutinesPayloadUpdatePatch = {};
  if ("startTime" in updates)
    payloadPatch.start_time = updates.startTime ?? null;
  if ("endTime" in updates) payloadPatch.end_time = updates.endTime ?? null;
  if ("isArchived" in updates && updates.isArchived !== undefined)
    payloadPatch.is_archived = updates.isArchived;
  if ("isVisible" in updates && updates.isVisible !== undefined)
    payloadPatch.is_visible = updates.isVisible;
  if ("order" in updates && updates.order !== undefined)
    payloadPatch.sort_order = updates.order;
  if ("frequencyType" in updates && updates.frequencyType !== undefined)
    payloadPatch.frequency_type = updates.frequencyType;
  if ("frequencyDays" in updates && updates.frequencyDays !== undefined)
    payloadPatch.frequency_days = JSON.stringify(updates.frequencyDays);
  if ("frequencyInterval" in updates)
    payloadPatch.frequency_interval = updates.frequencyInterval ?? null;
  if ("frequencyStartDate" in updates)
    payloadPatch.frequency_start_date = updates.frequencyStartDate ?? null;
  if ("reminderEnabled" in updates && updates.reminderEnabled !== undefined)
    payloadPatch.reminder_enabled = updates.reminderEnabled;
  if ("reminderOffset" in updates)
    payloadPatch.reminder_offset = updates.reminderOffset ?? null;

  return { metaPatch, payloadPatch };
}
