import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  AddPill,
  AgendaList,
  MonthGrid,
  ScheduleErrorCard,
  ScheduleLoadingCard,
  useTranslation,
  type AgendaItem,
  type AgendaListLabels,
  type MonthGridItem,
  type ScheduleLoadState,
  type WeekStartsOn,
} from "@life-editor/shared";
import type { ScheduleCopy } from "./scheduleCopy";

/*
 * The Calendar's narrow (Mobile) main area, extracted from CalendarTab by
 * #889: the month heading + steppers row, the retry banner slot, the
 * loading / error fold, the compact month grid, and the picked day's list
 * underneath it.
 *
 * WHY narrow looks like this — the block that used to sit above the narrow
 * return, and the reason this file exists at all:
 *
 * One screen — the month grid, the picked day's list under it, and the FAB
 * (#878, ユーザー確定 2026-08-15). Still no switcher: narrow has one view, it
 * is just no longer the same view as the drawer beside it.
 *
 * #467 made this a bare day list, and #692 hung the month off the header on a
 * sheet. What that left was a main area showing a day list next to a drawer
 * showing a day list — the same UI answering the same question twice — while
 * the month, the one thing the drawer cannot show, was behind a tap. So the
 * two swapped places: the calendar is the main view, the day is what a cell
 * tap chooses, and the drawer keeps today's flow.
 *
 * The Timeline option does NOT come back with it: a 24-hour time grid on a
 * phone puts the whole day behind a scroll and turns every block into a drag
 * target too small to hit. And the month is `compact` here (day badge + dot
 * row), which is what makes 42 cells legible — the dots say WHERE something
 * is, the list under the grid says WHAT.
 *
 * The steppers now page by MONTHS (`effView` is "month" on narrow), so a
 * far-off day is two taps rather than the day-at-a-time walk #467 accepted.
 *
 * `sidebarPortal` and `overlaysEl` stay at the CALL SITE rather than moving in
 * here — placement is the host's concern, the same line ScheduleSidebar.tsx
 * draws around <RightSidebarPortal>, and the overlay set is mounted ONCE for
 * both layouts on purpose (the two returns used to hand-list their own and the
 * lists drifted apart; see the ScheduleOverlays header).
 *
 * A HOST component, not a shared one: it composes parts that already live in
 * `shared/src/components/schedule/` (MonthGrid / AgendaList / the two
 * load-state cards) plus the shared <AddPill>, and resolves its own copy with
 * `useTranslation()`. Pushing it
 * into `shared/` would mean drilling the handful of labels below through a
 * layer that adds nothing but the composition — the shape #893 took out of the
 * parts underneath it. `web/src/schedule/` is also where #675 / #889 put every
 * other piece pulled out of CalendarTab.
 *
 * Zero behaviour change (#889): every element, class string and conditional
 * below is the code that stood inline in CalendarTab's narrow return.
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
  weekStartsOn: WeekStartsOn;
  weekdayLabels: ScheduleCopy["weekdayLabels"];
  items: MonthGridItem[];
  /**
   * A cell was tapped. Narrow moves the anchor (`pickMonthDay`) and nothing
   * else — deliberately NOT the Desktop `handleMonthCreate` that opens the
   * creation panel (#224), which is why the two layouts take different
   * callbacks for what looks like one gesture.
   */
  onSelectDay: (dateKey: string) => void;
  formatDayLabel: (dateKey: string) => string;
}

/** The picked day's list under the grid — the half a dot cannot answer. */
export interface CalendarNarrowDay {
  /** Already-formatted caption for the picked day (#878 — no year: the
   *  heading above already names the month and the year). */
  anchorDayLabel: string;
  /**
   * The day's rows, schedule items and todo chips merged (#761). Built at the
   * call site so the Desktop branch, which returns before this component is
   * ever reached, does not pay for a list it never draws.
   */
  agenda: AgendaItem[];
  /** Now-line minutes, or null when the picked day is not today. */
  nowMinutes: number | null;
  selectedId: string | null;
  labels: AgendaListLabels;
  /** "空き 1時間" between two timed rows (#691). */
  formatGapLabel: (minutes: number) => string;
  /** The day-list header's create action (#1034 — this replaced the FAB). */
  onAdd: () => void;
  onToggleComplete: (id: string) => void;
  onItemActivate: (id: string, pos: { x: number; y: number }) => void;
  onItemDoubleClick: (id: string) => void;
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
  day: CalendarNarrowDay;
}

export function CalendarNarrowLayout({
  header,
  banner,
  state,
  month,
  day,
}: CalendarNarrowLayoutProps) {
  const { t } = useTranslation();

  return (
    /*
     * The narrow column. It used to be the FAB's anchor (#632) and carried
     * `relative` for that; #1034 moved creation into the day-list header, so
     * nothing is absolutely positioned in here any more. The inner div keeps
     * the gutter so the list still lines up.
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
             * #878: the month grid IS narrow's main view now.
             *
             * Consumption only, as it was on the sheet (#692): a cell hands
             * back its day and nothing else, so `onSelectDay` is
             * `pickMonthDay` and NOT the Desktop `handleMonthCreate` that
             * opens the creation panel (#224). Mobile keeps one way to make
             * things — the FAB.
             *
             * `compact` is what makes 42 cells legible on a phone (day badge
             * + a dot row rather than title chips), and no item handlers are
             * passed: the dots are a density cue and the day underneath stays
             * the tap target. What a dot IS is answered by the list below.
             */}
            <div className="shrink-0">
              <MonthGrid
                compact
                monthKey={month.anchorDate}
                items={month.items}
                todayKey={month.today}
                selectedKey={month.anchorDate}
                weekStartsOn={month.weekStartsOn}
                weekdayLabels={month.weekdayLabels}
                onSelectDay={month.onSelectDay}
                formatMoreCount={(n) =>
                  t("scheduleScreen.moreCount", { count: n })
                }
                formatDayLabel={month.formatDayLabel}
                ariaLabel={t("scheduleScreen.calendar")}
              />
            </div>
            {/*
             * The picked day, underneath — the half of the pair the grid
             * cannot answer (a dot says "something is here", not what). It
             * names its own day because the header above now names the MONTH:
             * without it, a list of times has nothing saying which day they
             * belong to.
             */}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              {/* #1034: creation lives here now, not in a floating "+".
                  The row is `shrink-0` and OUTSIDE the scroller below, so
                  the button stays put however long the day gets. The pill is
                  the same shared part as Materials' 「+ノート」. */}
              <div className="flex shrink-0 items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs text-lumen-text-secondary">
                  {day.anchorDayLabel}
                </p>
                <AddPill
                  onClick={day.onAdd}
                  label={t("scheduleScreen.addCta")}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pb-3">
                <AgendaList
                  items={day.agenda}
                  nowMinutes={day.nowMinutes}
                  onToggleComplete={day.onToggleComplete}
                  onItemActivate={day.onItemActivate}
                  onItemDoubleClick={day.onItemDoubleClick}
                  selectedId={day.selectedId}
                  /* #691: Mobile stands in for the week grid here, so the row
                   has to say how long it runs and where the day is free.
                   Desktop's sidebar column stays one line tall (no props). */
                  dayflow
                  formatGapLabel={day.formatGapLabel}
                  labels={day.labels}
                  className="rounded-md border border-lumen-border bg-lumen-bg px-2"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
