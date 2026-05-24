import type { RoutineNode, FrequencyType } from "../types/routine";

/*
 * Pure RoutineNode <-> 2-row (items_meta + routines_payload) mappers
 * (DU-C-2). Same pattern as `taskMapper.ts`: a domain `RoutineNode` is
 * persisted as ONE row in `public.items_meta` (role='routine') + ONE row
 * in `public.routines_payload`. The mapper is the SSOT for the 2-row
 * shape; the data service does the 2 INSERT / 2 UPDATE / 2 SELECT
 * orchestration.
 *
 * Historical context: Phase 2 stored Routines in a single `public.routines`
 * table (0006). DU-A (0008) introduced items_meta as the authority row
 * for every item (5 roles) and split per-role columns into
 * `*_payload` tables. The legacy mappers (`RoutineRow` /
 * `rowToRoutine` / `routineToRow` / `routineUpdatesToPatch`) are kept as
 * THIN BACK-COMPAT SHIMS so DU-C-3 (SupabaseRoutinesService rewrite) can
 * land independently of DU-C-2 (this file) — they will be removed once
 * the service no longer references them.
 *
 * What this module owns (DU-C-2):
 *   - The 2-row shape (`ItemsMetaRoutineRow` / `RoutinesPayloadRow`).
 *   - SELECT column lists for items_meta (role='routine') +
 *     routines_payload (current-shape 19 cols; the parent-plan-shape
 *     fields — frequency/interval/weekdays_json/start_at/end_at/
 *     template_* — are present in DB but stay optional/unused on the
 *     write path until DU-D consolidates the contract).
 *   - `rowsToRoutineNode` / `routineNodeToRows` / `routineUpdatesToPatches`.
 *   - `frequency_days` JSON <-> number[] coercion (shared with the legacy
 *     shim and with `routineGroupMapper`).
 *   - DB-Q2 enforcement: `metaPatch.updated_at = now` is ALWAYS emitted
 *     by `routineUpdatesToPatches`, regardless of which payload column
 *     the caller patched (same rule as `taskUpdatesToPatches`).
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
// 0. Shared frequency_type / frequency_days helpers (also used by
//    routineGroupMapper via re-import).
// ---------------------------------------------------------------------------

const FREQUENCY_TYPES: ReadonlySet<string> = new Set([
  "daily",
  "weekdays",
  "interval",
  "group",
]);

/**
 * Narrow a DB `frequency_type` value to the `FrequencyType` union. The
 * 0008 CHECK constraint enforces this at the DB layer; this is
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

// ---------------------------------------------------------------------------
// 1. 2-row shapes (matches 0008 schema verbatim — DU-C-2)
// ---------------------------------------------------------------------------

/**
 * Row shape of `public.items_meta` for role='routine'. `role` is a CHECK
 * column with 5 allowed values; this mapper is the Routines-only view, so
 * `role` is narrowed to the `'routine'` literal. `user_id` is
 * server-derived (RLS default `auth.uid()`) and clients never write it
 * but is included for round-trip symmetry.
 */
