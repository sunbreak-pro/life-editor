/*
 * Period labels for the goals block (#872) — the ONLY thing about the goals
 * that moves with the calendar.
 *
 * The texts themselves never roll over (goalSections.ts), so what tells the
 * reader which week / month / year they are writing for is this label:
 *
 *   week  → "8/10 – 8/16"   (the week the paper's day falls in)
 *   month → "8月" / "August"
 *   year  → "2026年" / "2026"
 *
 * The week boundary follows the user's week-start preference
 * (`useWeekStartPref` — 0 = Sunday, 1 = Monday); hard-coding Monday here would
 * disagree with every calendar grid and with the Analytics week buckets (#860).
 *
 * Pure module (no React, no i18n lookup): the host passes the resolved BCP-47
 * locale, exactly like BriefingScreen's own `createDateLabel`.
 */

import type { WeekStartsOn } from "../../hooks/useWeekStart";
import { addDaysKey, startOfWeekKey } from "../../utils/scheduleGridLayout";
import type { GoalPeriod } from "./goalSections";

/** One display range per period, ready to sit next to the field's heading. */
export type GoalPeriodRanges = Record<GoalPeriod, string>;

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
