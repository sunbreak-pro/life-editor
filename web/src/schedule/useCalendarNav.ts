import { useCallback, useMemo, useState } from "react";
import {
  addDaysKey,
  addMonthsKey,
  monthGridKeys,
  normalizeDesktopView,
  startOfWeekKey,
  todayCalendarKey,
  useWeekStartPref,
  visibleCalendarRange,
} from "@life-editor/shared";

/*
 * Calendar navigation state (#280, extracted from CalendarTab): the anchor
 * date, the `view` string (Desktop's day/week/month choice, normalised by the
 * shared calendarView helper), the derived week/month keys and the visible
 * fetch window, plus prev/next/today stepping. No data access — the range
 * consumer (useVisibleRangeItems) and the mutation layer live separately.
 */
export function useCalendarNav(isWide: boolean) {
  const today = useMemo(() => todayCalendarKey(), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const [view, setView] = useState("week");

  const desktopView = normalizeDesktopView(view);

  /*
   * #692: narrow's one overview — the month grid on a sheet, opened from the
   * header's date label (D-20260811-sched-2 = A). The switcher #467 retired
   * does NOT come back: there is still no "view" to choose on Mobile, only a
   * sheet that is open or shut.
   *
   * The flag lives here rather than in the render branch because everything
   * that makes the grid usable reads `effView`: the fetch window (a sheet on
   * the day range would draw 42 empty cells), the step size, and the period
   * label. Flipping one line flips all three.
   *
   * Wide has the switcher's own month view and never mounts the sheet, so the
   * request only counts on narrow — that also means a window widened while the
   * sheet is open cannot leave a stale "month" behind.
   */
  const [monthSheetRequested, setMonthSheetRequested] = useState(false);
  const monthSheetOpen = !isWide && monthSheetRequested;

  // #467: Mobile is a single day list — the switcher and its Month / Timeline
  // options are gone, so narrow has no view of its own to normalise. Pinning
  // it HERE rather than at the render branch is what keeps `step` and the fetch
  // window honest: `view` still holds whatever Desktop last chose, so a
  // window narrowed while on "month" would otherwise page by months and fetch
  // a whole grid to draw one day's list.
  const effView = isWide ? desktopView : monthSheetOpen ? "month" : "list";

  // Week-start pref (#217): read once per mount (same reload semantics as the
  // other lightweight prefs — a Settings change applies on section re-entry).
  const { weekStartsOn } = useWeekStartPref();
  const weekStart = useMemo(
    () => startOfWeekKey(anchorDate, weekStartsOn),
    [anchorDate, weekStartsOn],
  );
  const weekEnd = useMemo(() => addDaysKey(weekStart, 6), [weekStart]);
  const monthRows = useMemo(
    () => monthGridKeys(anchorDate, weekStartsOn),
    [anchorDate, weekStartsOn],
  );

  // Visible fetch window per effective view (day/list/time = single day).
  const [rangeStart, rangeEnd] = useMemo<[string, string]>(
    () =>
      visibleCalendarRange({
        effView,
        isWide,
        anchorDate,
        weekStart,
        weekEnd,
        monthRows,
      }),
    [effView, isWide, monthRows, weekStart, weekEnd, anchorDate],
  );

  const step = useCallback(
    (dir: number) => {
      const next =
        effView === "month"
          ? addMonthsKey(anchorDate, dir)
          : isWide && effView === "week"
            ? addDaysKey(anchorDate, dir * 7)
            : addDaysKey(anchorDate, dir);
      setAnchorDate(next);
    },
    [effView, isWide, anchorDate],
  );
  const goToday = useCallback(() => setAnchorDate(today), [today]);

  const openMonthSheet = useCallback(() => setMonthSheetRequested(true), []);
  const closeMonthSheet = useCallback(() => setMonthSheetRequested(false), []);
  // Consumption only (#692): a cell hands back the day, never a new item. The
  // sheet shuts on the way out so the tap lands on that day's Dayflow (#691).
  const pickMonthDay = useCallback((dateKey: string) => {
    setAnchorDate(dateKey);
    setMonthSheetRequested(false);
  }, []);

  return {
    today,
    anchorDate,
    setAnchorDate,
    view,
    setView,
    desktopView,
    effView,
    weekStartsOn,
    weekStart,
    weekEnd,
    monthRows,
    rangeStart,
    rangeEnd,
    step,
    goToday,
    monthSheetOpen,
    openMonthSheet,
    closeMonthSheet,
    pickMonthDay,
  };
}
