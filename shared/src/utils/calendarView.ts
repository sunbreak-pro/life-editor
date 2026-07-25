/*
 * Calendar view-mode domain logic (#280, extracted from CalendarTab). Pure
 * string/date-key computation — no React, no Intl, no DataService.
 *
 * The Schedule host keeps ONE `view` state string across both layouts;
 * each layout normalises it to its own option set (Desktop day/week/month ↔
 * Mobile list/time/month) so a window resize keeps a sensible view without a
 * second piece of state.
 */

export type DesktopCalendarView = "day" | "week" | "month";
export type MobileCalendarView = "list" | "time" | "month";

/** Map the shared view string onto the Desktop option set. */
export function normalizeDesktopView(view: string): DesktopCalendarView {
  return view === "list"
    ? "day"
    : view === "time"
      ? "week"
      : view === "day" || view === "week" || view === "month"
        ? view
        : "week";
}

/** Map the shared view string onto the Mobile option set. */
export function normalizeMobileView(view: string): MobileCalendarView {
  return view === "day"
    ? "list"
    : view === "week"
      ? "time"
      : view === "list" || view === "time" || view === "month"
        ? view
        : "list";
}

/**
 * Visible fetch window (inclusive [start, end] date keys) for the effective
 * view. Month spans the whole grid incl. spillover cells; Desktop week spans
 * the anchor's week; every other view (day / Mobile list / Mobile time) is a
 * single day.
 */
export function visibleCalendarRange(args: {
  effView: string;
  isWide: boolean;
  anchorDate: string;
  weekStart: string;
  weekEnd: string;
  /** `monthGridKeys(anchor, weekStartsOn)` rows (each a 7-key week). */
  monthRows: readonly (readonly string[])[];
}): [string, string] {
  const { effView, isWide, anchorDate, weekStart, weekEnd, monthRows } = args;
  if (effView === "month") {
    const first = monthRows[0][0];
    const last = monthRows[monthRows.length - 1][6];
    return [first, last];
  }
  if (isWide && effView === "week") return [weekStart, weekEnd];
  return [anchorDate, anchorDate];
}
