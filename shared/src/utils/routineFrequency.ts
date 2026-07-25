import type { FrequencyType } from "../types/routine";

/**
 * Port of frontend/src/utils/routineFrequency.ts. Every date is parsed as
 * `new Date(d + "T00:00:00")` so the comparison stays in the user's local
 * calendar day (S4-0 D-1: no UTC conversion — `date`/`timestamptz`
 * columns would shift the JST boundary; all schedule date math is
 * local-consistent).
 *
 * The `default` branch deliberately returns `false` for an unknown
 * frequency. It is NOT dead under the narrowed union: the value arrives
 * from the DB, whose 0008 CHECK still allows the retired "group" type
 * (#352 removed the code, not the schema — DDL ゼロ). A fall-through to
 * `true` here would match EVERY date and cause runaway schedule_item
 * creation (Issue 017 family).
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
      // Unknown frequency (incl. rows still carrying the retired "group"
      // type — the DB CHECK outlives the code). Never fire: falling
      // through here would match every date and cause runaway
      // schedule_item creation in reconcile.
      return false;
  }
}
