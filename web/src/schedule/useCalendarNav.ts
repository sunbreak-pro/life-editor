import { useCallback, useMemo, useState } from "react";
import {
  addDaysKey,
  addMonthsKey,
  monthGridKeys,
  normalizeDesktopView,
  startOfWeekKey,
  todayCalendarKey,
  visibleCalendarRange,
  WEEK_STARTS_ON,
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
   * #878: narrow IS the month now (ユーザー確定 2026-08-15). The sheet #692 put
   * behind the header's date label is retired with it — a panel that has to be
   * asked for is the wrong shape for the thing the section is FOR, and the day
   * list it covered up read as a copy of the drawer beside it. The main area
   * shows the month grid with the anchored day's list underneath, so the two
   * surfaces answer different questions again.
   *
   * Pinning the view HERE rather than at the render branch is what keeps the
   * rest honest: the fetch window (a day range would draw 42 empty cells), the
   * step size (the header arrows page months, and the day is picked by tapping
   * a cell) and the period label all read `effView`. One line moves all three.
   *
   * `view` still holds whatever Desktop last chose, which is why narrow must
   * not read it — a window narrowed while on "day" would page by days under a
   * month grid.
   */
  const effView = isWide ? desktopView : "month";

  // Sunday-started weeks (#1102): one app-wide constant, nothing to re-read.
  const weekStart = useMemo(
    () => startOfWeekKey(anchorDate, WEEK_STARTS_ON),
    [anchorDate],
  );
  const weekEnd = useMemo(() => addDaysKey(weekStart, 6), [weekStart]);
  const monthRows = useMemo(
    () => monthGridKeys(anchorDate, WEEK_STARTS_ON),
    [anchorDate],
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

  // Consumption only (#692): a cell hands back the day, never a new item.
  // Since #878 that day is what the list under the grid shows, so the tap has
  // somewhere to land without anything opening or closing.
  const pickMonthDay = useCallback((dateKey: string) => {
    setAnchorDate(dateKey);
  }, []);

  return {
    today,
    anchorDate,
    setAnchorDate,
    view,
    setView,
    desktopView,
    effView,
    weekStart,
    weekEnd,
    monthRows,
    rangeStart,
    rangeEnd,
    step,
    goToday,
    pickMonthDay,
  };
}
