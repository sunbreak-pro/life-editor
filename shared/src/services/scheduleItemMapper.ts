import type { ScheduleItem } from "../types/schedule";
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
 * Pure ScheduleItem <-> 2-row (items_meta + events_payload) mappers
 * (DU-C-2). Same pattern as `todoMapper.ts` / `routineMapper.ts`: a
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
 * The single-row shims that bridged DU-C-5 (`ScheduleItemRow` /
 * `rowToScheduleItem` / `scheduleItemToRow` / `scheduleItemUpdatesToPatch`)
 * were deleted in #670 C3 PR 1 — the service has called the 2-row API
 * since DU-C-5 landed, so there is nothing left to migrate onto.
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
 *   - The partial UNIQUE dedup on bulkCreate (a pre-SELECT of the live
 *     (routine_item_id, source_date) pairs, NOT ON CONFLICT — PostgREST
 *     cannot aim one at a PARTIAL index; it lives in the service layer
 *     and the mapper only produces row shapes).
 *
 * Carries NO `@supabase/supabase-js` dependency: this module is pure.
 * The 0008 + 0011 migrations are the SSOT for column types — keep this
 * file in lockstep with them.
 */

// ---------------------------------------------------------------------------
// 1. 2-row shapes (matches 0008 + 0011 schema verbatim)
// ---------------------------------------------------------------------------

/**
 * items_meta shapes for role='event' — aliases of the canonical generics
 * in `itemsMeta` (the 5 role mappers carried byte-identical copies).
 */
export type ItemsMetaEventRow = ItemsMetaRow<"event">;
export type ItemsMetaEventInsertRow = ItemsMetaInsertRow<"event">;
export type ItemsMetaEventUpdatePatch = ItemsMetaUpdatePatch;

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

/** Role-scoped alias of `ITEMS_META_COLUMNS` for Events call sites. */
export const ITEMS_META_EVENT_COLUMNS = ITEMS_META_COLUMNS;

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
  assertItemsMetaPair("scheduleItemMapper", "event", meta, payload);

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
  // #296: surface the generator's origin day so the cleanup can tell a
  // hand-moved occurrence (date ≠ sourceDate) from a stale generated row.
  // Absent when null — same round-trip diff contract as deletedAt.
  if (payload.source_date !== null) item.sourceDate = payload.source_date;
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
  const meta: ItemsMetaEventInsertRow = toItemsMetaInsertRow({
    id: item.id,
    userId,
    role: "event",
    title: item.title,
    isDeleted: item.isDeleted,
    deletedAt: item.deletedAt,
  });

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
 *   - routineId / id / createdAt — generator/identity-owned, NOT mutable
 *     through this path.
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
  // DB-Q2's `updated_at` bump lives in `toItemsMetaPatch` (#890). Events
  // SKIP a present-but-undefined `isDeleted` rather than normalising it to
  // false the way todo / note / daily do — kept by not assigning the key.
  const metaFields: ItemsMetaPatchInput = {};
  if ("title" in updates) metaFields.title = updates.title;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    metaFields.isDeleted = updates.isDeleted;
  if ("deletedAt" in updates) metaFields.deletedAt = updates.deletedAt;
  const metaPatch: ItemsMetaEventUpdatePatch = toItemsMetaPatch(
    metaFields,
    now,
  );

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
