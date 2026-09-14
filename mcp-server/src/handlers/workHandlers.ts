import { getSupabase } from "../supabase.js";
import {
  assertDateKey,
  localDayUtcRange,
  localToday,
} from "../utils/localDate.js";
import { fetchAllPages, fetchByIdChunks } from "../utils/pagination.js";

/*
 * Work sessions — what the Work timer recorded.
 *
 * `timer_sessions` has been written since #714 and read by nothing in this
 * package: an assistant could see every todo and every event on a day and
 * still not know which of them the user actually spent the afternoon on.
 * That is the one fact the app has and the conversation did not.
 *
 * READ ONLY, deliberately. Starting and stopping a timer is a gesture about
 * the present moment ("I am working on this now"), and a tool that could
 * close a session would let an assistant invent time that was never spent.
 * The rows this returns are evidence; nothing here creates any.
 *
 * The totals cover the WHOLE range, not the page. `limit` trims how many
 * sessions come back as rows — a busy week is a hundred of them and the
 * caller rarely wants each one — but a total that silently described only the
 * first fifty would be worse than no total at all.
 */

/** Seconds, as `timer_sessions.duration` stores them (0018). */
type SessionType = "WORK" | "BREAK" | "LONG_BREAK" | "FREE";

interface TimerSessionRow {
  id: number;
  task_id: string | null;
  event_id: string | null;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  completed: boolean;
  label: string | null;
}

const SESSION_COLUMNS =
  "id, task_id, event_id, session_type, started_at, ended_at, duration, completed, label";

const DEFAULT_SESSION_LIMIT = 50;
const MAX_SESSION_LIMIT = 200;

interface WorkItem {
  id: string;
  role: string;
  title: string;
}

/**
 * The item a session was attributed to. At most one of `task_id` / `event_id`
 * is set — 0029 put a CHECK on the table for it — so this is one id, not two.
 */
function attributedId(row: TimerSessionRow): string | null {
  return row.task_id ?? row.event_id ?? null;
}

/** Seconds → whole minutes. A session still running has no answer yet. */
function toMinutes(seconds: number | null): number | null {
  return seconds === null ? null : Math.round(seconds / 60);
}

async function resolveItems(ids: string[]): Promise<Map<string, WorkItem>> {
  const byId = new Map<string, WorkItem>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return byId;

  const { client } = await getSupabase();
  const rows = await fetchByIdChunks<WorkItem>(unique, async (chunk) => {
    const { data, error } = await client
      .from("items_meta")
      .select("id, role, title")
      .in("id", chunk);
    if (error) throw new Error(`work items_meta: ${error.message}`);
    return (data ?? []) as WorkItem[];
  });
  for (const row of rows) byId.set(row.id, row);
  return byId;
}

export async function listWorkSessions(args: {
  date?: string;
  start_date?: string;
  end_date?: string;
  session_type?: SessionType;
  limit?: number;
}) {
  /*
   * Three ways to say the same thing, resolved to one [start, end] pair of
   * local day keys. `date` is the shorthand for a single day; an open-ended
   * start_date/end_date fills the missing side with the other one rather than
   * running to the beginning of time, which is the answer a caller who gave
   * only one date almost never means.
   */
  const start = assertDateKey(
    args.date ?? args.start_date ?? args.end_date ?? localToday(),
  );
  const end = assertDateKey(
    args.date ?? args.end_date ?? args.start_date ?? localToday(),
  );
  if (end < start) {
    throw new Error(`list_work_sessions: end_date ${end} is before ${start}`);
  }

  // Local days → UTC instants, because started_at is a timestamptz and
  // "2026-09-14" means the user's day, not UTC's (worker.ts refuses to boot
  // without LIFE_EDITOR_TZ for this reason).
  const { startIso } = localDayUtcRange(start);
  const { endIso } = localDayUtcRange(end);

  const { client } = await getSupabase();
  const rows = await fetchAllPages<TimerSessionRow>((from, to) => {
    let query = client
      .from("timer_sessions")
      .select(SESSION_COLUMNS)
      .gte("started_at", startIso)
      .lt("started_at", endIso);
    if (args.session_type) {
      query = query.eq("session_type", args.session_type);
    }
    return query.order("started_at", { ascending: false }).range(from, to);
  }, "timer_sessions");

  const itemById = await resolveItems(
    rows.map(attributedId).filter((id): id is string => id !== null),
  );

  const minutesByType: Record<string, number> = {};
  const minutesByItem = new Map<string, number>();
  let totalMinutes = 0;
  let openSessions = 0;
  for (const row of rows) {
    const minutes = toMinutes(row.duration);
    if (minutes === null) {
      // Still running, or closed without a duration. Counted separately
      // rather than as zero: "three sessions, 0 minutes" reads as a quiet day
      // when it may be a timer that is running right now.
      openSessions += 1;
      continue;
    }
    minutesByType[row.session_type] =
      (minutesByType[row.session_type] ?? 0) + minutes;
    totalMinutes += minutes;
    const itemId = attributedId(row);
    if (itemId) {
      minutesByItem.set(itemId, (minutesByItem.get(itemId) ?? 0) + minutes);
    }
  }

  const limit = Math.min(
    Math.max(Math.trunc(args.limit ?? DEFAULT_SESSION_LIMIT), 1),
    MAX_SESSION_LIMIT,
  );

  return {
    range: { start, end },
    sessions: rows.slice(0, limit).map((row) => {
      const itemId = attributedId(row);
      return {
        id: row.id,
        sessionType: row.session_type,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        durationMinutes: toMinutes(row.duration),
        completed: row.completed,
        label: row.label,
        // Null when the timer ran without a subject, or when the item it was
        // attributed to has since been hard-deleted (no FK — a session
        // outlives its item by design, 0018).
        item: itemId ? (itemById.get(itemId) ?? null) : null,
      };
    }),
    totals: {
      sessionCount: rows.length,
      openSessions,
      totalMinutes,
      minutesByType,
      // Descending, because "what did I spend the week on" is the question
      // this list answers and the answer is the first line of it.
      byItem: [...minutesByItem.entries()]
        .map(([id, minutes]) => ({
          id,
          role: itemById.get(id)?.role ?? null,
          title: itemById.get(id)?.title ?? null,
          minutes,
        }))
        .sort((a, b) => b.minutes - a.minutes),
    },
    hasMore: rows.length > limit,
  };
}
