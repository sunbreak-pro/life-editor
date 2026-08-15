import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import {
  localToday,
  localDayUtcRange,
  assertDateKey,
  assertTimeOfDay,
} from "../utils/localDate.js";
import {
  META_COLUMNS,
  bumpMeta,
  insertItem,
  softDeleteItem,
  updatePayload,
  type ItemsMetaRow,
} from "../utils/items.js";

/*
 * Schedule handlers — Supabase edition (briefing-loop Step 2 / Issue #256).
 *
 * Replaces the legacy single-table SQLite `schedule_items` access with the
 * unified 2-row model (0008): one `items_meta` row (role='event') + one
 * `events_payload` row per event. The conventions this file has to honour
 * (db-conventions §10) are the ones `utils/items.ts` already implements, so
 * the writes below go through those helpers rather than repeating them:
 *   - every write bumps `items_meta.updated_at` (the Cloud Sync LWW cursor;
 *     events_payload has no updated_at of its own) — §10.2
 *   - create = meta INSERT → payload INSERT with orphan recovery (meta
 *     hard-delete when the payload INSERT fails) — §10.5
 *   - delete = SOFT delete (items_meta.is_deleted; TrashView-restorable),
 *     mirroring SupabaseDataService.softDeleteScheduleItem
 *   - `version` is a legacy column, intentionally NOT bumped (CLAUDE.md §3.3)
 *
 * Column-set deltas vs the legacy SQLite shape (0008 design decisions, see
 * shared/src/services/scheduleItemMapper.ts header): events have no
 * content / note_id / template_id / reminder_enabled / reminder_offset.
 */

interface EventsPayloadRow {
  item_id: string;
  start_at: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  done: boolean;
  completed_at: string | null;
  is_dismissed: boolean;
  memo: string | null;
  routine_item_id: string | null;
}

const PAYLOAD_COLUMNS =
  "item_id, start_at, start_time, end_time, is_all_day, done, " +
  "completed_at, is_dismissed, memo, routine_item_id";

function formatItem(meta: ItemsMetaRow, payload: EventsPayloadRow) {
  return {
    id: meta.id,
    date: payload.start_at,
    title: meta.title,
    startTime: payload.start_time,
    endTime: payload.end_time,
    completed: payload.done,
    completedAt: payload.completed_at,
    routineId: payload.routine_item_id,
    memo: payload.memo,
    isDismissed: payload.is_dismissed,
    isAllDay: payload.is_all_day,
    isDeleted: meta.is_deleted,
    deletedAt: meta.deleted_at,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };
}

/**
 * In-app join of events_payload rows (already filtered) with their live
 * items_meta parents — same shape as SupabaseDataService.
 * fetchByPayloadFilter, without the pagination helpers (day/range MCP
 * queries stay far below the PostgREST page cap).
 */
async function fetchEvents(
  payloadFilter: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const { client } = await getSupabase();
  const { data: payloadRows, error: pErr } = await payloadFilter(
    client.from("events_payload").select(PAYLOAD_COLUMNS),
  ).order("start_time", { ascending: true, nullsFirst: false });
  if (pErr) throw new Error(`list events_payload: ${pErr.message}`);
  const payloads = (payloadRows ?? []) as EventsPayloadRow[];
  if (payloads.length === 0) return [];

  const { data: metaRows, error: mErr } = await client
    .from("items_meta")
    .select(META_COLUMNS)
    .eq("role", "event")
    .eq("is_deleted", false)
    .in(
      "id",
      payloads.map((p) => p.item_id),
    );
  if (mErr) throw new Error(`list items_meta: ${mErr.message}`);

  const metaById = new Map<string, ItemsMetaRow>();
  for (const m of (metaRows ?? []) as ItemsMetaRow[]) metaById.set(m.id, m);

  const out = [];
  for (const p of payloads) {
    const m = metaById.get(p.item_id);
    if (m) out.push(formatItem(m, p));
  }
  return out;
}

interface ScheduledTodoRow {
  item_id: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  is_all_day: boolean;
  status: string | null;
}

