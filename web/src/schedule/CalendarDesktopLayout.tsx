import type { ReactNode } from "react";
import {
  CalendarLensRow,
  MonthGrid,
  ScheduleErrorCard,
  ScheduleLoadingCard,
  ScheduleToolbar,
  TOUR_ANCHORS,
  WeekTimeGrid,
  tourAnchor,
  useTranslation,
  type CalendarLensRowProps,
  type DesktopCalendarView,
  type MonthGridItem,
  type ScheduleLoadState,
  type WeekTimeGridHandlers,
  type WeekTimeGridItem,
} from "@life-editor/shared";
import type { ScheduleCopy } from "./scheduleCopy";

/*
 * The Calendar's Desktop main area (#889) — toolbar, calendar lens, the retry
 * banner slot, and the body that folds between loading / error / month grid /
 * week grid. Extracted from CalendarTab, where it was the whole `if (isWide)`
 * return plus the `desktopBody` const hoisted just above it.
 *
 * `sidebarPortal` and `overlaysEl` stay at the CALL SITE rather than moving in
 * here. Placement is the host's concern — the same line ScheduleSidebar.tsx
 * draws around <RightSidebarPortal> — and the overlays in particular are
 * mounted ONCE for both layouts on purpose: the two returns used to hand-list
 * their own and the lists drifted apart (see the ScheduleOverlays header for
 * what that cost). A layout that mounted its own set would hand that failure
 * mode straight back.
 *
 * A HOST component, not a shared one: it composes parts that already live in
 * `shared/src/components/schedule/` (ScheduleToolbar / CalendarLensRow /
 * MonthGrid / WeekTimeGrid / the two load-state cards) and resolves its own
 * copy with `useTranslation()`.
 * Pushing it into `shared/` would mean drilling the labels below through a
 * layer that adds nothing but the composition — the very shape #893 took out
 * of the parts underneath it. `web/src/schedule/` is also where #675 / #889
 * put every other piece pulled out of CalendarTab.
 *
 * Zero behaviour change (#889): every element, class string and conditional
 * below is the code that stood inline in CalendarTab.
 */

/** The toolbar row: period label, stepping, the view switcher and the filters. */
export interface CalendarDesktopToolbar {
  /** Already-formatted period label (the host owns the locale). */
  periodLabel: string;
  viewOptions: ScheduleCopy["desktopViewOptions"];
  /**
   * The static half of the toolbar's copy. The two repeat-filter strings are
   * interpolated below instead, next to the count they have to carry.
   */
  labels: ScheduleCopy["toolbarLabels"];
  /** Repeat-generated rows are currently folded out of the grid (#466). */
  repeatsHidden: boolean;
  /** How many rows that filter dropped — the button says the number out loud. */
  hiddenRepeats: number;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onChangeView: (id: string) => void;
  onToggleRepeats: () => void;
  /** Open the calendars modal (the settings gear). */
  onOpenSettings: () => void;
  onAddEvent: () => void;
}

/** #468 calendar lens — the single-select chip row under the toolbar. */
export interface CalendarDesktopLens {
  chips: CalendarLensRowProps["chips"];
  /** The calendar in effect, or null while the grid shows everything. */
  activeId: string | null;
  /** Rows this lens takes off the grid — its own count, not a running total. */
  hiddenCount: number;
  onChange: CalendarLensRowProps["onChange"];
}

/** Everything the two grids draw from. */
export interface CalendarDesktopData {
  /** The month the grid renders, and the single column of the "day" view. */
  anchorDate: string;
  /** First column of the "week" view. */
  weekStart: string;
  today: string;
  monthItems: MonthGridItem[];
  gridItems: WeekTimeGridItem[];
  selectedId: string | null;
  nowMinutes: number;
}

/** The copy both grids need already translated (§6.4). */
export interface CalendarDesktopLabels {
  /** Weekday names indexed 0 (Sun) - 6 (Sat) — both grids draw the same row. */
  weekdays: ScheduleCopy["weekdayLabels"];
  /** Derived-status copy (#222), for the week grid's blocks. */
  status: ScheduleCopy["statusLabels"];
}

/** Every gesture the two grids can raise. */
export interface CalendarDesktopHandlers {
  onItemActivate: (id: string, pos: { x: number; y: number }) => void;
  onItemDoubleClick: (id: string) => void;
  onItemContextMenu: (id: string, pos: { x: number; y: number }) => void;
  /**
   * A month cell was chosen. Desktop opens the creation panel on it (#224) —
   * deliberately NOT the narrow layout's "show me this day", which is why the
   * two layouts take different callbacks for what looks like one gesture.
   */
  onMonthCreate: (dateKey: string) => void;
  onCreateAt: NonNullable<WeekTimeGridHandlers["onCreateAt"]>;
  onMoveItem: NonNullable<WeekTimeGridHandlers["onMoveItem"]>;
  onResizeItem: NonNullable<WeekTimeGridHandlers["onResizeItem"]>;
  onDropAllDay: NonNullable<WeekTimeGridHandlers["onDropAllDay"]>;
}

/** Locale-dependent copy the host has to compute rather than hand over. */
export interface CalendarDesktopFormat {
  /** Month-cell accessible names — MonthGrid otherwise announces "2026-07-09". */
  fullDay: (dateKey: string) => string;
  /** The week grid's per-column date caption. */
  dayDate: (dateKey: string) => string;
}

