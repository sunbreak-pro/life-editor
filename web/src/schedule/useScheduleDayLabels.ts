import { useCallback, useMemo } from "react";
import {
  minutesToTime,
  useTranslation,
  type AgendaListLabels,
} from "@life-editor/shared";
import { agendaEmptyKey } from "./agendaEmptyLabel";
import {
  formatFullDay as formatFullDayKey,
  formatPeriodLabel,
  formatShortDate,
} from "./scheduleCopy";

/*
 * Every date and day-shaped label the Calendar host hands to the parts
 * underneath it (#889, extracted from CalendarTab): the toolbar's period title,
 * the two day captions, the two per-cell formatters, and the AgendaList copy
 * for the two lists that use it.
 *
 * The pure `(language, dateKey) -> string` formatters live one layer down in
 * scheduleCopy.ts (#673), where a test can state the January / December edges
 * as facts. What comes out here is the part that could not: these are BOUND —
 * to the anchor day, to today, to the effective view, to the minute clock — and
 * so they are memos, not functions.
 *
 * The memo boundaries below are exactly the ones that stood in CalendarTab, and
 * they are load-bearing rather than decorative: `formatFullDay` is a dependency
 * of useScheduleRepeats' copy bundle, `periodLabel` is read by both layouts,
 * and every one of them is reachable from a keystroke somewhere else in the
 * host. Widening a dependency list here re-formats the calendar on every
 * character typed into the memo field.
 *
 * The two label objects are deliberately NOT memoised, also as they were: they
 * are rebuilt each render, and AgendaList holds no identity-sensitive effect on
 * them (see ScheduleSidebar / CalendarNarrowLayout, which both take them as
 * plain props).
 *
 * A web host hook, not a shared one: it resolves its own copy with
 * `useTranslation()` (§6.4 allows the host side to; the "no useTranslation in
 * parts" rule is about `shared/src/components/`), the same line
 * `useScheduleCopy` already draws — and the alternative is drilling `t` and
 * `i18n.language` in as arguments, which adds a parameter and answers nothing.
 * `web/src/schedule/` is also where #675 / #889 put every other piece pulled
 * out of CalendarTab.
 *
 * Zero behaviour change (#889): every field set, every key and every dependency
 * list below is the code that stood inline in CalendarTab.
 */

export interface UseScheduleDayLabelsArgs {
  /** The day the calendar is parked on — the narrow list's day (#878). */
  anchorDate: string;
  today: string;
  /**
   * `effView` from useCalendarNav — "month" on narrow whatever Desktop last
   * chose. Loosely typed for the same reason `formatPeriodLabel` is.
   */
  view: string;
  isWide: boolean;
  weekStart: string;
  weekEnd: string;
  /** Minutes-from-midnight (useMinuteClock) — the now-line's own caption. */
  nowMinutes: number;
}

export function useScheduleDayLabels({
  anchorDate,
  today,
  view,
  isWide,
  weekStart,
  weekEnd,
  nowMinutes,
}: UseScheduleDayLabelsArgs) {
  const { t, i18n } = useTranslation();

  const formatDayDate = useCallback(
    (key: string) => formatShortDate(i18n.language, key),
    [i18n.language],
  );

  const periodLabel = useMemo(
    () =>
      formatPeriodLabel({
        language: i18n.language,
        anchorDate,
        view,
        isWide,
        weekStart,
        weekEnd,
      }),
    [anchorDate, view, isWide, i18n.language, weekStart, weekEnd],
  );

  // #353 put the target day on screen as a caption, because the three gestures
  // that open the panel (toolbar / empty slot / month cell) each carry their
  // own day and none of them said so. #940 turned that caption into the date
  // input inside the panel, which formats itself — so the label is gone and
  // the day is now something the user can change rather than only read.

  const todayLabel = useMemo(
    () => formatFullDayKey(i18n.language, today),
    [today, i18n.language],
  );

  // #878: the day the Mobile list under the month grid is showing. No year —
  // the header right above it names the month and the year already.
  const anchorDayLabel = useMemo(
    () => formatFullDayKey(i18n.language, anchorDate),
    [anchorDate, i18n.language],
  );

  // Month-cell accessible names (MonthGrid falls back to the raw ISO key —
  // a screen reader would announce "2026-07-09").
  const formatFullDay = useCallback(
    (key: string) => formatFullDayKey(i18n.language, key),
    [i18n.language],
  );

  const agendaLabels: AgendaListLabels = {
    allDay: t("scheduleScreen.allDay"),
    empty: t("scheduleScreen.emptyToday"),
    nowLabel: minutesToTime(nowMinutes),
    // #1367: the todo rows wear the 朝刊's checkbox, so they wear the 朝刊's
    // words — the Todos section's own copy, resolved here rather than through
    // a scheduleScreen.* paraphrase of the same two values. The sidebar's
    // other tab (TodayTodoTray) already speaks todoDetail.* since #1368.
    todoStatus: t("todoDetail.status"),
    todoStatusLabels: {
      statusNotStarted: t("todoDetail.statusNotStarted"),
      statusDone: t("todoDetail.statusDone"),
    },
  };
  /*
   * #774: the same labels for the Mobile day list, whose empty state has to
   * name the day it is actually showing. The list above is the Dayflow tab —
   * always today — so it keeps `emptyToday` as it stands.
   */
  const anchorAgendaLabels: AgendaListLabels = {
    ...agendaLabels,
    empty: t(agendaEmptyKey(anchorDate, today)),
  };

  return {
    formatDayDate,
    periodLabel,
    todayLabel,
    anchorDayLabel,
    formatFullDay,
    agendaLabels,
    anchorAgendaLabels,
  };
}
