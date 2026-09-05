import { useEffect } from "react";
import {
  useTranslation,
  AddPill,
  AgendaList,
  NoticePanel,
  RepeatListPanel,
  RoutineSummaryCard,
  ScheduleSidebarTabs,
  TodayTodoTray,
  tourAnchor,
  useTourAction,
  TOUR_ACTIONS,
  TOUR_ANCHORS,
  type AgendaItem,
  type RepeatListRow,
  type RoutineSummaryRow,
  type ScheduleSidebarTab,
  type TodayTodoAddableRow,
  type TodayTodoRow,
} from "@life-editor/shared";
import { TagPicker } from "../wikitag/TagPicker";

/*
 * The Schedule section's rightSidebar content — the three tabs behind
 * <ScheduleSidebarTabs> ("今日の流れ" / "本日の Todo" / "繰り返し"). Extracted
 * from CalendarTab by #889.
 *
 * The <RightSidebarPortal> stays at the CALL SITE rather than wrapping this.
 * Placement is the host's concern, and a portal renders null without the
 * shell's Provider — folding it in here would make every branch below
 * invisible to a test that does not stand up the whole shell.
 *
 * A HOST component, not a shared one: it composes parts that already live in
 * `shared/src/components/schedule/` and resolves its own copy with
 * `useTranslation()`. Pushing it into `shared/` would mean drilling ~25 label
 * strings through a layer that adds nothing but the composition — the very
 * shape #893 just took out of the parts underneath it. `web/src/schedule/`
 * is also where #675 put every other piece it pulled out of CalendarTab.
 *
 * Zero behaviour change (#889): every branch below, including the layout
 * folds, is the code that stood inline in CalendarTab.
 */

/**
 * "今日の流れ" — the agenda, the skipped-item restore list, and the routine
 * summary.
 *
 * NOT ALWAYS TODAY SINCE #1148. Narrow's main area is the month grid alone
 * now, so this tab is where a tapped day is read — the host feeds it the
 * ANCHOR day's agenda and label on narrow, and today's on Desktop, which is
 * unchanged. The tab's name is still 今日の流れ because on Desktop that is
 * exactly what it is; on narrow the heading row below names the day it is
 * actually showing, which it always did.
 */
export interface ScheduleSidebarFlow {
  /** Already-formatted heading day (the host owns the locale). */
  todayLabel: string;
  agenda: AgendaItem[];
  /** Shared AgendaList copy, built once by the host. */
  agendaLabels: React.ComponentProps<typeof AgendaList>["labels"];
  /**
   * Minutes-from-midnight for the now-line, or null when the day on show is
   * not today (#1148). A now-line on a day that is not today points at an
   * hour that has no meaning there, which is worse than no line at all.
   */
  nowMinutes: number | null;
  selectedId: string | null;
  /**
   * Dismissed occurrences for today — the #296 restore surface. Structural
   * rather than `ScheduleItem[]`: the row prints a title and, unless it is
   * all-day, a start time. `isAllDay` stays optional because that is how it
   * arrives on a ScheduleItem, and narrowing it here would only push a cast
   * onto the call site.
   */
  skipped: Array<{
    id: string;
    title: string;
    startTime: string;
    isAllDay?: boolean;
  }>;
  summaryRows: RoutineSummaryRow[];
  onToggleComplete: (id: string) => void;
  onItemActivate: (id: string, pos: { x: number; y: number }) => void;
  onItemDoubleClick: (id: string) => void;
  onRestoreSkipped: (id: string) => void;
  /**
   * Row-duration + free-gap rendering (#691). Narrow stands in for the week
   * grid, so its rows say how long they run and where the day is free;
   * Desktop's column stays one line tall and leaves both off. Arrived here
   * with the day list in #1148.
   */
  dayflow?: boolean;
  formatGapLabel?: (minutes: number) => string;
  /**
   * The create action, in the heading row (#1148 option A). Present on narrow
   * ONLY: this became the phone's single create route when the day list that
   * held #1034's pill was removed, while Desktop already has the toolbar
   * button and does not want a second one.
   */
  onAdd?: () => void;
  /** Already-translated label for that pill. */
  addLabel?: string;
}

