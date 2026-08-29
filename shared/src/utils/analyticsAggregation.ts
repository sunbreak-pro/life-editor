import type { TimerSession } from "../types/timer";
import type { TodoNode } from "../types/todoTree";
import type { ScheduleItem } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
// The live tag data (DataService.listAllWikiTagsUnified / listAllTagAssignments)
// is the unified items_meta model — assignments hang off `itemId` with no
// entityType discriminator, so every aggregation here reads the unified shapes.
// The legacy `types/wikiTag` import is gone with aggregateTagByEntityType (#429).
import type {
  WikiTag as WikiTagUnified,
  WikiTagAssignment as WikiTagAssignmentUnified,
} from "../types/wikiTagUnified";
import type { WeekStartsOn } from "./scheduleGridLayout";
import {
  dateKeyOfInstant,
  formatDateKey as toDateStr,
  todayCalendarKey,
} from "./dateKey";

/*
 * "This week" has ONE meaning in Analytics: the CALENDAR week containing now
 * (`calendarWeekRange`). Every card under that label — work minutes, completed
 * todos, notes — reads the same window.
 *
 * It used to mean two things at once: the notes cards ran on a rolling 7-day
 * window (`createdWithinLastDays`) while the work / completed cards beside them
 * ran on the calendar week, so two differently-defined numbers sat under one
 * label. #670 C3 PR 3 only gave the two windows names; unifying them changes
 * displayed numbers, so it went to the decision queue and came back as
 * D-20260811-refactor-1 = A (calendar week), implemented here (#780).
 *
 * The first day of the week is the app-wide `WEEK_STARTS_ON` (Sunday, #1102),
 * NOT a hardcoded Monday — the same day the calendar grids key on.
 *
 * #780 unified the numbers only. The graphics next to them stayed on other
 * windows: the mobile week bars drew a rolling 7 days and the Work tab's weekly
 * buckets started on a hardcoded Monday, so the same card could show a number
 * and a chart covering different days. #860 (D-20260813-briefing-1 = A) moved
 * both onto `startOfCalendarWeek`. `aggregateByDay` still exists and still
 * means "the last N days" — WorkTimeChart's 14-day view wants exactly that.
 */

/**
 * Items created inside the inclusive local-key range `startKey`…`endKey`.
 * Comparison is on LOCAL calendar keys (#420): the stored `createdAt` is a UTC
 * instant, so slicing its ISO string would read the UTC day and drop anything
 * written before 09:00 JST on the boundary day.
 */
export function createdWithinRange<T extends { createdAt: string }>(
  items: readonly T[],
  startKey: string,
  endKey: string,
): T[] {
  return items.filter((item) => {
    const key = dateKeyOfInstant(item.createdAt);
    return key !== null && key >= startKey && key <= endKey;
  });
}

/**
 * Local midnight on the first day of the calendar week containing `d`.
 *
 * The ONE piece of step-back math in this file — `calendarWeekRange`, the
 * mobile week bars and the Work tab's weekly buckets all start here, so they
 * cannot drift apart. It replaced a private Monday-hardcoded `startOfWeek()`
 * that only the weekly buckets used, which is exactly how the Work tab ended
 * up ignoring the day every other week window reads (#860).
 *
 * `weekStartsOn` is required for the same reason it is on `calendarWeekRange`:
 * a default would silently pick a week for a caller that forgot to pass one.
 */
