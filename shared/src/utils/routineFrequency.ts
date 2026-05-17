import type { FrequencyType } from "../types/routine";

/**
 * 1:1 behaviour-preserving port of frontend/src/utils/routineFrequency.ts.
 * NOT modified — the only change vs. the Tauri original is the type
 * import path (`../types/routine` instead of `../types/routine` relative
 * to frontend). Every date is parsed as `new Date(d + "T00:00:00")` so
 * the comparison stays in the user's local calendar day (S4-0 D-1: no
 * UTC conversion — `date`/`timestamptz` columns would shift the JST
 * boundary; all schedule date math is local-consistent).
 *
 * The `default` branch deliberately returns `false` for "group"/unknown:
 * the caller (`shouldCreateRoutineItem`) must resolve "group" via the
 * routine's RoutineGroups and pass each group's own frequency in. A
 * fall-through to `true` here would match EVERY date and cause runaway
 * schedule_item creation in reconcile (Issue 017 family).
 */
export function shouldRoutineRunOnDate(
  frequencyType: FrequencyType,
  frequencyDays: number[],
  frequencyInterval: number | null,
  frequencyStartDate: string | null,
  date: string,
): boolean {
  switch (frequencyType) {
    case "daily":
      return true;
    case "weekdays": {
      const d = new Date(date + "T00:00:00");
      return frequencyDays.includes(d.getDay());
    }
    case "interval": {
      if (!frequencyInterval || frequencyInterval <= 0) return true;
      if (!frequencyStartDate) return true;
      const start = new Date(frequencyStartDate + "T00:00:00");
      const target = new Date(date + "T00:00:00");
      const diffMs = target.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % frequencyInterval === 0;
    }
    default:
      // "group" or unknown: caller must resolve via the routine's
      // RoutineGroups and pass the group's frequency in. Falling through
      // here would match every date and cause runaway schedule_item
      // creation in reconcile.
      return false;
  }
}
