import type { RoutineNode } from "../types/routine";
import type { ScheduleItem } from "../types/schedule";

/*
 * Shared label + mapping helpers for the target-IA Schedule hosts (CalendarTab
 * / RoutinesTab). Pure functions — no React, no DataService. i18n copy is
 * passed in already-resolved (§6.4) so the same string set drives the Calendar
 * summary rows and the Routines master list without duplicating the branch
 * logic in two files. Moved from web/src/schedule/scheduleLabels.ts (#280);
 * the old todayLocalKey() was unified into dateKey.todayCalendarKey().
 */

/** scheduleCalendar.* weekday keys, indexed 0 (Sun) – 6 (Sat). */
const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Build the 0-(Sun)-indexed weekday label array from the existing
 *  scheduleCalendar.weekday* catalog (reused so we don't add 7 new keys). */
export function buildWeekdayLabels(t: (key: string) => string): string[] {
  return WEEKDAY_KEYS.map((d) => t(`scheduleCalendar.weekday${d}`));
}

export interface FrequencyLabelCopy {
  daily: string;
  weekdaysFallback: string;
  group: string;
  intervalEvery: string;
  intervalDays: string;
}

/** Compose a human frequency summary (e.g. "月・水・金" / "Every 3 days"). */
export function frequencyLabel(
  r: Pick<RoutineNode, "frequencyType" | "frequencyDays" | "frequencyInterval">,
  copy: FrequencyLabelCopy,
  weekdayLabels: string[],
): string {
  switch (r.frequencyType) {
    case "daily":
      return copy.daily;
    case "weekdays":
      return r.frequencyDays.length > 0
        ? r.frequencyDays
            .slice()
            .sort((a, b) => a - b)
            .map((d) => weekdayLabels[d] ?? "")
            .join("・")
        : copy.weekdaysFallback;
    case "interval": {
      const n = r.frequencyInterval ?? 1;
      return `${copy.intervalEvery} ${n} ${copy.intervalDays}`
        .replace(/\s+/g, " ")
        .trim();
    }
    case "group":
      return copy.group;
    default:
      return r.frequencyType;
  }
}

/** Current wall-clock time as minutes-from-midnight. */
export function nowMinutesLocal(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Sort a day's items: all-day first, then ascending by start time. */
export function sortDayItems<
  T extends Pick<ScheduleItem, "isAllDay" | "startTime">,
>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => {
    if (!!a.isAllDay !== !!b.isAllDay) return a.isAllDay ? -1 : 1;
    return a.startTime.localeCompare(b.startTime);
  });
}

/** Provenance variant used by every shared schedule primitive. */
export function itemVariant(
  i: Pick<ScheduleItem, "routineId">,
): "routine" | "event" {
  return i.routineId != null ? "routine" : "event";
}
