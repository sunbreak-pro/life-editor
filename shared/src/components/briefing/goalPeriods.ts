/*
 * The calendar half of the goals block (#872, rolled over in #957): the period
 * a goal belongs to, as the label the reader sees beside it
 * (`goalPeriodRanges`: "8/10 – 8/16" / "8月" / "2026年").
 *
 * The week key is the week's START DATE, not an ISO week number — the boundary
 * is the app-wide week start (`WEEK_STARTS_ON` = Sunday, #1102), and an ISO
 * number would quietly assume Monday and disagree with every calendar grid and
 * with the Analytics week buckets (#860).
 *
 * Pure module (no React, no i18n lookup): the host passes the resolved BCP-47
 * locale, exactly like BriefingScreen's own `createDateLabel`.
 */

import {
  addDaysKey,
  startOfWeekKey,
  type WeekStartsOn,
} from "../../utils/scheduleGridLayout";
import type { GoalPeriodKind } from "../../types/goal";

/** One display range per period, ready to sit next to the field's heading. */
export type GoalPeriodRanges = Record<GoalPeriodKind, string>;

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
