import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MonthGrid,
  ScheduleErrorCard,
  ScheduleLoadingCard,
  TOUR_ANCHORS,
  tourAnchor,
  useTranslation,
  type MonthGridItem,
  type ScheduleLoadState,
} from "@life-editor/shared";
import type { ScheduleCopy } from "./scheduleCopy";

/*
 * The Calendar's narrow (Mobile) main area, extracted from CalendarTab by
 * #889: the month heading + steppers row, the retry banner slot, the
 * loading / error fold, and the compact month grid.
 *
 * WHY narrow looks like this — and what it looked like BEFORE, because #1148
 * reversed a ruling and a reader who finds only the new answer will not know
 * what was already tried:
 *
 * #878 (2026-08-15) put the month grid and the picked day's LIST on one
 * screen, on the reading that the dots say WHERE something is and the list
 * says WHAT. That reading still holds. What did not hold is the arithmetic:
 * the drawer beside it shows a day list too, so the phone carried two lists of
 * the same shape, and the month — the one thing only this view can show — got
 * whatever was left of the screen.
 *
 * #1148 (2026-08-27, ユーザー確定) settles it the other way. The main area is
 * the MONTH and nothing else; tapping a day opens the drawer on that day. The
 * pair survives — dots for where, a list for what — but the list is the
 * drawer's, which means one list in the app instead of two and a full-height
 * grid instead of a third of one.
 *
 * What that costs, said plainly: reading a day is a tap and a drawer rather
 * than a glance. That is the trade the ruling accepts.
 *
 * The Timeline option does NOT come back with it: a 24-hour time grid on a
 * phone puts the whole day behind a scroll and turns every block into a drag
 * target too small to hit. And the month is `compact` here (day badge + dot
 * row), which is what makes 42 cells legible.
 *
 * The steppers page by MONTHS (`effView` is "month" on narrow), so a far-off
 * day is two taps rather than the day-at-a-time walk #467 accepted.
 *
 * CREATION left with the list. #1034 had put the "+" pill in the day list's
 * header (retiring #632's floating FAB) on the argument that a create button
 * belongs in a heading outside the scroller rather than floating over content.
 * That header is gone, so the pill moved to the drawer's heading row — same
 * argument, new host (#1148 option A), and still not a FAB.
 *
 * `sidebarPortal` and `overlaysEl` stay at the CALL SITE rather than moving in
 * here — placement is the host's concern, the same line ScheduleSidebar.tsx
 * draws around <RightSidebarPortal>, and the overlay set is mounted ONCE for
 * both layouts on purpose (the two returns used to hand-list their own and the
 * lists drifted apart; see the ScheduleOverlays header).
 *
 * A HOST component, not a shared one: it composes parts that already live in
 * `shared/src/components/schedule/` (MonthGrid + the two load-state cards) and
 * resolves its own copy with `useTranslation()`. Pushing it into `shared/`
 * would mean drilling the handful of labels below through a layer that adds
 * nothing but the composition — the shape #893 took out of the parts
 * underneath it. `web/src/schedule/` is also where #675 / #889 put every other
 * piece pulled out of CalendarTab.
 */

const ICON_BTN =
  "flex size-8 items-center justify-center rounded-lumen-md border border-lumen-border-strong text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

