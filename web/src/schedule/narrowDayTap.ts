import type { ScheduleSidebarTabId } from "./ScheduleSidebar";

/*
 * What a narrow month-cell tap does (#1148).
 *
 * Three lines, in their own file, for the reason D-20260812-refactor-2 allows
 * one: CalendarTab needs the full Provider chain plus real layout to mount, so
 * no web test renders it (rules/frontend.md §テスト環境の制約). This is the
 * Issue's headline gesture — "tap a day, see that day" — and leaving it inside
 * the host would put the whole of it out of reach of every gate we can afford
 * to run. Everything it needs arrives as an argument, so it renders nowhere and
 * tests everywhere.
 *
 * Narrow only. Desktop's cells run `handleMonthCreate` (#224) instead, and its
 * sidebar is a push-in panel that is already on screen — there would be nothing
 * for `open` to do.
 */

export interface NarrowDayTap {
  /** Move the calendar's anchor. `pickMonthDay` from useCalendarNav. */
  pickDay: (dateKey: string) => void;
  /** The drawer's tab state. */
  setSidebarTab: (tab: ScheduleSidebarTabId) => void;
  /**
   * Open the drawer. OPTIONAL for the same reason the host reads
   * `useRightSidebarOptional`: a section body has to survive being rendered
   * without the shell's Provider (standalone renders / tests), and outside it
   * there is simply no drawer to open.
   */
  openSidebar?: () => void;
}

/**
 * Move the anchor to `dateKey` and put that day's plans on screen.
 *
 * The tab is forced to "flow" rather than left as the user last had it. The
 * gesture promises one specific answer — what is on this day — and the drawer
 * remembers its tab, so without this a tap made while 繰り返し was selected
 * opens a routine list and reads as the tap having done nothing.
 */
export function selectNarrowDay(deps: NarrowDayTap, dateKey: string): void {
  deps.pickDay(dateKey);
  deps.setSidebarTab("flow");
  deps.openSidebar?.();
}