export interface CalendarDesktopLayoutProps {
  /**
   * Which grid the body lands on. ONE prop rather than one per consumer: the
   * toolbar's switcher and the fold below have to agree, and two values free
   * to disagree is the bug a single source of the filter state avoids (#466).
   */
  view: DesktopCalendarView;
  toolbar: CalendarDesktopToolbar;
  lens: CalendarDesktopLens;
  /**
   * The #296 retry banner, or null. A node rather than a flag because the
   * condition behind it — a range fetch failed but there are still rows on
   * screen — is the host's reading of its own data (the reasoning is on
   * <ScheduleRangeErrorBanner>, shared/src/components/schedule).
   */
  banner: ReactNode;
  state: ScheduleLoadState;
  data: CalendarDesktopData;
  labels: CalendarDesktopLabels;
  handlers: CalendarDesktopHandlers;
  format: CalendarDesktopFormat;
}

export function CalendarDesktopLayout({
  view,
  toolbar,
  lens,
  banner,
  state,
  data,
  labels,
  handlers,
  format,
}: CalendarDesktopLayoutProps) {
  const { t } = useTranslation();

  /*
   * #889: the Desktop main area, hoisted out of the return so the layout
   * below reads as what it is — toolbar, lens, body. Same three states the
   * narrow branch shows, in the wrappers Desktop needs.
   *
   * The overlays that used to close that list stayed behind at the call site:
   * what is mounted ON TOP of the grid belongs to whoever places both layouts.
   */
  const desktopBody = state.loading ? (
    <ScheduleLoadingCard label={t("scheduleScreen.loading")} />
  ) : state.error ? (
    <ScheduleErrorCard
      labels={{
        message: t("scheduleScreen.loadError"),
        retry: t("scheduleScreen.retry"),
      }}
      onRetry={state.onRetry}
    />
  ) : view === "month" ? (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <MonthGrid
        monthKey={data.anchorDate}
        items={data.monthItems}
        todayKey={data.today}
        weekdayLabels={labels.weekdays}
        onSelectDay={handlers.onMonthCreate}
        onItemActivate={handlers.onItemActivate}
        onItemDoubleClick={handlers.onItemDoubleClick}
        onItemContextMenu={handlers.onItemContextMenu}
        formatMoreCount={(n) => t("scheduleScreen.moreCount", { count: n })}
        formatDayLabel={format.fullDay}
        ariaLabel={t("scheduleScreen.calendar")}
        className="h-full"
      />
    </div>
  ) : (
    // Item detail moved into a body-level overlay (#299), so the grid
    // takes the full width the editor <aside> used to share.
    <div className="min-h-0 flex-1">
      <WeekTimeGrid
        data={{
          weekStart: view === "day" ? data.anchorDate : data.weekStart,
          days: view === "day" ? 1 : 7,
          items: data.gridItems,
          selectedId: data.selectedId,
          todayKey: data.today,
          nowMinutes: data.nowMinutes,
        }}
        labels={{
          weekdays: labels.weekdays,
          allDay: t("scheduleScreen.allDay"),
          status: labels.status,
          createSlot: t("scheduleCalendar.createSlot"),
        }}
        handlers={{
          onItemActivate: handlers.onItemActivate,
          onItemDoubleClick: handlers.onItemDoubleClick,
          onItemContextMenu: handlers.onItemContextMenu,
          onCreateAt: handlers.onCreateAt,
          onMoveItem: handlers.onMoveItem,
          onResizeItem: handlers.onResizeItem,
          onDropAllDay: handlers.onDropAllDay,
        }}
        display={{ todoInteractive: true, fillHeight: true }}
        format={{ dayDate: format.dayDate }}
      />
    </div>
  );

  return (
    // #1124 tour anchor on the pane rather than on a grid cell: the step it
    // serves ("open what you just made and change its time") has to point at
    // something already on screen when it starts, and the created row is not
    // addressable by a fixed id. The narrow layout marks its month grid with
    // the same id — one of the two is mounted, never both.
    <div
      {...tourAnchor(TOUR_ANCHORS.scheduleCalendar)}
      className="flex min-h-0 flex-1 flex-col gap-3 px-lumen-gutter pb-4 pt-3 md:px-lumen-gutter-wide"
    >
      <ScheduleToolbar
        className="shrink-0 flex-wrap gap-y-2"
        periodLabel={toolbar.periodLabel}
        onToday={toolbar.onToday}
        onPrev={toolbar.onPrev}
        onNext={toolbar.onNext}
        view={view}
        viewOptions={toolbar.viewOptions}
        onChangeView={toolbar.onChangeView}
        onToggleRepeats={toolbar.onToggleRepeats}
        repeatsHidden={toolbar.repeatsHidden}
        onOpenSettings={toolbar.onOpenSettings}
        onAddEvent={toolbar.onAddEvent}
        addEventLabel={t("scheduleScreen.addEvent")}
        labels={{
          ...toolbar.labels,
          hideRepeats: t("scheduleScreen.repeatFilterHide"),
          // The count comes from the same call that dropped the rows
          // (applyRepeatFilter), so the button can never claim a different
          // number than the grid is missing.
          repeatsHidden: t("scheduleScreen.repeatFilterHidden", {
            count: toolbar.hiddenRepeats,
          }),
        }}
      />
      {/* #468 calendar lens — Desktop only. Its "why is this empty" rules
          (no chips ⇒ no row; the hidden count is the lens's own, not a
          running total) live in the component now (#889). */}
      <CalendarLensRow
        chips={lens.chips}
        activeId={lens.activeId}
        onChange={lens.onChange}
        labels={{
          filterLabel: t("scheduleScreen.calendarFilterLabel"),
          hidden: t("scheduleScreen.calendarFilterHidden", {
            count: lens.hiddenCount,
          }),
          showAll: t("scheduleScreen.calendarFilterShow"),
        }}
      />
      {banner}
      {desktopBody}
    </div>
  );
}
