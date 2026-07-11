import {
  DAY_START_HOUR_STORAGE_KEY,
  DEFAULT_DAY_START_HOUR,
  parseDayStartHour,
} from "../utils/dateKey";
import { useLocalStorage } from "./useLocalStorage";

/*
 * Day-start (rollover) hour pref — write side (#218, split from §216
 * lightweight prefs). Persisted key:
 *   - `life-editor-day-start-hour` = "0".."23" — the hour at which "today"
 *     rolls over for Daily / routine sync (e.g. 4 = the day starts at 4 AM).
 *
 * Readers never consume this hook: they go through the pure
 * `todayDateKey()` / `getDayStartHour()` in utils/dateKey (evaluated at
 * call time, so a pref change applies from the next "today" computation —
 * same reload semantics as the startup-section pref).
 */

/** Settings-side read/write of the day-start hour (value + setter). */
export function useDayStartHourPref(): {
  dayStartHour: number;
  setDayStartHour: (hour: number) => void;
} {
  const [dayStartHour, setDayStartHour] = useLocalStorage<number>(
    DAY_START_HOUR_STORAGE_KEY,
    DEFAULT_DAY_START_HOUR,
    {
      serialize: (v) => String(v),
      deserialize: parseDayStartHour,
    },
  );
  return { dayStartHour, setDayStartHour };
}
