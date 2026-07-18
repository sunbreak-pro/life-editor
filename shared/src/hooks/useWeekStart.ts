import { useLocalStorage } from "./useLocalStorage";

/*
 * Week-start preference (#217, split from §216 lightweight prefs). Persisted
 * key:
 *   - `life-editor-week-start` = "0" | "1" — the weekday calendar grids start
 *     on (0 = Sunday, 1 = Monday).
 *
 * The grid math (startOfWeekKey / monthGridKeys) and the grid components
 * (MonthGrid / WeekTimeGrid) already take `weekStartsOn` — this hook is the
 * single stored source the calendar hosts wire it from. The Settings-side
 * write UI lands with the settings section (same split as the day-start-hour
 * pref, #218); until then the key is still honoured when present.
 */

export const WEEK_START_STORAGE_KEY = "life-editor-week-start";

/** Week start day: 0 = Sunday (app default), 1 = Monday. */
export type WeekStartsOn = 0 | 1;

export const DEFAULT_WEEK_START: WeekStartsOn = 0;

/** Parse a stored raw value; anything but "1" falls back to Sunday. */
export function parseWeekStart(raw: string | null): WeekStartsOn {
  return raw === "1" ? 1 : DEFAULT_WEEK_START;
}

/** Read the pref outside React (pure; evaluated at call time). */
export function getWeekStartsOn(): WeekStartsOn {
  try {
    return parseWeekStart(localStorage.getItem(WEEK_START_STORAGE_KEY));
  } catch {
    return DEFAULT_WEEK_START;
  }
}

/** Read/write of the week-start pref (calendar hosts + the Settings card). */
export function useWeekStartPref(): {
  weekStartsOn: WeekStartsOn;
  setWeekStartsOn: (day: WeekStartsOn) => void;
} {
  const [weekStartsOn, setWeekStartsOn] = useLocalStorage<WeekStartsOn>(
    WEEK_START_STORAGE_KEY,
    DEFAULT_WEEK_START,
    {
      serialize: String,
      deserialize: parseWeekStart,
    },
  );
  return { weekStartsOn, setWeekStartsOn };
}
