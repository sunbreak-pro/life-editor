import { minutesFromMidnight, minutesToTime } from "./scheduleGridLayout";

/*
 * All-day ↔ timed conversion (#469 follow-up). Pure time arithmetic — no React,
 * no DataService.
 *
 * Turning all-day OFF has to hand the row a usable span back, and the row it
 * starts from may have nothing to offer: `events_payload.start_time` /
 * `end_time` are nullable and the mapper surfaces them as "". A null start
 * leaves the item unrenderable on the time grid, so the fallback is not a
 * nicety — it is what keeps the row on screen at all.
 *
 * This lived inline in the web host, where there is no test runner. The
 * end-of-day clamp and the garbage-input case below are exactly the kind of
 * thing that is cheap to pin here and invisible there.
 */

/** Same default span the create paths seed (09:00–10:00). */
const DEFAULT_START = "09:00";
const DEFAULT_DURATION_MIN = 60;
/** Last minute of the day: an end past midnight would clamp to "24:00", which
 *  a <input type="time"> cannot display and no day boundary accepts. */
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

/** HH:MM, or "" / null when the row carries no time. */
export type MaybeTime = string | null | undefined;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A concrete, renderable HH:MM — rejects "", null and malformed text alike. */
function usableTime(value: MaybeTime): string | null {
  return value && HHMM.test(value) ? value : null;
}

/**
 * The [start, end] to give a row when all-day is switched OFF.
 *
 * Keeps whatever the row already had (so flipping all-day twice is lossless),
 * fills only what is missing, and never returns an end at or before the start.
 */
export function timedSpanForAllDayOff(
  startTime: MaybeTime,
  endTime: MaybeTime,
): { startTime: string; endTime: string } {
  const start = usableTime(startTime) ?? DEFAULT_START;
  const existingEnd = usableTime(endTime);
  const startMin = minutesFromMidnight(start);
  if (existingEnd && minutesFromMidnight(existingEnd) > startMin) {
    return { startTime: start, endTime: existingEnd };
  }
  // Derived from the start (not a fixed 10:00), so a late row does not come
  // back inverted — and clamped so it stays inside the day.
  const endMin = Math.min(startMin + DEFAULT_DURATION_MIN, LAST_MINUTE_OF_DAY);
  return { startTime: start, endTime: minutesToTime(endMin) };
}
