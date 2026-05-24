import type { ScheduleItem } from "../types/schedule";

/*
 * Pure ScheduleItem <-> 2-row (items_meta + events_payload) mappers
 * (DU-C-2). Same pattern as `taskMapper.ts` / `routineMapper.ts`: a
 * domain `ScheduleItem` is persisted as ONE row in `public.items_meta`
 * (role='event') + ONE row in `public.events_payload`.
 *
 * Historical context: Phase 2 stored ScheduleItems in a single
 * `public.schedule_items` table (0006). DU-A (0008) introduced
 * items_meta + events_payload, AND intentionally simplified the legacy
 * column set:
 *
 *   - No `content` / no `note_id` on events_payload — event<->note
 *     linking uses wiki_tag_connections (DD-3 unified WikiLink).
 *   - No `template_id` — Templates integration deferred to a DU
 *     follow-up plan.
 *   - No `reminder_enabled` / `reminder_offset` columns; only
 *     `reminder_at timestamptz`. The mapper DERIVES `reminderEnabled`
 *     from `reminder_at !== null` for Phase 2 ScheduleItem-type
 *     compatibility, and surfaces `reminderOffset` as `undefined` on
 *     read (no source column). DU follow-up may extend events_payload
 *     with an offset column or migrate the ScheduleItem type.
 *
 * The 0011 migration (NOT yet applied at DU-C-2 land — Step 1 still
 * pending) will add:
 *   - `routine_item_role text generated always as ('routine') stored`
 *     (composite FK target to items_meta(id, role)). This is a SELECT-
 *     ONLY column — PG rejects it from INSERT/UPDATE (SQLSTATE 42601);
 *     the WRITE type below strips it.
 *   - The events_payload `is_deleted_cache` mirror is INSERT-trigger
 *     initialised from items_meta.is_deleted; also strip from WRITE.
 *
 * What this module owns:
 *   - The 2-row shape (`ItemsMetaEventRow` / `EventsPayloadRow`).
 *   - SELECT column lists for items_meta (role='event') + events_payload.
 *   - `rowsToScheduleItem` / `scheduleItemToRows` (INSERT) /
 *     `scheduleItemUpdatesToPatches` (UPDATE).
 *   - DB-Q2 enforcement: `metaPatch.updated_at = now` is ALWAYS emitted.
 *
 * What this module does NOT own:
 *   - The orphan-cleanup `try/catch` after a failed payload INSERT
 *     (R2 → DU-C-5 SupabaseScheduleItemsService.createScheduleItem).
 *   - The partial UNIQUE conflict handler on bulkCreate (ON CONFLICT
 *     ignoreDuplicates lives in the service layer; the mapper only
 *     produces row shapes).
 *
 * Carries NO `@supabase/supabase-js` dependency: this module is pure.
 * The 0008 + 0011 migrations are the SSOT for column types — keep this
 * file in lockstep with them.
 */

// ---------------------------------------------------------------------------
// 1. 2-row shapes (matches 0008 + 0011 schema verbatim)
// ---------------------------------------------------------------------------

/**
 * Row shape of `public.items_meta` for role='event'. `role` is a CHECK
 * column with 5 allowed values; this mapper is the Events-only view, so
 * `role` is narrowed to the `'event'` literal.
 */
