import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useScheduleItemsContext,
  useRoutineContext,
  useSyncDomains,
  useTaskTreeContext,
  useCalendarContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  useMediaQuery,
  useRightSidebarOptional,
  WeekTimeGrid,
  MonthGrid,
  AgendaList,
  TodayTodoTray,
  ScheduleToolbar,
  EventEditorPane,
  RoutineSummaryCard,
  RepeatListPanel,
  RightSidebarPortal,
  RightSidebarToggle,
  ScheduleSidebarTabs,
  RepeatScopeDialog,
  QuickCaptureSheet,
  ItemCreatePanel,
  ItemActionPopover,
  ItemDetailOverlay,
  TaskDetailPanel,
  STATUS_TEXT_KEY,
  StatusFilterChips,
  BottomSheet,
  Modal,
  useScheduleItemsRoutineSync,
  useDeferredAction,
  useInFlightGuard,
  useToast,
  eventToTodoBlock,
  todoToEventBlock,
  taskToEventPlacement,
  ItemConversionError,
  logServiceError,
  minutesToTime,
  timedSpanForAllDayOff,
  deriveScheduleStatus,
  tasksToCalendarChips,
  taskChipId,
  isTaskChip,
  unwrapTaskChipId,
  pickAddableTasks,
  buildWeekdayLabels,
  frequencyLabel,
  nextRoutineOccurrence,
  itemVariant,
  applyRepeatFilter,
  applyCalendarLens,
  buildCalendarMemberIds,
  pickSelectableCalendars,
  nowMinutesLocal,
  sortDayItems,
  todayCalendarKey,
  type FrequencyLabelCopy,
  type TaskCalendarChip,
  type TodayTodoRow,
  type ScheduleStatus,
  type ScheduleItem,
  type ItemCreateNoteDraft,
  type WeekTimeGridItem,
  type MonthGridItem,
  type AgendaItem,
  type EventEditorItem,
  type FrequencyEditorValue,
  type RoutineSummaryRow,
  type RepeatListRow,
  type SegmentedOption,
  type StatusFilterChip,
  type DataService,
  MobileFab,
} from "@life-editor/shared";
import { CalendarView } from "./CalendarView";
import { TagPicker } from "../wikitag/TagPicker";
import { TagColorControls } from "../wikitag/TagColorControls";
import { useCreatePanelNotes } from "./useCreatePanelNotes";
import { useCalendarNav } from "./useCalendarNav";
import { useVisibleRangeItems } from "./useVisibleRangeItems";
import { useScheduleMutations } from "./useScheduleMutations";
import { todoDeleteCascade } from "./todoTrayDeleteGuard";
import {
  timedPlacement,
  taskChipMoveWrite,
  taskChipResizeWrite,
  taskChipAllDayWrite,
  todoAddCandidateWrite,
  placeTaskWrite,
} from "./taskChipUndoWiring";
import { answersChipClick, taskChipPanelModel } from "./taskChipPanel";

/*
 * Calendar tab (target-IA host). Assembles the shared presentational parts
 * (ScheduleToolbar / WeekTimeGrid / MonthGrid / AgendaList / EventEditorPane /
 * RoutineSummaryCard) into the day/week/month calendar, the "今日の流れ"
 * rightSidebar (RightSidebarPortal), and the Mobile list|time|month single
 * screen with a FAB + Quick-capture sheet.
 *
 * Data flows ONLY through useScheduleItemsContext (§3.1). The provider is
 * anchored on today (MainScreen injects no `date`), so context.items backs the
 * "今日の流れ" panel + the routine-completion summary, while the calendar grid
 * reads its own visible range via loadDateRange and patches it optimistically
 * (mirrors the pre-target ScheduleCalendarView). i18n is resolved here and
 * injected into the pure parts (§6.4).
 */

const ICON_BTN =
  "flex size-8 items-center justify-center rounded-lumen-md border border-lumen-border-strong text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
// Default duration (minutes) prefilled when creating from an empty-slot click.
const CREATE_DURATION_MIN = 60;
/*
 * How long the single-click bubble waits for a possible double-click (#355).
 *
 * Only the bubble waits — selection is applied immediately either way — so the
 * cost of a longer window is small, while too short a one leaves the original
 * bug in place: Windows counts anything under 500ms as a double-click, and at
 * 200ms every slower-than-brisk double-click still flashed. 350ms covers the
 * bulk of that range without the click feeling unanswered (the selection ring
 * lands at once). Above ~400ms the wait starts to read as lag.
 */
const POPOVER_DELAY_MS = 350;

/*
 * What each repeat-write failure says (#434 → #469 → #504). A table rather
 * than a nested ternary: the reasons only ever grow, and each new one has to
 * be given words deliberately — a chain quietly files the newcomer under
 * whatever sits in the final `else`, which is how a "nothing was saved" case
 * ends up telling the user their change went through.
 */
const REPEAT_FAILURE_COPY_KEY: Record<
  "attach" | "materialise" | "update" | "series" | "series-partial",
  string
> = {
  attach: "scheduleScreen.repeatConvertFailed",
  materialise: "scheduleScreen.repeatMaterialiseFailed",
  update: "scheduleScreen.repeatUpdateFailed",
  series: "scheduleScreen.repeatSeriesUpdateFailed",
  // Deliberately NOT the same words as `series`: that one promises nothing
  // changed, and this one cannot — the rhythm from here on is already the new
  // one.
  "series-partial": "scheduleScreen.repeatSeriesPartialFailed",
};

