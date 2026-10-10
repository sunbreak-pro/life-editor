import type { DailyNode } from "../../types/daily";
import type { Goal, GoalPeriodKind } from "../../types/goal";
import type { ScheduleItem } from "../../types/schedule";
import type { TimerSession } from "../../types/timer";
import type { TodoNode } from "../../types/todoTree";
import { dateKeyOfInstant, todayDateKey } from "../../utils/dateKey";
import {
  goalPeriodKey,
  type GoalAchievementLink,
} from "../../utils/goalAchievement";
import { addDaysKey } from "../../utils/scheduleGridLayout";
import { isCountedSession } from "../../utils/timerSessions";
import { extractEveningSection } from "./eveningSection";
import {
  applyGoalLinkEdit,
  previewGoalLinkEdit,
  toAchievementTodo,
  toGoalLinkState,
  type GoalProgressChange,
} from "./goalLinkPreview";

/*
 * What one day amounted to (#2107, plan Step 8) — the evening paper's numbers
 * and lists, as plain functions of the day's rows.
 *
 * Standalone and argument-driven on purpose: the Daily rebuild (#2123, Step
 * 13) prints the same four numbers under its body for ANY past day, and the
 * plan forbids a second way of counting them (D-20261006-main-3). So the day
 * and its start hour come in as arguments rather than being read off the
 * clock or localStorage here.
 *
 * Pure (no React, no I/O).
 */

/**
 * The instants that belong to `dateKey`: from its day-start hour to the next
 * day's (#218 — with a 4 o'clock start, 01:30 is still last night).
 */
export function eveningDayWindow(
  dateKey: string,
  dayStartHour: number,
): { start: number; end: number } {
  const at = (key: string): number => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d, dayStartHour).getTime();
  };
  return { start: at(dateKey), end: at(addDaysKey(dateKey, 1)) };
}

const inWindow = (
  value: string | Date | null | undefined,
  w: { start: number; end: number },
): boolean => {
  if (value === null || value === undefined || value === "") return false;
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t >= w.start && t < w.end;
};

