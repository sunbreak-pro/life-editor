import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import {
  localToday,
  localDayUtcRange,
  assertDateKey,
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

interface ScheduledTaskRow {
  item_id: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  is_all_day: boolean;
  status: string | null;
}

/** Tasks scheduled inside the given local-day window (timestamptz). */
async function fetchScheduledTasks(startDate: string, endDate: string) {
  const { client } = await getSupabase();
  const { startIso } = localDayUtcRange(startDate);
  const { endIso } = localDayUtcRange(endDate);
  const { data: taskRows, error: tErr } = await client
    .from("tasks_payload")
    .select("item_id, scheduled_at, scheduled_end_at, is_all_day, status")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", startIso)
    .lt("scheduled_at", endIso)
    .order("scheduled_at", { ascending: true });
  if (tErr) throw new Error(`list tasks_payload: ${tErr.message}`);
  const tasks = (taskRows ?? []) as ScheduledTaskRow[];
  if (tasks.length === 0) return [];

  const { data: metaRows, error: mErr } = await client
    .from("items_meta")
    .select("id, title")
    .eq("role", "task")
    .eq("is_deleted", false)
    .in(
      "id",
      tasks.map((t) => t.item_id),
    );
  if (mErr) throw new Error(`list task items_meta: ${mErr.message}`);
  const titleById = new Map<string, string>();
  for (const m of (metaRows ?? []) as { id: string; title: string }[])
    titleById.set(m.id, m.title);

  return tasks
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

export async function listSchedule(args: {
  date?: string;
  start_date?: string;
  end_date?: string;
}) {
  if (args.start_date && args.end_date) {
    assertDateKey(args.start_date);
    assertDateKey(args.end_date);
    const [scheduleItems, scheduledTasks] = await Promise.all([
      fetchEvents((q) =>
        q
          .gte("start_at", args.start_date)
          .lte("start_at", args.end_date)
          .eq("is_dismissed", false),
      ),
      fetchScheduledTasks(args.start_date, args.end_date),
    ]);
    return { scheduleItems, scheduledTasks };
  }

  const date = assertDateKey(args.date ?? localToday());
  const [scheduleItems, scheduledTasks] = await Promise.all([
    fetchEvents((q) => q.eq("start_at", date).eq("is_dismissed", false)),
    fetchScheduledTasks(date, date),
  ]);
  return { scheduleItems, scheduledTasks };
}

export async function createScheduleItem(args: {
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  is_all_day?: boolean;
  memo?: string;
}) {
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
  await getEvent(args.id); // not-found guard

  const metaPatch: Record<string, unknown> = {};
  if (args.title !== undefined) metaPatch.title = args.title;

  const payloadPatch: Record<string, unknown> = {};
  if (args.date !== undefined) payloadPatch.start_at = args.date;
  if (args.start_time !== undefined) payloadPatch.start_time = args.start_time;
  if (args.end_time !== undefined) payloadPatch.end_time = args.end_time;
  if (args.memo !== undefined) payloadPatch.memo = args.memo;
  if (args.is_all_day !== undefined) payloadPatch.is_all_day = args.is_all_day;

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

async function setDismissed(id: string, dismissed: boolean) {
  await getEvent(id);
  await updatePayload("events_payload", id, "event", {
    is_dismissed: dismissed,
  });

  const { meta, payload } = await getEvent(id);
  return formatItem(meta, payload);
}

export async function dismissScheduleItem(args: { id: string }) {
  return setDismissed(args.id, true);
}

export async function undismissScheduleItem(args: { id: string }) {
  return setDismissed(args.id, false);
}

export async function deleteScheduleItem(args: { id: string }) {
  await getEvent(args.id);
  await softDeleteItem(args.id, "event");
  return { success: true, id: args.id, softDeleted: true };
}

export async function toggleScheduleComplete(args: { id: string }) {
  const { payload } = await getEvent(args.id);

  const done = !payload.done;
  await updatePayload("events_payload", args.id, "event", {
    done,
    completed_at: done ? new Date().toISOString() : null,
  });

  const { meta, payload: fresh } = await getEvent(args.id);
  return formatItem(meta, fresh);
}
