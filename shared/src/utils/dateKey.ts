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
 */
export function todayDateKey(
  now: Date = new Date(),
  dayStartHour: number = getDayStartHour(),
): string {
  return formatDateKey(new Date(now.getTime() - dayStartHour * 60 * 60_000));
}