export interface ItemsMetaEventRow {
  id: string;
  user_id: string;
  role: "event";
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Row shape of `public.events_payload` (0008 + 0011). `routine_item_role`
 * is a 0011 GENERATED STORED column (`generated always as ('routine')`);
 * SELECT-only — PG rejects any client write. `is_deleted_cache` is
 * server-managed (BEFORE INSERT trigger inits from items_meta; AFTER
 * UPDATE trigger on items_meta keeps it in sync) — clients never write
 * it either. The WRITE type below strips both.
 *
 * DATE/TIME CONTRACT: `start_at` ("YYYY-MM-DD") / `start_time` /
 * `end_time` ("HH:MM") / `source_date` ("YYYY-MM-DD") are TEXT columns
 * (NOT date/timestamptz) — PostgREST would TZ-shift real date/time
 * types across the JST boundary. The mapper passes them through verbatim
 * as strings. `reminder_at` IS timestamptz, since absolute reminder
 * instants are unambiguous.
 *
 * NB: events_payload has NO `content` / `note_id` / `template_id` /
 * `reminder_enabled` / `reminder_offset` columns by design — see file
 * header.
 */
export interface EventsPayloadRow {
  item_id: string;
  user_id: string;
  start_at: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  done: boolean;
  completed_at: string | null;
  is_dismissed: boolean;
  reminder_at: string | null;
  memo: string | null;
  routine_item_id: string | null;
  /** 0011 generated stored column — SELECT-only. */
  routine_item_role: "routine" | null;
  source_date: string | null;
  /** Server-managed mirror (BEFORE INSERT trigger + AFTER UPDATE on
   *  items_meta). SELECT-only. */
  is_deleted_cache: boolean;
}

/**
 * Writable subset for INSERT. `user_id` is the only items_meta column
 * the client must supply explicitly (RLS default would fill it, but
 * explicit is safer for cross-device parity); `created_at` /
 * `updated_at` are left to the column DEFAULT `now()` on first INSERT.
 */
export type ItemsMetaEventInsertRow = Omit<
  ItemsMetaEventRow,
  "created_at" | "updated_at"
>;

/**
 * Writable subset for INSERT/UPDATE on events_payload. Strips:
 *   - `routine_item_role` (0011 generated stored — SELECT-only, type-
 *     level guard, not a runtime check; same defence as
 *     TasksPayloadWriteRow);
 *   - `is_deleted_cache` (server-managed by the BEFORE-INSERT +
 *     items_meta AFTER-UPDATE triggers).
 */
export type EventsPayloadWriteRow = Omit<
  EventsPayloadRow,
  "routine_item_role" | "is_deleted_cache"
>;

/** UPDATE patch for items_meta. `id` / `user_id` / `role` / `created_at`
 * are never patched. `updated_at` is ALWAYS present (bump responsibility,
 * see `scheduleItemUpdatesToPatches`). */
export type ItemsMetaEventUpdatePatch = Partial<
  Omit<ItemsMetaEventRow, "id" | "user_id" | "role" | "created_at">
>;

/** UPDATE patch for events_payload. `item_id` / `user_id` /
 * `routine_item_role` / `is_deleted_cache` are never patched. */
export type EventsPayloadUpdatePatch = Partial<
  Omit<
    EventsPayloadRow,
    "item_id" | "user_id" | "routine_item_role" | "is_deleted_cache"
  >
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists
// ---------------------------------------------------------------------------

/** SELECT column list for `items_meta` rows of role='event'. */
export const ITEMS_META_EVENT_COLUMNS =
  "id, user_id, role, title, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

/**
 * SELECT column list for `events_payload`. Includes the 0011
 * `routine_item_role` generated column (so callers can verify the
 * composite FK invariant) and `is_deleted_cache` (the Issue-011 partial
 * unique index filter mirror); INSERT/UPDATE paths must not include
 * either (use `EventsPayloadWriteRow`).
 */
export const EVENTS_PAYLOAD_COLUMNS =
  "item_id, user_id, start_at, start_time, end_time, is_all_day, done, " +
  "completed_at, is_dismissed, reminder_at, memo, routine_item_id, " +
  "routine_item_role, source_date, is_deleted_cache";

// ---------------------------------------------------------------------------
// 3. SELECT: 2 rows -> ScheduleItem
// ---------------------------------------------------------------------------

/**
 * Materialise a domain ScheduleItem from one items_meta row
 * (role='event') + its matching events_payload row.
 *
 * REQUIRED-FIELD CONTRACT (Phase 2 ScheduleItem type):
 *   - `date` <- payload.start_at  (REQUIRED string on ScheduleItem;
 *     callers MUST ensure events_payload.start_at is non-null for any
 *     event surfaced to the frontend).
 *   - `startTime` <- payload.start_time (REQUIRED — same caveat).
 *   - `endTime`   <- payload.end_time   (REQUIRED — same caveat).
 *   - `completed` <- payload.done.
 *   - `routineId` <- payload.routine_item_id (nullable).
 *   - `templateId` is always `null` (column intentionally omitted from
 *     0008 events_payload — see header).
 *   - `memo` / `completedAt` / pass-through.
 *   - `noteId` always `null` (events<->notes via wiki_tag_connections).
 *   - `content` always `null` (events have no RichEditor — see header).
 *   - `isAllDay` / `isDismissed` always materialised (NOT NULL columns).
 *   - `isDeleted` / `deletedAt` <- items_meta (NOT the cache mirror).
 *   - `reminderEnabled` <- DERIVED from `reminder_at !== null`.
 *   - `reminderOffset` is NOT materialised on read (no source column) —
 *     callers that need an offset must compute it from
 *     `reminder_at - start_at` at the consumption boundary if needed.
 *
 * If `payload.start_at` is NULL the mapper still materialises (uses ""
 * — the frontend treats an empty-date event as an unscheduled candidate).
 * Same defence for start_time / end_time. The DataService layer should
 * filter NULL-date events out of date-bounded queries.
 */
export function rowsToScheduleItem(
  meta: ItemsMetaEventRow,
  payload: EventsPayloadRow,
): ScheduleItem {
  if (meta.id !== payload.item_id) {
    throw new Error(
      `scheduleItemMapper: row mismatch — meta.id="${meta.id}" but payload.item_id="${payload.item_id}"`,
    );
  }
  if (meta.role !== "event") {
    throw new Error(
      `scheduleItemMapper: items_meta.role expected "event" but got "${meta.role}"`,
    );
  }

  const item: ScheduleItem = {
    id: meta.id,
    date: payload.start_at ?? "",
    title: meta.title,
    startTime: payload.start_time ?? "",
    endTime: payload.end_time ?? "",
    completed: payload.done,
    completedAt: payload.completed_at,
    routineId: payload.routine_item_id,
    // 0008 events_payload omits these by design (see header).
    templateId: null,
    memo: payload.memo,
    noteId: null,
    content: null,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };

  item.isDeleted = meta.is_deleted;
  if (meta.deleted_at !== null) item.deletedAt = meta.deleted_at;
  item.isDismissed = payload.is_dismissed;
  item.isAllDay = payload.is_all_day;
  // Phase 2 compat: derive the flag — events_payload has no
  // reminder_enabled column.
  item.reminderEnabled = payload.reminder_at !== null;
  // reminderOffset is intentionally NOT set on read (no source column).

  return item;
}

// ---------------------------------------------------------------------------
// 4. INSERT: ScheduleItem -> { meta, payload }
// ---------------------------------------------------------------------------

/**
 * Project a ScheduleItem into the 2 INSERT rows.
 *
 * `reminder_at` write rule: if `reminderEnabled === true` and
 * `reminderOffset` is set, the caller must precompute the absolute
 * `reminder_at` (start_at + reminder offset) at the service layer — this
 * mapper writes `null` because it has no knowledge of timezones.
 * `reminderEnabled === true` with no precomputed `reminder_at` is
 * tolerated as a no-op on the DB side (reminder simply does not fire).
 *
 * `routine_item_role` and `is_deleted_cache` are stripped by the
 * `EventsPayloadWriteRow` type — they are server-managed.
 */
export function scheduleItemToRows(
  item: ScheduleItem,
  userId: string,
): { meta: ItemsMetaEventInsertRow; payload: EventsPayloadWriteRow } {
  const meta: ItemsMetaEventInsertRow = {
    id: item.id,
    user_id: userId,
    role: "event",
    title: item.title,
    is_deleted: item.isDeleted ?? false,
    deleted_at: item.deletedAt ?? null,
    version: 1,
  };

  const payload: EventsPayloadWriteRow = {
    item_id: item.id,
    user_id: userId,
    start_at: item.date === "" ? null : item.date,
    start_time: item.startTime === "" ? null : item.startTime,
    end_time: item.endTime === "" ? null : item.endTime,
    is_all_day: item.isAllDay ?? false,
    done: item.completed,
    completed_at: item.completedAt,
    is_dismissed: item.isDismissed ?? false,
    // No timezone math at the mapper layer — caller precomputes if needed.
    reminder_at: null,
    memo: item.memo,
    routine_item_id: item.routineId,
    source_date: null,
  };

  return { meta, payload };
}

// ---------------------------------------------------------------------------
// 5. UPDATE: Partial<ScheduleItem> -> { metaPatch, payloadPatch }
// ---------------------------------------------------------------------------

/**
 * Build snake_case PATCH objects for items_meta + events_payload from a
 * partial ScheduleItem update. Only keys explicitly present on `updates`
 * are emitted so a partial UPDATE never clobbers untouched columns
 * (Issue 020 partial-payload safety — see scheduleMapper.test.ts for the
 * date-only-move regression case).
 *
 * DB-Q2 contract — `metaPatch.updated_at = now` is ALWAYS set,
 * regardless of which payload columns the caller changed. Reason: Cloud
 * Sync uses `items_meta.updated_at` as its LWW cursor, and events_payload
 * has no own `updated_at` column (single-owner via the 1:1 FK).
 *
 * MUTABLE SURFACE (mirrors the Phase 2 frontend `ScheduleItemUpdate`):
 *   - title / startTime / endTime / completed / completedAt / memo /
 *     date / isAllDay / isDismissed / isDeleted / deletedAt
 *   - reminderEnabled — flipping FALSE clears events_payload.reminder_at
 *     (no offset column, so flipping TRUE without a precomputed
 *     `reminder_at` is a no-op).
 *   - content / noteId / templateId — kept on the surface for type
 *     compatibility but DROPPED in the emitted patch (no corresponding
 *     events_payload columns — see header).
 *   - routineId / id / version / createdAt — generator/identity-owned,
 *     NOT mutable through this path.
 */
export function scheduleItemUpdatesToPatches(
  updates: Partial<
    Pick<
      ScheduleItem,
      | "title"
      | "startTime"
      | "endTime"
      | "completed"
      | "completedAt"
      | "memo"
      | "content"
      | "date"
      | "isAllDay"
      | "isDismissed"
      | "isDeleted"
      | "deletedAt"
      | "noteId"
      | "templateId"
      | "reminderEnabled"
      | "reminderOffset"
    >
  >,
  userId: string,
  now: string,
): {
  metaPatch: ItemsMetaEventUpdatePatch;
  payloadPatch: EventsPayloadUpdatePatch;
} {
  // -- meta side --
  // DB-Q2: ALWAYS bump updated_at.
  const metaPatch: ItemsMetaEventUpdatePatch = { updated_at: now };
  if ("title" in updates && updates.title !== undefined)
    metaPatch.title = updates.title;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    metaPatch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) metaPatch.deleted_at = updates.deletedAt ?? null;