/** "繰り返し" — the routine list that replaced the retired Routines header tab (#408). */
export interface ScheduleSidebarRepeats {
  /** The grid's repeat filter is on (#466) — show the notice that says so. */
  hidden: boolean;
  rows: RepeatListRow[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** Turn the grid's repeat filter back off, from the notice. */
  onShowHidden: () => void;
}

/**
 * "本日の Todo" — the A-3 tray (#298), and since #1153 the app's only todo
 * surface.
 *
 * It was Desktop-only and mostly a staging list: rows jumped to the Kanban tab
 * for anything real. That tab is retired, so the three things it was the route
 * to now live here — opening a todo, opening an UNSCHEDULED one, and making a
 * new one.
 */
export interface ScheduleSidebarTodo {
  placed: TodayTodoRow[];
  unplaced: TodayTodoRow[];
  addable: TodayTodoAddableRow[];
  onToggleComplete: (id: string) => void;
  onAddCandidate: (id: string) => void;
  /** "Take off today" on a today row (#1406) — the reverse of onAddCandidate. */
  onMoveOut: (id: string) => void;
  /** Open a PLACED row's detail. Took an id in #1153 — it used to be the
   *  zero-argument jump to the board. */
  onOpenTodo: (id: string) => void;
  /** Open an UNSCHEDULED row's detail (#1153). */
  onOpenAddable: (id: string) => void;
  onDelete: (id: string) => void;
  /** Make a todo with no day yet (#1153). */
  onAdd: () => void;
}

/**
 * The three tabs, as an id. Named since #1148 because a second file decides
 * which one to show (narrowDayTap forces "flow" on a day tap) and a re-declared
 * union in the caller would drift silently.
 */
export type ScheduleSidebarTabId = "flow" | "todo" | "repeats";

export interface ScheduleSidebarProps {
  isWide: boolean;
  tabs: ScheduleSidebarTab[];
  tab: ScheduleSidebarTabId;
  onTabChange: (tab: ScheduleSidebarTabId) => void;
  flow: ScheduleSidebarFlow;
  repeats: ScheduleSidebarRepeats;
  todo: ScheduleSidebarTodo;
}

/*
 * All three tabs render at both widths since #1153.
 *
 * "todo" used to be Desktop-only — Mobile reached the Todo board through the
 * section's own tab — so a resize could leave it selected with no tab to match,
 * and it was folded back to the flow. The board is gone and this tray is the
 * only todo surface there is, so withholding it from narrow would mean the
 * phone has none. The fold went with the reason for it.
 */

export function ScheduleSidebar({
  isWide,
  tabs,
  tab,
  onTabChange,
  flow,
  repeats,
  todo,
}: ScheduleSidebarProps) {
  const { t } = useTranslation();
  const active = tab;

  /*
   * #1124: tell the tour the todos are on screen. This component only exists
   * while the detail panel is showing it — RightSidebarPortal renders nothing
   * when the panel is closed — so "the todo tab is active here" is the same
   * fact the retired Kanban board reported on mount, and it covers every route
   * in (the switcher, the `nav:tasks` intent, the palette) without any of them
   * knowing about the tour.
   *
   * Reported from the sidebar rather than from CalendarTab on purpose: the tab
   * id is host state that survives the panel being closed, so a host-side
   * effect would announce a tray nobody can see and advance the step early.
   */
  const reportTourAction = useTourAction();
  useEffect(() => {
    if (active === "todo") reportTourAction(TOUR_ACTIONS.scheduleTodoTabOpened);
  }, [active, reportTourAction]);

  const flowBody = (
    <div className="flex flex-col gap-3">
      {/* No heading on either layout: the switcher above already reads
          "今日の流れ". It used to be Mobile-only, back when narrow had no
          tabs at all (#467 gave it the same switcher).

          #1148 put the create pill on this row rather than adding a second
          one: the day caption and the way to add to that day belong together,
          and the row is outside the scroller below — which is the whole of
          #1034's argument for a pill over a floating FAB, carried across from
          the day list that used to host it.

          #1124: the pill therefore carries the narrow half of the
          `scheduleAddEvent` tour anchor — it moved here with the create route
          itself. It cannot collide with the wide half on ScheduleToolbar: the
          pill renders only when `onAdd` is passed, which CalendarTab does only
          on narrow. */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        {/* #1440: the day alone. The "{done}/{total}" that followed it counted
            `completed` on events, which #1373 took away from events entirely
            — so it read "0 of N" on every day. Folded (Issue option C) rather
            than re-pointed at todos or at the clock, pending the product
            call. */}
        <p className="min-w-0 truncate text-xs text-lumen-text-secondary">
          {flow.todayLabel}
        </p>
        {flow.onAdd && flow.addLabel && (
          <AddPill
            onClick={flow.onAdd}
            label={flow.addLabel}
            tourId={TOUR_ANCHORS.scheduleAddEvent}
          />
        )}
      </div>
      <AgendaList
        items={flow.agenda}
        nowMinutes={flow.nowMinutes}
        onToggleComplete={flow.onToggleComplete}
        onItemActivate={flow.onItemActivate}
        onItemDoubleClick={flow.onItemDoubleClick}
        selectedId={flow.selectedId}
        dayflow={flow.dayflow}
        formatGapLabel={flow.formatGapLabel}
        labels={flow.agendaLabels}
      />
      {/* Restore surface for skipped (dismissed) items — #296. */}
      {flow.skipped.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-lumen-border bg-lumen-bg-secondary px-3 py-2">
          <h4 className="text-xs font-semibold text-lumen-text-secondary">
            {t("scheduleScreen.skippedTitle", {
              count: flow.skipped.length,
            })}
          </h4>
          <ul className="flex flex-col gap-1">
            {flow.skipped.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-lumen-text-secondary line-through">
                  {i.isAllDay ? i.title : `${i.startTime} ${i.title}`}
                </span>
                <button
                  type="button"
                  onClick={() => flow.onRestoreSkipped(i.id)}
                  className="shrink-0 rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                >
                  {t("scheduleScreen.restoreSkipped")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Routine-completion summary rides the flow tab (Desktop only — Mobile
          keeps its lean drawer). It used to live in the main-area <aside>,
          which #408 removed. */}
      {isWide && (
        <RoutineSummaryCard
          routines={flow.summaryRows}
          labels={{
            title: t("scheduleScreen.summaryTitle"),
            empty: t("scheduleScreen.summaryEmpty"),
            cta: t("scheduleScreen.openRoutinesCta"),
          }}
          onOpenRoutines={() => onTabChange("repeats")}
        />
      )}
    </div>
  );

  /*
   * #408: the repeat list that replaces the retired Routines header tab.
   *
   * #467 put it on Mobile too, viewing only (mobile-scope.md #5): tapping a row
   * still jumps the calendar to that routine's next occurrence — that is the
   * reachability this panel exists for, and navigating is not editing — but
   * `onDelete` is left off, so no row offers to take a whole series away on a
   * touch target the size of a fingertip. `repeats.hidden` is Desktop-only
   * state (narrow has no toggle), so the notice below never shows there.
   *
   * #466: while the grid filter is on, this list is the surface most likely to
   * be read as the truth about what is scheduled ("the routine is right here,
   * why is the calendar empty?"). Both the notice and the toolbar button read
   * the SAME `repeatsHidden` state, so there is no second flag to fall out of
   * step — and either one turns it back off.
   */
  const repeatsBody = (
    <div className="flex flex-col gap-2">
      {repeats.hidden && (
        // The one notice here that owns a next step, so it carries the
        // panel's `action` slot rather than a button of its own (#1184).
        <NoticePanel
          tone="info"
          message={t("scheduleScreen.repeatFilterNotice")}
          action={{
            label: t("scheduleScreen.repeatFilterShow"),
            onClick: repeats.onShowHidden,
          }}
        />
      )}
      <RepeatListPanel
        rows={repeats.rows}
        onOpen={repeats.onOpen}
        onDelete={isWide ? repeats.onDelete : undefined}
        labels={{
          empty: t("scheduleScreen.summaryEmpty"),
          never: t("scheduleScreen.repeatNeverFires"),
          delete: t("scheduleScreen.deleteRoutine"),
        }}
      />
    </div>
  );

  /*
   * A-3 (#298): the "本日の Todo" tray. #555: rows also soft-delete
   * (softDeleteTodo → Trash) and carry the same <TagPicker> the todo detail
   * uses, so tags attach without leaving the tray.
   *
   * #1406: TWO lists rather than the three groups #298 drew. "本日分の Todo"
   * is the old placed / unplaced pair merged (`singleList`, the shape Briefing
   * already used — a time-less row wears the all-day pill), and "その他の Todo"
   * is every open todo that is not on today. Each row's hover reveals the one
   * move that makes sense for it — off today, or onto it — and a row with a
   * time keeps it across the move (the host's write).
   *
   * #1153 put the create pill in a heading row ABOVE the tray rather than
   * inside a list: it makes a todo with no day, which lands in "その他" by
   * itself. Outside the scroller and not floating, for the reason
   * D-20260827-sched-1 gives.
   */
  const todoBody = (
    // #1124: the tour's "finish one of them" step points at the whole tray
    // rather than at one control, because completing has three routes (the row
    // checkbox, the detail's toggle, the detail's status row) and singling one
    // out would teach the other two as wrong. It pointed at the Kanban board
    // until #1153 retired it; this is the same argument on the surface that
    // replaced it.
    <div
      {...tourAnchor(TOUR_ANCHORS.scheduleTodoBoard)}
      className="flex flex-col gap-2"
    >
      <div className="flex shrink-0 items-center justify-end">
        <AddPill
          onClick={todo.onAdd}
          label={t("scheduleScreen.todoAddCta")}
          tourId={TOUR_ANCHORS.scheduleTodoAdd}
        />
      </div>
      <TodayTodoTray
        placed={todo.placed}
        unplaced={todo.unplaced}
        addable={todo.addable}
        onToggleComplete={todo.onToggleComplete}
        onAddCandidate={todo.onAddCandidate}
        onMoveOut={todo.onMoveOut}
        onOpenTodo={todo.onOpenTodo}
        onOpenAddable={todo.onOpenAddable}
        onDelete={todo.onDelete}
        singleList
        hoverActions
        renderRowExtra={(row) => <TagPicker itemId={row.id} />}
        labels={{
          placedHeading: t("scheduleScreen.todoTodayHeading"),
          emptyPlaced: t("scheduleScreen.todoEmptyToday"),
          allDay: t("scheduleScreen.allDay"),
          addHeading: t("scheduleScreen.todoOthersHeading"),
          addAction: t("scheduleScreen.todoMoveToToday"),
          moveOut: t("scheduleScreen.todoMoveToOthers"),
          emptyAddable: t("scheduleScreen.todoEmptyOthers"),
          // The tray's rows draw the same checkbox the paper does (#1368), so
          // they name themselves with the same status words rather than the
          // old "complete" — even here, where the press still writes the
          // `completed` flag (no onSetStatus).
          status: t("todoDetail.status"),
          statusLabels: {
            statusNotStarted: t("todoDetail.statusNotStarted"),
            statusDone: t("todoDetail.statusDone"),
          },
          // #1153: both open the same detail now — the label no longer
          // promises a trip to another surface.
          openInTodos: t("scheduleScreen.todoOpenDetail"),
          openAddable: t("scheduleScreen.todoOpenDetail"),
          delete: t("todoDetail.todoDelete"),
        }}
      />
    </div>
  );

  return (
    <ScheduleSidebarTabs
      tabs={tabs}
      value={active}
      onChange={(id) => onTabChange(id as ScheduleSidebarTabId)}
      label={t("scheduleScreen.detailPanelLabel")}
    >
      {active === "flow"
        ? flowBody
        : active === "todo"
          ? todoBody
          : repeatsBody}
    </ScheduleSidebarTabs>
  );
}
