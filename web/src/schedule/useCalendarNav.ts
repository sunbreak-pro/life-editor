import { useCallback, useMemo, useState } from "react";
import {
  addDaysKey,
  addMonthsKey,
  monthGridKeys,
  normalizeDesktopView,
  resolveInitialCalendarView,
  startOfWeekKey,
  todayCalendarKey,
  visibleCalendarRange,
  WEEK_STARTS_ON,
} from "@life-editor/shared";

/*
 * Calendar navigation state (#280, extracted from CalendarTab): the anchor
 * date, the `view` string (Desktop's week/month choice, normalised by the
 * shared calendarView helper), the derived week/month keys and the visible
 * fetch window, plus prev/next/today stepping. No data access — the range
 * consumer (useVisibleRangeItems) and the mutation layer live separately.
 */
export function useCalendarNav(isWide: boolean, providerToday?: string) {
  /*
   * #1642 W10 (H-01): "today" had two owners — the ScheduleItems provider's
   * anchored `date` and a key this hook froze at mount. Past midnight the
   * provider moved on and the calendar's Today button still went to
   * yesterday. The host now hands the provider's value in, so both read the
   * same key; the mount-time key is only the fallback for a caller with no
   * provider (the hook's own tests).
   */
  const mountToday = useMemo(() => todayCalendarKey(), []);
  const today = providerToday ?? mountToday;
  const [anchorDate, setAnchorDate] = useState(today);
  /*
   * #1174: the opening view is a preference now, not a literal. Seeded from
   * localStorage through the pure resolver (lazy initialiser — read once, on
   * the mount that creates the state) exactly like the startup-section pref
   * seeds MainScreen's section. From here on `view` is live state the header's
   * switcher owns, so changing the setting applies to the NEXT visit to
   * Schedule rather than yanking the view out from under the user.
   */
  const [view, setView] = useState<string>(resolveInitialCalendarView);

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
   * not read it — a window narrowed while on the week would page by weeks
   * under a month grid.
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

  // Visible fetch window per effective view (#1628: wide is week or month).
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
      // #1628: the day view is gone, so anything that is not the month is
      // the week (narrow is always the month — see effView above).
      const next =
        effView === "month"
          ? addMonthsKey(anchorDate, dir)
          : addDaysKey(anchorDate, dir * 7);
      setAnchorDate(next);
    },
    [effView, anchorDate],
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