export interface ItemsMetaRoutineRow {
  id: string;
  user_id: string;
  role: "routine";
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

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
 * Writable subset for INSERT. `user_id` is the only items_meta column
 * the client must supply (RLS default would fill it, but explicit is
 * safer for cross-device parity); `created_at` / `updated_at` are left
 * to the column DEFAULT `now()` on first INSERT.
 */
export type ItemsMetaRoutineInsertRow = Omit<
  ItemsMetaRoutineRow,
  "created_at" | "updated_at"
>;

/**
 * Writable subset for INSERT/UPDATE on routines_payload. No generated
 * columns exist on routines_payload (unlike tasks_payload's
 * `parent_item_role`), so this is just an alias for parity with
 * `TasksPayloadWriteRow`.
 */
export type RoutinesPayloadWriteRow = RoutinesPayloadRow;

/** UPDATE patch for items_meta. `id` / `user_id` / `role` / `created_at`
 * are never patched. `updated_at` is ALWAYS present (bump responsibility,
 * see `routineUpdatesToPatches`). */
export type ItemsMetaRoutineUpdatePatch = Partial<
  Omit<ItemsMetaRoutineRow, "id" | "user_id" | "role" | "created_at">
>;

/** UPDATE patch for routines_payload. `item_id` / `user_id` are never
 * patched. */
export type RoutinesPayloadUpdatePatch = Partial<
  Omit<RoutinesPayloadRow, "item_id" | "user_id">
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists (literal strings to keep query intent reviewable)
// ---------------------------------------------------------------------------

/** SELECT column list for `items_meta` rows of role='routine'. */
export const ITEMS_META_ROUTINE_COLUMNS =
  "id, user_id, role, title, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

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
  if (meta.id !== payload.item_id) {
    throw new Error(
      `routineMapper: row mismatch — meta.id="${meta.id}" but payload.item_id="${payload.item_id}"`,
    );
  }
  if (meta.role !== "routine") {
    throw new Error(
      `routineMapper: items_meta.role expected "routine" but got "${meta.role}"`,
    );
  }

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
    frequencyType: toFrequencyType(payload.frequency_type),
    frequencyDays: parseFrequencyDays(payload.frequency_days),
    frequencyInterval: payload.frequency_interval,
    frequencyStartDate: payload.frequency_start_date,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };

  // reminder_enabled is NOT NULL with default — always materialise.
  node.reminderEnabled = payload.reminder_enabled;
  if (payload.reminder_offset !== null)
    node.reminderOffset = payload.reminder_offset;

  // groupIds is NOT a routines_payload column — populated via the
  // routine_group_assignments join in the DataService layer. Intentionally
  // not set here so round-trip diffs do not manufacture undefined-vs-absent.

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
 * SupabaseTasksService.createTask).
 *
 * Parent-plan (DU-A) shape columns are written as `null` — they exist in
 * the schema for future contract consolidation but the current TS
 * contract does not surface them on RoutineNode.
 */
export function routineNodeToRows(
  node: RoutineNode,
  userId: string,
): { meta: ItemsMetaRoutineInsertRow; payload: RoutinesPayloadWriteRow } {
  const meta: ItemsMetaRoutineInsertRow = {
    id: node.id,
    user_id: userId,
    role: "routine",
    title: node.title,
    is_deleted: node.isDeleted,
    deleted_at: node.deletedAt,
    version: 1,
  };

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
  // DB-Q2: ALWAYS bump updated_at, even if the caller is only patching
  // payload columns. Single point of enforcement.
  const metaPatch: ItemsMetaRoutineUpdatePatch = { updated_at: now };
  if ("title" in updates && updates.title !== undefined)
    metaPatch.title = updates.title;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    metaPatch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) metaPatch.deleted_at = updates.deletedAt ?? null;
  if ("version" in updates && updates.version !== undefined)
    metaPatch.version = updates.version;

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

// ---------------------------------------------------------------------------
// 6. Back-compat shims (LEGACY — DU-C-3 will remove after the service is
//    rewritten to call the 2-row API directly).
// ---------------------------------------------------------------------------

/**
 * @deprecated Legacy single-row Routine shape (Phase 2 `public.routines`).
 * DU-C-3 will remove this once `SupabaseRoutinesService` calls
 * `rowsToRoutineNode` / `routineNodeToRows` / `routineUpdatesToPatches`
 * directly. New callers must use the 2-row API.
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

/** @deprecated See `RoutineRow`. */
export type RoutineWriteRow = Omit<RoutineRow, "user_id">;

/** @deprecated SELECT column list of the legacy single-row shape. */
export const ROUTINE_SELECT_COLUMNS =
  'id, user_id, title, is_archived, "order", is_deleted, deleted_at, ' +
  "version, frequency_type, frequency_days, frequency_interval, " +
  "frequency_start_date, is_visible, start_time, end_time, " +
  "reminder_enabled, reminder_offset, created_at, updated_at";

/** @deprecated Use `rowsToRoutineNode(meta, payload)` instead. */
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

/** @deprecated Use `routineNodeToRows(node, userId)` instead. */
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

/** @deprecated Use `routineUpdatesToPatches(updates, userId, now)` instead. */
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
