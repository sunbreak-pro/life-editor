/*
 * The calendar half of the goals block (#872, rolled over in #957): the period
 * a goal belongs to, in two forms.
 *
 *   goalPeriodKeys   → what the STORED heading says   ("2026-08-10" / "2026-08" / "2026")
 *   goalPeriodRanges → what the READER sees beside it ("8/10 – 8/16" / "8月" / "2026年")
 *
 * Both are computed from the SAME two inputs (the paper's day key + the
 * week-start preference), which is the point of keeping them in one file: a
 * key and a label that disagreed would file this week's goal under last week's
 * heading, and nothing on screen would say so.
 *
 * The week key is the week's START DATE, not an ISO week number — the boundary
 * follows the user's week-start preference (`useWeekStartPref` — 0 = Sunday,
 * 1 = Monday), and an ISO number would quietly assume Monday and disagree with
 * every calendar grid and with the Analytics week buckets (#860).
 *
 * Pure module (no React, no i18n lookup): the host passes the resolved BCP-47
 * locale, exactly like BriefingScreen's own `createDateLabel`.
 */

import type { WeekStartsOn } from "../../hooks/useWeekStart";
import { addDaysKey, startOfWeekKey } from "../../utils/scheduleGridLayout";
import type { GoalPeriod } from "./goalSections";

/** One display range per period, ready to sit next to the field's heading. */
export type GoalPeriodRanges = Record<GoalPeriod, string>;

/** One storage key per period — the tail of the stored heading (#957). */
export type GoalPeriodKeys = Record<GoalPeriod, string>;

/**
 * The three period keys the day `todayKey` falls in.
 *
 * Deliberately plain and sortable: the week is its own start date, the month
 * and year are prefixes of the day key. That makes a heading readable in Notes
 * (`## 週目標 2026-08-10`) without a decoder, and it keeps the key derivable
 * from the same call `goalPeriodRanges` makes for the label.
 */
export function goalPeriodKeys(
  todayKey: string,
  weekStartsOn: WeekStartsOn,
): GoalPeriodKeys {
  return {
    week: startOfWeekKey(todayKey, weekStartsOn),
    month: todayKey.slice(0, 7),
    year: todayKey.slice(0, 4),
  };
}

/** `YYYY-MM-DD` (local date key) → Date at local midnight. */
function dateOf(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

/**
 * Build the three display ranges for the day `todayKey` falls in.
 *
 * `locale` is a BCP-47 tag ("ja-JP" / "en-US"). Day numbers stay numeric in
 * both languages ("8/10") because that form reads the same either way; the
 * month and year take the locale's own wording ("8月" vs "August").
 */
export function goalPeriodRanges(
  todayKey: string,
  weekStartsOn: WeekStartsOn,
  locale: string,
): GoalPeriodRanges {
  const weekStart = startOfWeekKey(todayKey, weekStartsOn);
  const weekEnd = addDaysKey(weekStart, 6);
  const day = { month: "numeric", day: "numeric" } as const;
  const today = dateOf(todayKey);
  return {
    week: `${dateOf(weekStart).toLocaleDateString(locale, day)} – ${dateOf(
      weekEnd,
    ).toLocaleDateString(locale, day)}`,
    month: today.toLocaleDateString(locale, { month: "long" }),
    year: today.toLocaleDateString(locale, { year: "numeric" }),
  };
}