/** Todos scheduled inside the given local-day window (timestamptz). */
async function fetchScheduledTodos(startDate: string, endDate: string) {
  const { client } = await getSupabase();
  const { startIso } = localDayUtcRange(startDate);
  const { endIso } = localDayUtcRange(endDate);
  const { data: todoRows, error: tErr } = await client
    .from("tasks_payload")
    .select("item_id, scheduled_at, scheduled_end_at, is_all_day, status")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", startIso)
    .lt("scheduled_at", endIso)
    .order("scheduled_at", { ascending: true });
  if (tErr) throw new Error(`list tasks_payload: ${tErr.message}`);
  const todos = (todoRows ?? []) as ScheduledTodoRow[];
  if (todos.length === 0) return [];

  const { data: metaRows, error: mErr } = await client
    .from("items_meta")
    .select("id, title")
    .eq("role", "task")
    .eq("is_deleted", false)
    .in(
      "id",
      todos.map((t) => t.item_id),
    );
  if (mErr) throw new Error(`list todo items_meta: ${mErr.message}`);
  const titleById = new Map<string, string>();
  for (const m of (metaRows ?? []) as { id: string; title: string }[])
    titleById.set(m.id, m.title);

  return todos
    .filter((t) => titleById.has(t.item_id))
    .map((t) => ({
      id: t.item_id,
      title: titleById.get(t.item_id) as string,
      scheduledAt: t.scheduled_at,
      scheduledEndAt: t.scheduled_end_at,
      isAllDay: t.is_all_day,
      status: t.status,
    }));
}

