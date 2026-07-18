import { getSupabase } from "../supabase.js";
import { localToday, addDays, localDayUtcRange } from "../utils/localDate.js";
import {
  upsertBriefingSection,
  hasBriefingSection,
} from "../utils/briefingSection.js";
import { extractTextFromTipTap } from "../utils/tiptapText.js";

/*
 * Briefing handlers (briefing-loop Step 2 / Issue #256).
 *
 *   get_today_context — everything the morning-paper writer needs in one
 *     call: today's events, scheduled/overdue/in-progress tasks, recent
 *     dailies (the 夕刊 material) and the state of today's daily.
 *   write_briefing — upserts the 朝刊 section into today's DailyNode
 *     content (dailies_payload.content_json), honouring the §10.2
 *     items_meta.updated_at bump. The section shape is the write half of
 *     shared/src/components/briefing/extractBriefing.ts.
 */

interface DailiesPayloadRow {
  item_id: string;
  date: string;
  content_json: unknown;
}

/** jsonb → TipTap JSON string (same policy as dailiesUnifiedMapper). */
function contentJsonToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function contentPlainText(value: unknown): string {
  const s = contentJsonToString(value);
  if (s === "") return "";
  try {
    return extractTextFromTipTap(JSON.parse(s)).trim();
  } catch {
    return s;
  }
}

/** Live daily payload rows for date ∈ [from, to], newest first. */
async function fetchDailies(from: string, to: string) {
  const { client } = await getSupabase();
  const { data: rows, error } = await client
    .from("dailies_payload")
    .select("item_id, date, content_json")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });
  if (error) throw new Error(`dailies_payload: ${error.message}`);
  const payloads = (rows ?? []) as DailiesPayloadRow[];
  if (payloads.length === 0) return [];

  const { data: metaRows, error: mErr } = await client
    .from("items_meta")
    .select("id, is_deleted")
    .eq("role", "daily")
    .in(
      "id",
      payloads.map((p) => p.item_id),
    );
  if (mErr) throw new Error(`daily items_meta: ${mErr.message}`);
  const live = new Set(
    ((metaRows ?? []) as { id: string; is_deleted: boolean }[])
      .filter((m) => !m.is_deleted)
      .map((m) => m.id),
  );
  return payloads.filter((p) => live.has(p.item_id));
}

interface OpenTaskRow {
  item_id: string;
  due_at: string | null;
  status: string | null;
  priority: number | null;
  scheduled_at: string | null;
}

const OPEN_TASK_COLUMNS = "item_id, due_at, status, priority, scheduled_at";

export async function getTodayContext(args: { date?: string }) {
  const date = args.date ?? localToday();
  const { client } = await getSupabase();

  // Today's events (live, not dismissed) + tasks scheduled onto today.
  const { startIso, endIso } = localDayUtcRange(date);
  const [
    { data: eventPayloads, error: eErr },
    { data: scheduledTaskRows, error: sErr },
    { data: dueTaskRows, error: dErr },
    { data: inProgressRows, error: iErr },
    recentDailyPayloads,
    todayDailyPayloads,
  ] = await Promise.all([
    client
      .from("events_payload")
      .select("item_id, start_at, start_time, end_time, is_all_day, done, memo")
      .eq("start_at", date)
      .eq("is_dismissed", false)
      .order("start_time", { ascending: true, nullsFirst: false }),
    client
      .from("tasks_payload")
      .select("item_id, scheduled_at, scheduled_end_at, is_all_day, status")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at", { ascending: true }),
    // Due today or overdue (carry-over), not yet DONE. NB: a plain
    // .neq("status", "DONE") would also drop NULL-status rows (SQL
    // three-valued logic), so NULL is allowed explicitly.
    client
      .from("tasks_payload")
      .select(OPEN_TASK_COLUMNS)
      .eq("task_type", "task")
      .not("due_at", "is", null)
      .lte("due_at", date)
      .or("status.neq.DONE,status.is.null"),
    client
      .from("tasks_payload")
      .select(OPEN_TASK_COLUMNS)
      .eq("task_type", "task")
      .eq("status", "IN_PROGRESS"),
    fetchDailies(addDays(date, -3), addDays(date, -1)),
    fetchDailies(date, date),
  ]);
  if (eErr) throw new Error(`events_payload: ${eErr.message}`);
  if (sErr) throw new Error(`scheduled tasks: ${sErr.message}`);
  if (dErr) throw new Error(`due tasks: ${dErr.message}`);
  if (iErr) throw new Error(`in-progress tasks: ${iErr.message}`);

  // Merge the two open-task queries (a task can be both overdue and
  // in-progress) and resolve titles + liveness via items_meta in one shot.
  const openTaskById = new Map<string, OpenTaskRow>();
  for (const row of [
    ...((dueTaskRows ?? []) as OpenTaskRow[]),
    ...((inProgressRows ?? []) as OpenTaskRow[]),
  ])
    openTaskById.set(row.item_id, row);

  const titleIds = [
    ...((eventPayloads ?? []) as { item_id: string }[]).map((r) => r.item_id),
    ...((scheduledTaskRows ?? []) as { item_id: string }[]).map(
      (r) => r.item_id,
    ),
    ...openTaskById.keys(),
  ];
  const titleById = new Map<string, string>();
  if (titleIds.length > 0) {
    const { data: metaRows, error: mErr } = await client
      .from("items_meta")
      .select("id, title")
      .eq("is_deleted", false)
      .in("id", titleIds);
    if (mErr) throw new Error(`items_meta titles: ${mErr.message}`);
    for (const m of (metaRows ?? []) as { id: string; title: string }[])
      titleById.set(m.id, m.title);
  }

  const todayDaily = todayDailyPayloads[0] ?? null;
  const todayContent = todayDaily
    ? contentJsonToString(todayDaily.content_json)
    : null;

  return {
    date,
    events: ((eventPayloads ?? []) as Array<Record<string, unknown>>)
      .filter((e) => titleById.has(e.item_id as string))
      .map((e) => ({
        id: e.item_id,
        title: titleById.get(e.item_id as string),
        startTime: e.start_time,
        endTime: e.end_time,
        isAllDay: e.is_all_day,
        completed: e.done,
        memo: e.memo,
      })),
    scheduledTasks: (
      (scheduledTaskRows ?? []) as Array<Record<string, unknown>>
    )
      .filter((t) => titleById.has(t.item_id as string))
      .map((t) => ({
        id: t.item_id,
        title: titleById.get(t.item_id as string),
        scheduledAt: t.scheduled_at,
        scheduledEndAt: t.scheduled_end_at,
        isAllDay: t.is_all_day,
        status: t.status,
      })),
    openTasks: [...openTaskById.values()]
      .filter((t) => titleById.has(t.item_id))
      .map((t) => ({
        id: t.item_id,
        title: titleById.get(t.item_id),
        dueAt: t.due_at,
        status: t.status,
        priority: t.priority,
        overdue: t.due_at !== null && t.due_at < date,
      })),
    recentDailies: recentDailyPayloads.map((d) => ({
      date: d.date,
      text: contentPlainText(d.content_json),
    })),
    todayDaily: {
      exists: todayDaily !== null,
      hasBriefing: todayDaily ? hasBriefingSection(todayContent) : false,
      text: todayDaily ? contentPlainText(todayDaily.content_json) : null,
    },
  };
}

