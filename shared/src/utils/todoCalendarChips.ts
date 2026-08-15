import type { TodoNode } from "../types/todoTree";
import { dateFromKey } from "./scheduleGridLayout";

/*
 * todoCalendarChips (schedule redesign A-1) — pure conversion from scheduled
 * TodoNodes into calendar-ready chip data. No React, no DataService; the
 * Schedule host maps the output into WeekTimeGrid / MonthGrid / AgendaList
 * items with variant "task".
 *
 * UTC → LOCAL: `scheduledAt` / `scheduledEndAt` are ISO-8601 UTC. Grids key on
 * LOCAL date/time (the "no UTC" convention — see dateKey.todayCalendarKey),
 * so we build the date/time parts with the local Date getters here.
 */

export interface TodoCalendarChip {
  /** Source TodoNode id (unprefixed — the host prefixes synthetic chip ids). */
  id: string;
  /** Local YYYY-MM-DD of `scheduledAt`. */
  date: string;
  title: string;
  /** Local HH:MM start ("00:00" for all-day). */
  startTime: string;
  /** Local HH:MM end ("00:00" for all-day). */
  endTime: string;
  isAllDay: boolean;
  /** status === "DONE" — done todos are kept (grids render completed styling). */
  completed: boolean;
}

/*
 * Synthetic chip ids (#280, moved from CalendarTab): chips are merged into
 * grids whose other ids are ScheduleItem ids, so chip ids carry a prefix the
 * host handlers use to tell them apart and no-op (A-1 read-only semantics —
 * Steps 2/3 wire writes). The prefix also guarantees no id collision with a
 * ScheduleItem.
 */
export const TODO_CHIP_PREFIX = "todochip-";

/** Synthetic grid id for a chip (prefix + source TodoNode id). */
export function todoChipId(id: string): string {
  return TODO_CHIP_PREFIX + id;
}

/** True when a grid/agenda id denotes a todo chip. */
export function isTodoChip(id: string): boolean {
  return id.startsWith(TODO_CHIP_PREFIX);
}

/**
 * Inverse of `todoChipId`: recover the source TodoNode id from a synthetic
 * chip id. A non-prefixed id is returned unchanged (defensive — callers gate
 * on `isTodoChip` first). Used by the Step-2 drag-to-write path to address the
 * underlying TodoNode.
 */
export function unwrapTodoChipId(id: string): string {
  return id.startsWith(TODO_CHIP_PREFIX)
    ? id.slice(TODO_CHIP_PREFIX.length)
    : id;
}

/**
 * Inverse of the module's UTC→LOCAL read conversion: build a UTC ISO instant
 * from a grid's LOCAL date key (YYYY-MM-DD) + LOCAL time (HH:MM). The grid
 * writes back through here on drag/resize (schedule redesign A-2 / #297).
 *
 * `new Date(y, monthIndex, d, hh, mm)` interprets its parts in LOCAL time, so
 * the resulting instant round-trips with `todosToCalendarChips` at minute
 * granularity. A "24:00" end (minutesToTime clamps to 24*60) normalises to the
 * next day's 00:00 — the correct absolute instant for an end-of-day block.
 */
export function localDateTimeToISO(dateKey: string, timeHHMM: string): string {
  return dateFromKey(dateKey, timeHHMM).toISOString();
}

/** Timed todos with no explicit end get a 1-hour block. */
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
 * WHEN one todo sits on the calendar — the local day and span a chip would be
 * drawn on, or null when the todo is not scheduled at all.
 *
 * #877 split this out of `todosToCalendarChips` so a surface that only wants to
 * SAY when a todo is (the detail panel's schedule row) reads the same answer
 * the grid draws. The rules below are not obvious enough to restate: an absent
 * end means a 60-minute block, and a degenerate span becomes all-day. A second
 * implementation would agree on the easy cases and disagree exactly on those
 * two — the panel would read "13:00–13:00" under a chip sitting in the all-day
 * lane.
 */
export interface TodoScheduleSlot {
  /** Local YYYY-MM-DD of `scheduledAt`. */
  date: string;
  /** Local HH:MM start ("00:00" for all-day). */
  startTime: string;
  /** Local HH:MM end ("00:00" for all-day). */
  endTime: string;
  isAllDay: boolean;
}

/** Where a todo sits on the calendar, or null when it carries no schedule. */
export function todoScheduleSlot(todo: TodoNode): TodoScheduleSlot | null {
  if (todo.scheduledAt == null) return null;
  const start = new Date(todo.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;

  const date = localDateKey(start);
  const allDay: TodoScheduleSlot = {
    date,
    startTime: "00:00",
    endTime: "00:00",
    isAllDay: true,
  };
  if (todo.isAllDay === true) return allDay;

  // Timed todo: local start; end from scheduledEndAt or a default 60-min block.
  let end: Date;
  if (todo.scheduledEndAt != null) {
    const parsed = new Date(todo.scheduledEndAt);
    end = Number.isNaN(parsed.getTime())
      ? new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000)
      : parsed;
  } else {
    end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);
  }

  // Rescue (#562): a degenerate span (end instant <= start instant, e.g. the
  // 00:00/00:00 rows an unclamped lane drop used to write) has no drawable
  // block — the grid renders inverted HH:MM as a full-day band that todo
  // chips offer no way to open. Surface it as an all-day candidate instead:
  // that chip can be re-placed by drag, and the tray/todos side can edit it.
  // A legitimate overnight span (end on the NEXT day) has end > start and is
  // untouched.
  if (end.getTime() <= start.getTime()) return allDay;

  return {
    date,
    startTime: localTime(start),
    endTime: localTime(end),
    isAllDay: false,
  };
}

/**
 * Convert scheduled todos into calendar chips whose LOCAL date falls within the
 * inclusive [rangeStartKey, rangeEndKey] window (YYYY-MM-DD strings compare
 * lexicographically = chronologically). Only todos with `scheduledAt` set are
 * emitted; soft-deleted todos are excluded. Multi-day spans are kept simple —
 * the chip lands on the START date only.
 */
export function todosToCalendarChips(
  todos: TodoNode[],
  rangeStartKey: string,
  rangeEndKey: string,
): TodoCalendarChip[] {
  const chips: TodoCalendarChip[] = [];
  for (const todo of todos) {
    if (todo.isDeleted) continue;
    const slot = todoScheduleSlot(todo);
    if (slot == null) continue;
    // Multi-day spans: chip on the start date only (keep it simple for A-1).
    if (slot.date < rangeStartKey || slot.date > rangeEndKey) continue;

    chips.push({
      id: todo.id,
      title: todo.title,
      completed: todo.status === "DONE",
      ...slot,
    });
  }
  return chips;
}