function startOfCalendarWeek(d: Date, weekStartsOn: WeekStartsOn): Date {
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() - weekStartsOn + 7) % 7));
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * The CALENDAR week containing `now`, as inclusive local date keys.
 *
 * `weekStartsOn` is required on purpose: a default here would silently pick a
 * week for callers that forgot to pass `WEEK_STARTS_ON` (Sunday, #1102), and
 * the Monday case is what pins the math. The step-back math is `startOfWeekKey`'s
 * (`utils/scheduleGridLayout.ts`), so an Analytics week and a calendar grid
 * week always begin on the same day.
 *
 * The boundary is the wall calendar midnight — Analytics deliberately ignores
 * the day-start-hour pref that Daily / routine sync roll over on (#356), and
 * so must the window its buckets are compared against.
 */
export function calendarWeekRange(
  now: Date,
  weekStartsOn: WeekStartsOn,
): {
  startKey: string;
  endKey: string;
} {
  const start = startOfCalendarWeek(now, weekStartsOn);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { startKey: toDateStr(start), endKey: toDateStr(end) };
}

export interface DayBucket {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  sessionCount: number;
}

export interface TodoBucket {
  todoId: string;
  todoName: string;
  totalMinutes: number;
  sessionCount: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0=Mon, 6=Sun
  hour: number; // 0-23
  totalMinutes: number;
}

export interface PomodoroRateBucket {
  date: string;
  actual: number;
  target: number;
  rate: number; // 0-100
}

export interface WorkBreakBucket {
  date: string;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
}

export interface TimelineBlock {
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  sessionType: string;
  todoId: string | null;
}

export interface CompletionTrendBucket {
  date: string;
  completedCount: number;
}

export interface StagnationBucket {
  label: string;
  count: number;
  color: string;
}

/**
 * One slice of the tag work-time ring. A discriminated union so a "tag" slice
 * is statically guaranteed to carry a name — the two synthetic buckets ("other"
 * = tags past the top-N cap, folded together; "untagged" = work on a todo with
 * no tag, or with no todo at all) carry none, because the host supplies their
 * labels: the shared tree holds no strings.
 */
export type TagWorkTimeBucket =
  | {
      kind: "tag";
      tagId: string;
      tagName: string;
      /** Tag colour as authored in Materials; null when the tag has none. */
      tagColor: string | null;
      totalMinutes: number;
    }
  | {
      kind: "other" | "untagged";
      tagId: null;
      tagName: null;
      tagColor: null;
      totalMinutes: number;
    };

export interface WorkStreak {
  currentStreak: number;
  longestStreak: number;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function getWorkSessions(sessions: TimerSession[]): TimerSession[] {
  return sessions.filter(
    (s) => s.sessionType === "WORK" && s.duration != null && s.duration > 0,
  );
}

export function aggregateByDay(
  sessions: TimerSession[],
  days: number,
): DayBucket[] {
  const work = getWorkSessions(sessions);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, DayBucket>();

  // Pre-fill all dates so there are no gaps
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, totalMinutes: 0, sessionCount: 0 });
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const key = toDateStr(started);
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalMinutes += (s.duration ?? 0) / 60;
      bucket.sessionCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Work minutes per day across the CALENDAR week containing `now` — the window
 * `calendarWeekRange` defines, so a "this week" total and the bars drawn beside
 * it always cover the same days (#860 / D-20260813-briefing-1 = A).
 *
 * Always 7 buckets in calendar order, starting on `WEEK_STARTS_ON`. The
 * mobile card used to draw `aggregateByDay(sessions, 7)` — a rolling 7 days
 * ending today — so mid-week its bars and the number above them ran on two
 * different windows. The accepted cost of the switch: mid-week the days that
 * have not happened yet come back as zeros, i.e. empty bars.
 */
export function aggregateCalendarWeekByDay(
  sessions: TimerSession[],
  now: Date,
  weekStartsOn: WeekStartsOn,
): DayBucket[] {
  const work = getWorkSessions(sessions);
  const start = startOfCalendarWeek(now, weekStartsOn);

  const map = new Map<string, DayBucket>();

  // Pre-fill the whole week so the future days render as empty bars rather
  // than shortening the row.
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, totalMinutes: 0, sessionCount: 0 });
  }

  for (const s of work) {
    const key = toDateStr(new Date(s.startedAt));
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalMinutes += (s.duration ?? 0) / 60;
      bucket.sessionCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Work minutes per calendar week, most recent `weeks` windows.
 *
 * `weekStartsOn` is required (#860): the buckets used to start on a hardcoded
 * Monday of their own, so the Work tab sliced the same sessions along a
 * different boundary than every "this week" number in the app.
 */
export function aggregateByWeek(
  sessions: TimerSession[],
  weeks: number,
  weekStartsOn: WeekStartsOn,
): DayBucket[] {
  const work = getWorkSessions(sessions);
  const now = new Date();
  const currentWeekStart = startOfCalendarWeek(now, weekStartsOn);

  const map = new Map<string, DayBucket>();

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - i * 7);
    const key = toDateStr(d);
    map.set(key, { date: key, totalMinutes: 0, sessionCount: 0 });
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const weekStart = startOfCalendarWeek(started, weekStartsOn);
    const key = toDateStr(weekStart);
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalMinutes += (s.duration ?? 0) / 60;
      bucket.sessionCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateByMonth(
  sessions: TimerSession[],
  months: number,
): DayBucket[] {
  const work = getWorkSessions(sessions);
  const now = new Date();

  const map = new Map<string, DayBucket>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toDateStr(startOfMonth(d));
    map.set(key, { date: key, totalMinutes: 0, sessionCount: 0 });
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const key = toDateStr(startOfMonth(started));
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalMinutes += (s.duration ?? 0) / 60;
      bucket.sessionCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateByTodo(
  sessions: TimerSession[],
  todoNameMap: Map<string, string>,
): TodoBucket[] {
  const work = getWorkSessions(sessions);
  const map = new Map<string, TodoBucket>();

  for (const s of work) {
    const tid = s.todoId ?? "__none__";
    let bucket = map.get(tid);
    if (!bucket) {
      bucket = {
        todoId: tid,
        todoName:
          todoNameMap.get(tid) ?? (tid === "__none__" ? "No Todo" : tid),
        totalMinutes: 0,
        sessionCount: 0,
      };
      map.set(tid, bucket);
    }
    bucket.totalMinutes += (s.duration ?? 0) / 60;
    bucket.sessionCount += 1;
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 10);
}

export function computeSummary(sessions: TimerSession[]) {
  const work = getWorkSessions(sessions);
  const totalMinutes = work.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0);
  const totalSessions = work.length;

  const uniqueDays = new Set(work.map((s) => toDateStr(new Date(s.startedAt))))
    .size;
  const avgMinutesPerDay = uniqueDays > 0 ? totalMinutes / uniqueDays : 0;

  return { totalMinutes, totalSessions, avgMinutesPerDay };
}

// --- New aggregation functions ---

/** Heatmap: aggregate work time by hour-of-day × day-of-week */
export function aggregateByHourAndDay(sessions: TimerSession[]): HeatmapCell[] {
  const work = getWorkSessions(sessions);
  // 7 days × 24 hours grid, dayOfWeek: 0=Mon..6=Sun
  const grid = new Map<string, HeatmapCell>();
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.set(`${d}-${h}`, { dayOfWeek: d, hour: h, totalMinutes: 0 });
    }
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const jsDay = started.getDay(); // 0=Sun
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
    const hour = started.getHours();
    const cell = grid.get(`${dayOfWeek}-${hour}`);
    if (cell) {
      cell.totalMinutes += (s.duration ?? 0) / 60;
    }
  }

  return Array.from(grid.values());
}

/** Pomodoro completion rate: actual vs target sessions per day */
export function aggregatePomodoroRate(
  sessions: TimerSession[],
  targetPerDay: number,
  days: number,
): PomodoroRateBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, PomodoroRateBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, actual: 0, target: targetPerDay, rate: 0 });
  }

  // Count completed WORK sessions per day
  for (const s of sessions) {
    if (s.sessionType !== "WORK" || !s.completed) continue;
    const key = toDateStr(new Date(s.startedAt));
    const bucket = map.get(key);
    if (bucket) {
      bucket.actual += 1;
    }
  }

  for (const bucket of map.values()) {
    bucket.rate =
      bucket.target > 0
        ? Math.min(100, Math.round((bucket.actual / bucket.target) * 100))
        : 0;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Work/Break balance per day */
export function aggregateWorkBreakBalance(
  sessions: TimerSession[],
  days: number,
): WorkBreakBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, WorkBreakBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, {
      date: key,
      workMinutes: 0,
      breakMinutes: 0,
      longBreakMinutes: 0,
    });
  }

  for (const s of sessions) {
    if (s.duration == null || s.duration <= 0) continue;
    const key = toDateStr(new Date(s.startedAt));
    const bucket = map.get(key);
    if (!bucket) continue;
    const mins = s.duration / 60;
    if (s.sessionType === "WORK") bucket.workMinutes += mins;
    else if (s.sessionType === "BREAK") bucket.breakMinutes += mins;
    else if (s.sessionType === "LONG_BREAK") bucket.longBreakMinutes += mins;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Daily timeline: session blocks for a specific date */
export function aggregateDailyTimeline(
  sessions: TimerSession[],
  date: string,
): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];

  for (const s of sessions) {
    if (s.duration == null || s.duration <= 0) continue;
    const started = new Date(s.startedAt);
    if (toDateStr(started) !== date) continue;
    blocks.push({
      startHour: started.getHours(),
      startMinute: started.getMinutes(),
      durationMinutes: s.duration / 60,
      sessionType: s.sessionType,
      todoId: s.todoId,
    });
  }

  return blocks.sort(
    (a, b) =>
      a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
  );
}

