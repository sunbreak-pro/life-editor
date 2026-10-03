import { useEffect, useRef } from "react";
import { formatDateKey, type RoutineNode } from "@life-editor/shared";

/** Next calendar day of a `YYYY-MM-DD` key, in local time. */
function nextDayKey(key: string): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return formatDateKey(d);
}

export interface UseRoutineRangeFillArgs {
  routines: RoutineNode[];
  rangeStart: string;
  rangeEnd: string;
  /** Day-start-hour aware today (useCalendarNav). */
  today: string;
  fill: (
    startDate: string,
    endDate: string,
    routines: RoutineNode[],
  ) => Promise<number | null>;
  /** Refetch the visible range once rows were written. */
  reload: () => void;
}

/**
 * The window the start of a fill is clamped to, or null when nothing in the
 * visible range is the fill's to make.
 *
 * Starts the day AFTER today: today belongs to the always-on generator
 * (RoutineScheduleSync), and two writers on the same (routine, day) slot race
 * into a 23505 that rolls the whole batch back. Past days are never filled —
 * fabricating not-done rows into the past would pollute the life record
 * (tier-1 rule 1, the same clamp `materialiseNewSeries` applies).
 */
export function routineFillWindow(
  rangeStart: string,
  rangeEnd: string,
  today: string,
): { startDate: string; endDate: string } | null {
  const tomorrow = nextDayKey(today);
  const startDate = rangeStart > tomorrow ? rangeStart : tomorrow;
  if (startDate > rangeEnd) return null;
  return { startDate, endDate: rangeEnd };
}

/**
 * #2081: materialise the repeat occurrences of the window the calendar shows.
 *
 * Without it a series only ever had today (the always-on generator) plus the
 * window that was visible when it was created or last re-shaped — so a repeat
 * made while September was on screen stopped at the edge of that grid, and
 * every October week came up empty.
 *
 * Creation only (see `fillRoutineItemsForDateRange`): navigating never
 * deletes. A failed pass is retried once, because the likeliest failure is a
 * race with another writer on the same slots (a repeat being minted, whose own
 * fill covers the same window); the retry's pre-check sees the winner.
 */
export function useRoutineRangeFill({
  routines,
  rangeStart,
  rangeEnd,
  today,
  fill,
  reload,
}: UseRoutineRangeFillArgs): void {
  // The newest pass wins: a navigation that lands while an older pass is in
  // flight must not have that pass's reload repaint the old window's result.
  const passRef = useRef(0);
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (routines.length === 0) return;
    const window = routineFillWindow(rangeStart, rangeEnd, today);
    if (!window) return;
    const pass = ++passRef.current;
    void (async () => {
      let created = await fill(window.startDate, window.endDate, routines);
      if (created === null && pass === passRef.current) {
        created = await fill(window.startDate, window.endDate, routines);
      }
      if (created && created > 0 && pass === passRef.current) {
        reloadRef.current();
      }
    })();
  }, [routines, rangeStart, rangeEnd, today, fill]);
}
