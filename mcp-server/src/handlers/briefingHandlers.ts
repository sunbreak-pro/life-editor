import { getSupabase } from "../supabase.js";
import {
  localToday,
  addDays,
  localDateKey,
  localDayUtcRange,
  localWeekStart,
  assertDateKey,
} from "../utils/localDate.js";
import {
  upsertBriefingSection,
  hasBriefingSection,
} from "../utils/briefingSection.js";
import {
  FOCUS_NOTE_ID,
  FOCUS_NOTE_TITLE,
  mergeFocusSection,
  normalizeFocusText,
} from "../utils/focusSection.js";
import { contentJsonToString, contentPlainText } from "../utils/content.js";
import { insertItem, updatePayload } from "../utils/items.js";
import { fetchByIdChunks } from "../utils/pagination.js";

/*
 * Briefing handlers (briefing-loop Step 2 / Issue #256).
 *
 *   get_today_context — everything the morning-paper writer needs in one
 *     call: today's events, scheduled/overdue/in-progress todos, recent
 *     dailies (the 夕刊 material) and the state of today's daily.
 *   get_week_context — the same day-shaped material for 7 days at once, for
 *     the weekly review (#782 ③).
 *   write_briefing — two writes since #1048 / #1097: the focus goes into
 *     the reserved focus note's per-day section (the read half =
 *     shared focusSections.ts), and the comment paragraphs are upserted as
 *     the 朝刊 section of the DailyNode content (read half =
 *     shared extractBriefing.ts). Both honour the §10.2
 *     items_meta.updated_at bump.
 */

