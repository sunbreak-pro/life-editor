import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import { localToday, localDayUtcRange } from "../utils/localDate.js";

/*
 * Schedule handlers — Supabase edition (briefing-loop Step 2 / Issue #256).
 *
 * Replaces the legacy single-table SQLite `schedule_items` access with the
 * unified 2-row model (0008): one `items_meta` row (role='event') + one
 * `events_payload` row per event. Conventions honoured (db-conventions §10):
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

interface ItemsMetaRow {
  id: string;
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

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

const META_COLUMNS =
  "id, title, is_deleted, deleted_at, created_at, updated_at";
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

  const date = args.date ?? localToday();
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
  const { client, userId } = await getSupabase();
  const id = `si-${randomUUID()}`;

  const { error: mErr } = await client.from("items_meta").insert({
    id,
    user_id: userId,
    role: "event",
    title: args.title,
    is_deleted: false,
    deleted_at: null,
    version: 1,
  });
  if (mErr) throw new Error(`create items_meta: ${mErr.message}`);

  // §10.5 orphan recovery: hard-delete the meta row when the payload
  // INSERT fails, so no meta-only orphan survives.
  try {
    const { error: pErr } = await client.from("events_payload").insert({
      item_id: id,
      user_id: userId,
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
    });
    if (pErr) throw new Error(`create events_payload: ${pErr.message}`);
  } catch (err) {
    await client.from("items_meta").delete().eq("id", id);
    throw err;
  }

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
  const { client } = await getSupabase();
  await getEvent(args.id); // not-found guard

  // §10.2: updated_at bump is unconditional, even for payload-only edits.
  const metaPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (args.title !== undefined) metaPatch.title = args.title;

  const payloadPatch: Record<string, unknown> = {};
  if (args.date !== undefined) payloadPatch.start_at = args.date;
  if (args.start_time !== undefined) payloadPatch.start_time = args.start_time;
  if (args.end_time !== undefined) payloadPatch.end_time = args.end_time;
  if (args.memo !== undefined) payloadPatch.memo = args.memo;
  if (args.is_all_day !== undefined) payloadPatch.is_all_day = args.is_all_day;

  const { error: mErr } = await client
    .from("items_meta")
    .update(metaPatch)
    .eq("id", args.id)
    .eq("role", "event");
  if (mErr) throw new Error(`update items_meta: ${mErr.message}`);

  if (Object.keys(payloadPatch).length > 0) {
    const { error: pErr } = await client
      .from("events_payload")
      .update(payloadPatch)
      .eq("item_id", args.id);
    if (pErr) throw new Error(`update events_payload: ${pErr.message}`);
  }

  const { meta, payload } = await getEvent(args.id);
  return formatItem(meta, payload);
}

async function setDismissed(id: string, dismissed: boolean) {
  const { client } = await getSupabase();
  await getEvent(id);

  const { error: pErr } = await client
    .from("events_payload")
    .update({ is_dismissed: dismissed })
    .eq("item_id", id);
  if (pErr) throw new Error(`dismiss events_payload: ${pErr.message}`);

  const { error: mErr } = await client
    .from("items_meta")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("role", "event");
  if (mErr) throw new Error(`dismiss items_meta: ${mErr.message}`);

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
  const { client } = await getSupabase();
  await getEvent(args.id);

  const now = new Date().toISOString();
  const { error } = await client
    .from("items_meta")
    .update({ is_deleted: true, deleted_at: now, updated_at: now })
    .eq("id", args.id)
    .eq("role", "event");
  if (error) throw new Error(`delete items_meta: ${error.message}`);
  return { success: true, id: args.id, softDeleted: true };
}

export async function toggleScheduleComplete(args: { id: string }) {
  const { client } = await getSupabase();
  const { payload } = await getEvent(args.id);

  const done = !payload.done;
  const now = new Date().toISOString();
  const { error: pErr } = await client
    .from("events_payload")
    .update({ done, completed_at: done ? now : null })
    .eq("item_id", args.id);
  if (pErr) throw new Error(`toggle events_payload: ${pErr.message}`);

  const { error: mErr } = await client
    .from("items_meta")
    .update({ updated_at: now })
    .eq("id", args.id)
    .eq("role", "event");
  if (mErr) throw new Error(`toggle items_meta: ${mErr.message}`);

  const { meta, payload: fresh } = await getEvent(args.id);
  return formatItem(meta, fresh);
}
