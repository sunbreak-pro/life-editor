import { useCallback, useMemo, useState } from "react";
import {
  addDaysKey,
  addMonthsKey,
  monthGridKeys,
  normalizeDesktopView,
  normalizeMobileView,
  startOfMonthKey,
  startOfWeekKey,
  todayCalendarKey,
  useWeekStartPref,
  visibleCalendarRange,
} from "@life-editor/shared";

/*
 * Calendar navigation state (#280, extracted from CalendarTab): the anchor
 * date, the single cross-layout `view` string (normalised per layout by the
 * shared calendarView helpers), the derived week/month keys and the visible
 * fetch window, plus prev/next/today stepping. No data access — the range
 * consumer (useVisibleRangeItems) and the mutation layer live separately.
 */
export function useCalendarNav(isWide: boolean) {
  const today = useMemo(() => todayCalendarKey(), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const [view, setView] = useState("week");
  // Mobile month-agenda day (kept in the shown month on month navigation).
  const [mobileSelectedDay, setMobileSelectedDay] = useState(today);

  const desktopView = normalizeDesktopView(view);
  const mobileView = normalizeMobileView(view);
  const effView = isWide ? desktopView : mobileView;

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
      // Month nav: keep the Mobile month-agenda day inside the shown month —
      // a stale day from the previous month sits outside the fetched range and
      // renders an always-empty agenda until the user taps a cell.
      if (effView === "month") setMobileSelectedDay(startOfMonthKey(next));
    },
    [effView, isWide, anchorDate],
  );
  const goToday = useCallback(() => {
    setAnchorDate(today);
    setMobileSelectedDay(today);
  }, [today]);

  return {
    today,
    anchorDate,
    setAnchorDate,
    view,
    setView,
    desktopView,
    mobileView,
    effView,
    weekStartsOn,
    weekStart,
    weekEnd,
    monthRows,
    rangeStart,
    rangeEnd,
    mobileSelectedDay,
    setMobileSelectedDay,
    step,
    goToday,
  };
}