interface DailiesPayloadRow {
  item_id: string;
  date: string;
  content_json: unknown;
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

interface EventRow {
  item_id: string;
  start_at: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  done: boolean;
  memo: string | null;
}

interface ScheduledTodoRow {
  item_id: string;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  is_all_day: boolean;
  status: string | null;
}

interface OpenTodoRow {
  item_id: string;
  due_at: string | null;
  status: string | null;
  priority: number | null;
  scheduled_at: string | null;
}

const EVENT_COLUMNS =
  "item_id, start_at, start_time, end_time, is_all_day, done, memo";
const SCHEDULED_TODO_COLUMNS =
  "item_id, scheduled_at, scheduled_end_at, is_all_day, status";
const OPEN_TODO_COLUMNS = "item_id, due_at, status, priority, scheduled_at";

/*
 * The three item shapes a context tool returns. Both tools hand back the same
 * ones — a day inside get_week_context is exactly a get_today_context day —
 * so they are formatted here once rather than per tool.
 *
 * Bodies are deliberately absent: an event's memo is a line, but a todo's
 * content is a document, and a week of them would swamp the context the
 * caller came here to save. `title` is resolved through items_meta, which is
 * also the liveness check — callers filter on `titleById.has(...)` first.
 */

function formatEvent(row: EventRow, titleById: Map<string, string>) {
  return {
    id: row.item_id,
    title: titleById.get(row.item_id),
    startTime: row.start_time,
    endTime: row.end_time,
    isAllDay: row.is_all_day,
    completed: row.done,
    memo: row.memo,
  };
}

function formatScheduledTodo(
  row: ScheduledTodoRow,
  titleById: Map<string, string>,
) {
  return {
    id: row.item_id,
    title: titleById.get(row.item_id),
    scheduledAt: row.scheduled_at,
    scheduledEndAt: row.scheduled_end_at,
    isAllDay: row.is_all_day,
    status: row.status,
  };
}

/** `sinceIso` is the instant a todo counts as carried over from before. */
function formatOpenTodo(
  row: OpenTodoRow,
  titleById: Map<string, string>,
  sinceIso: string,
) {
  return {
    id: row.item_id,
    title: titleById.get(row.item_id),
    scheduledAt: row.scheduled_at,
    dueAt: row.due_at,
    status: row.status,
    priority: row.priority,
    // Compared as instants, not strings: PostgREST renders timestamptz as
    // `+00:00` while toISOString ends `.000Z`, and at the same second the
    // string order puts `+` before `.` — a midnight-of-the-window todo would
    // read as carried over.
    carriedOver:
      row.scheduled_at !== null &&
      Date.parse(row.scheduled_at) < Date.parse(sinceIso),
  };
}

/**
 * Collect the open-todo rows into an id-keyed map, listing each todo once.
 *
 * It took two query results until #873: carry-over plus everything marked
 * IN_PROGRESS. That status is retired, so carry-over — scheduled before the
 * window and not yet DONE — is now the whole definition of an open todo.
 */
function mergeOpenTodos(...rowSets: OpenTodoRow[][]): Map<string, OpenTodoRow> {
  const byId = new Map<string, OpenTodoRow>();
  for (const rows of rowSets)
    for (const row of rows) byId.set(row.item_id, row);
  return byId;
}

/**
 * id → items_meta.title for the LIVE rows among `ids`. Doubles as the
 * liveness filter: a trashed or vanished item simply has no title here.
 */
async function resolveTitles(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const titleById = new Map<string, string>();
  if (unique.length === 0) return titleById;

  const { client } = await getSupabase();
  const rows = await fetchByIdChunks<{ id: string; title: string }>(
    unique,
    async (chunk) => {
      const { data, error } = await client
        .from("items_meta")
        .select("id, title")
        .eq("is_deleted", false)
        .in("id", chunk);
      if (error) throw new Error(`items_meta titles: ${error.message}`);
      return (data ?? []) as { id: string; title: string }[];
    },
  );
  for (const m of rows) titleById.set(m.id, m.title);
  return titleById;
}

/** Bucket rows by day key; a row whose key is null belongs to no day. */
function groupByDate<Row>(
  rows: Row[],
  keyOf: (row: Row) => string | null,
): Map<string, Row[]> {
  const byDate = new Map<string, Row[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    const bucket = byDate.get(key);
    if (bucket) bucket.push(row);
    else byDate.set(key, [row]);
  }
  return byDate;
}

export async function getTodayContext(args: { date?: string }) {
  const date = assertDateKey(args.date ?? localToday());
  const { client } = await getSupabase();

  // Today's events (live, not dismissed) + todos scheduled onto today.
  const { startIso, endIso } = localDayUtcRange(date);
  const [
    { data: eventPayloads, error: eErr },
    { data: scheduledTodoRows, error: sErr },
    { data: carryoverRows, error: cErr },
    recentDailyPayloads,
    todayDailyPayloads,
  ] = await Promise.all([
    client
      .from("events_payload")
      .select(EVENT_COLUMNS)
      .eq("start_at", date)
      .eq("is_dismissed", false)
      .order("start_time", { ascending: true, nullsFirst: false }),
    client
      .from("tasks_payload")
      .select(SCHEDULED_TODO_COLUMNS)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at", { ascending: true }),
    // Carry-over: scheduled BEFORE today and not yet DONE — the same
    // definition BriefingScreen uses for 持ち越し. `due_at` is a dead
    // column (todoNodeToRows always writes NULL); `scheduled_at` is the
    // field the app actually populates. NB: a plain .neq("status",
    // "DONE") would also drop NULL-status rows (SQL three-valued
    // logic), so NULL is allowed explicitly.
    client
      .from("tasks_payload")
      .select(OPEN_TODO_COLUMNS)
      .eq("task_type", "task")
      .not("scheduled_at", "is", null)
      .lt("scheduled_at", startIso)
      .or("status.neq.DONE,status.is.null"),
    fetchDailies(addDays(date, -3), addDays(date, -1)),
    fetchDailies(date, date),
  ]);
  if (eErr) throw new Error(`events_payload: ${eErr.message}`);
  if (sErr) throw new Error(`scheduled todos: ${sErr.message}`);
  if (cErr) throw new Error(`carry-over todos: ${cErr.message}`);

  // Collect the open todos and resolve titles + liveness via items_meta in one
  // shot.
  const events = (eventPayloads ?? []) as EventRow[];
  const scheduledTodos = (scheduledTodoRows ?? []) as ScheduledTodoRow[];
  const openTodoById = mergeOpenTodos((carryoverRows ?? []) as OpenTodoRow[]);
  const titleById = await resolveTitles([
    ...events.map((r) => r.item_id),
    ...scheduledTodos.map((r) => r.item_id),
    ...openTodoById.keys(),
  ]);

  const todayDaily = todayDailyPayloads[0] ?? null;
  const todayContent = todayDaily
    ? contentJsonToString(todayDaily.content_json)
    : null;

  return {
    date,
    events: events
      .filter((e) => titleById.has(e.item_id))
      .map((e) => formatEvent(e, titleById)),
    scheduledTodos: scheduledTodos
      .filter((t) => titleById.has(t.item_id))
      .map((t) => formatScheduledTodo(t, titleById)),
    openTodos: [...openTodoById.values()]
      .filter((t) => titleById.has(t.item_id))
      .map((t) => formatOpenTodo(t, titleById, startIso)),
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

/**
 * get_week_context (#782 ③) — the weekly-review counterpart of
 * get_today_context.
 *
 * A review used to cost seven get_today_context calls, six of which returned
 * the same open-todo list. Here the whole window is four queries: the days
 * are grouped in-app from one range read per source, and the open todos are
 * measured once, against the START of the week.
 */
export async function getWeekContext(args: { start_date?: string }) {
  // An explicit start_date opens a 7-day window there; only the default
  // snaps, so "no argument" means the week the caller is living in. Checked
  // as `!= null` so an empty string is rejected by assertDateKey instead of
  // silently answering for this week (get_today_context's rule).
  const startDate =
    args.start_date != null
      ? assertDateKey(args.start_date)
      : localWeekStart(localToday());
  const endDate = addDays(startDate, 6);
  const { client } = await getSupabase();

  // `scheduled_at` is an instant, so the 7 local days become one UTC window
  // [00:00 of day 1, 00:00 of day 8). `start_at` is a local date string and
  // compares as one.
  const { startIso } = localDayUtcRange(startDate);
  const { endIso } = localDayUtcRange(endDate);
  const [
    { data: eventPayloads, error: eErr },
    { data: scheduledTodoRows, error: sErr },
    { data: carryoverRows, error: cErr },
    dailyPayloads,
  ] = await Promise.all([
    client
      .from("events_payload")
      .select(EVENT_COLUMNS)
      .gte("start_at", startDate)
      .lte("start_at", endDate)
      .eq("is_dismissed", false)
      .order("start_at", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false }),
    client
      .from("tasks_payload")
      .select(SCHEDULED_TODO_COLUMNS)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at", { ascending: true }),
    // Carry-over, measured against the week rather than the day: scheduled
    // before it started and not yet DONE. Same NULL-status caveat as
    // getTodayContext — a plain .neq would drop NULL-status rows too.
    client
      .from("tasks_payload")
      .select(OPEN_TODO_COLUMNS)
      .eq("task_type", "task")
      .not("scheduled_at", "is", null)
      .lt("scheduled_at", startIso)
      .or("status.neq.DONE,status.is.null"),
    fetchDailies(startDate, endDate),
  ]);
  if (eErr) throw new Error(`events_payload: ${eErr.message}`);
  if (sErr) throw new Error(`scheduled todos: ${sErr.message}`);
  if (cErr) throw new Error(`carry-over todos: ${cErr.message}`);

  const events = (eventPayloads ?? []) as EventRow[];
  const scheduledTodos = (scheduledTodoRows ?? []) as ScheduledTodoRow[];
  const openTodoById = mergeOpenTodos((carryoverRows ?? []) as OpenTodoRow[]);
  const titleById = await resolveTitles([
    ...events.map((r) => r.item_id),
    ...scheduledTodos.map((r) => r.item_id),
    ...openTodoById.keys(),
  ]);

  const eventsByDate = groupByDate(events, (e) => e.start_at);
  const todosByDate = groupByDate(scheduledTodos, (t) =>
    t.scheduled_at === null ? null : localDateKey(t.scheduled_at),
  );
  // One daily per date is the id convention (`daily-<YYYY-MM-DD>`), so two
  // rows on one date should not happen; if they ever do, the first row wins
  // (fetchDailies orders by date only — same-date order is unspecified).
  const dailyByDate = new Map<string, DailiesPayloadRow>();
  for (const d of dailyPayloads)
    if (!dailyByDate.has(d.date)) dailyByDate.set(d.date, d);

  const days = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(startDate, offset);
    const daily = dailyByDate.get(date) ?? null;
    days.push({
      date,
      events: (eventsByDate.get(date) ?? [])
        .filter((e) => titleById.has(e.item_id))
        .map((e) => formatEvent(e, titleById)),
      scheduledTodos: (todosByDate.get(date) ?? [])
        .filter((t) => titleById.has(t.item_id))
        .map((t) => formatScheduledTodo(t, titleById)),
      // The whole daily text, like get_today_context's recentDailies: it is
      // the 夕刊 material the review is written from.
      daily: {
        exists: daily !== null,
        text: daily ? contentPlainText(daily.content_json) : null,
      },
    });
  }

  return {
    startDate,
    endDate,
    days,
    openTodos: [...openTodoById.values()]
      .filter((t) => titleById.has(t.item_id))
      .map((t) => formatOpenTodo(t, titleById, startIso)),
  };
}

/**
 * The focus half of write_briefing (#1097): upsert the date's section into
 * the reserved focus note — the place the morning paper actually reads the
 * focus from since #1048. Created on the first save, restored from the
 * trash on write (a focus written into a trashed note stays what the paper
 * reads, but the repair matches the web hook / the daily path below).
 */
async function writeFocusIntoNote(
  date: string,
  focus: string,
): Promise<{ id: string; created: boolean }> {
  const { client } = await getSupabase();
  const { data: existing, error: exErr } = await client
    .from("notes_payload")
    .select("item_id, content_json")
    .eq("item_id", FOCUS_NOTE_ID)
    .maybeSingle();
  if (exErr) throw new Error(`focus notes_payload read: ${exErr.message}`);

  if (existing) {
    const current = contentJsonToString(
      (existing as { content_json: unknown }).content_json,
    );
    const merged = mergeFocusSection(current, date, focus);
    // A byte-identical merge is a no-op: writing it would only move the
    // §10.2 LWW cursor (same skip as useFocusNote's).
    if (merged !== current) {
      await updatePayload(
        "notes_payload",
        FOCUS_NOTE_ID,
        "note",
        { content_json: JSON.parse(merged) },
        { is_deleted: false, deleted_at: null },
      );
    }
    return { id: FOCUS_NOTE_ID, created: false };
  }

  // First save creates the reserved note (§10.5 orphan recovery on the
  // payload INSERT) — same shape as create_note.
  const content = mergeFocusSection(null, date, focus);
  await insertItem({
    id: FOCUS_NOTE_ID,
    role: "note",
    title: FOCUS_NOTE_TITLE,
    payloadTable: "notes_payload",
    payload: {
      parent_item_id: null,
      note_type: "note",
      content_json: JSON.parse(content),
      sort_order: 0,
      is_pinned: false,
      is_edit_locked: false,
    },
  });
  return { id: FOCUS_NOTE_ID, created: true };
}

/** The comment half of write_briefing: upsert the 朝刊 section (#256). */
async function writeCommentIntoDaily(
  date: string,
  paragraphs: string[],
): Promise<{ id: string; created: boolean }> {
  const { client } = await getSupabase();
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
      paragraphs,
    );
    // The meta patch rides along with the §10.2 LWW bump: a soft-deleted
    // daily is restored, because a briefing written into a trashed
    // (invisible) daily would silently vanish.
    await updatePayload(
      "dailies_payload",
      row.item_id,
      "daily",
      { content_json: JSON.parse(next) },
      { is_deleted: false, deleted_at: null },
    );
    return { id: row.item_id, created: false };
  }

  // No daily yet — create the canonical `daily-<YYYY-MM-DD>` pair
  // (§10.5 orphan recovery on the payload INSERT).
  const id = `daily-${date}`;
  const content = upsertBriefingSection(null, paragraphs);
  await insertItem({
    id,
    role: "daily",
    // items_meta.title is NOT NULL; the date IS the daily's identity
    // (same rule as dailiesUnifiedMapper).
    title: date,
    payloadTable: "dailies_payload",
    payload: {
      date,
      content_json: JSON.parse(content),
      is_pinned: false,
      is_edit_locked: false,
    },
  });
  return { id, created: true };
}

export async function writeBriefing(args: {
  date?: string;
  focus: string;
  paragraphs?: string[];
}) {
  const date = assertDateKey(args.date ?? localToday());
  const focus = normalizeFocusText(args.focus);
  if (focus === null) {
    throw new Error("write_briefing: focus must be a non-empty string");
  }
  const paragraphs = (args.paragraphs ?? [])
    .map((p) => p.trim())
    .filter((p) => p !== "");

  // The focus goes to the reserved focus note (#1048 moved the read there);
  // the comment paragraphs stay in the daily's 朝刊 section. No paragraphs
  // means no daily write at all — a heading-only section is invisible to
  // extractBriefing, and creating a daily for it would be pure litter.
  const focusNote = await writeFocusIntoNote(date, focus);
  const daily =
    paragraphs.length > 0
      ? await writeCommentIntoDaily(date, paragraphs)
      : null;

  return { date, focus, focusNote, daily };
}