/** The month heading and the three controls beside it. */
export interface CalendarNarrowHeader {
  /** Already-formatted month label (the host owns the locale). */
  periodLabel: string;
  /** Page back / forward — by MONTHS on narrow, see the note above. */
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** The compact month grid — narrow's main view since #878. */
export interface CalendarNarrowMonth {
  /** The month rendered, and the cell marked as picked (they are one day). */
  anchorDate: string;
  today: string;
  weekdayLabels: ScheduleCopy["weekdayLabels"];
  items: MonthGridItem[];
  /**
   * A cell was tapped. Narrow moves the anchor AND opens the drawer on that
   * day (#1148) — deliberately NOT the Desktop `handleMonthCreate` that opens
   * the creation panel (#224), which is why the two layouts take different
   * callbacks for what looks like one gesture. Both halves live at the call
   * site: this component knows nothing about the sidebar.
   */
  onSelectDay: (dateKey: string) => void;
  formatDayLabel: (dateKey: string) => string;
}

export interface CalendarNarrowLayoutProps {
  header: CalendarNarrowHeader;
  /**
   * The #296 retry banner, or null. A node rather than a flag because the
   * condition behind it — a range fetch failed but there are still rows on
   * screen — is the host's reading of its own data (the reasoning is on
   * <ScheduleRangeErrorBanner>, shared/src/components/schedule).
   */
  banner: ReactNode;
  state: ScheduleLoadState;
  month: CalendarNarrowMonth;
}

export function CalendarNarrowLayout({
  header,
  banner,
  state,
  month,
}: CalendarNarrowLayoutProps) {
  const { t } = useTranslation();

  return (
    /*
     * The narrow column. It used to be the FAB's anchor (#632) and carried
     * `relative` for that; creation left this file entirely with #1148, so
     * nothing is absolutely positioned in here any more. The inner div keeps
     * the gutter so the grid lines up with the heading above it.
     */
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-lumen-gutter pt-3">
        {/* #1033: no hamburger here any more — the shell draws the one
            hamburger at the left edge of the tab band, where every other
            narrow section has always had it. */}
        <div className="flex shrink-0 items-center gap-2">
          {/* #878: the month the grid below is showing. It is a heading
              again, not a control — #692's chevron opened the month on a
              sheet, and with the month AS the main view there is nothing
              left for a tap to reveal. */}
          {/* px-1 went with the hamburger (#1033): the heading is the
              row's first item now, so it lines up with px-lumen-gutter and
              the month grid below it. */}
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-lumen-text">
            {header.periodLabel}
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={t("scheduleScreen.prev")}
              onClick={header.onPrev}
              className={ICON_BTN}
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t("scheduleScreen.next")}
              onClick={header.onNext}
              className={ICON_BTN}
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={header.onToday}
            className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {t("scheduleScreen.today")}
          </button>
        </div>
        {banner}
        {state.loading ? (
          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            <ScheduleLoadingCard label={t("scheduleScreen.loading")} />
          </div>
        ) : state.error ? (
          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            <ScheduleErrorCard
              labels={{
                message: t("scheduleScreen.loadError"),
                retry: t("scheduleScreen.retry"),
              }}
              onRetry={state.onRetry}
            />
          </div>
        ) : (
          <>
            {/*
             * #878: the month grid IS narrow's main view. Since #1148 it is
             * also the ONLY thing in the main area, so it takes the height the
             * day list used to hold rather than sitting in a `shrink-0` band
             * above it. `auto-rows-fr` inside MonthGrid spreads that over the
             * six week rows, which is what turns the freed space into taller
             * cells instead of a gap under the grid.
             *
             * The wrapper scrolls rather than the grid clipping: cells carry a
             * `min-h-14` floor, so six rows plus the weekday header need about
             * 360px. Portrait phones clear that easily; a short landscape
             * window does not, and a clipped final week would hide the end of
             * the month without saying so.
             *
             * Consumption only, as it was on the sheet (#692): a cell hands
             * back its day and nothing else, so `onSelectDay` is the host's
             * "move the anchor, open the drawer" and NOT the Desktop
             * `handleMonthCreate` that opens the creation panel (#224).
             *
             * `compact` is what makes 42 cells legible on a phone (day badge +
             * a dot row rather than title chips), and no item handlers are
             * passed: the dots are a density cue and the day underneath stays
             * the tap target. What a dot IS is answered by the drawer.
             */}
            {/* #1124: the narrow half of the `scheduleCalendar` anchor — the
                grid is where a created event is found again on this width. */}
            <div
              {...tourAnchor(TOUR_ANCHORS.scheduleCalendar)}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3"
            >
              <MonthGrid
                compact
                className="flex-1"
                monthKey={month.anchorDate}
                items={month.items}
                todayKey={month.today}
                selectedKey={month.anchorDate}
                weekdayLabels={month.weekdayLabels}
                onSelectDay={month.onSelectDay}
                formatMoreCount={(n) =>
                  t("scheduleScreen.moreCount", { count: n })
                }
                formatDayLabel={month.formatDayLabel}
                ariaLabel={t("scheduleScreen.calendar")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
