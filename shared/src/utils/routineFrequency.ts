import type { FrequencyType } from "../types/routine";
import { addDaysKey } from "./scheduleGridLayout";

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
      // Malformed config fails CLOSED (#407): a null/non-positive interval
      // or a missing start date means "fires never", NOT "fires every day".
      // Pre-#407 both guards returned true, so a routine stranded with a
      // bare interval type regenerated a schedule row EVERY day (the live
      // #407 zombie was a conversion twin minted before #352 began seeding
      // bare frequency switches; current-code losers are instead rolled
      // back by the conditional attach). The editor paths seed both fields
      // (seedFrequencyPatch / handleChangeRepeat — including the missing-
      // routine fallbacks since #407), so a healthy routine never lands
      // here — same runaway-creation defence as the `default` branch below.
      if (!frequencyInterval || frequencyInterval <= 0) return false;
      if (!frequencyStartDate) return false;
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

/**
 * Complete a bare frequency-TYPE switch into a self-consistent frequency.
 *
 * The segmented control emits `{ frequencyType }` alone, so a switch lands
 * on the type-specific fields of the PREVIOUS type:
 *   - → "weekdays" with no day set: `shouldRoutineRunOnDate` matches NO
 *     date, so the routine reads as "fires never";
 *   - → "interval" with a null interval / start date: fails closed to
 *     "fires never" too (#407 — pre-fix both guards degraded to `true`,
 *     i.e. "fires every day").
 * Either reading is a transient the user never asked for, and since #352
 * wired reconcile to this patch it is no longer harmless: one click would
 * sweep occurrences before the user picked a weekday or typed an
 * interval. Seeding mirrors what the manual→repeat conversion already does
 * with its seed event (`useScheduleMutations.handleChangeRepeat`).
 *
 * `anchorDate` is the day the edit is anchored on (the occurrence being
 * edited, else today). Fields the caller set explicitly are never
 * overwritten, and a patch without `frequencyType` passes through
 * untouched — a weekday toggle that clears the last day still means "fires
 * never", which is the user's own choice.
 */
export function seedFrequencyPatch<
  T extends {
    frequencyType?: FrequencyType;
    frequencyDays?: number[];
    frequencyInterval?: number | null;
    frequencyStartDate?: string | null;
  },
>(
  patch: T,
  current: {
    frequencyDays: number[];
    frequencyInterval: number | null;
    frequencyStartDate: string | null;
  },
  anchorDate: string,
): T {
  if (patch.frequencyType === undefined) return patch;
  const seeded: T = { ...patch };

  if (patch.frequencyType === "weekdays") {
    const days = patch.frequencyDays ?? current.frequencyDays;
    if (days.length === 0) {
      const [y, m, d] = anchorDate.split("-").map(Number);
      seeded.frequencyDays = [new Date(y, m - 1, d).getDay()];
    }
  }

  if (patch.frequencyType === "interval") {
    const interval = patch.frequencyInterval ?? current.frequencyInterval;
    if (interval == null || interval <= 0) seeded.frequencyInterval = 1;
    const start = patch.frequencyStartDate ?? current.frequencyStartDate;
    // "" counts as unset (#407): a routine that inherited an empty string
    // from a cleared date input would otherwise keep it and read as
    // "fires never" under the fail-closed guard above.
    if (!start) seeded.frequencyStartDate = anchorDate;
  }

  return seeded;
}

/** The widest window the repeat list scans for a next occurrence. */
const NEXT_OCCURRENCE_HORIZON_DAYS = 366;

/**
 * The first date on or after `from` that this frequency fires, or null when it
 * fires on no day within a year.
 *
 * The repeat list (#408) is the only route to a routine whose occurrences are
 * NOT materialised in the visible calendar range — an interval starting in the
 * future, or one that fires never (a malformed frequency reads that way under
 * the fail-closed guards above, which is exactly the #407 zombie shape). null
 * is what lets the list say "this never fires" instead of offering a jump that
 * lands on an empty day.
 *
 * A year is the horizon because the only unbounded frequency is `interval`,
 * and an interval longer than a year has no occurrence worth navigating to —
 * scanning further would cost more than the answer is worth.
 */
export function nextRoutineOccurrence(
  routine: {
    frequencyType: FrequencyType;
    frequencyDays: number[];
    frequencyInterval: number | null;
    frequencyStartDate: string | null;
  },
  from: string,
  horizonDays: number = NEXT_OCCURRENCE_HORIZON_DAYS,
): string | null {
  for (let i = 0; i <= horizonDays; i++) {
    const date = addDaysKey(from, i);
    if (
      shouldRoutineRunOnDate(
        routine.frequencyType,
        routine.frequencyDays,
        routine.frequencyInterval,
        routine.frequencyStartDate,
        date,
      )
    ) {
      return date;
    }
  }
  return null;
}
