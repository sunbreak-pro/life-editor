import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import {
  useTranslation,
  cn,
  AddPill,
  AgendaList,
  NoticePanel,
  RepeatListPanel,
  ScheduleSidebarTabs,
  TodayTodoTray,
  TodoFilterPanel,
  TodoFocusCard,
  type TodoFilterPanelTag,
  type TodoFocusCardTodo,
  tourAnchor,
  useTourAction,
  TOUR_ACTIONS,
  TOUR_ANCHORS,
  type AgendaItem,
  type RepeatListRow,
  type ScheduleSidebarTab,
  type TodayTodoAddableRow,
  type TodayTodoRow,
} from "@life-editor/shared";
import { TagDotNames } from "../wikitag/TagDotNames";
import type { TodoTabFilter } from "./useTodoTabFilter";

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
 * The Todo tab's heading buttons on narrow: a 44px hit area around a small
 * button (#2010; the button lost its accent fill in #2568).
 *
 * #1832 floored the pill's BOX to 44px (`max-md:min-h-11`), which made each
 * heading row a 44px band around a small "+" label — the padding the user
 * reported. This is `TAP_TARGET_TALL` (shared styleTokens) behind `max-md:`:
 * the painted pill keeps its size and a transparent `::after` takes the tap
 * up to 44px, above and below only. That is safe here because nothing
 * tappable sits directly above or below a heading pill — the heading text
 * beside it is not a control, and the list starts a row further down.
 * Desktop keeps its mouse-sized target, as before.
 */
const HEADING_PILL_TAP =
  "max-md:relative max-md:after:absolute max-md:after:inset-x-0 max-md:after:top-1/2 max-md:after:h-11 max-md:after:-translate-y-1/2 max-md:after:content-['']";

/*
 * #2568: the heading's add action is quiet text (「＋ 本日分に追加」) rather
 * than the accent AddPill. Two filled pills stacked down one panel competed
 * with the rows for attention, and the prototype draws them as plain links.
 */
function HeadingAddButton({
  label,
  onClick,
  tourId,
}: {
  label: string;
  onClick: () => void;
  tourId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(tourId ? tourAnchor(tourId) : {})}
      className={cn(
        "inline-flex shrink-0 items-center rounded-lumen-md px-1.5 py-0.5 text-xs font-medium text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        HEADING_PILL_TAP,
      )}
    >
      {label}
    </button>
  );
}

/**
 * "今日の流れ" — the agenda and the skipped-item restore list. #2222 took the
 * routine summary ("マイルーチン") out: the 繰り返し tab beside it lists the
 * same routines in full.
 *
 * NOT ALWAYS TODAY SINCE #1148. Narrow's main area is the month grid alone
 * now, so this tab is where a tapped day is read — the host feeds it the
 * ANCHOR day's agenda and label on narrow, and today's on Desktop. The tab's
 * name is still 今日の流れ because on Desktop that is exactly what it is; on
 * narrow the heading row below names the day it is actually showing, which it
 * always did.
 *
 * #1973 once pointed the Desktop tab at the day a month cell's "他 N 件"
 * named, with a "back to today" button on the heading row. #2049 moved that
 * press to a panel beside the cell, and both went.
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
  /** #1678: the row was pressed — the host opens its panel at `pos`. */
  onOpen: (id: string, pos: { x: number; y: number }) => void;
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
  /** Make a todo with no day yet (#1153) — the "その他" heading's pill. */
  onAdd: () => void;
  /** Make a todo on today (#1640) — the "今日の Todo" heading's pill. */
  onAddToday: () => void;
  /** The tab's own filter (#1641) — the host owns the state, this draws it. */
  filter: TodoTabFilter;
  /** Every live tag, already sorted, for the filter panel's checkboxes. */
  filterTags: TodoFilterPanelTag[];
  /** The day the first list shows, and the row that moves it (#2281). */
  day: ScheduleSidebarTodoDay;
  /**
   * The todo a link pointed at (#2393), drawn above the lists because the tab's
   * own filter can hide its row, or null.
   */
  focus?: ScheduleSidebarTodoFocus | null;
}

