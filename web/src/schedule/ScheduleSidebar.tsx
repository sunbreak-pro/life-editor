import {
  useTranslation,
  AddPill,
  AgendaList,
  RepeatListPanel,
  RoutineSummaryCard,
  ScheduleSidebarTabs,
  TodayTodoTray,
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
  doneCount: number;
  totalCount: number;
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
  routineDoneCount: number;
  routineTotalCount: number;
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

/** "本日の Todo" — the A-3 tray (#298). Desktop only. */
export interface ScheduleSidebarTodo {
  placed: TodayTodoRow[];
  unplaced: TodayTodoRow[];
  addable: TodayTodoAddableRow[];
  onToggleComplete: (id: string) => void;
  onAddCandidate: (id: string) => void;
  onOpenTodo: () => void;
  onDelete: (id: string) => void;
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

/**
 * Which tab actually renders. "todo" is Desktop-only (Mobile reaches the Todo
 * board through its own section tab, and "repeats" is unreachable from narrow
 * since #408 retired the Routines header tab). A resize can leave "todo"
 * selected with no tab to match it, which would draw the tray under a switcher
 * that shows nothing as active. Fold it back to the flow rather than resetting
 * the state — widening again returns the user to the tab they actually chose.
 */
function activeScheduleSidebarTab(
  tab: ScheduleSidebarTabId,
  isWide: boolean,
): ScheduleSidebarTabId {
  return !isWide && tab === "todo" ? "flow" : tab;
}

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
  const active = activeScheduleSidebarTab(tab, isWide);

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
        <p className="min-w-0 truncate text-xs text-lumen-text-secondary">
          {flow.todayLabel} ·{" "}
          {t("scheduleScreen.doneSummary", {
            done: flow.doneCount,
            total: flow.totalCount,
          })}
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
          completedCount={flow.routineDoneCount}
          totalCount={flow.routineTotalCount}
          summaryText={t("scheduleScreen.doneSummary", {
            done: flow.routineDoneCount,
            total: flow.routineTotalCount,
          })}
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
        <div className="flex flex-col gap-1.5 rounded-md border border-lumen-accent bg-lumen-accent-subtle px-3 py-2">
          <p className="text-xs text-lumen-text-secondary">
            {t("scheduleScreen.repeatFilterNotice")}
          </p>
          <button
            type="button"
            onClick={repeats.onShowHidden}
            className="self-start rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {t("scheduleScreen.repeatFilterShow")}
          </button>
        </div>
      )}
      <RepeatListPanel
        rows={repeats.rows}
        onOpen={repeats.onOpen}
        onDelete={isWide ? repeats.onDelete : undefined}
        labels={{
          empty: t("scheduleScreen.summaryEmpty"),
          never: t("scheduleScreen.repeatNeverFires"),
          delete: t("scheduleScreen.deleteRoutine"),
          confirmDelete: t("scheduleScreen.repeatDeleteConfirm"),
          confirm: t("scheduleScreen.delete"),
          cancel: t("scheduleScreen.scopeCancel"),
        }}
      />
    </div>
  );

  // A-3 (#298): "本日の Todo" tray — placed / unplaced todo groups + an add
  // picker. Desktop-only (it rides the tab switcher; Mobile shows only flow).
  // #555: rows also soft-delete (softDeleteTodo → Trash) and carry the same
  // <TagPicker> the todo detail uses, so tags attach without leaving the tray.
  const todoBody = (
    <TodayTodoTray
      placed={todo.placed}
      unplaced={todo.unplaced}
      addable={todo.addable}
      onToggleComplete={todo.onToggleComplete}
      onAddCandidate={todo.onAddCandidate}
      onOpenTodo={todo.onOpenTodo}
      onDelete={todo.onDelete}
      renderRowExtra={(row) => <TagPicker itemId={row.id} />}
      labels={{
        placedHeading: t("scheduleScreen.todoPlacedHeading"),
        unplacedHeading: t("scheduleScreen.todoUnplacedHeading"),
        emptyPlaced: t("scheduleScreen.todoEmptyPlaced"),
        emptyUnplaced: t("scheduleScreen.todoEmptyUnplaced"),
        addHeading: t("scheduleScreen.todoAddHeading"),
        addAction: t("scheduleScreen.todoAddAction"),
        emptyAddable: t("scheduleScreen.todoEmptyAddable"),
        complete: t("scheduleScreen.complete"),
        openInTodos: t("scheduleScreen.todoOpenInTodos"),
        delete: t("todoDetail.todoDelete"),
      }}
    />
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
