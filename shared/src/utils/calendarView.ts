/*
 * Calendar view-mode domain logic (#280, extracted from CalendarTab). Pure
 * string/date-key computation — no React, no Intl, no DataService.
 *
 * The Schedule host keeps ONE `view` state string, and only Desktop offers a
 * choice: week / month. It is normalised here so a value left over from an
 * older session (or a future option) still resolves to something drawable.
 *
 * #1628 retired the Desktop day view. A stored or in-session day view (and the
 * Mobile "list" that used to map onto it) now lands on the week, which still
 * shows that day as one of its columns.
 *
 * #467 retired the Mobile option set (list / time / month) with its switcher —
 * narrow is a single day list now, so there is no second view string to
 * normalise. `normalizeMobileView` / `MobileCalendarView` went with it; the
 * caller pins the effective view to "list" instead.
 */

export type DesktopCalendarView = "week" | "month";

/** Map the shared view string onto the Desktop option set. */
export function normalizeDesktopView(view: string): DesktopCalendarView {
  return view === "month" ? "month" : "week";
}

/**
 * Visible fetch window (inclusive [start, end] date keys) for the effective
 * view. Month spans the whole grid incl. spillover cells; Desktop week spans
 * the anchor's week; anything else (a narrow layout that is not on the month)
 * is a single day.
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