export function CalendarTab({
  dataService,
  onOpenTasks,
  pendingSelectEvent,
  onConsumePendingEvent,
}: {
  dataService: DataService;
  /** Jump to the Tasks section (Today's Todo tray title click — A-3 / #298). */
  onOpenTasks: () => void;
  /**
   * "Open this event" intent from the command palette (#503) — the same
   * pending-select idiom Notes / Daily / Kanban consume, plus the date: the
   * grid shows one window at a time, so an id alone would select a row that is
   * not on screen.
   */
  pendingSelectEvent?: { id: string; date: string } | null;
  /** Called once the intent has been acted on, so re-entry does not re-select. */
  onConsumePendingEvent?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isWide = useMediaQuery("(min-width: 768px)", true);
  const {
    items: contextItems,
    isLoading,
    error,
    loadDateRange,
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    dismiss,
    undismiss,
    deleteScheduleItem,
    registerViewMirror,
  } = useScheduleItemsContext();
  const {
    routines,
    convertEventToRoutine,
    updateRoutine,
    deleteRoutine,
    detachRoutine,
    updateFutureOccurrences,
  } = useRoutineContext();
  // Realtime change cursor: rows written outside the visible-range store
  // (the always-on generator, undo, another device) refetch the range when
  // this bumps (#296 — pre-fix they stayed invisible until navigation).
  const syncVersion = useSyncDomains("schedule", "calendars");
  // Range materialiser (#279): after an Event→Repeats conversion, the new
  // routine's occurrences are generated for the visible range right away —
  // the always-on RoutineScheduleSync only covers today.
  // reconcile (#352): a frequency edit re-shapes the already-materialised
  // future of ONE routine (drop days that stopped firing, add days that
  // started), honouring the tier-1 §Schedule conflict rules.
  const { ensureRoutineItemsForDateRange, reconcileRoutineScheduleItems } =
    useScheduleItemsRoutineSync({
      dataService,
    });
  // Scheduled TaskNodes → task=blue chips (schedule redesign A-1). `nodes`
  // already excludes soft-deleted tasks (useTaskTreeAPI). A-2 (#297) writes
  // scheduledAt back via updateNode on grid drag/resize.
  // addNode (#376): the creation panel's task tab writes a NEW TaskNode that is
  // already scheduled into the target slot — the same provider the tray and the
  // chip drags write through, so there is no second source of task truth.
  // refetch (#625): the Event <-> Todo conversion writes through the
  // DataService, not through this provider's own persist path, so the tree
  // in memory would keep showing the pre-conversion shape until Realtime got
  // around to it. The conversion asks for the truth directly.
  const {
    nodes: taskNodes,
    addNode,
    updateNode,
    setTaskStatus,
    toggleTaskStatus,
    softDelete: softDeleteTask,
    refetch: refetchTasks,
  } = useTaskTreeContext();
  // #468: the calendar ledger as a filter lens. A `calendars` row is a saved
  // view over ONE life tag, so the grid needs both halves — the ledger (which
  // calendars exist, and which tag each points at) and the assignments (which
  // items carry that tag). Both are already bulk-loaded on this branch
  // (MainScreen mounts CalendarProvider + WikiTagsUnifiedProvider around the
  // Schedule tree), so this adds no fetch.
  const { calendars } = useCalendarContext();
  const { allTags, allAssignments } = useWikiTagsUnifiedContext();

  // Navigation + visible fetch window (#280 → useCalendarNav).
  const {
    today,
    anchorDate,
    setAnchorDate,
    setView,
    desktopView,
    effView,
    weekStartsOn,
    weekStart,
    weekEnd,
    rangeStart,
    rangeEnd,
    step,
    goToday,
  } = useCalendarNav(isWide);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Which rightSidebar tab is showing ("今日の流れ" / "本日の Todo" — the A-3
  // tray, #298). The old "詳細" tab was removed in #299 (item detail now lives
  // in a body-level overlay, not the rightSidebar).
  // #408 added "repeats" — with the Routines header tab retired this is the
  // only route to a routine whose occurrences are not in the visible range.
  // #467 gave Mobile the same drawer minus "todo" (the Todo board is its own
  // section tab there), so the value is normalised per layout at render.
  const [sidebarTab, setSidebarTab] = useState<"flow" | "todo" | "repeats">(
    "flow",
  );
  // #467: jumping to a repeat's next occurrence has to put the calendar on
  // screen, and on Mobile the list that was tapped is a drawer sitting over it.
  // The OPTIONAL hook, for the same reason RightSidebarPortal uses it: a
  // section body has to survive being rendered without the shell's Provider
  // (standalone renders / tests). Outside it there is no drawer to close.
  const closeSidebar = useRightSidebarOptional()?.close;
  // #466 Step 5-b: fold repeat-generated occurrences out of the GRID so the
  // gaps left between one-off events are visible. Deliberately NOT persisted
  // (see the decision in the Issue): a filter restored at startup shows a
  // calendar missing its scaffolding, and the next event gets booked into a
  // slot that only looks free. It resets with the section, and while it is on
  // the toolbar button and the Repeats tab both say so.
  const [repeatsHidden, setRepeatsHidden] = useState(false);
  // #468: which calendar the grid is looking through, or null for all of them.
  // Not persisted, for the same reason as the repeat filter above: a lens
  // restored at startup shows a calendar that is missing most of the day, and
  // the next event gets booked into a slot that only looks free. Independent
  // of `repeatsHidden` — the two compose as an AND and neither resets the
  // other.
  const [calendarFilterId, setCalendarFilterId] = useState<string | null>(null);
  // #299 single-click bubble popover: anchor id + viewport coords (Desktop).
  const [popover, setPopover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  // #299 detail-edit overlay open flag (Desktop; Mobile keeps the BottomSheet).
  const [overlayOpen, setOverlayOpen] = useState(false);
  // #626: task-chip detail overlay — the UNWRAPPED TaskNode id behind an open
  // task detail, or null. Separate from selectedId/overlayOpen because those
  // resolve schedule_items and a chip has none.
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  // #299 event-creation panel: the target day + prefilled start/end. null =
  // closed. Desktop shows it in an ItemDetailOverlay-style modal; Mobile in the
  // QuickCaptureSheet. Replaces the old eager-create + Mobile `quickOpen`.
  const [createPanel, setCreatePanel] = useState<{
    date: string;
    start: string;
    end: string;
  } | null>(null);
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(() => nowMinutesLocal());
  // Real "now" Date, ticked alongside nowMinutes. Drives deriveScheduleStatus
  // (#222) — nowMinutes alone (minutes-from-midnight) can't compare across days.
  const [now, setNow] = useState(() => new Date());

  /*
   * #520: the grid's two filters, dropped together whenever the user is being
   * TAKEN to a specific row.
   *
   * Both of them hide by row, and either one alone reproduces the whole bug:
   * #466 folds away everything a repeat generated, #468 keeps only what
   * carries one calendar's tag. Land on a row that either filter excludes and
   * the day changes with nothing on it — the same "the button did nothing"
   * shape as #434 S-1.
   *
   * Cleared unconditionally rather than only when the arriving row would in
   * fact be hidden, because at that moment there is nothing to test: the
   * palette hands over an id + a date, and the row is still being fetched (the
   * anchor move is what starts the fetch). `fetchEvents` feeds that palette
   * every live schedule item, repeat-generated occurrences included, so both
   * filters are live suspects every time.
   *
   * This is the navigation counterpart of finishCreatePanel(), which reveals a
   * row that was just CREATED and so touches only the lens — a brand-new event
   * is never repeat-generated, and the repeat filter cannot be what is hiding
   * it. Two junctions, one per intent: the next route that reveals a row joins
   * one of them instead of re-opening the hole #506 closed for creation.
   */
  const revealOnGrid = useCallback(() => {
    setRepeatsHidden(false);
    setCalendarFilterId(null);
  }, []);

  /*
   * Palette "open this event" intent (#503). Three moves, in this order: clear
   * whatever is filtering the grid (#520), put the event's day in the window,
   * then select it. The row itself may not be in `rangeItems` for another
   * moment — the anchor change triggers the fetch and nothing pre-loads
   * outside the window — but selection is by id, so it simply starts showing
   * once the range lands.
   *
   * Consumed immediately (like pendingNewTask), so coming back to the Calendar
   * later does not re-select an event the user has moved on from. #467 retired
   * the Mobile month agenda and the separate `mobileSelectedDay` it read, so
   * the anchor is now the only day either layout draws from — moving it is the
   * whole job.
   */
  useEffect(() => {
    if (!pendingSelectEvent) return;
    // Local setStates, which the cascading-render rule flags — the reveal
    // included, since it sees through the callback. ONE directive because the
    // rule reports only the first such call in an effect; put it above
    // whichever line comes first, or the directive itself goes unused (a
    // warning) and the real report moves.
    //
    // They fire once per arrival — a user navigating from the palette, not a
    // render loop — and the intent exists only as a PROP, so there is no event
    // handler inside this component to move them into. Same shape and same
    // reasoning as the task handoff (useTaskDetailTarget.ts:112).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    revealOnGrid();
    setAnchorDate(pendingSelectEvent.date);
    setSelectedId(pendingSelectEvent.id);
    onConsumePendingEvent?.();
  }, [pendingSelectEvent, setAnchorDate, onConsumePendingEvent, revealOnGrid]);

  // 1-minute now ticker (drives the now-line + agenda divider). Cleared on
  // unmount so it never leaks across section changes.
  useEffect(() => {
    const id = setInterval(() => {
      setNowMinutes(nowMinutesLocal());
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // #355: the bubble popover is deferred so a double-click can claim the
  // gesture before it appears. Cancelled on unmount by the hook.
  const { defer: deferPopover, cancel: cancelPopover } =
    useDeferredAction(POPOVER_DELAY_MS);

  // #376 note tab: the picker's pool + the "create the note, then link it"
  // write. Loaded only while the creation panel is open (see the hook).
  // The link lands after the panel has closed, so a failure has to be said out
  // loud — there is nothing left on screen to show it.
  const { showToast } = useToast();
  const handleAttachError = useCallback(
    () => showToast("danger", t("scheduleScreen.noteAttachFailed")),
    [showToast, t],
  );
  // #434: an Event→Repeats conversion that did not fully land. Without this
  // the editor just snaps back on the reload, which reads as the click having
  // been ignored. "materialise" is a partial success — the repeat is on, so
  // saying "couldn't turn on repeat" there would be a lie.
  // "update" (#469 小粒) is a THIRD outcome: the repeat was already on and
  // stays on — only the new rhythm failed to save — so neither of the other
  // two sentences fits.
  const handleRepeatConvertError = useCallback(
    (
      reason: "attach" | "materialise" | "update" | "series" | "series-partial",
    ) => showToast("danger", t(REPEAT_FAILURE_COPY_KEY[reason])),
    [showToast, t],
  );
  const {
    notes: noteOptions,
    notesError,
    attachNote,
  } = useCreatePanelNotes({
    dataService,
    active: !!createPanel,
    onAttachError: handleAttachError,
  });

  // Selection = highlight only (#299). The grid ring follows selectedId; the
  // duplicate handler re-selects the copy. Bubble / overlay opening is handled
  // by the activate/open-detail handlers below.
  const handleSelectItem = useCallback((id: string) => {
    // A chip id is not a ScheduleItem id, and this path exists to point the
    // schedule-item surfaces (editor pane / mutation layer) at a row. Task
    // chips DO answer a click since #564 — through handleItemActivate, which
    // opens their own panel — so this guard is about the id's shape, not about
    // chips being read-only.
    if (isTaskChip(id)) return;
    setSelectedId(id);
  }, []);

  // #299 single-click: open the bubble popover next to the item (Desktop). On
  // Mobile a single tap opens the BottomSheet editor directly (selectedId →
  // editorPane → sheet), matching the existing lean-drawer flow.
  //
  // #355: the bubble is held back for a beat. A double-click fires `click` on
  // its first press and only announces itself afterwards, so opening the
  // bubble straight away made it flash open and shut on every double-click.
  // Selection stays immediate — it is the part that should feel instant, and
  // the detail surface wants it anyway.
  //
  // #564: task chips come through here too. They used to be dropped on the
  // spot (the A-1 "read-only display" rule), which by now was only true of the
  // click — #297/#298/#569 had made the same chip draggable, so the all-day
  // lane ended up with chips that answered a drag but not a click. They open
  // the same bubble with the task action set (see taskChipPanel.ts).
  //
  // On NARROW they keep the old no-op, selection included — see
  // answersChipClick for why.
  const handleItemActivate = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      if (!answersChipClick(id, isWide)) return;
      setSelectedId(id);
      if (isWide) deferPopover(() => setPopover({ id, x: pos.x, y: pos.y }));
    },
    [isWide, deferPopover],
  );

  // #299 "詳細を編集" (bubble) / double-click: open the detail-edit surface —
  // the body-level overlay on Desktop, the BottomSheet on Mobile (selectedId
  // drives it). Closes any open bubble; one still waiting to appear is dropped
  // by the "another surface opened" effect below (#355).
  //
  // #564: a task chip's detail is not this overlay — EventEditorPane edits a
  // schedule_item, and a task has none. #626 gives the chip its own in-place
  // surface on Desktop (TaskDetailPanel in an ItemDetailOverlay), so tags are
  // editable without leaving Schedule; narrow keeps the #564 Tasks hand-off
  // (its stand-in surface, the task BottomSheet, is still a follow-up).
  const handleItemOpenDetail = useCallback(
    (id: string) => {
      setPopover(null);
      if (isTaskChip(id)) {
        if (isWide) setTaskDetailId(unwrapTaskChipId(id));
        else onOpenTasks();
        return;
      }
      setSelectedId(id);
      if (isWide) setOverlayOpen(true);
    },
    [isWide, onOpenTasks],
  );

  // #299 open the creation panel prefilled for a target day + time window.
  const openCreatePanel = useCallback(
    (date: string, start: string, end: string) => {
      setPopover(null);
      setCreatePanel({ date, start, end });
    },
    [],
  );
  // Toolbar "Add event" / Mobile FAB → default 09:00–10:00 on the anchor day.
  const handleToolbarAdd = useCallback(
    () => openCreatePanel(anchorDate, "09:00", "10:00"),
    [openCreatePanel, anchorDate],
  );
  // Empty-slot click (week/day grid) → prefill from the clicked slot time.
  const handleGridCreateAt = useCallback(
    (dateISO: string, minutes: number) =>
      openCreatePanel(
        dateISO,
        minutesToTime(minutes),
        minutesToTime(minutes + CREATE_DURATION_MIN),
      ),
    [openCreatePanel],
  );
  // Month-cell day click (Desktop) → default 09:00–10:00 on that day.
  const handleMonthCreate = useCallback(
    (day: string) => openCreatePanel(day, "09:00", "10:00"),
    [openCreatePanel],
  );

  /*
   * A-2 (#297) / #562 / #569: the task-chip writes.
   *
   * What each gesture writes — the patch AND whether it lands on the undo stack
   * — lives in taskChipUndoWiring.ts, not here. Inside this component those
   * decisions cannot be tested: the calendar needs the whole Provider stack to
   * render and the grid needs real layout, which jsdom does not have, so
   * deleting a label or swapping place ↔ move went unnoticed by all seven gates
   * (#569 QA). As plain functions they are pinned in
   * web/tests/taskChipUndoWiring.test.ts.
   *
   * These handlers keep what is actually the host's: unwrapping the synthetic
   * chip id, finding the task, and calling updateNode (which is optimistic — the
   * chip re-derives at its new position with no manual patch, closing Schedule
   * AC10).
   */
  const handleTaskChipMove = useCallback(
    (chipId: string, dateISO: string, startISO: string, endISO: string) => {
      const taskId = unwrapTaskChipId(chipId);
      const { patch, options } = taskChipMoveWrite(
        taskNodes.find((n) => n.id === taskId),
        dateISO,
        startISO,
        endISO,
      );
      updateNode(taskId, patch, options);
    },
    [taskNodes, updateNode],
  );

  const handleTaskChipResize = useCallback(
    (chipId: string, endISO: string) => {
      const taskId = unwrapTaskChipId(chipId);
      // null = the task has no usable start, so there is no day to anchor the
      // new end to (see taskChipResizeWrite).
      const write = taskChipResizeWrite(
        taskNodes.find((n) => n.id === taskId),
        endISO,
      );
      if (!write) return;
      updateNode(taskId, write.patch, write.options);
    },
    [taskNodes, updateNode],
  );

  const handleTaskChipDropAllDay = useCallback(
    (chipId: string, dateISO: string) => {
      const { patch, options } = taskChipAllDayWrite(dateISO);
      updateNode(unwrapTaskChipId(chipId), patch, options);
    },
    [updateNode],
  );

  // A-3 (#298) Today's Todo tray. Completion routes to the TaskTree status API
  // (the tray owns no completion state of its own); a plain binary toggle, not
  // the 3-state cycle (NOT_STARTED ↔ DONE).
  const handleTodoToggleComplete = useCallback(
    (taskId: string) => {
      const task = taskNodes.find((n) => n.id === taskId);
      setTaskStatus(taskId, task?.status === "DONE" ? "NOT_STARTED" : "DONE");
    },
    [taskNodes, setTaskStatus],
  );

  // "Add to today" (案 c staging — the write itself is in
  // taskChipUndoWiring.ts). #569 made it undoable: it is a single button press
  // with no gesture to reverse it, and the tray's "add from tasks" list drops
  // the task the moment it is added, so a mis-tap left the user hunting for the
  // row in the unplaced group to put it back by hand.
  const handleTodoAddCandidate = useCallback(
    (taskId: string) => {
      const { patch, options } = todoAddCandidateWrite(today);
      updateNode(taskId, patch, options);
    },
    [today, updateNode],
  );

  // Visible-range optimistic store (#280 → useVisibleRangeItems): edits patch
  // rangeItems optimistically; navigation, reload(), retry and Realtime
  // (syncVersion) refetch.
  const {
    rangeItems,
    setRangeItems,
    patchRange,
    viewMirror,
    reload,
    rangeError,
  } = useVisibleRangeItems({
    loadDateRange,
    rangeStart,
    rangeEnd,
    refreshKey: syncVersion,
  });

  // #568: hand the provider a handle on this store. Undo/redo commands are
  // pushed inside the provider, which is anchored on today alone — so before
  // this, an edit on any other day pushed nothing at all, and the commands
  // that did get pushed rolled back a list the grid never reads (the "元に
  // 戻しました" toast with the event still sitting where it was). Both stable
  // identities, so this registers once per mount.
  useEffect(
    () => registerViewMirror(viewMirror),
    [registerViewMirror, viewMirror],
  );

  // The selected ScheduleItem — resolved before the mutation layer, which
  // acts on the selection (repeat conversion / detach / scope dialog).
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      rangeItems.find((i) => i.id === selectedId) ??
      contextItems.find((i) => i.id === selectedId) ??
      null
    );
  }, [selectedId, rangeItems, contextItems]);

  // Mutation layer (#280 → useScheduleMutations): every write path plus the
  // #279 repeat/scope machinery (#299 retired the #278 pending-draft guard).
  const {
    scopeRequest,
    closeScopeRequest,
    handleScopeChoose,
    handleUpdate,
    handleToggle,
    handleCreate,
    handleMoveItem,
    handleResizeItem,
    handleDropAllDay,
    handleDismiss,
    handleDelete,
    handleRename,
    handleDuplicate,
    handleChangeRepeat,
    handleDetachRepeat,
    repeatConverting,
  } = useScheduleMutations({
    rangeItems,
    setRangeItems,
    patchRange,
    reload,
    contextItems,
    rangeStart,
    rangeEnd,
    today,
    selected,
    setSelectedId,
    onSelectItem: handleSelectItem,
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    dismiss,
    deleteScheduleItem,
    routines,
    convertEventToRoutine,
    updateRoutine,
    deleteRoutine,
    detachRoutine,
    updateFutureOccurrences,
    ensureRoutineItemsForDateRange,
    reconcileRoutineScheduleItems,
    onMoveTaskChip: handleTaskChipMove,
    onResizeTaskChip: handleTaskChipResize,
    onDropTaskChipAllDay: handleTaskChipDropAllDay,
    onRepeatConvertFailed: handleRepeatConvertError,
    copySuffix: t("scheduleScreen.copySuffix"),
  });

  // #355: whenever ANY other surface opens, drop a bubble still waiting its
  // turn — it would otherwise surface on top of that surface a moment later.
  // One effect rather than a cancel sprinkled through each opener: the openers
  // are spread across this file and the mutation layer, and the next one added
  // would silently miss it. Cancelling twice is harmless (the hook no-ops when
  // nothing is pending).
  useEffect(() => {
    if (
      overlayOpen ||
      createPanel ||
      calendarsOpen ||
      scopeRequest ||
      taskDetailId != null
    ) {
      cancelPopover();
    }
  }, [
    overlayOpen,
    createPanel,
    calendarsOpen,
    scopeRequest,
    taskDetailId,
    cancelPopover,
  ]);

  // #468: every panel path that actually PUTS something on the grid closes
  // through here, and clearing the lens is the point. A brand-new row carries
  // no tag, so while a calendar lens is on it is filtered out the instant it
  // exists — no block on the grid, no toast, and any selection made below
  // points at something nobody can see. The add button reads as broken.
  // Showing the thing that was just created is what the click asked for;
  // auto-filing it into the active calendar would be a write the user never
  // asked for.
  //
  // Placing an EXISTING task gets the same treatment: it only survives the lens
  // if it already carries that calendar's tag, so otherwise it disappears from
  // the very slot it was just dropped into.
  //
  // Cancelling the panel deliberately does NOT come through here (those call
  // sites keep the bare setCreatePanel(null)): nothing new is on the grid to
  // reveal, so the lens the user set stays where they put it.
  const finishCreatePanel = useCallback(() => {
    setCreatePanel(null);
    setCalendarFilterId(null);
  }, []);

  // #299 create-panel submit: the panel carries the target day; the fields hand
  // over the trimmed title + times. Reuses the mutation layer's single create.
  //
  // #354: the new row's id was previously dropped on the floor, so nothing on
  // screen pointed at what had just been created and the memo / repeat fields
  // (which live in the detail editor, not this panel) were unreachable without
  // hunting for the item on the grid. The panel now offers both intents.
  const handleCreateSubmit = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      if (!createPanel) return;
      // #376: the note rides along with the create, but only once the row is
      // really there — `wiki_tag_connections` carries an FK to `items_meta`,
      // and the id handleCreate returns is the optimistic one (see the
      // ORDERING note in useCreatePanelNotes).
      const id = handleCreate(createPanel.date, title, start, end, (saved) => {
        if (saved) attachNote(saved.id, note);
        else if (note) handleAttachError();
      });
      finishCreatePanel();
      // Desktop: select without opening anything — a quiet "here it is" that
      // does not interrupt blocking out the next slot. It shows as a ring on
      // the week/day grid (WeekTimeGrid) and a highlight in the sidebar
      // agenda; MonthGrid takes no selectedId, so month-cell creation gets no
      // marker (matching the pre-#354 behaviour there).
      // Mobile deliberately selects NOTHING: there, selection IS the detail
      // sheet (`editorPane` derives from it), so selecting would silently turn
      // the plain create into the other button.
      if (isWide) setSelectedId(id);
    },
    [
      createPanel,
      handleCreate,
      attachNote,
      handleAttachError,
      isWide,
      finishCreatePanel,
    ],
  );

  // #354 secondary action: create, then land in the detail editor.
  const handleCreateSubmitAndOpen = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      if (!createPanel) return;
      const id = handleCreate(createPanel.date, title, start, end, (saved) => {
        if (saved) attachNote(saved.id, note);
        else if (note) handleAttachError();
      });
      // Clears the lens too: the overlay hides the grid at first, but closing
      // it would otherwise drop the user back on a grid that does not draw the
      // row their selection still points at.
      finishCreatePanel();
      setSelectedId(id);
      // Desktop opens the body-level overlay; on Mobile the selection alone
      // brings up the BottomSheet editor (the same path a tap takes).
      if (isWide) setOverlayOpen(true);
    },
    [
      createPanel,
      handleCreate,
      attachNote,
      handleAttachError,
      isWide,
      finishCreatePanel,
    ],
  );

  // #376 task tab — the timed counterpart of the #298 tray. The tray stages a
  // task as "today, time TBD" (all-day); this panel commits it to a concrete
  // day + window, which is what makes it show up as a placed block rather than
  // an all-day candidate (the shape itself: taskChipUndoWiring.timedPlacement).
  const scheduleTaskAt = useCallback(
    (start: string, end: string) => {
      if (!createPanel) return null;
      return timedPlacement(createPanel.date, start, end);
    },
    [createPanel],
  );

  const handleCreateTaskSubmit = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      const placement = scheduleTaskAt(start, end);
      if (!placement) return;
      // Root-level task (parentId null), matching every other "quick create"
      // entry — the panel carries no place-in-the-tree control, and the Tasks
      // section is where re-parenting belongs.
      addNode("task", null, title, {
        ...placement,
        // Same ordering rule as the event path: the node is optimistic until
        // the tree sync lands, and the guard in useTaskTreeAPI can drop the
        // write entirely (tree not loaded), which reports `null` here.
        onSaved: (saved) => {
          if (saved) attachNote(saved.id, note);
          else if (note) handleAttachError();
        },
      });
      finishCreatePanel();
    },
    [scheduleTaskAt, addNode, attachNote, handleAttachError, finishCreatePanel],
  );

  const handlePlaceTaskSubmit = useCallback(
    (
      taskId: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      if (!createPanel) return;
      // Undoable only when no note rides along (#569): a note attaches a
      // separate link row this panel has no un-write for, and an undo that
      // moved the task back while leaving the note on it would be a half
      // reversal the toast claims was whole. See placeTaskWrite.
      const { patch, options } = placeTaskWrite(
        createPanel.date,
        start,
        end,
        note != null,
      );
      updateNode(taskId, patch, options);
      // No onSaved wait here, unlike the create paths: this task was picked
      // out of a pool that came from the DB, so its `items_meta` row is
      // already there and the link's FK is satisfied right now.
      attachNote(taskId, note);
      finishCreatePanel();
    },
    [createPanel, updateNode, attachNote, finishCreatePanel],
  );

  // ── Context menu (rename / duplicate / delete: handlers in the mutation
  // layer; only the menu position state lives here) ──────────────────────────

  // #551: right-click opens the SAME bubble as a left-click — one panel for
  // both gestures (the separate ScheduleItemContextMenu is retired). No #355
  // deferral here: a contextmenu gesture is never the first half of a
  // double-click, so the bubble can appear at once; cancelling a deferred
  // left-click bubble keeps it from resurfacing elsewhere a beat later. On
  // narrow the selection alone opens the BottomSheet editor, same as a tap.
  const handleItemContextMenu = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      // Same narrow guard as handleItemActivate.
      if (!answersChipClick(id, isWide)) return;
      cancelPopover();
      setSelectedId(id);
      if (isWide) setPopover({ id, x: pos.x, y: pos.y });
    },
    [isWide, cancelPopover],
  );

  // ── Derived data ─────────────────────────────────────────────────────────

  const weekdayLabels = useMemo(() => buildWeekdayLabels(t), [t]);
  const freqCopy = useMemo<FrequencyLabelCopy>(
    () => ({
      daily: t("scheduleScreen.frequencyDaily"),
      weekdaysFallback: t("scheduleScreen.frequencyWeekdays"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
    }),
    [t],
  );

  const mdFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: "numeric",
        day: "numeric",
      }),
    [i18n.language],
  );
  const formatDayDate = useCallback(
    (key: string) => {
      const [y, m, d] = key.split("-").map(Number);
      return mdFmt.format(new Date(y, m - 1, d));
    },
    [mdFmt],
  );

  const periodLabel = useMemo(() => {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const dObj = new Date(y, m - 1, d);
    if (effView === "month") {
      return new Intl.DateTimeFormat(i18n.language, {
        year: "numeric",
        month: "long",
      }).format(dObj);
    }
    if (isWide && effView === "week") {
      return `${formatDayDate(weekStart)} – ${formatDayDate(weekEnd)}`;
    }
    return new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(dObj);
  }, [
    anchorDate,
    effView,
    isWide,
    i18n.language,
    formatDayDate,
    weekStart,
    weekEnd,
  ]);

  // #353: the creation panel is reachable from three gestures (toolbar /
  // empty slot / month cell) and each carries its own target day, but only
  // the times were visible — "which day am I adding to?" had no answer on
  // screen. The year is included: the panel can be open on a day the user
  // navigated months away to.
  const createDateLabel = useMemo(() => {
    if (!createPanel) return undefined;
    const [y, m, d] = createPanel.date.split("-").map(Number);
    return new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date(y, m - 1, d));
  }, [createPanel, i18n.language]);

  const todayLabel = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return new Intl.DateTimeFormat(i18n.language, {
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date(y, m - 1, d));
  }, [today, i18n.language]);

  // Month-cell accessible names (MonthGrid falls back to the raw ISO key —
  // a screen reader would announce "2026-07-09").
  const fullDayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: "long",
        day: "numeric",
        weekday: "short",
      }),
    [i18n.language],
  );
  const formatFullDay = useCallback(
    (key: string) => {
      const [y, m, d] = key.split("-").map(Number);
      return fullDayFmt.format(new Date(y, m - 1, d));
    },
    [fullDayFmt],
  );

  const desktopViewOptions: SegmentedOption[] = [
    { id: "day", label: t("scheduleScreen.viewDay") },
    { id: "week", label: t("scheduleScreen.viewWeek") },
    { id: "month", label: t("scheduleScreen.viewMonth") },
  ];

  const toolbarLabels = {
    today: t("scheduleScreen.today"),
    prev: t("scheduleScreen.prev"),
    next: t("scheduleScreen.next"),
    openSettings: t("scheduleScreen.openSettings"),
    view: t("scheduleScreen.viewLabel"),
  };

  // Scheduled-task chips (schedule redesign A-1). `rangeTaskChips` is the
  // unfiltered visible range — the grid + month draw `gridTaskChips`, its
  // post-lens narrowing (#468). `todayTaskChips` backs the "今日の流れ" flow,
  // which always shows today regardless of the grid's visible range AND stays
  // outside the lens: the sidebar is where a hidden row is still reachable.
  // Task chips are merged only at this derived (map) layer — never into
  // `rangeItems` (the optimistic ScheduleItem mutation store).
  const scheduledTasks = useMemo(
    () => taskNodes.filter((n) => n.scheduledAt != null),
    [taskNodes],
  );
  const rangeTaskChips = useMemo(
    () => tasksToCalendarChips(scheduledTasks, rangeStart, rangeEnd),
    [scheduledTasks, rangeStart, rangeEnd],
  );
  const todayTaskChips = useMemo(
    () => tasksToCalendarChips(scheduledTasks, today, today),
    [scheduledTasks, today],
  );

  // A-3 (#298) Today's Todo tray groups. Reuse today's chips: a time = placed,
  // all-day = an unplaced candidate (案 c staging). "Add from tasks" offers the
  // incomplete, unscheduled leaves (pickAddableTasks).
  const todoPlaced = useMemo<TodayTodoRow[]>(
    () =>
      todayTaskChips
        .filter((c) => !c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          timeLabel: c.startTime,
          completed: c.completed,
        })),
    [todayTaskChips],
  );
  const todoUnplaced = useMemo<TodayTodoRow[]>(
    () =>
      todayTaskChips
        .filter((c) => c.isAllDay)
        .map((c) => ({ id: c.id, title: c.title, completed: c.completed })),
    [todayTaskChips],
  );
  const todoAddable = useMemo(() => pickAddableTasks(taskNodes), [taskNodes]);

  // #466: the grid's view of the range. The filter is applied HERE and nowhere
  // upstream — `rangeItems` stays the whole truth for `selected`, the mutation
  // layer and the context menu, so hiding a row never changes what an edit
  // writes and a hidden item stays editable from the flow tab. `hiddenRepeats`
  // rides along from the same call, so the toolbar's count cannot disagree
  // with what the grid actually dropped.
  const { visible: repeatFilteredItems, hiddenCount: hiddenRepeats } = useMemo(
    () => applyRepeatFilter(rangeItems, repeatsHidden),
    [rangeItems, repeatsHidden],
  );

  // #468: the calendar lens, applied AFTER the repeat filter. Serial order
  // matters for the counts, not the contents — running it second means a row
  // the repeat filter already took away is not counted a second time here, so
  // "N hidden" on the chip row never overshoots the rows actually missing.
  //
  // Only calendars whose tag still exists can be chosen — see
  // pickSelectableCalendars for why a dangling one is never offered. The ledger
  // modal shows those as invalid with delete as the only action (CalendarView).
  const activeTagIds = useMemo(
    () => new Set(allTags.map((tag) => tag.id)),
    [allTags],
  );
  const selectableCalendars = useMemo(
    () => pickSelectableCalendars(calendars, activeTagIds),
    [calendars, activeTagIds],
  );
  // Resolving the selection through the SELECTABLE list is what makes a tag
  // deleted mid-session degrade to "no filter" instead of an empty grid with
  // no lit chip to turn off.
  const activeCalendar = useMemo(
    () => selectableCalendars.find((c) => c.id === calendarFilterId) ?? null,
    [selectableCalendars, calendarFilterId],
  );
  // THE single application point of the lens, and the only place `isWide` gates
  // it. The chip row that turns the lens off renders in the Desktop branch
  // only, so a window narrowed below 768px while a calendar is picked would
  // otherwise leave the grid filtered with nothing on screen able to clear it.
  // Gating the membership set (rather than each consumer) means every layer
  // below — grid rows, task chips, chip counts — un-narrows together.
  const calendarMemberIds = useMemo(
    () =>
      isWide && activeCalendar
        ? buildCalendarMemberIds(allAssignments, activeCalendar.tagId)
        : null,
    [isWide, activeCalendar, allAssignments],
  );
  // Both grid layers go through the lens together. Narrowing only the schedule
  // rows would hide the other calendars' events while every task chip stayed
  // put — tasks carry the same life-tags (KanbanView) and a chip's id IS the
  // task's items_meta.id, so the same membership set applies unchanged.
  // `hiddenByCalendar` is the total across both, so the "N hidden" line counts
  // the task chips it actually took away.
  const {
    events: gridRangeItems,
    taskChips: gridTaskChips,
    hiddenCount: hiddenByCalendar,
  } = useMemo(
    () =>
      applyCalendarLens(repeatFilteredItems, rangeTaskChips, calendarMemberIds),
    [repeatFilteredItems, rangeTaskChips, calendarMemberIds],
  );

  // Chip row data. The count comes out of the SAME call the grid uses, over the
  // same post-repeat lists, so the number on a chip is exactly what clicking it
  // leaves on screen — including the task chips.
  const calendarChips = useMemo<StatusFilterChip[]>(
    () =>
      selectableCalendars.map((c) => ({
        id: c.id,
        label: c.title,
        count: applyCalendarLens(
          repeatFilteredItems,
          rangeTaskChips,
          buildCalendarMemberIds(allAssignments, c.tagId),
        ).visibleCount,
      })),
    [selectableCalendars, repeatFilteredItems, rangeTaskChips, allAssignments],
  );

  const gridItems = useMemo<WeekTimeGridItem[]>(
    () => [
      ...gridRangeItems.map((i) => ({
        id: i.id,
        date: i.date,
        title: i.title,
        startTime: i.startTime,
        endTime: i.endTime,
        isAllDay: i.isAllDay,
        completed: i.completed,
        status: deriveScheduleStatus(i, now),
        variant: itemVariant(i),
      })),
      ...gridTaskChips.map((c) => ({
        id: taskChipId(c.id),
        date: c.date,
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        isAllDay: c.isAllDay,
        completed: c.completed,
        variant: "task" as const,
      })),
    ],
    [gridRangeItems, now, gridTaskChips],
  );
  const monthItems = useMemo<MonthGridItem[]>(
    () => [
      ...gridRangeItems.map((i) => ({
        id: i.id,
        date: i.date,
        title: i.title,
        variant: itemVariant(i),
        completed: i.completed,
        isAllDay: i.isAllDay,
      })),
      ...gridTaskChips.map((c) => ({
        id: taskChipId(c.id),
        date: c.date,
        title: c.title,
        variant: "task" as const,
        completed: c.completed,
        isAllDay: c.isAllDay,
      })),
    ],
    [gridRangeItems, gridTaskChips],
  );

  // Merge schedule items + task chips into a single sorted agenda. Task rows
  // carry no derived status, so AgendaList renders no toggle tag for them —
  // completion for scheduled tasks lands in Step 3 (TaskTree API).
  const toAgenda = useCallback(
    (arr: ScheduleItem[], chips: TaskCalendarChip[] = []): AgendaItem[] => {
      const scheduleAgenda: AgendaItem[] = arr.map((i) => ({
        id: i.id,
        title: i.title,
        startTime: i.startTime,
        endTime: i.endTime,
        isAllDay: i.isAllDay,
        completed: i.completed,
        status: deriveScheduleStatus(i, now),
        variant: itemVariant(i),
      }));
      const taskAgenda: AgendaItem[] = chips.map((c) => ({
        id: taskChipId(c.id),
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        isAllDay: c.isAllDay,
        completed: c.completed,
        variant: "task" as const,
      }));
      return sortDayItems([...scheduleAgenda, ...taskAgenda]);
    },
    [now],
  );

  const todayItems = useMemo(
    () => contextItems.filter((i) => !i.isDeleted && !i.isDismissed),
    [contextItems],
  );
  // "この予定のみ削除" dismisses the row; pre-#296 nothing surfaced it again
  // (not in Trash, no undismiss UI — effectively unrecoverable). The flow
  // tab lists today's skipped items with a restore action.
  const skippedToday = useMemo(
    () => contextItems.filter((i) => !i.isDeleted && i.isDismissed),
    [contextItems],
  );
  const handleRestoreSkipped = useCallback(
    (id: string) => {
      undismiss(id);
      // Fast path; if the refetch races ahead of the undismiss write, the
      // syncVersion-driven refetch reconciles once the write lands.
      reload();
    },
    [undismiss, reload],
  );
  const todayAgenda = useMemo(
    () => toAgenda(todayItems, todayTaskChips),
    [todayItems, todayTaskChips, toAgenda],
  );
  const todayDone = todayItems.filter((i) => i.completed).length;
  const todayTotal = todayItems.length;

  // The Mobile day list — #467 made it the only thing narrow draws, so this is
  // the Mobile grid. Filtered like the Desktop grid is, though Mobile shows
  // neither toggle; with both filters off it is the same array.
  const anchorDayItems = useMemo(
    () => gridRangeItems.filter((i) => i.date === anchorDate),
    [gridRangeItems, anchorDate],
  );

  const editorItem: EventEditorItem | null = selected
    ? {
        id: selected.id,
        title: selected.title,
        date: selected.date,
        isAllDay: selected.isAllDay ?? false,
        startTime: selected.startTime,
        endTime: selected.endTime,
        completed: selected.completed,
        status: deriveScheduleStatus(selected, now),
        memo: selected.memo ?? "",
        isRoutine: selected.routineId != null,
      }
    : null;

  const originDetail = useMemo(() => {
    if (!selected || selected.routineId == null) return undefined;
    const r = routines.find((x) => x.id === selected.routineId);
    return r ? frequencyLabel(r, freqCopy, weekdayLabels) : undefined;
  }, [selected, routines, freqCopy, weekdayLabels]);

  // ── Repeat section (#185 Step 3) ───────────────────────────────────────────
  // The source routine of the selected occurrence (null for a manual event).
  const selectedRoutine = useMemo(() => {
    if (!selected || selected.routineId == null) return null;
    return routines.find((r) => r.id === selected.routineId) ?? null;
  }, [selected, routines]);

  // The frequency the <FrequencyEditor> edits. null = "なし" (manual event).
  const repeatValue = useMemo<FrequencyEditorValue | null>(() => {
    if (!selectedRoutine) return null;
    return {
      frequencyType: selectedRoutine.frequencyType,
      frequencyDays: selectedRoutine.frequencyDays,
      frequencyInterval: selectedRoutine.frequencyInterval,
      frequencyStartDate: selectedRoutine.frequencyStartDate,
    };
  }, [selectedRoutine]);

  const repeatLabels = useMemo(
    () => ({
      frequency: t("scheduleScreen.frequency"),
      frequencyNone: t("scheduleScreen.frequencyNone"),
      frequencyDaily: t("scheduleScreen.frequencyDaily"),
      frequencyWeekdays: t("scheduleScreen.frequencyWeekdays"),
      frequencyInterval: t("scheduleScreen.frequencyInterval"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
      startDate: t("scheduleScreen.startDate"),
      converting: t("scheduleScreen.repeatConverting"),
    }),
    [t],
  );

  const summaryRows = useMemo<RoutineSummaryRow[]>(
    () =>
      routines
        .filter((r) => !r.isArchived && r.isVisible)
        .map((r) => ({
          id: r.id,
          title: r.title,
          timeLabel: r.startTime ?? "",
          frequencyLabel: frequencyLabel(r, freqCopy, weekdayLabels),
        })),
    [routines, freqCopy, weekdayLabels],
  );
  const routineTodayItems = todayItems.filter((i) => i.routineId != null);
  const routineDone = routineTodayItems.filter((i) => i.completed).length;
  const routineTotal = routineTodayItems.length;

  // #408 repeat list. Unlike summaryRows this is NOT filtered: the whole point
  // of the panel is listing routines the calendar cannot show — an interval
  // starting next month, archived / hidden ones, and the malformed ones that
  // fire on no day at all (#407's zombies). Sorted by `order`, the same
  // ordering the retired Routines tab used.
  //
  // The scan is skipped unless the tab is showing: a routine that fires on no
  // day walks the full year before answering, so an unopened panel would pay
  // that on every routine write. `listDate` rides the minute ticker rather
  // than `today` (frozen at mount) — a stale key here is not a stale grid, it
  // is a wrong date printed in the row and a jump to the wrong day.
  const listDate = useMemo(() => todayCalendarKey(now), [now]);
  const repeatRows = useMemo<RepeatListRow[]>(
    () =>
      sidebarTab !== "repeats"
        ? []
        : routines
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((r) => {
              const next = nextRoutineOccurrence(r, listDate);
              return {
                id: r.id,
                title: r.title || t("scheduleScreen.untitled"),
                timeLabel: r.startTime ?? "",
                frequencyLabel: frequencyLabel(r, freqCopy, weekdayLabels),
                nextLabel: next ? formatFullDay(next) : null,
              };
            }),
    [sidebarTab, routines, listDate, t, freqCopy, weekdayLabels, formatFullDay],
  );

  const handleOpenRepeat = useCallback(
    (id: string) => {
      const routine = routines.find((r) => r.id === id);
      if (!routine) return;
      const next = nextRoutineOccurrence(routine, listDate);
      // The panel renders no-occurrence rows as static text, so this guard is
      // belt-and-braces against a routine edited out from under the list.
      if (!next) return;
      // #520: the same reveal the palette needs, and here the first filter is
      // not even a suspect — it is a certainty. The destination is by
      // definition repeat-generated, so with #466 on it is folded away the
      // moment it is fetched, and the lens hides it too unless the SERIES
      // carries that calendar's tag. Jumping to a day where the thing jumped
      // to is filtered out is exactly the unreachability this panel exists to
      // fix (#408).
      revealOnGrid();
      setAnchorDate(next);
      // #467: on Mobile this list lives in the drawer that covers the calendar,
      // so a jump with the drawer left open lands on a day the user cannot see.
      // Desktop's panel sits beside the grid, and `close` there would collapse
      // a panel the user deliberately opened — hence the layout guard.
      if (!isWide) closeSidebar?.();
      void (async () => {
        // Navigating only FETCHES a range — nothing on the nav path
        // materialises occurrences (the generator covers today, and reconcile
        // covers whatever range was visible at the time). So a jump onto a
        // future-dated repeat would land on an empty day with nothing to open,
        // which is exactly the reachability hole this panel exists to close.
        try {
          await ensureRoutineItemsForDateRange(next, next, [routine]);
        } catch {
          // Logged at the API layer; the reload below still returns the view
          // to whatever the server actually has.
        }
        reload();
      })();
    },
    [
      routines,
      listDate,
      setAnchorDate,
      isWide,
      closeSidebar,
      ensureRoutineItemsForDateRange,
      reload,
      revealOnGrid,
    ],
  );

  const handleDeleteRepeat = useCallback(
    (id: string) => {
      void (async () => {
        const { landed } = await deleteRoutine(id);
        // The calendar is on screen here (it never was behind the old Routines
        // tab), so without this the deleted routine's occurrences linger until
        // something else refetches the visible range.
        reload();
        // deleteRoutine drops the row optimistically and swallows the service
        // error. Silence would leave the list short one row while every
        // occurrence stays on the grid, with no way to tell which is true.
        if (!landed) {
          showToast("danger", t("scheduleScreen.repeatDeleteFailed"));
        }
      })();
    },
    [deleteRoutine, reload, showToast, t],
  );

  // #466: flipping the filter on takes the selected occurrence off the grid.
  // The selection itself is what the popover and the editor read, so dropping
  // it here keeps them from pointing at a row that is no longer drawn. Only
  // repeat-generated selections are affected — a manual event stays selected.
  const handleToggleRepeats = useCallback(() => {
    const next = !repeatsHidden;
    setRepeatsHidden(next);
    if (next && selected?.routineId != null) {
      setSelectedId(null);
      setPopover(null);
    }
  }, [repeatsHidden, selected]);

  // #468: same guard for the calendar lens. Picking a calendar the selected
  // row is not in takes it off the grid, and the popover + the editor both
  // read the selection — leaving it would point them at a row that is no
  // longer drawn. Clearing the lens (id === null) never hides anything, so it
  // keeps the selection.
  const handleSelectCalendar = useCallback(
    (id: string | null) => {
      setCalendarFilterId(id);
      if (id == null || !selected) return;
      const cal = selectableCalendars.find((c) => c.id === id);
      if (!cal) return;
      const members = buildCalendarMemberIds(allAssignments, cal.tagId);
      // Same membership test as the grid, routine inheritance included — a
      // selected occurrence stays selected when its SERIES carries the tag.
      const stillVisible =
        members.has(selected.id) ||
        (selected.routineId != null && members.has(selected.routineId));
      if (!stillVisible) {
        setSelectedId(null);
        setPopover(null);
      }
    },
    [selected, selectableCalendars, allAssignments],
  );

  // #553: duration suffix on the TimeRangeField's end options ("10:30
  // (1時間30分)"). Hour/minute composition happens here so the words stay in
  // the catalogs — the shared field never builds copy.
  const formatDuration = useCallback(
    (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return t("scheduleScreen.durationMin", { m });
      if (m === 0) return t("scheduleScreen.durationHour", { h });
      return t("scheduleScreen.durationHourMin", { h, m });
    },
    [t],
  );

  const statusLabels = useMemo<Record<ScheduleStatus, string>>(
    () => ({
      notStarted: t("scheduleScreen.statusNotStarted"),
      inProgress: t("scheduleScreen.statusInProgress"),
      done: t("scheduleScreen.statusDone"),
    }),
    [t],
  );

  const agendaLabels = {
    allDay: t("scheduleScreen.allDay"),
    empty: t("scheduleScreen.emptyToday"),
    nowLabel: minutesToTime(nowMinutes),
    complete: t("scheduleScreen.complete"),
    statusLabels,
  };
  // #469: the date picker. Before this the only way to move an occurrence to
  // another day was to drag it across the grid — impossible for a day the grid
  // is not showing. No ensure pass is needed (an existing row is moving, not an
  // occurrence being generated).
  //
  // #469 follow-up: it used to move the calendar to the target day as well, on
  // the reasoning that a row vanishing from the current week needs following.
  // That backfired — changing the anchor changes [rangeStart, rangeEnd], which
  // refetches and REPLACES rangeItems, discarding the optimistic patch before
  // the (fire-and-forget, several round trips) write lands. The read wins the
  // race, the row is in neither range, `selected` goes null and the editor
  // closes itself. Staying put keeps the patched row in rangeItems, so the
  // editor stays open showing the new day, and the next settled fetch is what
  // finally moves the row out of the visible range.
  const handleChangeDate = useCallback(
    (id: string, date: string) => {
      handleUpdate(id, { date });
    },
    [handleUpdate],
  );

  // #469: the all-day switch. Turning it ON keeps the times (so switching back
  // restores them); turning it OFF has to hand back a usable span, because a
  // row created as all-day can carry none at all — a null start would leave the
  // item unrenderable on the time grid. The span itself is worked out by a
  // shared pure helper (#469 follow-up — web has no test runner, and the
  // end-of-day clamp / malformed-time cases are worth pinning).
  const handleToggleAllDay = useCallback(
    (id: string, next: boolean) => {
      if (next) {
        handleUpdate(id, { isAllDay: true });
        return;
      }
      // `selected` IS the row the editor is bound to (editorItem is derived
      // from it), so there is no second lookup to disagree with it.
      const span = timedSpanForAllDayOff(
        selected?.startTime,
        selected?.endTime,
      );
      handleUpdate(id, { isAllDay: false, ...span });
    },
    [handleUpdate, selected],
  );

  const editorLabels = {
    complete: t("scheduleScreen.complete"),
    statusLabels,
    title: t("scheduleScreen.title"),
    date: t("scheduleScreen.date"),
    allDay: t("scheduleScreen.allDay"),
    startTime: t("scheduleScreen.startTime"),
    endTime: t("scheduleScreen.endTime"),
    memo: t("scheduleScreen.memo"),
    seriesHint: t("scheduleScreen.seriesEditHint"),
    originRoutine: t("scheduleScreen.originRoutine"),
    originEvent: t("scheduleScreen.originEvent"),
    skipThisDay: t("scheduleScreen.skipThisDay"),
    delete: t("scheduleScreen.delete"),
  };

  const editorPane = editorItem ? (
    <EventEditorPane
      item={editorItem}
      originDetail={originDetail}
      onCommitTitle={(id, title) => handleUpdate(id, { title })}
      onChangeDate={handleChangeDate}
      onToggleAllDay={handleToggleAllDay}
      // #553: one patch per gesture — the TimeRangeField may move both ends
      // at once, and two writes would ask a routine's scope dialog twice.
      onChangeTimes={(id, patch) => handleUpdate(id, patch)}
      formatDuration={formatDuration}
      onToggleComplete={handleToggle}
      onChangeMemo={(id, memo) => handleUpdate(id, { memo })}
      onDismiss={handleDismiss}
      onDelete={handleDelete}
      labels={editorLabels}
      repeat={repeatValue}
      repeatWeekdayLabels={weekdayLabels}
      repeatLabels={repeatLabels}
      onChangeRepeat={handleChangeRepeat}
      onDetachRepeat={handleDetachRepeat}
      repeatPending={repeatConverting}
      tagSlot={
        // #468: tagging is what files a row into a calendar, so without this
        // the lens above would have nothing to find. A routine occurrence is
        // tagged through its SERIES (the routine id): the occurrence rows are
        // regenerated, so a tag on one of them would go missing the moment the
        // generator re-materialises the range — and the user thinks of the
        // series as the thing anyway (#185 presents Routine as "an Event with
        // a repeat"). The role follows the id we actually write against, so it
        // matches `items_meta.role` of that row rather than what the UI calls
        // it.
        //
        // #551: the color controls write the TAG's color (setTagColor) — an
        // item shows color only through its tags, so "change this item's
        // color" and "change this tag's color" are the same act, and the hue
        // updates everywhere that tag paints (pills, Kanban, lens chips).
        <div className="flex flex-col gap-1.5">
          <TagPicker
            itemId={selected?.routineId ?? editorItem.id}
            itemRole={selected?.routineId != null ? "routine" : "event"}
          />
          <TagColorControls itemId={selected?.routineId ?? editorItem.id} />
        </div>
      }
    />
  ) : null;

  const loadingCard = (
    <div className="rounded-md border border-lumen-border bg-lumen-bg-secondary px-4 py-10 text-center text-sm text-lumen-text-secondary">
      {t("scheduleScreen.loading")}
    </div>
  );
  const errorCard = (
    <div className="flex flex-col items-center gap-3 rounded-md border border-lumen-border bg-lumen-bg-secondary px-4 py-10 text-center">
      <p className="text-sm text-lumen-text-secondary">
        {t("scheduleScreen.loadError")}
      </p>
      <button
        type="button"
        onClick={reload}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {t("scheduleScreen.retry")}
      </button>
    </div>
  );
  const showLoading = isLoading && rangeItems.length === 0;
  // Full-screen error only when there is nothing to show; a range-fetch
  // failure with stale items on screen degrades to the retry banner below
  // (#296 — blanking a populated calendar over a transient error reads as
  // "my items vanished").
  const showError = !!error || (rangeError && rangeItems.length === 0);
  const rangeErrorBanner =
    rangeError && rangeItems.length > 0 ? (
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-lumen-border bg-lumen-bg-secondary px-3 py-2">
        <p className="text-xs text-lumen-text-secondary">
          {t("scheduleScreen.loadError")}
        </p>
        <button
          type="button"
          onClick={reload}
          className="rounded-lumen-md border border-lumen-border-strong px-2.5 py-1 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          {t("scheduleScreen.retry")}
        </button>
      </div>
    ) : null;

  // Shared rightSidebar (AppShell owns the frame — a push-in panel on Desktop,
  // a drawer on Mobile). One portal either way so contentCount stays 1 (#299
  // removed the old "詳細" tab — item detail now lives in a body-level overlay).
  //
  // #467: Mobile gets the same switcher minus "本日の Todo". The Todo board is
  // its own SegmentedControl tab in the Schedule section there, so a second
  // route to it inside the drawer would be a duplicate; "繰り返し" is the one
  // that had no Mobile route at all (mobile-scope.md #5 — the list was
  // unreachable from narrow since #408 retired the Routines header tab).
  const sidebarTabs = useMemo(
    () =>
      isWide
        ? [
            { id: "flow", label: t("scheduleScreen.todayFlow") },
            { id: "todo", label: t("scheduleScreen.tabTodo") },
            { id: "repeats", label: t("scheduleScreen.tabRepeats") },
          ]
        : [
            { id: "flow", label: t("scheduleScreen.todayFlow") },
            { id: "repeats", label: t("scheduleScreen.tabRepeats") },
          ],
    [isWide, t],
  );
  // A resize can leave "todo" selected with no tab to match it, which would
  // draw the tray under a switcher that shows nothing as active. Fold it back
  // to the flow rather than resetting the state — widening again returns the
  // user to the tab they actually chose.
  const activeSidebarTab =
    !isWide && sidebarTab === "todo" ? "flow" : sidebarTab;

  const flowBody = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {/* No heading on either layout: the switcher above already reads
            "今日の流れ". It used to be Mobile-only, back when narrow had no
            tabs at all (#467 gave it the same switcher). */}
        <p className="text-xs text-lumen-text-secondary">
          {todayLabel} ·{" "}
          {t("scheduleScreen.doneSummary", {
            done: todayDone,
            total: todayTotal,
          })}
        </p>
      </div>
      <AgendaList
        items={todayAgenda}
        nowMinutes={nowMinutes}
        onToggleComplete={handleToggle}
        onItemActivate={handleItemActivate}
        onItemDoubleClick={handleItemOpenDetail}
        selectedId={selectedId}
        labels={agendaLabels}
      />
      {/* Restore surface for skipped (dismissed) items — #296. */}
      {skippedToday.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-lumen-border bg-lumen-bg-secondary px-3 py-2">
          <h4 className="text-xs font-semibold text-lumen-text-secondary">
            {t("scheduleScreen.skippedTitle", {
              count: skippedToday.length,
            })}
          </h4>
          <ul className="flex flex-col gap-1">
            {skippedToday.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-lumen-text-secondary line-through">
                  {i.isAllDay ? i.title : `${i.startTime} ${i.title}`}
                </span>
                <button
                  type="button"
                  onClick={() => handleRestoreSkipped(i.id)}
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
          which this change removed. */}
      {isWide && (
        <RoutineSummaryCard
          routines={summaryRows}
          completedCount={routineDone}
          totalCount={routineTotal}
          summaryText={t("scheduleScreen.doneSummary", {
            done: routineDone,
            total: routineTotal,
          })}
          labels={{
            title: t("scheduleScreen.summaryTitle"),
            empty: t("scheduleScreen.summaryEmpty"),
            cta: t("scheduleScreen.openRoutinesCta"),
          }}
          onOpenRoutines={() => setSidebarTab("repeats")}
        />
      )}
    </div>
  );

  // #408: the repeat list that replaces the retired Routines header tab.
  //
  // #467 put it on Mobile too, viewing only (mobile-scope.md #5): tapping a row
  // still jumps the calendar to that routine's next occurrence — that is the
  // reachability this panel exists for, and navigating is not editing — but
  // `onDelete` is left off, so no row offers to take a whole series away on a
  // touch target the size of a fingertip. `repeatsHidden` is Desktop-only
  // state (narrow has no toggle), so the notice below never shows there.
  //
  // #466: while the grid filter is on, this list is the surface most likely to
  // be read as the truth about what is scheduled ("the routine is right here,
  // why is the calendar empty?"). Both the notice and the toolbar button read
  // the SAME `repeatsHidden` state, so there is no second flag to fall out of
  // step — and either one turns it back off.
  const repeatsBody = (
    <div className="flex flex-col gap-2">
      {repeatsHidden && (
        <div className="flex flex-col gap-1.5 rounded-md border border-lumen-accent bg-lumen-accent-subtle px-3 py-2">
          <p className="text-xs text-lumen-text-secondary">
            {t("scheduleScreen.repeatFilterNotice")}
          </p>
          <button
            type="button"
            onClick={handleToggleRepeats}
            className="self-start rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {t("scheduleScreen.repeatFilterShow")}
          </button>
        </div>
      )}
      <RepeatListPanel
        rows={repeatRows}
        onOpen={handleOpenRepeat}
        onDelete={isWide ? handleDeleteRepeat : undefined}
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

  // #573 (#555 follow-up): softDelete cascades through the subtree and both
  // recovery routes are weak (undo clears on section unmount; Trash restores
  // one row at a time), so a row with children confirms first. Leaves keep
  // the one-click delete. window.confirm follows the SettingsScreen reset
  // precedent; guards the tray AND the task-chip bubble (same write).
  const handleTodoDelete = useCallback(
    (id: string) => {
      const cascade = todoDeleteCascade(taskNodes, id);
      if (
        cascade &&
        !window.confirm(
          t("scheduleScreen.todoDeleteCascadeConfirm", {
            name: cascade.title,
            count: cascade.childCount,
          }),
        )
      ) {
        return;
      }
      softDeleteTask(id);
    },
    [taskNodes, softDeleteTask, t],
  );

  /*
   * #625: Event <-> Todo conversion.
   *
   * The write keeps the item's id, so both surfaces stay pointed at the same
   * row and its tags/links survive — but the row changes ROLE, which means the
   * list it was in stops holding it and another list starts. Neither store
   * finds that out on its own here: the schedule range reloads and the task
   * tree refetches, and the item is simply gone from one surface and present
   * on the other. No navigation (per the Issue) — jumping the user to the
   * other section after a one-line action reads as losing their place.
   *
   * The guard is per-id and claimed synchronously (#434): the confirm dialog
   * plus an async write is exactly the window in which a second click lands,
   * and a second conversion of the same id would hit a row whose role has
   * already moved — recoverable, but it would report a failure for something
   * that actually worked.
   */
  const { begin: beginConvert, end: endConvert } = useInFlightGuard();

  const handleConvertToTodo = useCallback(
    (id: string) => {
      const item =
        rangeItems.find((i) => i.id === id) ??
        contextItems.find((i) => i.id === id);
      if (!item) return;
      // D-20260810-sched-5, and the user asked for it in exactly this shape:
      // the action stays enabled and ANSWERS with the reason. A greyed-out row
      // teaches nothing.
      if (eventToTodoBlock(item)) {
        window.alert(t("itemConvert.routineBlocked"));
        return;
      }
      if (
        !window.confirm(
          t("itemConvert.toTodoConfirm", {
            title: item.title || t("scheduleCalendar.newEvent"),
          }),
        )
      )
        return;
      if (!beginConvert(id)) return;
      setPopover(null);
      // order 0 = the top of the root group, the slot addNode aims a new task
      // at. It does NOT shift the existing siblings down the way addNode does:
      // that would be a second, unrelated write over every root row, and a tie
      // in sort_order only costs an arbitrary order between two rows.
      void dataService
        .convertEventToTask(id, { order: 0 })
        .then(() => {
          reload();
          void refetchTasks();
        })
        .then(() => showToast("success", t("itemConvert.toTodoDone")))
        .catch((err) => {
          logServiceError("ItemConversion", `convertEventToTask (${id})`, err);
          showToast("danger", t("itemConvert.failed"));
        })
        .finally(() => endConvert(id));
    },
    [
      rangeItems,
      contextItems,
      dataService,
      reload,
      refetchTasks,
      showToast,
      beginConvert,
      endConvert,
      t,
    ],
  );

  const handleConvertToEvent = useCallback(
    (id: string) => {
      const task = taskNodes.find((n) => n.id === id);
      if (!task) return;
      // D-20260810-sched-4. The service repeats this check against the DB
      // (soft-deleted children are invisible here but still hold the FK); this
      // one exists so the common case gets a sentence instead of a red toast.
      const blocked = todoToEventBlock(taskNodes, id);
      if (blocked) {
        window.alert(
          t("itemConvert.childrenBlocked", {
            title: blocked.title,
            count: blocked.childCount,
          }),
        );
        return;
      }
      if (
        !window.confirm(
          // A child Todo loses its parent link (events have no hierarchy), and
          // the dialog is the only place that can say so before it happens.
          t(
            task.parentId != null
              ? "itemConvert.toEventConfirmChild"
              : "itemConvert.toEventConfirm",
            { title: task.title || t("common.untitled") },
          ),
        )
      )
        return;
      if (!beginConvert(id)) return;
      setPopover(null);
      setTaskDetailId(null);
      void dataService
        .convertTaskToEvent(id, taskToEventPlacement(task, listDate))
        .then(() => {
          reload();
          void refetchTasks();
        })
        .catch((err) => {
          logServiceError("ItemConversion", `convertTaskToEvent (${id})`, err);
          // The DB sees children the live tree cannot (trashed ones still hold
          // the 0009 FK), so that refusal gets its own sentence — "conversion
          // failed" would send the user looking for a network problem.
          showToast(
            "danger",
            err instanceof ItemConversionError && err.reason === "children"
              ? t("itemConvert.childrenBlockedServer")
              : t("itemConvert.failed"),
          );
        })
        .finally(() => endConvert(id));
    },
    [
      taskNodes,
      dataService,
      listDate,
      reload,
      refetchTasks,
      showToast,
      beginConvert,
      endConvert,
      t,
    ],
  );

  // A-3 (#298): "本日の Todo" tray — placed / unplaced task groups + an add
  // picker. Desktop-only (it rides the tab switcher; Mobile shows only flow).
  // #555: rows also soft-delete (softDeleteTask → Trash) and carry the same
  // <TagPicker> the task detail uses, so tags attach without leaving the tray.
  const todoBody = (
    <TodayTodoTray
      placed={todoPlaced}
      unplaced={todoUnplaced}
      addable={todoAddable}
      onToggleComplete={handleTodoToggleComplete}
      onAddCandidate={handleTodoAddCandidate}
      onOpenTask={() => onOpenTasks()}
      onDelete={handleTodoDelete}
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
        openInTasks: t("scheduleScreen.todoOpenInTasks"),
        delete: t("scheduleScreen.todoDelete"),
      }}
    />
  );

  const sidebarPortal = (
    <RightSidebarPortal>
      <ScheduleSidebarTabs
        tabs={sidebarTabs}
        value={activeSidebarTab}
        onChange={(id) => setSidebarTab(id as "flow" | "todo" | "repeats")}
        label={t("scheduleScreen.detailPanelLabel")}
      >
        {activeSidebarTab === "flow"
          ? flowBody
          : activeSidebarTab === "todo"
            ? todoBody
            : repeatsBody}
      </ScheduleSidebarTabs>
    </RightSidebarPortal>
  );

  const calendarsModal = (
    <Modal
      open={calendarsOpen}
      onClose={() => setCalendarsOpen(false)}
      title={t("scheduleScreen.calendarsTitle")}
      className="max-w-lg"
    >
      <CalendarView />
    </Modal>
  );

  // #279: this/future/all chooser — centered on every layout per the issue.
  const scopeDialogEl = (
    <RepeatScopeDialog
      open={!!scopeRequest}
      mode={scopeRequest?.mode ?? "edit"}
      labels={{
        title:
          scopeRequest?.mode === "delete"
            ? t("scheduleScreen.deleteScopeTitle")
            : t("scheduleScreen.editScopeTitle"),
        thisOnly: t("scheduleScreen.scopeThisOnly"),
        thisAndFuture: t("scheduleScreen.scopeThisAndFuture"),
        all: t("scheduleScreen.scopeAll"),
        cancel: t("scheduleScreen.scopeCancel"),
      }}
      onChoose={handleScopeChoose}
      onClose={closeScopeRequest}
    />
  );

  /*
   * #564: the chip behind an open bubble, when the bubble belongs to a TASK
   * chip rather than a schedule item.
   *
   * Resolved against the unfiltered `rangeTaskChips` for the same reason
   * `selected` reads `rangeItems`: the calendar lens narrows what the grid
   * DRAWS, and a panel already on screen has to keep acting on its item even if
   * the row behind it stops being drawn (a rename can move it out of the lens).
   *
   * `todayTaskChips` is the second half of the same pair `selected` uses
   * (rangeItems ?? contextItems): the "今日の流れ" agenda always lists TODAY, so
   * with the grid parked on another week its task rows are in no range chip at
   * all — and looking only at the range would leave that surface with exactly
   * the silently-dead click this Issue is about.
   */
  const popoverTaskChip =
    popover && isTaskChip(popover.id)
      ? (rangeTaskChips.find((c) => c.id === unwrapTaskChipId(popover.id)) ??
        todayTaskChips.find((c) => c.id === unwrapTaskChipId(popover.id)) ??
        null)
      : null;
  // The task action set. Deliberately not the event one: a task has no
  // duplicate write and its detail lives in another section (taskChipPanel.ts).
  const taskChipPanel = popoverTaskChip
    ? taskChipPanelModel(
        popoverTaskChip,
        {
          // NOT scheduleScreen.untitled — that one reads "無題の繰り返し",
          // written for the repeat list. A task is neither.
          untitled: t("common.untitled"),
          allDay: t("scheduleScreen.allDay"),
          rename: t("scheduleScreen.rename"),
          delete: t("scheduleScreen.todoDelete"),
          convertToEvent: t("itemConvert.toEvent"),
        },
        {
          onRename: (title) =>
            updateNode(
              popoverTaskChip.id,
              { title },
              // The catch-all tree label: a rename is not a move, so none of
              // the position-shaped taskChip* words fit (useTaskTreeHistory).
              { undoLabel: "taskTreeChange" },
            ),
          onDelete: () => handleTodoDelete(popoverTaskChip.id),
          onConvertToEvent: () => handleConvertToEvent(popoverTaskChip.id),
        },
      )
    : null;

  // #299 single-click bubble (Desktop): summary + quick actions + "詳細を編集".
  // `selected` is the popover's item (activate sets selectedId + popover to the
  // same id); guard against a transient mismatch. Portalled to body → does not
  // touch the rightSidebar contentCount invariant.
  const popoverEl =
    !isWide || !popover ? null : taskChipPanel ? (
      <ItemActionPopover
        key={popover.id}
        position={{ x: popover.x, y: popover.y }}
        summary={
          <div className="flex flex-col gap-0.5">
            <p className="truncate font-semibold text-lumen-text">
              {taskChipPanel.title}
            </p>
            <p className="text-lumen-text-secondary">
              {taskChipPanel.timeLabel}
            </p>
          </div>
        }
        actions={taskChipPanel.actions}
        onEditDetail={() => handleItemOpenDetail(popover.id)}
        // #626: the primary hand-off now opens the in-Schedule task detail
        // (tags editable in place); "open in Tasks" moved inside that panel.
        editDetailLabel={t("scheduleScreen.editDetail")}
        label={t("scheduleScreen.itemActionsLabel")}
        onClose={() => setPopover(null)}
      />
    ) : selected && selected.id === popover.id ? (
      <ItemActionPopover
        // Remount per item: without a mousedown in between (e.g. the keyboard
        // contextmenu key) the id can swap while the bubble stays mounted,
        // and a rename draft from the previous item would survive the swap.
        key={popover.id}
        position={{ x: popover.x, y: popover.y }}
        summary={
          <div className="flex flex-col gap-0.5">
            <p className="truncate font-semibold text-lumen-text">
              {selected.title || t("scheduleCalendar.newEvent")}
            </p>
            <p className="text-lumen-text-secondary">
              {selected.isAllDay
                ? t("scheduleScreen.allDay")
                : `${selected.startTime}–${selected.endTime}`}
            </p>
          </div>
        }
        actions={[
          // #551: rename rides the unified bubble as an inline input — the
          // retired right-click menu was the only place it lived before.
          {
            id: "rename",
            label: t("scheduleScreen.rename"),
            inlineInput: {
              value: selected.title,
              ariaLabel: t("scheduleScreen.rename"),
              onCommit: (title) => handleRename(popover.id, title),
            },
          },
          {
            id: "duplicate",
            label: t("scheduleScreen.duplicate"),
            onSelect: () => handleDuplicate(popover.id),
          },
          // #625: stays enabled for a routine occurrence too — selecting it
          // then explains why a Todo cannot hold a repeat (D-20260810-sched-5,
          // user-specified shape).
          {
            id: "convertToTodo",
            label: t("itemConvert.toTodo"),
            onSelect: () => handleConvertToTodo(popover.id),
          },
          {
            id: "delete",
            label: t("scheduleScreen.delete"),
            danger: true,
            onSelect: () => handleDelete(popover.id),
          },
        ]}
        onEditDetail={() => handleItemOpenDetail(popover.id)}
        editDetailLabel={t("scheduleScreen.editDetail")}
        label={t("scheduleScreen.itemActionsLabel")}
        onClose={() => setPopover(null)}
      />
    ) : null;

  // #299 detail-edit overlay (Desktop): the former rightSidebar "詳細" tab body
  // (EventEditorPane) now rides a body-level modal. Mobile keeps the BottomSheet.
  const detailOverlayEl = (
    <ItemDetailOverlay
      open={isWide && overlayOpen && !!editorPane}
      title={t("scheduleScreen.detailTitle")}
      onClose={() => setOverlayOpen(false)}
    >
      {editorPane}
    </ItemDetailOverlay>
  );

  /*
   * #626: task-chip detail overlay (Desktop) — the same TaskDetailPanel +
   * TagPicker pair Kanban renders, so a todo's tags are editable without
   * leaving Schedule. Deliberately NOT EventEditorPane: that pane edits a
   * schedule_item and a task has none (#564), so the task counterpart is the
   * panel the Tasks section already trusts. Resolved against the live tree —
   * a task deleted elsewhere while open simply closes the overlay.
   *
   * The #564 hand-off survives as the button under the panel: in-place editing
   * covers tags/title/status, and anything deeper still lives in Tasks.
   */
  const taskDetailTask =
    taskDetailId != null
      ? (taskNodes.find((n) => n.id === taskDetailId) ?? null)
      : null;
  const taskDetailOverlayEl = (
    <ItemDetailOverlay
      open={isWide && !!taskDetailTask}
      title={t("materials.tasks.detailTitle")}
      onClose={() => setTaskDetailId(null)}
    >
      {taskDetailTask && (
        <div className="flex flex-col gap-3">
          <TaskDetailPanel
            taskId={taskDetailTask.id}
            title={taskDetailTask.title}
            status={taskDetailTask.status}
            onTitleCommit={(id, title) =>
              updateNode(id, { title }, { undoLabel: "taskTreeChange" })
            }
            onToggleStatus={toggleTaskStatus}
            titleLabel={t("taskDetail.titleLabel")}
            statusLabel={t("taskDetail.status")}
            statusText={t(
              STATUS_TEXT_KEY[taskDetailTask.status ?? "NOT_STARTED"],
            )}
            // Same omission as Kanban: TagPicker's own kind badge captions the
            // row, so TaskDetailPanel's generic tagsLabel would repeat it.
            tagsSlot={
              <TagPicker
                itemId={taskDetailTask.id}
                itemRole="task"
                showLabel
                size="sm"
              />
            }
          />
          {/* #625: the same convert the chip bubble offers. The panel is the
              surface a user reaches for when the todo turns out to be an
              appointment, so the action has to be here too — and this one
              closes the overlay itself, since the row it is showing changes
              role out from under it. */}
          <button
            type="button"
            onClick={() => handleConvertToEvent(taskDetailTask.id)}
            className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {t("itemConvert.toEvent")}
          </button>
          <button
            type="button"
            onClick={() => {
              setTaskDetailId(null);
              onOpenTasks();
            }}
            className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {t("scheduleScreen.todoOpenInTasks")}
          </button>
        </div>
      )}
    </ItemDetailOverlay>
  );

  // #376: one label bundle for BOTH creation frames (Desktop overlay + Mobile
  // sheet) — they render the same panel, so keeping two literals here is how
  // the two would eventually drift apart.
  const createPanelLabels = useMemo(
    () => ({
      typeLabel: t("scheduleScreen.itemTypeLabel"),
      typeEvent: t("scheduleScreen.typeEvent"),
      typeTask: t("scheduleScreen.typeTask"),
      typeNote: t("scheduleScreen.typeNote"),
      title: t("scheduleScreen.title"),
      eventPlaceholder: t("scheduleScreen.quickAddPlaceholder"),
      taskPlaceholder: t("scheduleScreen.taskPlaceholder"),
      date: t("scheduleScreen.date"),
      startTime: t("scheduleScreen.startTime"),
      endTime: t("scheduleScreen.endTime"),
      addEvent: t("scheduleScreen.addEvent"),
      addEventAndOpen: t("scheduleScreen.addEventAndOpen"),
      sourceLabel: t("scheduleScreen.sourceLabel"),
      sourceNew: t("scheduleScreen.sourceNew"),
      sourceExisting: t("scheduleScreen.sourceExisting"),
      addTask: t("scheduleScreen.addTask"),
      placeTask: t("scheduleScreen.placeTask"),
      searchTasks: t("scheduleScreen.searchTasks"),
      // Same sentence as the tray's picker, and the same fact ("nothing left
      // to schedule") — one key rather than two that can disagree.
      taskPickerEmpty: t("scheduleScreen.todoEmptyAddable"),
      taskPickerNoMatch: t("scheduleScreen.taskPickerNoMatch"),
      noteTitleLabel: t("scheduleScreen.noteTitleLabel"),
      notePlaceholder: t("scheduleScreen.notePlaceholder"),
      searchNotes: t("scheduleScreen.searchNotes"),
      // "No notes yet" is a claim about the user's data, so it must not stand
      // in for a list we simply failed to read.
      notePickerEmpty: notesError
        ? t("scheduleScreen.notePickerError")
        : t("scheduleScreen.notePickerEmpty"),
      notePickerNoMatch: t("scheduleScreen.notePickerNoMatch"),
      noteLinkHint: t("scheduleScreen.noteLinkHint"),
      attachedNote: t("scheduleScreen.attachedNote"),
      clearNote: t("scheduleScreen.clearNote"),
    }),
    [t, notesError],
  );

  // #299 item-creation overlay (Desktop): the shared creation panel in an
  // ItemDetailOverlay-style modal. Keyed on the prefill so a new empty-slot
  // click while open re-seeds the fields.
  const createOverlayEl = (
    <ItemDetailOverlay
      open={isWide && !!createPanel}
      title={t("scheduleScreen.addItem")}
      onClose={() => setCreatePanel(null)}
    >
      {createPanel && (
        <ItemCreatePanel
          key={`${createPanel.date}-${createPanel.start}-${createPanel.end}`}
          dateLabel={createDateLabel}
          initialStart={createPanel.start}
          initialEnd={createPanel.end}
          existingTasks={todoAddable}
          existingNotes={noteOptions}
          onSubmitEvent={handleCreateSubmit}
          onSubmitEventAndOpen={handleCreateSubmitAndOpen}
          onCreateTask={handleCreateTaskSubmit}
          onPlaceTask={handlePlaceTaskSubmit}
          formatDuration={formatDuration}
          labels={createPanelLabels}
        />
      )}
    </ItemDetailOverlay>
  );

  // ── Desktop ────────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <>
        {sidebarPortal}
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-lumen-gutter pb-4 pt-3 md:px-lumen-gutter-wide">
          <ScheduleToolbar
            className="shrink-0 flex-wrap gap-y-2"
            periodLabel={periodLabel}
            onToday={goToday}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            view={desktopView}
            viewOptions={desktopViewOptions}
            onChangeView={setView}
            onToggleRepeats={handleToggleRepeats}
            repeatsHidden={repeatsHidden}
            onOpenSettings={() => setCalendarsOpen(true)}
            onAddEvent={handleToolbarAdd}
            addEventLabel={t("scheduleScreen.addEvent")}
            labels={{
              ...toolbarLabels,
              hideRepeats: t("scheduleScreen.repeatFilterHide"),
              // The count comes from the same call that dropped the rows
              // (applyRepeatFilter), so the button can never claim a different
              // number than the grid is missing.
              repeatsHidden: t("scheduleScreen.repeatFilterHidden", {
                count: hiddenRepeats,
              }),
            }}
          />
          {/* #468 calendar lens. One row of single-select chips directly under
              the toolbar — Desktop only, and rendered at all only when there
              is a calendar to offer, so the empty case costs no vertical
              space. While the tags are still loading (or their fetch failed)
              `activeTagIds` is empty, so nothing is offered and the row simply
              is not there — the safe direction: it appears once the data
              lands, and it never offers a chip that would empty the grid.
              The "N 件を非表示" line uses the lens's OWN count
              (hiddenByCalendar, both grid layers), not a running total: rows
              the repeat filter already folded away are reported by the toolbar
              button instead, and adding the two would claim more missing rows
              than there are. */}
          {calendarChips.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <StatusFilterChips
                chips={calendarChips}
                value={activeCalendar?.id ?? null}
                onChange={handleSelectCalendar}
                label={t("scheduleScreen.calendarFilterLabel")}
                size="sm"
              />
              {activeCalendar && (
                <>
                  <span className="text-xs text-lumen-text-secondary">
                    {t("scheduleScreen.calendarFilterHidden", {
                      count: hiddenByCalendar,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectCalendar(null)}
                    className="rounded-lumen-md border border-lumen-border-strong px-2 py-0.5 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                  >
                    {t("scheduleScreen.calendarFilterShow")}
                  </button>
                </>
              )}
            </div>
          )}
          {rangeErrorBanner}
          {showLoading ? (
            loadingCard
          ) : showError ? (
            errorCard
          ) : desktopView === "month" ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MonthGrid
                monthKey={anchorDate}
                items={monthItems}
                todayKey={today}
                weekStartsOn={weekStartsOn}
                weekdayLabels={weekdayLabels}
                onSelectDay={handleMonthCreate}
                onItemActivate={handleItemActivate}
                onItemDoubleClick={handleItemOpenDetail}
                onItemContextMenu={handleItemContextMenu}
                formatMoreCount={(n) =>
                  t("scheduleScreen.moreCount", { count: n })
                }
                formatDayLabel={formatFullDay}
                ariaLabel={t("scheduleScreen.calendar")}
                className="h-full"
              />
            </div>
          ) : (
            // Item detail moved into a body-level overlay (#299), so the grid
            // takes the full width the editor <aside> used to share.
            <div className="min-h-0 flex-1">
              <WeekTimeGrid
                weekStart={desktopView === "day" ? anchorDate : weekStart}
                days={desktopView === "day" ? 1 : 7}
                items={gridItems}
                selectedId={selectedId}
                onItemActivate={handleItemActivate}
                onItemDoubleClick={handleItemOpenDetail}
                onItemContextMenu={handleItemContextMenu}
                onCreateAt={handleGridCreateAt}
                onMoveItem={handleMoveItem}
                onResizeItem={handleResizeItem}
                onDropAllDay={handleDropAllDay}
                taskInteractive
                weekdayLabels={weekdayLabels}
                allDayLabel={t("scheduleScreen.allDay")}
                statusLabels={statusLabels}
                createSlotLabel={t("scheduleCalendar.createSlot")}
                todayKey={today}
                nowMinutes={nowMinutes}
                fillHeight
                formatDayDate={formatDayDate}
              />
            </div>
          )}
        </div>
        {calendarsModal}
        {popoverEl}
        {detailOverlayEl}
        {taskDetailOverlayEl}
        {createOverlayEl}
        {scopeDialogEl}
      </>
    );
  }

  // ── Mobile ───────────────────────────────────────────────────────────────
  //
  // #467 Step 5-c: one screen — the anchored day as a list, plus the FAB. The
  // Timeline and Month options went with the switcher. Both were Desktop
  // surfaces shrunk to fit: a 24-hour time grid on a phone puts the whole day
  // behind a scroll and turns every block into a drag target too small to hit,
  // and a month grid leaves cells that show a count instead of what is in them.
  // The list answers the question narrow is actually for ("what is next?")
  // without either, and the day steppers below reach every other day.
  //
  // What was lost with them is the picker for a far-off day — prev/next only
  // walks one day at a time now. That is the accepted trade of "単画面 + FAB"
  // (Epic #290 Step 5-c); the repeats tab in the drawer covers the case that
  // actually needed a jump (a routine whose next occurrence is weeks out).
  return (
    <>
      {sidebarPortal}
      {/*
       * #632: the FAB anchors to THIS wrapper, not the viewport. It has to be
       * padding-free and span the section box — see MobileFab's host contract.
       * The inner div keeps the gutter so the list still lines up.
       */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-lumen-gutter pt-3">
          <div className="flex shrink-0 items-center gap-2">
            <RightSidebarToggle
              variant="hamburger"
              openLabel={t("scheduleScreen.openMenu")}
              closeLabel={t("scheduleScreen.closeMenu")}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-lumen-text">
              {periodLabel}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={t("scheduleScreen.prev")}
                onClick={() => step(-1)}
                className={ICON_BTN}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("scheduleScreen.next")}
                onClick={() => step(1)}
                className={ICON_BTN}
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
            >
              {t("scheduleScreen.today")}
            </button>
          </div>
          {rangeErrorBanner}
          <div className="min-h-0 flex-1 overflow-y-auto pb-24">
            {showLoading ? (
              loadingCard
            ) : showError ? (
              errorCard
            ) : (
              <AgendaList
                items={toAgenda(
                  anchorDayItems,
                  rangeTaskChips.filter((c) => c.date === anchorDate),
                )}
                nowMinutes={anchorDate === today ? nowMinutes : null}
                onToggleComplete={handleToggle}
                onItemActivate={handleItemActivate}
                onItemDoubleClick={handleItemOpenDetail}
                selectedId={selectedId}
                labels={agendaLabels}
                className="rounded-md border border-lumen-border bg-lumen-bg px-2"
              />
            )}
          </div>
        </div>

        {/* FAB → creation panel. */}
        <MobileFab
          onClick={handleToolbarAdd}
          label={t("scheduleScreen.addEvent")}
        />
      </div>

      {/* Mobile creation panel (#299 → #376): the FAB opens with defaults, an
          empty-slot tap opens with the tapped slot's time prefilled. Same panel
          as the Desktop overlay, so the task tab is reachable here too. */}
      <QuickCaptureSheet
        open={!!createPanel}
        onClose={() => setCreatePanel(null)}
        sheetTitle={t("scheduleScreen.addItem")}
        closeLabel={t("common.close")}
        dateLabel={createDateLabel}
        initialStart={createPanel?.start}
        initialEnd={createPanel?.end}
        existingTasks={todoAddable}
        existingNotes={noteOptions}
        onSubmitEvent={handleCreateSubmit}
        onSubmitEventAndOpen={handleCreateSubmitAndOpen}
        onCreateTask={handleCreateTaskSubmit}
        onPlaceTask={handlePlaceTaskSubmit}
        formatDuration={formatDuration}
        labels={createPanelLabels}
      />

      {/* #633: cap + inner scroller, like the Notes/Tasks detail sheets — without
          them a tall editor pushes the sheet's top edge past the viewport and
          the only thing left to scroll is the document (= pull-to-refresh).
          svh, not vh: 100vh is the URL-bar-hidden viewport, so a vh cap can
          still overflow while the bar is showing (#631's trap). */}
      <BottomSheet
        open={!!editorPane}
        onClose={() => setSelectedId(null)}
        title={t("scheduleScreen.detailTitle")}
        closeLabel={t("common.close")}
        className="flex max-h-[92svh] flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {editorPane}
        </div>
      </BottomSheet>

      {scopeDialogEl}
    </>
  );
}