/** Todo completion trend: completed todos per day */
export function aggregateTodoCompletionTrend(
  nodes: TodoNode[],
  days: number,
): CompletionTrendBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, CompletionTrendBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, completedCount: 0 });
  }

  for (const n of nodes) {
    if (n.type !== "task" || !n.completedAt) continue;
    // `completedAt` is a UTC ISO string; the buckets above are LOCAL calendar
    // keys (#356). Slicing it would read the UTC day, so in JST anything
    // finished before 09:00 fell into the previous bucket (#420).
    const key = dateKeyOfInstant(n.completedAt);
    if (key === null) continue;
    const bucket = map.get(key);
    if (bucket) {
      bucket.completedCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Todo stagnation: distribution of incomplete todo ages */
export function aggregateTodoStagnation(nodes: TodoNode[]): StagnationBucket[] {
  const now = new Date();
  const buckets: StagnationBucket[] = [
    {
      label: "< 1 week",
      count: 0,
      color: "var(--color-chart-stagnation-1, #22c55e)",
    },
    {
      label: "1-2 weeks",
      count: 0,
      color: "var(--color-chart-stagnation-2, #84cc16)",
    },
    {
      label: "2-4 weeks",
      count: 0,
      color: "var(--color-chart-stagnation-3, #eab308)",
    },
    {
      label: "1-3 months",
      count: 0,
      color: "var(--color-chart-stagnation-4, #f97316)",
    },
    {
      label: "3+ months",
      count: 0,
      color: "var(--color-chart-stagnation-5, #ef4444)",
    },
  ];

  const DAY = 24 * 60 * 60 * 1000;

  for (const n of nodes) {
    if (n.type !== "task" || n.status === "DONE" || n.isDeleted) continue;
    const created = new Date(n.createdAt);
    const ageDays = Math.floor((now.getTime() - created.getTime()) / DAY);

    if (ageDays < 7) buckets[0].count += 1;
    else if (ageDays < 14) buckets[1].count += 1;
    else if (ageDays < 28) buckets[2].count += 1;
    else if (ageDays < 90) buckets[3].count += 1;
    else buckets[4].count += 1;
  }

  return buckets;
}

/**
 * Work time by life-tag — the successor of the retired folder aggregation
 * (#334 / life-tags §Step 4: the Todos domain has no folder nodes since #225,
 * so `aggregateByFolder` always returned [] while its unguarded parent climb
 * could still hang on a cyclic `parentId`). Attribution runs off
 * `wiki_tag_assignments` instead of the todo tree, so no ancestor walk exists
 * here at all.
 *
 * Rules:
 * - Only WORK sessions count (same filter as every other work-time chart).
 * - A session's minutes are split evenly across its todo's tags.
 * - Work on an untagged todo — or with no todo at all — lands in the trailing
 *   "untagged" bucket, and tags past `limit` are folded into an "other" bucket
 *   rather than dropped, so no tag's share is overstated.
 * - Work on a todo that is NOT in `liveTodos` is dropped entirely — see the
 *   trash rule below. The condition is literally "absent from the live tree",
 *   which is wider than "trashed": `fetchTodoTree` also drops purged rows, R2
 *   orphans (meta with no payload) and legacy folder rows
 *   (`SupabaseDataService.fetchTodoTree`). Sessions attached to any of those
 *   disappear from this ring rather than reading as untagged.
 * - Assignments pointing at a tag that is not in `tags` (deleted / filtered)
 *   are ignored rather than surfaced as a raw id; that work reads as untagged.
 *
 * Trash rule (#428, finishing what #365 started): a trashed todo's assignments
 * stop being returned by `listAllTagAssignments`, so before this its minutes did
 * not vanish — they silently piled into "untagged", which reads as "work on a
 * todo I never tagged". Analytics excludes trashed items everywhere else
 * (`fetchTodoTree` is live-only, so the completion trend and stagnation charts
 * never saw them), and Connect already drops any edge whose endpoint is not a
 * live node; this aligns the ring with both. Restoring an item brings its work
 * back for free — nothing is mutated.
 *
 * Consequence: the buckets sum to the work logged on LIVE items, not to the
 * grand total the Work tab reports (which still counts every session). The two
 * differ by exactly the time spent on trashed todos — the same kind of gap as
 * the Todos tab not listing trashed todos.
 *
 * Assignments are matched by `itemId` — item ids are unique across roles, so
 * a note/daily/event assignment simply never matches a session's `todoId`.
 */
export function aggregateWorkTimeByTag(
  sessions: TimerSession[],
  assignments: WikiTagAssignmentUnified[],
  tags: WikiTagUnified[],
  liveTodos: TodoNode[],
  limit: number = 10,
): TagWorkTimeBucket[] {
  const work = getWorkSessions(sessions);
  const tagMap = new Map(
    tags.filter((t) => !t.isDeleted).map((t) => [t.id, t] as const),
  );
  // `fetchTodoTree` is already live-only; the isDeleted guard keeps callers
  // that hand over a wider list (or a stale cache) from reviving trashed work.
  const liveTodoIds = new Set(
    liveTodos.filter((n) => !n.isDeleted).map((n) => n.id),
  );

  // itemId -> its tag ids (Set: the same tag can be assigned twice — e.g.
  // inline text plus a manual chip — and double counting would skew the split).
  const todoTags = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (a.isDeleted || !tagMap.has(a.tagId)) continue;
    const set = todoTags.get(a.itemId);
    if (set) set.add(a.tagId);
    else todoTags.set(a.itemId, new Set([a.tagId]));
  }

  const minutesByTag = new Map<string, number>();
  let untaggedMinutes = 0;

  for (const s of work) {
    const minutes = (s.duration ?? 0) / 60;
    // A session that names a todo no longer in the live tree is work on a
    // trashed (or purged) todo — dropped, NOT folded into untagged (#428).
    // A missing todo id is different: that is genuine todo-less work. Tested
    // for truthiness, matching the tag lookup on the next line — an empty
    // `todoId` would otherwise count as "trashed" here and as "no todo" there.
    if (s.todoId && !liveTodoIds.has(s.todoId)) continue;
    const tagIds = s.todoId ? todoTags.get(s.todoId) : undefined;
    if (!tagIds || tagIds.size === 0) {
      untaggedMinutes += minutes;
      continue;
    }
    const share = minutes / tagIds.size;
    for (const tagId of tagIds) {
      minutesByTag.set(tagId, (minutesByTag.get(tagId) ?? 0) + share);
    }
  }

  const ranked: TagWorkTimeBucket[] = Array.from(minutesByTag.entries())
    .map(([tagId, totalMinutes]) => {
      // Non-null by construction — only ids that passed the tagMap.has()
      // filter above reach minutesByTag. The fallback is belt-and-braces.
      const tag = tagMap.get(tagId);
      return {
        kind: "tag" as const,
        tagId,
        tagName: tag?.name ?? tagId,
        tagColor: tag?.color ?? null,
        totalMinutes,
      };
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const buckets = ranked.slice(0, limit);

  // The tail is folded, never dropped: a discarded slice would silently
  // inflate every remaining tag's percentage.
  const otherMinutes = ranked
    .slice(limit)
    .reduce((sum, b) => sum + b.totalMinutes, 0);
  if (otherMinutes > 0) {
    buckets.push({
      kind: "other",
      tagId: null,
      tagName: null,
      tagColor: null,
      totalMinutes: otherMinutes,
    });
  }

  // Always last so it never crowds a real tag out of the top-N.
  if (untaggedMinutes > 0) {
    buckets.push({
      kind: "untagged",
      tagId: null,
      tagName: null,
      tagColor: null,
      totalMinutes: untaggedMinutes,
    });
  }

  return buckets;
}

/** Work streak: consecutive days with at least one work session */
export function computeWorkStreak(sessions: TimerSession[]): WorkStreak {
  const work = getWorkSessions(sessions);
  const days = new Set(work.map((s) => toDateStr(new Date(s.startedAt))));

  if (days.size === 0) return { currentStreak: 0, longestStreak: 0 };

  const sorted = Array.from(days).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  // Check if today or yesterday is in the set to start current streak.
  // Calendar days (#356) — `days` above is keyed the same way. One clock read
  // for both, so a midnight tick between them can't make them the same date.
  const now = new Date();
  const today = todayCalendarKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = todayCalendarKey(yesterday);

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
    longestStreak = Math.max(longestStreak, streak);
  }
  longestStreak = Math.max(longestStreak, streak);

  // Current streak: walk backwards from today/yesterday
  const startDay = days.has(today)
    ? today
    : days.has(yesterdayStr)
      ? yesterdayStr
      : null;
  if (startDay) {
    currentStreak = 1;
    const d = new Date(startDay);
    while (true) {
      d.setDate(d.getDate() - 1);
      if (days.has(toDateStr(d))) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}

// ============================================================
// Schedule aggregation
// ============================================================

export interface EventCompletionBucket {
  date: string;
  completedCount: number;
  totalCount: number;
}

export interface HourBucket {
  hour: number;
  count: number;
}

export interface RoutineCompletionBucket {
  routineId: string;
  routineTitle: string;
  completedCount: number;
  totalCount: number;
  rate: number;
}

/** Event completion count per day */
export function aggregateEventCompletionByDay(
  items: ScheduleItem[],
  days: number,
): EventCompletionBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, EventCompletionBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, completedCount: 0, totalCount: 0 });
  }

  for (const item of items) {
    const key = item.date;
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalCount += 1;
      if (item.completed) bucket.completedCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Events distribution by hour of day */
export function aggregateEventsByHour(items: ScheduleItem[]): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));

  for (const item of items) {
    if (!item.startTime) continue;
    const hour = parseInt(item.startTime.split(":")[0], 10);
    if (hour >= 0 && hour < 24) {
      buckets[hour].count += 1;
    }
  }

  return buckets;
}

