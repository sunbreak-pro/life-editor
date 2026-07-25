import type { TaskNode } from "../types/taskTree";

/*
 * taskCalendarChips (schedule redesign A-1) — pure conversion from scheduled
 * TaskNodes into calendar-ready chip data. No React, no DataService; the
 * Schedule host maps the output into WeekTimeGrid / MonthGrid / AgendaList
 * items with variant "task".
 *
 * UTC → LOCAL: `scheduledAt` / `scheduledEndAt` are ISO-8601 UTC. Grids key on
 * LOCAL date/time (the "no UTC" convention — see dateKey.todayCalendarKey),
 * so we build the date/time parts with the local Date getters here.
 */

export interface TaskCalendarChip {
  /** Source TaskNode id (unprefixed — the host prefixes synthetic chip ids). */
  id: string;
  /** Local YYYY-MM-DD of `scheduledAt`. */
  date: string;
  title: string;
  /** Local HH:MM start ("00:00" for all-day). */
  startTime: string;
  /** Local HH:MM end ("00:00" for all-day). */
  endTime: string;
  isAllDay: boolean;
  /** status === "DONE" — done tasks are kept (grids render completed styling). */
  completed: boolean;
}

/*
 * Synthetic chip ids (#280, moved from CalendarTab): chips are merged into
 * grids whose other ids are ScheduleItem ids, so chip ids carry a prefix the
 * host handlers use to tell them apart and no-op (A-1 read-only semantics —
 * Steps 2/3 wire writes). The prefix also guarantees no id collision with a
 * ScheduleItem.
 */
export const TASK_CHIP_PREFIX = "taskchip-";

/** Synthetic grid id for a chip (prefix + source TaskNode id). */
export function taskChipId(id: string): string {
  return TASK_CHIP_PREFIX + id;
}

/** True when a grid/agenda id denotes a task chip. */
export function isTaskChip(id: string): boolean {
  return id.startsWith(TASK_CHIP_PREFIX);
}

/**
 * Inverse of `taskChipId`: recover the source TaskNode id from a synthetic
 * chip id. A non-prefixed id is returned unchanged (defensive — callers gate
 * on `isTaskChip` first). Used by the Step-2 drag-to-write path to address the
 * underlying TaskNode.
 */
export function unwrapTaskChipId(id: string): string {
  return id.startsWith(TASK_CHIP_PREFIX)
    ? id.slice(TASK_CHIP_PREFIX.length)
    : id;
}

/**
 * Inverse of the module's UTC→LOCAL read conversion: build a UTC ISO instant
 * from a grid's LOCAL date key (YYYY-MM-DD) + LOCAL time (HH:MM). The grid
 * writes back through here on drag/resize (schedule redesign A-2 / #297).
 *
 * `new Date(y, monthIndex, d, hh, mm)` interprets its parts in LOCAL time, so
 * the resulting instant round-trips with `tasksToCalendarChips` at minute
 * granularity. A "24:00" end (minutesToTime clamps to 24*60) normalises to the
 * next day's 00:00 — the correct absolute instant for an end-of-day block.
 */
export function localDateTimeToISO(dateKey: string, timeHHMM: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

/** Timed tasks with no explicit end get a 1-hour block. */
const DEFAULT_DURATION_MIN = 60;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD via local getters (NOT toISOString, which is UTC). */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local HH:MM via local getters. */
function localTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Convert scheduled tasks into calendar chips whose LOCAL date falls within the
 * inclusive [rangeStartKey, rangeEndKey] window (YYYY-MM-DD strings compare
 * lexicographically = chronologically). Only tasks with `scheduledAt` set are
 * emitted; soft-deleted tasks are excluded. Multi-day spans are kept simple —
 * the chip lands on the START date only.
 */
export function tasksToCalendarChips(
  tasks: TaskNode[],
  rangeStartKey: string,
  rangeEndKey: string,
): TaskCalendarChip[] {
  const chips: TaskCalendarChip[] = [];
  for (const task of tasks) {
    if (task.scheduledAt == null) continue;
    if (task.isDeleted) continue;
    const start = new Date(task.scheduledAt);
    if (Number.isNaN(start.getTime())) continue;

    const date = localDateKey(start);
    // Multi-day spans: chip on the start date only (keep it simple for A-1).
    if (date < rangeStartKey || date > rangeEndKey) continue;

    const completed = task.status === "DONE";

    if (task.isAllDay === true) {
      chips.push({
        id: task.id,
        date,
        title: task.title,
        startTime: "00:00",
        endTime: "00:00",
        isAllDay: true,
        completed,
      });
      continue;
    }

    // Timed task: local start; end from scheduledEndAt or a default 60-min block.
    let end: Date;
    if (task.scheduledEndAt != null) {
      const parsed = new Date(task.scheduledEndAt);
      end = Number.isNaN(parsed.getTime())
        ? new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000)
        : parsed;
    } else {
      end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);
    }

    chips.push({
      id: task.id,
      date,
      title: task.title,
      startTime: localTime(start),
      endTime: localTime(end),
      isAllDay: false,
      completed,
    });
  }
  return chips;
}