export async function writeBriefing(args: {
  date?: string;
  focus: string;
  paragraphs?: string[];
}) {
  const date = args.date ?? localToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`write_briefing: invalid date "${date}"`);
  }
  const paragraphs = args.paragraphs ?? [];
  const { client, userId } = await getSupabase();
  const now = new Date().toISOString();

  const { data: existing, error: exErr } = await client
    .from("dailies_payload")
    .select("item_id, date, content_json")
    .eq("date", date)
    .maybeSingle();
  if (exErr) throw new Error(`dailies_payload read: ${exErr.message}`);

  if (existing) {
    const row = existing as DailiesPayloadRow;
    const next = upsertBriefingSection(
      contentJsonToString(row.content_json),
      args.focus,
      paragraphs,
    );
    const { error: pErr } = await client
      .from("dailies_payload")
      .update({ content_json: JSON.parse(next) })
      .eq("item_id", row.item_id);
    if (pErr) throw new Error(`dailies_payload update: ${pErr.message}`);

    // §10.2 LWW bump. A soft-deleted daily is restored — a briefing
    // written into a trashed (invisible) daily would silently vanish.
    const { error: mErr } = await client
      .from("items_meta")
      .update({ updated_at: now, is_deleted: false, deleted_at: null })
      .eq("id", row.item_id)
      .eq("role", "daily");
    if (mErr) throw new Error(`items_meta bump: ${mErr.message}`);

    return { date, dailyId: row.item_id, created: false, focus: args.focus };
  }

  // No daily yet — create the canonical `daily-<YYYY-MM-DD>` pair
  // (§10.5 orphan recovery on the payload INSERT).
  const id = `daily-${date}`;
  const content = upsertBriefingSection(null, args.focus, paragraphs);
  const { error: mErr } = await client.from("items_meta").insert({
    id,
    user_id: userId,
    role: "daily",
    // items_meta.title is NOT NULL; the date IS the daily's identity
    // (same rule as dailiesUnifiedMapper).
    title: date,
    is_deleted: false,
    deleted_at: null,
    version: 1,
  });
  if (mErr) throw new Error(`items_meta insert: ${mErr.message}`);

  try {
    const { error: pErr } = await client.from("dailies_payload").insert({
      item_id: id,
      user_id: userId,
      date,
      content_json: JSON.parse(content),
      is_pinned: false,
      is_edit_locked: false,
    });
    if (pErr) throw new Error(`dailies_payload insert: ${pErr.message}`);
  } catch (err) {
    await client.from("items_meta").delete().eq("id", id);
    throw err;
  }

  return { date, dailyId: id, created: true, focus: args.focus };
}
