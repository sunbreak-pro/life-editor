/*
 * Schedule status derivation (#222).
 *
 * A schedule item shows one of three status tags. The 3 values are DERIVED from
 * the clock (no DB column): the store only persists `completed`, so this pure
 * function turns (item, now) into a tag the calendar surfaces can render.
 *
 *   completed === true                       → "done"
 *   not completed, start still in the future → "notStarted"
 *   not completed, start already reached     → "inProgress"
 *
 * Timed items compare the full start datetime (date + HH:MM) against `now`, so a
 * past-dated item that was never completed reads "inProgress" (started, still
 * open) even long after its end time. All-day items have no clock time, so they
 * fall back to a DATE comparison: a future day is "notStarted", the target day
 * or any past day is "inProgress" (until completed).
 *
 * Pure + timezone-safe: both the item start and `now` are built as LOCAL Date
 * values, so the comparison never crosses a UTC boundary.
 */

export type ScheduleStatus = "notStarted" | "inProgress" | "done";

/** Minimal shape needed to derive a status — a subset of ScheduleItem. */
export interface DerivableScheduleItem {
  /** YYYY-MM-DD (local calendar day). */
  date: string;
  /** HH:MM start time (ignored for all-day items). */
  startTime: string;
  completed: boolean;
  isAllDay?: boolean;
}

/** Local midnight timestamp (ms) for a YYYY-MM-DD key. */
function localDayStart(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function deriveScheduleStatus(
  item: DerivableScheduleItem,
  now: Date,
): ScheduleStatus {
  if (item.completed) return "done";

  if (item.isAllDay) {
    // Date-based: future day = not started, today or earlier = in progress.
    const itemDay = localDayStart(item.date);
    const todayDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return itemDay > todayDay ? "notStarted" : "inProgress";
  }

  // Timed: compare the start datetime against now. Start exactly == now counts
  // as started (>= → inProgress).
  const [y, m, d] = item.date.split("-").map(Number);
  const [hh, mm] = item.startTime.split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm).getTime();
  return now.getTime() >= start ? "inProgress" : "notStarted";
}