/** The todo a link pointed at, and the two things its card can do (#2393). */
export interface ScheduleSidebarTodoFocus {
  todo: TodoFocusCardTodo;
  /** Open the full detail. */
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * The Todo tab's day (#2281) — its own, not the flow tab's. The host owns the
 * state (this body unmounts on a tab switch); this draws the ‹ day › / 今日
 * row and renames the first list after it.
 */
export interface ScheduleSidebarTodoDay {
  /** Already-formatted day for the stepper (the host owns the locale). */
  label: string;
  /**
   * The first list's heading on a day that is not today
   * (「10/21（火）の Todo」), or null on today — which is also how this
   * component knows the day IS today.
   */
  heading: string | null;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/**
 * The ‹ / › buttons on the Todo tab's day row (#2281): a 1.75rem box on
 * Desktop, a 44px box on a phone (rules/frontend.md §Gotchas — the floor is
 * per call site and narrow-only).
 *
 * #2568 outlines them. The border is painted on DAY_STEP_FACE inside rather
 * than on the button, for #2010's reason: on a phone the button grows to
 * 44px, and a border on THAT box would be a 44px frame around a small arrow.
 */
const DAY_STEP_BTN =
  "group/step flex size-7 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11";
const DAY_STEP_FACE =
  "flex size-7 items-center justify-center rounded-lumen-md border border-lumen-border-strong transition-colors group-hover/step:bg-lumen-hover";

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
            // #1832: the pill paints at 35px, which is a mouse size. The
            // floor is narrow-only and per call site (rules/frontend.md
            // §Gotchas) — AddPill's own recipe feeds Notes too.
            className="max-md:min-h-11"
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
                  // #1832: 25px tall on a phone. `max-md:min-h-11` only —
                  // the label is already wider than the floor, and Desktop
                  // keeps the small pill it was drawn as.
                  className="shrink-0 rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                >
                  {t("scheduleScreen.restoreSkipped")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  /*
   * #408: the repeat list that replaces the retired Routines header tab.
   *
   * #467 put it on Mobile too, viewing only (mobile-scope.md #5): tapping a row
   * still reaches that routine — that is the reachability this panel exists
   * for, and navigating is not editing. Since #2569 no row carries a delete at
   * either width: Desktop deletes from the row's panel, and narrow has none,
   * so a whole series never goes on a fingertip-sized target. `repeats.hidden` is Desktop-only
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
        labels={{
          empty: t("scheduleScreen.summaryEmpty"),
          never: t("scheduleScreen.repeatNeverFires"),
          next: (date: string) => t("scheduleScreen.repeatNext", { date }),
        }}
      />
    </div>
  );

  /*
   * A-3 (#298): the "本日の Todo" tray. #555: rows also soft-delete
   * (softDeleteTodo → Trash). #2408: a row reads its tags beside its time, at
   * both widths, and the tags are edited in the todo's panel.
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
  /*
   * #1641: the Todo tab's own filter. Kept here rather than in CalendarTab
   * because the rows arrive as props — narrowing them is a question about this
   * panel, and the calendar's own lens (useScheduleGridFilters) answers a
   * different one about the grid.
   */
  const [filterOpen, setFilterOpen] = useState(false);
  const { filter, filterTags, day } = todo;
  const isToday = day.heading == null;
  // The host hands over the rows unfiltered: which of them are on screen is
  // this panel's question, and the grid beside it asks a different one.
  const filtered = filter.apply({
    placed: todo.placed,
    unplaced: todo.unplaced,
    addable: todo.addable,
  });

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
      {todo.focus && (
        <TodoFocusCard
          todo={todo.focus.todo}
          onOpen={todo.focus.onOpen}
          onDismiss={todo.focus.onDismiss}
          labels={{
            heading: t("materials.todos.detailTitle"),
            open: t("scheduleScreen.todoOpenDetail"),
            dismiss: t("common.close"),
          }}
        />
      )}
      {/*
       * #2281: the first list's day, above the filter. ‹ and › step a day and
       * 今日 comes back; the day between them gives way (truncate) before the
       * buttons do at the panel's minimum width. 今日 is disabled while the
       * list is already on today, so the press it offers is never a no-op.
       *
       * #2568: the day says "· 今日" while it is today. The disabled 今日
       * button alone did not read as "you are on today" — it only greyed out.
       */}
      <div data-todo-day-row className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={t("scheduleScreen.todoDayPrev")}
          onClick={day.onPrev}
          className={DAY_STEP_BTN}
        >
          <span className={DAY_STEP_FACE}>
            <ChevronLeft aria-hidden className="size-3.5" />
          </span>
        </button>
        <span
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-center text-xs font-medium text-lumen-text"
        >
          {day.label}
          {isToday && (
            <span data-todo-day-today className="text-lumen-text-secondary">
              {" "}
              {t("scheduleScreen.todoDayTodayMark")}
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label={t("scheduleScreen.todoDayNext")}
          onClick={day.onNext}
          className={DAY_STEP_BTN}
        >
          <span className={DAY_STEP_FACE}>
            <ChevronRight aria-hidden className="size-3.5" />
          </span>
        </button>
        <button
          type="button"
          onClick={day.onToday}
          disabled={isToday}
          // #2477: `max-md:min-w-11` too — the word alone is 35px wide.
          className="flex h-7 shrink-0 items-center rounded-lumen-md border border-lumen-border-strong px-2 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover disabled:cursor-default disabled:text-lumen-text-secondary disabled:opacity-60 disabled:hover:bg-transparent max-md:min-h-11 max-md:min-w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          {t("scheduleScreen.today")}
        </button>
      </div>
      {/*
       * #1641: the filter button gets a row of its own at the top of the tab.
       * It used to share that row with the create pill — but #1640 moved the
       * single pill into the two list headings, one per list, so there is no
       * longer a pill up here to sit opposite. Putting one back would give the
       * tab two controls that do the same thing, and two DOM nodes carrying
       * the same tour anchor.
       *
       * The count on it is the number of things narrowing the list (a chosen
       * list counts as one, plus one per ticked tag) — the same reading the
       * calendar's badge carries (#1639).
       *
       * #2568: a full-width, left-aligned button with the word 絞り込み, and
       * the count after the word instead of over the icon's corner. The
       * accessible name starts with the visible word, so a voice command
       * saying 絞り込み hits it (label in name); the older todoFilterOpen
       * sentence ended in 絞り込む and did not contain it.
       */}
      <div data-todo-filter-row className="flex shrink-0 items-center">
        <button
          type="button"
          aria-label={
            filter.activeCount > 0
              ? t("scheduleScreen.todoFilterActive", {
                  count: filter.activeCount,
                })
              : t("scheduleScreen.todoFilterButtonName")
          }
          aria-expanded={filterOpen}
          aria-pressed={filter.activeCount > 0}
          onClick={() => setFilterOpen((open) => !open)}
          className={cn(
            // #2477: the day row's 44px floor (DAY_STEP_BTN) on a phone.
            "flex h-7 w-full items-center justify-start gap-1.5 rounded-lumen-md border px-2 text-xs font-medium transition-colors max-md:min-h-11 max-md:min-w-11",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            filter.activeCount > 0
              ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
              : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
          )}
        >
          <ListFilter aria-hidden className="size-3.5 shrink-0" />
          <span>{t("scheduleScreen.todoFilterButton")}</span>
          {filter.activeCount > 0 && (
            <span
              aria-hidden
              data-todo-filter-count={filter.activeCount}
              className="flex h-4 min-w-4 items-center justify-center rounded-full bg-lumen-accent px-1 text-[0.625rem] font-semibold leading-none text-lumen-on-accent tabular-nums"
            >
              {filter.activeCount}
            </span>
          )}
        </button>
      </div>
      {filterOpen && (
        <TodoFilterPanel
          scope={filter.scope}
          onScopeChange={filter.setScope}
          tags={filterTags}
          selectedTagIds={filter.tagIds}
          onToggleTag={filter.toggleTag}
          onClear={filter.clear}
          active={filter.activeCount > 0}
          labels={{
            panel: t("scheduleScreen.todoFilterPanel"),
            scopeHeading: t("scheduleScreen.todoFilterScopeHeading"),
            scopeBoth: t("scheduleScreen.todoFilterScopeBoth"),
            scopeToday: t("scheduleScreen.todoFilterScopeToday"),
            scopeOther: t("scheduleScreen.todoFilterScopeOther"),
            tagsHeading: t("scheduleScreen.todoFilterTagsHeading"),
            noTags: t("scheduleScreen.todoFilterNoTags"),
            clear: t("scheduleScreen.todoFilterClear"),
          }}
        />
      )}
      {/* Nothing left after filtering is not the same as having no todos, so
          it gets its own line and its own way back out (#1641). */}
      {filter.activeCount > 0 &&
        filtered.placed.length === 0 &&
        filtered.unplaced.length === 0 &&
        filtered.addable.length === 0 && (
          <div className="flex flex-col items-start gap-1 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-3">
            <p className="text-xs text-lumen-text-secondary">
              {t("scheduleScreen.todoFilterEmpty")}
            </p>
            <button
              type="button"
              onClick={filter.clear}
              className="text-xs font-medium text-lumen-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
            >
              {t("scheduleScreen.todoFilterClear")}
            </button>
          </div>
        )}
      <TodayTodoTray
        placed={filtered.placed}
        unplaced={filtered.unplaced}
        addable={filtered.addable}
        hideToday={!filter.showToday}
        hideOther={!filter.showOther}
        onToggleComplete={todo.onToggleComplete}
        onAddCandidate={todo.onAddCandidate}
        onMoveOut={todo.onMoveOut}
        onOpenTodo={todo.onOpenTodo}
        onOpenAddable={todo.onOpenAddable}
        onDelete={todo.onDelete}
        singleList
        hoverActions
        // #1627: the "その他" rows get today's checkbox and delete too, and on
        // Desktop they drag onto the week / month grid beside them. Narrow has
        // no grid next to the drawer, so the rows stay put there.
        addableControls
        draggableAddable={isWide}
        // #2408: the three icons on Desktop. Narrow leaves this off and keeps
        // the buttons it had: hover cannot reveal or explain anything on a phone.
        rowActions={
          isWide
            ? {
                edit: t("scheduleScreen.todoRowEdit"),
                moveOutHint: t("scheduleScreen.todoRowMoveToOthersHint"),
                moveToTodayHint: t("scheduleScreen.todoRowMoveToTodayHint"),
                editHint: t("scheduleScreen.todoRowEditHint"),
                deleteHint: t("scheduleScreen.todoRowDeleteHint"),
              }
            : undefined
        }
        metaLine
        // #2568: the "その他" rows read their tags too, on the same second
        // line as their date.
        renderRowExtra={(row) => <TagDotNames itemId={row.id} />}
        strongHeadings
        /*
         * #1640: an add action per heading, so each list is added to from
         * where it is read. The one over "その他" makes a todo with no day (what
         * the single pill above the tray did until now, tour anchor included —
         * the tour's create step still points at the control that MAKES one);
         * the one over "今日の Todo" makes it on today.
         */
        headingActions={{
          placed: (
            <HeadingAddButton
              onClick={todo.onAddToday}
              label={
                isToday
                  ? t("scheduleScreen.todoAddTodayLink")
                  : t("scheduleScreen.todoAddDayLink")
              }
            />
          ),
          addable: (
            <HeadingAddButton
              onClick={todo.onAdd}
              label={t("scheduleScreen.todoAddLink")}
              tourId={TOUR_ANCHORS.scheduleTodoAdd}
            />
          ),
        }}
        labels={{
          // #2281: the first list is named after the day it shows; off today
          // its empty line says "this day", directly under that heading.
          placedHeading: day.heading ?? t("scheduleScreen.todoTodayHeading"),
          emptyPlaced: isToday
            ? t("scheduleScreen.todoEmptyToday")
            : t("scheduleScreen.todoEmptyDay"),
          allDay: t("scheduleScreen.allDay"),
          addHeading: t("scheduleScreen.todoOthersHeading"),
          addAction: t("scheduleScreen.todoMoveToToday"),
          moveOut: t("scheduleScreen.todoMoveToOthers"),
          emptyAddable: t("scheduleScreen.todoEmptyOthers"),
          // #2571: one line when both lists are empty. Not while a filter is
          // narrowing — then the card above already says what happened, and
          // "no todos yet" would be false.
          emptyAll:
            filter.activeCount > 0
              ? undefined
              : t("scheduleScreen.todoEmptyAll"),
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
