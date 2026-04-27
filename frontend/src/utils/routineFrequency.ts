import type { FrequencyType } from "../types/routine";

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
      // "group" or unknown: caller must resolve via the routine's RoutineGroups
      // and pass the group's frequency in. Falling through here would match
      // every date and cause runaway schedule_item creation in reconcile.
      return false;
  }
}