/** Per-routine completion rate */
export function aggregateRoutineCompletion(
  items: ScheduleItem[],
  routines: RoutineNode[],
): RoutineCompletionBucket[] {
  const routineMap = new Map(routines.map((r) => [r.id, r]));
  const map = new Map<
    string,
    { completed: number; total: number; title: string }
  >();

  for (const item of items) {
    if (!item.routineId) continue;
    let entry = map.get(item.routineId);
    if (!entry) {
      const routine = routineMap.get(item.routineId);
      entry = { completed: 0, total: 0, title: routine?.title ?? item.title };
      map.set(item.routineId, entry);
    }
    entry.total += 1;
    if (item.completed) entry.completed += 1;
  }

  return Array.from(map.entries())
    .map(([routineId, data]) => ({
      routineId,
      routineTitle: data.title,
      completedCount: data.completed,
      totalCount: data.total,
      rate:
        data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

/*
 * The "Connect aggregation" section that lived here — `aggregateTagByEntityType`
 * + `TagEntityTypeBucket` — was retired in #429. It had no production caller
 * (never exported from `shared/src/index.ts`; only its own tests kept it alive)
 * and it branched on `assignment.entityType`, a field the unified
 * `WikiTagAssignment` does not have. Wiring it to live data would therefore have
 * returned all-zero counts without a type error or an exception — a silent wrong
 * number, not a crash. Anything new here should start from the unified shapes
 * (`WikiTag` / `WikiTagAssignment`), which is what every live consumer reads.
 */