  // -- payload side --
  void userId;
  const payloadPatch: EventsPayloadUpdatePatch = {};
  if ("startTime" in updates && updates.startTime !== undefined)
    payloadPatch.start_time =
      updates.startTime === "" ? null : updates.startTime;
  if ("endTime" in updates && updates.endTime !== undefined)
    payloadPatch.end_time = updates.endTime === "" ? null : updates.endTime;
  if ("date" in updates && updates.date !== undefined)
    payloadPatch.start_at = updates.date === "" ? null : updates.date;
  if ("completed" in updates && updates.completed !== undefined)
    payloadPatch.done = updates.completed;
  if ("completedAt" in updates)
    payloadPatch.completed_at = updates.completedAt ?? null;
  if ("memo" in updates) payloadPatch.memo = updates.memo ?? null;
  if ("isAllDay" in updates && updates.isAllDay !== undefined)
    payloadPatch.is_all_day = updates.isAllDay;
  if ("isDismissed" in updates && updates.isDismissed !== undefined)
    payloadPatch.is_dismissed = updates.isDismissed;
  // Flipping reminderEnabled=false clears reminder_at; flipping true is
  // a no-op without an offset/timezone, leaving the column as caller
  // pre-set it (events_payload.reminder_at write path is service-owned
  // for the enable-true case).
  if ("reminderEnabled" in updates && updates.reminderEnabled === false)
    payloadPatch.reminder_at = null;
  // content / noteId / templateId / reminderOffset are dropped — the
  // 0008 events_payload schema has no corresponding columns.

