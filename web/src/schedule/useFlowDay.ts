import { useCallback, useState } from "react";
import type { ScheduleSidebarTabId } from "./ScheduleSidebar";

/*
 * Which day the Desktop flow tab is showing (#1973, D-20260922-sched-1 = B).
 *
 * The flow tab was always today on Desktop (#1148). A month cell's "他 N 件"
 * (#1829) now points it at the pressed day instead: the grid stays on the
 * month, and the list beside it reads that day in full. #1933 answered the
 * same press by switching to the week, which was the stopgap this replaces.
 *
 * Lives in its own file for the reason narrowDayTap.ts does: CalendarTab needs
 * the full Provider chain plus real layout to mount, so no web test renders it
 * (rules/frontend.md §テスト環境の制約, D-20260812-refactor-2). The gesture and
 * its way back are the whole of the Issue, and both are decided here.
 *
 * It holds no view or anchor setter on purpose. "The month stays on screen" is
 * then a fact about the signature rather than a promise the body keeps.
 *
 * Narrow ignores the picked day. Its flow tab already follows the anchor day
 * (#1148) and a narrow month cell has no "他 N 件" of its own to press.
 */

export interface UseFlowDayArgs {
  isWide: boolean;
  today: string;
  /**
   * The grid's fetch window (useCalendarNav). The flow tab lists rows from
   * that window, so a day outside it would read as empty whatever is on it.
   */
  rangeStart: string;
  rangeEnd: string;
  /** The sidebar's tab state (useScheduleSelection). */
  setSidebarTab: (tab: ScheduleSidebarTabId) => void;
  /**
   * Open the detail panel. Optional for the reason the host reads
   * `useRightSidebarOptional`: outside the shell there is no panel to open.
   * On Desktop the panel is a push-in that the user can have closed, and a
   * press that fills a closed panel would read as doing nothing.
   */
  openSidebar?: () => void;
}

export interface FlowDay {
  /**
   * The day the Desktop flow tab shows, when it is NOT today. `null` means
   * today, which is also what narrow always gets back.
   */
  day: string | null;
  /** A month cell's "他 N 件" was pressed on `dateKey`. */
  showDay: (dateKey: string) => void;
  /** The flow tab's "今日に戻る". */
  backToToday: () => void;
}

export function useFlowDay({
  isWide,
  today,
  rangeStart,
  rangeEnd,
  setSidebarTab,
  openSidebar,
}: UseFlowDayArgs): FlowDay {
  const [picked, setPicked] = useState<string | null>(null);

  /*
   * Let go of the pick once the grid moves away from it, or once it has
   * become today (the clock crossed midnight). Adjusted while rendering, the
   * same React pattern CalendarTab uses for its todo dialog: an effect would
   * draw one frame of the stale day first.
   *
   * Letting go rather than keeping it hidden: a pick that came back to life
   * when the user later paged back to that month would be a list nobody asked
   * for.
   */
  const inRange = picked !== null && picked >= rangeStart && picked <= rangeEnd;
  if (picked !== null && (!inRange || picked === today)) {
    setPicked(null);
  }

  const showDay = useCallback(
    (dateKey: string) => {
      setPicked(dateKey);
      // The panel remembers its tab. Without this, a press made while 繰り返し
      // was showing fills a list nobody is looking at.
      setSidebarTab("flow");
      openSidebar?.();
    },
    [openSidebar, setSidebarTab],
  );

  const backToToday = useCallback(() => setPicked(null), []);

  return {
    day: isWide && inRange && picked !== today ? picked : null,
    showDay,
    backToToday,
  };
}

/**
 * The rows the flow tab lists for `day`: every schedule item and todo chip on
 * it. Nothing here folds or caps, which is the point — the month cell drew two
 * of these and the button promised the rest.
 */
export function rowsOnDay<
  I extends { date: string },
  C extends { date: string },
>(
  items: readonly I[],
  chips: readonly C[],
  day: string,
): { items: I[]; chips: C[] } {
  return {
    items: items.filter((i) => i.date === day),
    chips: chips.filter((c) => c.date === day),
  };
}