const hhmm = (value: string | Date): string => {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * The day a todo is booked on, by the day-start hour (#218) like `todayKey`:
 * tomorrow's 02:00 under a 4 o'clock start is stored on the calendar date
 * after it. All-day bookings sit at local midnight and keep their date.
 */
const todoDayOf = (t: TodoNode, dayStartHour: number): string | null => {
  const key = dateKeyOfInstant(t.scheduledAt);
  if (key === null || t.isAllDay === true || t.scheduledAt === undefined)
    return key;
  return todayDateKey(new Date(t.scheduledAt), dayStartHour);
};

const liveEvent = (s: ScheduleItem, dateKey: string): boolean =>
  s.date === dateKey && s.isDeleted !== true && s.isDismissed !== true;

const isAllDayEvent = (s: ScheduleItem): boolean =>
  s.isAllDay === true || s.startTime === "";

/** A counted, finished WORK session — what "worked" means on the paper. */
const isWorkDone = (
  s: TimerSession,
): s is TimerSession & { duration: number; completedAt: Date } =>
  s.sessionType === "WORK" && isCountedSession(s) && s.completedAt !== null;

const doneInWindow = (
  t: TodoNode,
  w: { start: number; end: number },
): boolean =>
  t.isDeleted !== true && t.status === "DONE" && inWindow(t.completedAt, w);

// ── 今日の出来事 ─────────────────────────────────────────────────────────

export interface EveningEvent {
  /** The evening_notes key: `event:<id>` / `todo:<id>` / `session:<id>`. */
  key: string;
  kind: "event" | "todo" | "session";
  /** Null only for a session with nothing to name it (host prints「作業」). */
  title: string | null;
  /** Local "HH:MM"; null = an all-day event. */
  startTime: string | null;
  /** Sessions only. */
  endTime: string | null;
}

export interface EveningDayInput {
  dateKey: string;
  dayStartHour: number;
  scheduleItems: readonly ScheduleItem[];
  todos: readonly TodoNode[];
  sessions: readonly TimerSession[];
}

const KIND_ORDER = { event: 0, session: 1, todo: 2 } as const;

/**
 * The day's events, completed todos and work sessions on one time line. With
 * `now`, events that have not started yet stay off it — they are still
 * 「今後の予定」, not something that happened.
 */
export function eveningEvents(
  input: EveningDayInput & { now?: Date },
): EveningEvent[] {
  const { dateKey, dayStartHour, scheduleItems, todos, sessions, now } = input;
  const w = eveningDayWindow(dateKey, dayStartHour);
  const rows: Array<{ at: number; row: EveningEvent }> = [];
  const add = (at: number, row: EveningEvent): void => {
    rows.push({ at, row });
  };

  for (const s of scheduleItems) {
    if (!liveEvent(s, dateKey)) continue;
    const allDay = isAllDayEvent(s);
    const at = allDay
      ? Number.NEGATIVE_INFINITY
      : new Date(`${s.date}T${s.startTime}:00`).getTime();
    if (!allDay && now !== undefined && at > now.getTime()) continue;
    add(at, {
      key: `event:${s.id}`,
      kind: "event",
      title: s.title,
      startTime: allDay ? null : s.startTime,
      endTime: null,
    });
  }

  for (const t of todos) {
    if (!doneInWindow(t, w) || t.completedAt === undefined) continue;
    add(new Date(t.completedAt).getTime(), {
      key: `todo:${t.id}`,
      kind: "todo",
      title: t.title,
      startTime: hhmm(t.completedAt),
      endTime: null,
    });
  }

  for (const s of sessions) {
    if (!isWorkDone(s) || !inWindow(s.startedAt, w)) continue;
    const title =
      (s.todoId != null ? todos.find((t) => t.id === s.todoId)?.title : null) ??
      (s.eventId != null
        ? scheduleItems.find((e) => e.id === s.eventId)?.title
        : null) ??
      (s.label !== null && s.label.trim() !== "" ? s.label : null);
    add(new Date(s.startedAt).getTime(), {
      key: `session:${s.id}`,
      kind: "session",
      title,
      startTime: hhmm(s.startedAt),
      endTime: hhmm(s.completedAt),
    });
  }

  // Ordered by the instant, not the "HH:MM" text: with a late day-start hour
  // a 01:00 session belongs AFTER the evening, though its text sorts first.
  // (Two all-day rows give -Infinity - -Infinity = NaN, which falls through
  // to the kind order like a tie.)
  return rows
    .sort(
      (a, b) => a.at - b.at || KIND_ORDER[a.row.kind] - KIND_ORDER[b.row.kind],
    )
    .map((r) => r.row);
}

export interface EveningDayCounts {
  /** The day's live, undismissed schedule items (all of them). */
  events: number;
  /** Todos scheduled on the day that are done / all of them. */
  todosDone: number;
  todosTotal: number;
  /** done / total, null when nothing was scheduled. */
  todoRate: number | null;
  /** Counted, finished WORK sessions that started inside the day. Unrounded. */
  workMinutes: number;
}

/** The numbers the evening paper's「今日の出来事」header and #2123's Daily print. */
export function eveningDayCounts(input: EveningDayInput): EveningDayCounts {
  const { dateKey, dayStartHour, scheduleItems, todos, sessions } = input;
  const w = eveningDayWindow(dateKey, dayStartHour);
  // The day a todo is scheduled on follows the day-start hour, the same rule
  // tomorrowCandidates and「明日に置く」use.
  const scheduled = todos.filter(
    (t) => t.isDeleted !== true && todoDayOf(t, dayStartHour) === dateKey,
  );
  const todosDone = scheduled.filter((t) => t.status === "DONE").length;
  let workMinutes = 0;
  for (const s of sessions) {
    if (isWorkDone(s) && inWindow(s.startedAt, w))
      workMinutes += s.duration / 60;
  }
  return {
    events: scheduleItems.filter((s) => liveEvent(s, dateKey)).length,
    todosDone,
    todosTotal: scheduled.length,
    todoRate: scheduled.length === 0 ? null : todosDone / scheduled.length,
    workMinutes,
  };
}

// ── 今日進んだ目標 ───────────────────────────────────────────────────────

export interface EveningGoalMove extends GoalProgressChange {
  title: string;
  periodKind: GoalPeriodKind;
}

const KIND_RANK: Readonly<Record<GoalPeriodKind, number>> = {
  week: 0,
  month: 1,
  year: 2,
};

const currentGoals = (goals: readonly Goal[], dateKey: string): Goal[] =>
  goals
    .filter(
      (g) =>
        !g.isDeleted && g.periodKey === goalPeriodKey(g.periodKind, dateKey),
    )
    .sort(
      (a, b) =>
        KIND_RANK[a.periodKind] - KIND_RANK[b.periodKind] ||
        a.sortOrder - b.sortOrder,
    );

/**
 * The current goals the day's completions moved:「企画書を通す 2/4 → 3/4」.
 *
 * No second rule (the #2109 preview's reasoning): `judgeGoals` runs twice,
 * through `previewGoalLinkEdit` — once with today's completions undone, once
 * as things are — so the paper cannot disagree with Connect or the MCP tools.
 * A todo done with no `completedAt` counts as done before today; a link made
 * today is not undone, only the completion is.
 */
export function goalsMovedToday(input: {
  goals: readonly Goal[];
  links: readonly GoalAchievementLink[];
  todos: readonly TodoNode[];
  dateKey: string;
  dayStartHour: number;
}): EveningGoalMove[] {
  const { goals, links, todos, dateKey, dayStartHour } = input;
  const w = eveningDayWindow(dateKey, dayStartHour);
  const todayDone = todos
    .filter((t) => doneInWindow(t, w))
    .map(toAchievementTodo);
  if (todayDone.length === 0) return [];
  const before = applyGoalLinkEdit(toGoalLinkState(goals, links, todos), {
    todos: todayDone.map((t) => ({ ...t, done: false })),
  });
  const changes = new Map(
    previewGoalLinkEdit(before, { todos: todayDone }).map((c) => [c.goalId, c]),
  );
  const moves: EveningGoalMove[] = [];
  for (const goal of currentGoals(goals, dateKey)) {
    const change = changes.get(goal.id);
    if (change === undefined) continue;
    moves.push({ ...change, title: goal.title, periodKind: goal.periodKind });
  }
  return moves;
}

// ── 号数と連続日数 ───────────────────────────────────────────────────────

export interface EveningIssue {
  /** Days up to `todayKey` whose 夕刊 carries a mood line. */
  number: number;
  /** Consecutive such days ending today — or yesterday while today is unpublished. */
  streak: number;
  publishedToday: boolean;
}

/**
 * 「夕刊 第 N 号 · n 日連続」. Counted off the「気分: n/5」line — the star IS
 * the publishing act — so past days count with no new storage, and an
 * unpublished today still shows the last issue's number (brief §11).
 */
export function eveningIssue(
  dailies: readonly Pick<DailyNode, "date" | "content" | "isDeleted">[],
  todayKey: string,
): EveningIssue {
  const published = new Set<string>();
  for (const d of dailies) {
    if (d.isDeleted === true || d.date > todayKey) continue;
    if (extractEveningSection(d.content).mood !== null) published.add(d.date);
  }
  const publishedToday = published.has(todayKey);
  let streak = 0;
  let key = publishedToday ? todayKey : addDaysKey(todayKey, -1);
  while (published.has(key)) {
    streak += 1;
    key = addDaysKey(key, -1);
  }
  return { number: published.size, streak, publishedToday };
}

// ── 明日の予定に置く ─────────────────────────────────────────────────────

/** Unlinked todos offered after the goal-linked ones — the carryover cap. */
export const TOMORROW_OTHERS_LIMIT = 5;

export interface EveningTomorrowCandidate {
  id: string;
  title: string;
  /** The current goal it serves (first hit, week first), null when none. */
  goalTitle: string | null;
  /** Already on tomorrow: its time, null for all-day. Null = not placed yet. */
  placed: { time: string | null } | null;
}

/**
 * Todos worth putting on tomorrow: unfinished ones serving a current goal
 * first, then up to TOMORROW_OTHERS_LIMIT others. A todo already booked
 * past tomorrow is left out — its day is decided — while one already on
 * tomorrow always stays listed, showing where it went.
 */
export function tomorrowCandidates(input: {
  todos: readonly TodoNode[];
  goals: readonly Goal[];
  links: readonly GoalAchievementLink[];
  todayKey: string;
  /** Default 0. A timed todo before this hour belongs to the day before. */
  dayStartHour?: number;
}): EveningTomorrowCandidate[] {
  const { todos, goals, links, todayKey, dayStartHour = 0 } = input;
  const tomorrowKey = addDaysKey(todayKey, 1);
  const dayOf = (t: TodoNode): string | null => todoDayOf(t, dayStartHour);
  const pool = todos.filter((t) => {
    if (t.isDeleted === true || t.status === "DONE") return false;
    const day = dayOf(t);
    return day === null || day <= tomorrowKey;
  });
  const candidate = (
    t: TodoNode,
    goalTitle: string | null,
  ): EveningTomorrowCandidate => ({
    id: t.id,
    title: t.title,
    goalTitle,
    placed:
      dayOf(t) === tomorrowKey && t.scheduledAt !== undefined
        ? { time: t.isAllDay === true ? null : hhmm(t.scheduledAt) }
        : null,
  });

  const out: EveningTomorrowCandidate[] = [];
  const taken = new Set<string>();
  for (const goal of currentGoals(goals, todayKey)) {
    for (const link of links) {
      if (link.isDeleted || link.goalId !== goal.id || taken.has(link.todoId))
        continue;
      const todo = pool.find((t) => t.id === link.todoId);
      if (todo === undefined) continue;
      taken.add(todo.id);
      out.push(candidate(todo, goal.title));
    }
  }
  let others = 0;
  for (const todo of pool) {
    if (taken.has(todo.id)) continue;
    const row = candidate(todo, null);
    if (row.placed === null) {
      if (others >= TOMORROW_OTHERS_LIMIT) continue;
      others += 1;
    }
    out.push(row);
  }
  return out;
}

// ── 出来事の一言 ─────────────────────────────────────────────────────────

/**
 * One note edit on the evening_notes map. A note is ONE line, so newlines
 * fold to spaces; an empty note removes its key, and a map left with no key
 * becomes null. Returns `notes` itself (===) when nothing changes, so the
 * caller can skip the write.
 */
export function applyEveningNote(
  notes: Readonly<Record<string, string>> | null,
  key: string,
  text: string,
): Record<string, string> | null {
  const line = text.replace(/\s*\r?\n\s*/g, " ").trim();
  const current = notes ?? {};
  if (line === "") {
    if (!(key in current)) return notes as Record<string, string> | null;
    const rest = { ...current };
    delete rest[key];
    return Object.keys(rest).length === 0 ? null : rest;
  }
  if (current[key] === line) return notes as Record<string, string>;
  return { ...current, [key]: line };
}