  return { metaPatch, payloadPatch };
}

// ---------------------------------------------------------------------------
// 6. Back-compat shims (LEGACY — DU-C-5 will remove after the service is
//    rewritten to call the 2-row API directly).
// ---------------------------------------------------------------------------

/**
 * @deprecated Legacy single-row ScheduleItem shape (Phase 2
 * `public.schedule_items`). DU-C-5 will remove this once
 * `SupabaseScheduleItemsService` calls the 2-row API directly.
 */
export interface ScheduleItemRow {
  id: string;
  user_id: string;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  completed: boolean;
  completed_at: string | null;
  routine_id: string | null;
  template_id: string | null;
  memo: string | null;
  is_dismissed: boolean;
  note_id: string | null;
  is_all_day: boolean;
  content: string | null;
  reminder_enabled: boolean;
  reminder_offset: number | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/** @deprecated See `ScheduleItemRow`. */
export type ScheduleItemWriteRow = Omit<ScheduleItemRow, "user_id">;

/** @deprecated SELECT column list of the legacy single-row shape. */
export const SCHEDULE_ITEM_SELECT_COLUMNS =
  "id, user_id, date, title, start_time, end_time, completed, " +
  "completed_at, routine_id, template_id, memo, is_dismissed, note_id, " +
  "is_all_day, content, reminder_enabled, reminder_offset, is_deleted, " +
  "deleted_at, created_at, updated_at, version";

/** @deprecated Use `rowsToScheduleItem(meta, payload)` instead. */
export function rowToScheduleItem(row: ScheduleItemRow): ScheduleItem {
  const item: ScheduleItem = {
    id: row.id,
    date: row.date,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    completed: row.completed,
    completedAt: row.completed_at,
    routineId: row.routine_id,
    templateId: row.template_id,
    memo: row.memo,
    noteId: row.note_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  item.isDeleted = row.is_deleted;
  item.isDismissed = row.is_dismissed;
  item.isAllDay = row.is_all_day;
  item.reminderEnabled = row.reminder_enabled;
  if (row.deleted_at !== null) item.deletedAt = row.deleted_at;
  if (row.reminder_offset !== null) item.reminderOffset = row.reminder_offset;

  return item;
}

/** @deprecated Use `scheduleItemToRows(item, userId)` instead. */
export function scheduleItemToRow(item: ScheduleItem): ScheduleItemWriteRow {
  return {
    id: item.id,
    date: item.date,
    title: item.title,
    start_time: item.startTime,
    end_time: item.endTime,
    completed: item.completed,
    completed_at: item.completedAt,
    routine_id: item.routineId,
    template_id: item.templateId,
    memo: item.memo,
    is_dismissed: item.isDismissed ?? false,
    note_id: item.noteId,
    is_all_day: item.isAllDay ?? false,
    content: item.content,
    reminder_enabled: item.reminderEnabled ?? false,
    reminder_offset: item.reminderOffset ?? null,
    is_deleted: item.isDeleted ?? false,
    deleted_at: item.deletedAt ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    version: 1,
  };
}

/** @deprecated Use `scheduleItemUpdatesToPatches(updates, userId, now)` instead. */
export function scheduleItemUpdatesToPatch(
  updates: Partial<
    Pick<
      ScheduleItem,
      | "title"
      | "startTime"
      | "endTime"
      | "completed"
      | "completedAt"
      | "memo"
      | "content"
      | "date"
      | "isAllDay"
      | "isDismissed"
      | "isDeleted"
      | "deletedAt"
      | "noteId"
      | "templateId"
      | "reminderEnabled"
      | "reminderOffset"
    >
  >,
): Partial<ScheduleItemWriteRow> {
  const patch: Partial<ScheduleItemWriteRow> = {};
  if ("title" in updates && updates.title !== undefined)
    patch.title = updates.title;
  if ("startTime" in updates && updates.startTime !== undefined)
    patch.start_time = updates.startTime;
  if ("endTime" in updates && updates.endTime !== undefined)
    patch.end_time = updates.endTime;
  if ("completed" in updates && updates.completed !== undefined)
    patch.completed = updates.completed;
  if ("completedAt" in updates)
    patch.completed_at = updates.completedAt ?? null;
  if ("memo" in updates) patch.memo = updates.memo ?? null;
  if ("content" in updates) patch.content = updates.content ?? null;
  if ("date" in updates && updates.date !== undefined)
    patch.date = updates.date;
  if ("isAllDay" in updates && updates.isAllDay !== undefined)
    patch.is_all_day = updates.isAllDay;
  if ("isDismissed" in updates && updates.isDismissed !== undefined)
    patch.is_dismissed = updates.isDismissed;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    patch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  if ("noteId" in updates) patch.note_id = updates.noteId ?? null;
  if ("templateId" in updates) patch.template_id = updates.templateId ?? null;
  if ("reminderEnabled" in updates && updates.reminderEnabled !== undefined)
    patch.reminder_enabled = updates.reminderEnabled;
  if ("reminderOffset" in updates)
    patch.reminder_offset = updates.reminderOffset ?? null;
  return patch;
}