/** Fetch one live event (meta + payload) or throw a not-found error. */
async function getEvent(id: string) {
  const { client } = await getSupabase();
  const [{ data: meta, error: mErr }, { data: payload, error: pErr }] =
    await Promise.all([
      client
        .from("items_meta")
        .select(META_COLUMNS)
        .eq("id", id)
        .eq("role", "event")
        .maybeSingle(),
      client
        .from("events_payload")
        .select(PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .maybeSingle(),
    ]);
  if (mErr) throw new Error(`get items_meta: ${mErr.message}`);
  if (pErr) throw new Error(`get events_payload: ${pErr.message}`);
  if (!meta || !payload) throw new Error(`Schedule item not found: ${id}`);
  return {
    meta: meta as unknown as ItemsMetaRow,
    payload: payload as unknown as EventsPayloadRow,
  };
}

/**
 * Reject the argument combinations that used to answer a different question
 * than the one asked (#702 ②).
 *
 * `start_date` alone fell through to the single-day branch and returned
 * TODAY: a caller who asked for "this week from Monday" got one day back,
 * with nothing in the result saying so. `date` alongside a range was
 * likewise dropped without a word. Both look like success, which is the
 * worst way to be wrong.
 */
function assertScheduleWindow(args: {
  date?: string;
  start_date?: string;
  end_date?: string;
}): void {
  if (Boolean(args.start_date) !== Boolean(args.end_date)) {
    const given = args.start_date ? "start_date" : "end_date";
    const missing = args.start_date ? "end_date" : "start_date";
    throw new Error(
      `${missing} is required when ${given} is given (use date on its own for a single day)`,
    );
  }
  if (args.date && args.start_date) {
    throw new Error(
      "date and start_date/end_date are mutually exclusive (pass a single day or a range, not both)",
    );
  }
}

export async function listSchedule(args: {
  date?: string;
  start_date?: string;
  end_date?: string;
}) {
  assertScheduleWindow(args);

  if (args.start_date && args.end_date) {
    assertDateKey(args.start_date);
    assertDateKey(args.end_date);
    const [scheduleItems, scheduledTodos] = await Promise.all([
      fetchEvents((q) =>
        q
          .gte("start_at", args.start_date)
          .lte("start_at", args.end_date)
          .eq("is_dismissed", false),
      ),
      fetchScheduledTodos(args.start_date, args.end_date),
    ]);
    return { scheduleItems, scheduledTodos };
  }

  const date = assertDateKey(args.date ?? localToday());
  const [scheduleItems, scheduledTodos] = await Promise.all([
    fetchEvents((q) => q.eq("start_at", date).eq("is_dismissed", false)),
    fetchScheduledTodos(date, date),
  ]);
  return { scheduleItems, scheduledTodos };
}

export async function createScheduleItem(args: {
  date: string;
  title: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  memo?: string;
}) {
  // #702 ②: the write path checked none of its own formats, so a typo in
  // `date` or a "9:00" instead of "09:00" surfaced as a raw Postgres parse
  // error naming a column the caller never mentioned.
  assertDateKey(args.date);

  // #702 ③: the times were `required` even for an all-day event, which then
  // threw them away — so a caller had to invent two values to be ignored.
  // They are required, and checked, exactly when they mean something.
  if (!args.is_all_day) {
    if (!args.start_time || !args.end_time) {
      throw new Error(
        "start_time and end_time are required unless is_all_day is true",
      );
    }
    assertTimeOfDay(args.start_time, "start_time");
    assertTimeOfDay(args.end_time, "end_time");
  }

  const id = `si-${randomUUID()}`;

  await insertItem({
    id,
    role: "event",
    title: args.title,
    payloadTable: "events_payload",
    payload: {
      start_at: args.date,
      start_time: args.is_all_day ? null : args.start_time,
      end_time: args.is_all_day ? null : args.end_time,
      is_all_day: args.is_all_day ?? false,
      done: false,
      completed_at: null,
      is_dismissed: false,
      reminder_at: null,
      memo: args.memo ?? null,
      routine_item_id: null,
      source_date: null,
    },
  });

  const { meta, payload } = await getEvent(id);
  return formatItem(meta, payload);
}

export async function updateScheduleItem(args: {
  id: string;
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  memo?: string;
  is_all_day?: boolean;
}) {
  // #702 ②: same formats as create_schedule_item, checked the same way —
  // and before the not-found round trip, since a malformed argument is
  // wrong whether or not the item exists.
  if (args.date !== undefined) assertDateKey(args.date);
  if (args.start_time !== undefined)
    assertTimeOfDay(args.start_time, "start_time");
  if (args.end_time !== undefined) assertTimeOfDay(args.end_time, "end_time");

  const { payload: current } = await getEvent(args.id); // not-found guard

  const metaPatch: Record<string, unknown> = {};
  if (args.title !== undefined) metaPatch.title = args.title;

  const payloadPatch: Record<string, unknown> = {};
  if (args.date !== undefined) payloadPatch.start_at = args.date;
  if (args.start_time !== undefined) payloadPatch.start_time = args.start_time;
  if (args.end_time !== undefined) payloadPatch.end_time = args.end_time;
  if (args.memo !== undefined) payloadPatch.memo = args.memo;

  /*
   * #702 ③: is_all_day and the times used to move independently here, while
   * create_schedule_item nulled the times for an all-day event. Flipping an
   * event to all-day therefore left 09:00-09:15 sitting in the row, and
   * flipping one back left an event with no times at all — two shapes the
   * create path can never produce. Both directions now settle the times.
   */
  if (args.is_all_day !== undefined) {
    payloadPatch.is_all_day = args.is_all_day;
    if (args.is_all_day) {
      payloadPatch.start_time = null;
      payloadPatch.end_time = null;
    } else {
      const start = args.start_time ?? current.start_time;
      const end = args.end_time ?? current.end_time;
      if (!start || !end) {
        throw new Error(
          "start_time and end_time are required when turning is_all_day off (this item has none stored)",
        );
      }
      payloadPatch.start_time = start;
      payloadPatch.end_time = end;
    }
  }

  // §10.2: the updated_at bump is unconditional, even for a call that names
  // no field at all. `updatePayload` would treat "nothing to change" as a
  // no-op, so the field-less case goes straight to `bumpMeta` and keeps the
  // LWW cursor moving exactly as this tool always has.
  if (Object.keys(payloadPatch).length > 0) {
    await updatePayload(
      "events_payload",
      args.id,
      "event",
      payloadPatch,
      metaPatch,
    );
  } else {
    await bumpMeta(args.id, "event", metaPatch);
  }

  const { meta, payload } = await getEvent(args.id);
  return formatItem(meta, payload);
}

/**
 * Hide or unhide an event (#702 ③).
 *
 * Was two tools, `dismiss_schedule_item` / `undismiss_schedule_item`, over
 * this one line. Two names for one boolean means the caller picks the tool
 * from the state it thinks the item is in; one tool taking the value means
 * it states the state it wants. Renamed rather than aliased, per #419: an
 * old name kept beside the new one is a wrong instruction still on offer.
 */
export async function setScheduleDismissed(args: {
  id: string;
  dismissed: boolean;
}) {
  await getEvent(args.id);
  await updatePayload("events_payload", args.id, "event", {
    is_dismissed: args.dismissed,
  });

  const { meta, payload } = await getEvent(args.id);
  return formatItem(meta, payload);
}

export async function deleteScheduleItem(args: { id: string }) {
  await getEvent(args.id);
  await softDeleteItem(args.id, "event");
  return { success: true, id: args.id, softDeleted: true };
}

/**
 * Mark an event done or not done (#702 ③).
 *
 * Was `toggle_schedule_complete`, which flipped whatever the row held. A
 * caller that means "mark this done" cannot predict the outcome without
 * first reading the current value, and calling it twice undoes the intent —
 * the tool was not idempotent (running it again changes the answer). Taking
 * the value instead makes the result knowable before the call. Renamed
 * rather than aliased, per #419.
 */
export async function setScheduleComplete(args: {
  id: string;
  completed: boolean;
}) {
  await getEvent(args.id);

  await updatePayload("events_payload", args.id, "event", {
    done: args.completed,
    completed_at: args.completed ? new Date().toISOString() : null,
  });

  const { meta, payload } = await getEvent(args.id);
  return formatItem(meta, payload);
}
