/**
 * Local-timezone `YYYY-MM-DD` key. Ported from frontend/src/utils/dateKey
 * (only the subset Daily needs). Uses local getFullYear/Month/Date so the
 * key matches the user's calendar day, not UTC.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/*
 * Day-start (rollover) hour pref — reader side (#218, split from §216
 * lightweight prefs). "Today" for Daily / routine sync rolls over at
 * HH:00 instead of midnight, so a 2 AM entry still lands on yesterday's
 * daily when the pref is e.g. 4. Settings owns the write side (a select
 * wired to `useDayStartHourPref`); readers derive "today" exclusively
 * through `todayDateKey()` so the boundary lives in one place.
 */
export const DAY_START_HOUR_STORAGE_KEY = "life-editor-day-start-hour";

export const DEFAULT_DAY_START_HOUR = 0;

/** Validate a stored value: integer hour 0–23, else the default (0). */
export function parseDayStartHour(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_DAY_START_HOUR;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 23) return DEFAULT_DAY_START_HOUR;
  return n;
}

/** Read the configured day-start hour (pure; reads localStorage). */
export function getDayStartHour(): number {
  try {
    return parseDayStartHour(localStorage.getItem(DAY_START_HOUR_STORAGE_KEY));
  } catch {
    return DEFAULT_DAY_START_HOUR;
  }
}

/**
 * Local date key for "today", honoring the day-start hour: an instant
 * before HH:00 counts as the previous day (exactly HH:00 is the new day).
 * With the default 0 this is identical to `formatDateKey(new Date())`.
 * The fixed-ms shift assumes a DST-less timezone (JST, N=1 user); around
 * a DST switch the wall-clock boundary would drift by an hour.
 */
export function todayDateKey(
  now: Date = new Date(),
  dayStartHour: number = getDayStartHour(),
): string {
  return formatDateKey(new Date(now.getTime() - dayStartHour * 60 * 60_000));
}

/**
 * Plain calendar-day "today" (local midnight boundary — NO day-start-hour
 * shift). The Schedule hosts key their grids on the wall calendar, where a
 * 2 AM edit belongs to the new date; `todayDateKey()` above is the
 * Daily / routine-sync "today" that rolls over at the configured hour.
 * Analytics uses this one too (#356): its buckets — 30-day trends, the
 * hour × weekday heatmap, the 0–24h timeline axis — are all calendar-keyed,
 * so its "today" cards must be as well.
 * Single implementation (#280) — replaces the todayLocal / todayLocalKey
 * copies that lived in useScheduleItemsAPI and web scheduleLabels.
 */
export function todayCalendarKey(now: Date = new Date()): string {
  return formatDateKey(now);
}

/**
 * LOCAL date key of a stored instant (`scheduledAt` / `scheduledEndAt` etc.,
 * ISO-8601 UTC). Returns null for missing / unparseable input.
 *
 * Use this instead of `value.slice(0, 10)`: the stored string is UTC, so
 * slicing it reads the UTC calendar day. In JST that is the PREVIOUS day for
 * anything before 09:00 local — an all-day task staged at local midnight
 * (`localDateTimeToISO(key, "00:00")`, the "add to today" write) is stored as
 * `…T15:00:00Z` on the day before and a sliced key says yesterday. Grids and
 * chips key on the LOCAL day (`tasksToCalendarChips`), so a sliced consumer
 * silently disagrees with them (#413).
 */
export function dateKeyOfInstant(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : formatDateKey(d);
}
