import type { TimerSession } from "../types/timer";
import { sessionTargetId } from "./timerSessions";
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

/*
 * Age brackets for the stagnation chart, as ids rather than text (#1478).
 *
 * The aggregation used to hand back the axis text itself ("< 1 week"), which
 * put five English strings below the i18n layer where no catalog could reach
 * them — the ja UI showed them untranslated. The chart resolves the id through
 * its injected labels now, the same way every other Analytics string arrives.
 */
export type StagnationBucketId =
  | "under1Week"
  | "1to2Weeks"
  | "2to4Weeks"
  | "1to3Months"
  | "over3Months";

export interface StagnationBucket {
  bucket: StagnationBucketId;
  count: number;
  color: string;
}

/**
 * The minimum an item must expose to be a work-time target (#1375).
 *
 * Structural for the same reason `TagUsageItem` is: a session names an id and
 * nothing else, item ids are unique across roles (CLAUDE.md §4), and the tag
 * layer carries no role discriminator — so the ring needs an id to match on
 * and the soft-delete flag, and genuinely nothing more. TodoNode and
 * ScheduleItem both satisfy it, so a host concatenates whichever roles it can
 * see the LIVE universe of.
 */
export interface WorkTimeItem {
  id: string;
  isDeleted?: boolean;
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
      bucket: "under1Week",
      count: 0,
      color: "var(--color-chart-stagnation-1, #22c55e)",
    },
    {
      bucket: "1to2Weeks",
      count: 0,
      color: "var(--color-chart-stagnation-2, #84cc16)",
    },
    {
      bucket: "2to4Weeks",
      count: 0,
      color: "var(--color-chart-stagnation-3, #eab308)",
    },
    {
      bucket: "1to3Months",
      count: 0,
      color: "var(--color-chart-stagnation-4, #f97316)",
    },
    {
      bucket: "over3Months",
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
 * - A session's minutes are split evenly across its item's tags.
 * - Work on an untagged item — or with no item at all — lands in the trailing
 *   "untagged" bucket, and tags past `limit` are folded into an "other" bucket
 *   rather than dropped, so no tag's share is overstated.
 * - Work on an item that is NOT in `liveItems` is dropped entirely — see the
 *   trash rule below. The condition is literally "absent from the live set",
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
 * Assignments are matched by `itemId` — item ids are unique across roles, so a
 * note/daily assignment simply never matches a session's target id.
 *
 * Todo AND Event (#1375). A session names at most one of the two (0029 CHECK),
 * `sessionTargetId` unfolds the pair, and `liveItems` is whatever LIVE roles
 * the caller can see — the same structural-list idiom `aggregateTagUsage` uses,
 * and for the same reason: the tag layer has no role discriminator, so the
 * aggregation does not need one either. A host that passes only todos gets
 * exactly the ring it got before this change; one that also passes events sees
 * event work appear. The order matters in one direction only — an event left
 * OUT of `liveItems` reads as work on a trashed item and is DROPPED, not
 * counted as untagged, so a host that starts writing `event_id` has to start
 * passing its events in the same change.
 */
export function aggregateWorkTimeByTag(
  sessions: TimerSession[],
  assignments: WikiTagAssignmentUnified[],
  tags: WikiTagUnified[],
  liveItems: readonly WorkTimeItem[],
  limit: number = 10,
): TagWorkTimeBucket[] {
  const work = getWorkSessions(sessions);
  const tagMap = new Map(
    tags.filter((t) => !t.isDeleted).map((t) => [t.id, t] as const),
  );
  // `fetchTodoTree` is already live-only; the isDeleted guard keeps callers
  // that hand over a wider list (or a stale cache) from reviving trashed work.
  const liveItemIds = new Set(
    liveItems.filter((n) => !n.isDeleted).map((n) => n.id),
  );

  // itemId -> its tag ids (Set: the same tag can be assigned twice — e.g.
  // inline text plus a manual chip — and double counting would skew the split).
  const itemTags = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (a.isDeleted || !tagMap.has(a.tagId)) continue;
    const set = itemTags.get(a.itemId);
    if (set) set.add(a.tagId);
    else itemTags.set(a.itemId, new Set([a.tagId]));
  }

  const minutesByTag = new Map<string, number>();
  let untaggedMinutes = 0;

  for (const s of work) {
    const minutes = (s.duration ?? 0) / 60;
    const targetId = sessionTargetId(s);
    // A session naming an item that is not in the live set is work on a
    // trashed (or purged) todo/event — dropped, NOT folded into untagged
    // (#428). A missing target id is different: that is genuine free work.
    // `sessionTargetId` already collapses an empty-string id to null, so the
    // two cases cannot be confused with each other.
    if (targetId && !liveItemIds.has(targetId)) continue;
    const tagIds = targetId ? itemTags.get(targetId) : undefined;
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

/**
 * One row of the tag usage card (#1379).
 *
 * TWO WINDOWS in one row, which is exactly the shape #780 / #860 warn about —
 * so they are named apart at the type level rather than left to the caller's
 * memory. `rangeCount` is scoped to the selected date range; `totalCount` is
 * "carrying this tag right now", with no date filter at all. The card is
 * required to label which is which (Issue #1379 DoD); a single `count` field
 * would have made that impossible to get right by construction.
 */
export interface TagUsageBucket {
  tagId: string;
  tagName: string;
  tagColor: string | null;
  /** Live items CREATED inside the requested key range that carry this tag. */
  rangeCount: number;
  /** Live items carrying this tag, whenever they were created. */
  totalCount: number;
}

/**
 * The minimum an item must expose to be counted here.
 *
 * Structural on purpose: `wiki_tag_assignments` has no `entityType`
 * discriminator (types/wikiTagUnified.ts) and item ids are unique across roles
 * (CLAUDE.md §4), so a tag count does not care WHICH role a row is — it needs
 * an id to match assignments on, a creation instant to slice the range on, and
 * the soft-delete flag. TodoNode / ScheduleItem / NoteNode all satisfy it, so
 * the caller concatenates whatever roles it can see the LIVE universe of.
 */
export interface TagUsageItem {
  id: string;
  createdAt: string;
  isDeleted?: boolean;
}

/**
 * Tag usage: how many items were tagged in the selected range, and how many
 * carry each tag right now (#1379).
 *
 * Deliberately NOT "how many times a tag was applied in the range".
 * `wiki_tag_assignments` carries only `updated_at` — no `created_at`
 * (0008_data_unification_schema.sql:850) — so the moment a tag was attached is
 * not recorded, and re-attaching overwrites it. The range is therefore sliced
 * on the ITEM's `createdAt`, which is why `rangeCount` reads "items created in
 * this range that carry the tag" and nothing stronger. The strict version needs
 * DDL and stays on #1375.
 *
 * `items` is the LIVE universe the caller can see, and the totals mean exactly
 * that much: a role the host does not fetch in full simply contributes nothing,
 * which is a visible undercount rather than a number that drifts when the range
 * moves. Feeding a range-windowed list in here would make `totalCount` move
 * with the date preset — the one thing it must not do.
 *
 * Exclusions follow `aggregateWorkTimeByTag` so the two tag cards can never
 * disagree about what counts: trashed items, deleted tags and deleted
 * assignments are all dropped (#428), and a tag assigned twice to the same item
 * counts once (the same Set-dedupe, for the same reason — a manual chip plus an
 * inline "[[ ]]" link is a routine way to end up with two rows).
 *
 * Rows are the tags with a non-zero `rangeCount`: the card ranks "what did I
 * work on this month", and a tag with nothing in the window has no bar to draw.
 * The tail past `limit` is dropped rather than folded into an "other" row —
 * unlike the work-time ring there is no whole for the parts to add up to, so a
 * cut tail distorts nothing.
 */
export function aggregateTagUsage(
  items: readonly TagUsageItem[],
  assignments: readonly WikiTagAssignmentUnified[],
  tags: readonly WikiTagUnified[],
  startKey: string,
  endKey: string,
  limit: number = 10,
): TagUsageBucket[] {
  const tagMap = new Map(
    tags.filter((t) => !t.isDeleted).map((t) => [t.id, t] as const),
  );
  const liveItems = items.filter((i) => !i.isDeleted);
  const liveItemIds = new Set(liveItems.map((i) => i.id));

  // itemId -> its tag ids (Set: the same tag can be assigned twice — counting
  // both would report more tagged items than exist).
  const itemTags = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (a.isDeleted || !tagMap.has(a.tagId) || !liveItemIds.has(a.itemId)) {
      continue;
    }
    const set = itemTags.get(a.itemId);
    if (set) set.add(a.tagId);
    else itemTags.set(a.itemId, new Set([a.tagId]));
  }

  const totalByTag = new Map<string, number>();
  for (const tagIds of itemTags.values()) {
    for (const tagId of tagIds) {
      totalByTag.set(tagId, (totalByTag.get(tagId) ?? 0) + 1);
    }
  }

  const rangeByTag = new Map<string, number>();
  for (const item of createdWithinRange(liveItems, startKey, endKey)) {
    const tagIds = itemTags.get(item.id);
    if (!tagIds) continue;
    for (const tagId of tagIds) {
      rangeByTag.set(tagId, (rangeByTag.get(tagId) ?? 0) + 1);
    }
  }

  return Array.from(rangeByTag.entries())
    .map(([tagId, rangeCount]) => {
      // Non-null by construction — only ids that passed the tagMap.has()
      // filter above reach these maps. The fallback is belt-and-braces.
      const tag = tagMap.get(tagId);
      return {
        tagId,
        tagName: tag?.name ?? tagId,
        tagColor: tag?.color ?? null,
        rangeCount,
        totalCount: totalByTag.get(tagId) ?? rangeCount,
      };
    })
    .sort(
      (a, b) =>
        b.rangeCount - a.rangeCount ||
        b.totalCount - a.totalCount ||
        // Name last so the order is total, not "whatever Map iteration gave" —
        // two tags with identical counts would otherwise swap places between
        // renders as assignments come back in a different order.
        a.tagName.localeCompare(b.tagName),
    )
    .slice(0, limit);
}
