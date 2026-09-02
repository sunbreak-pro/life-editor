import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useScheduleItemsContext,
  useRoutineContext,
  useSyncDomains,
  useTodoTreeContext,
  useTagGroupContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  useMediaQuery,
  useRightSidebarOptional,
  useUndoRedoOptional,
  RightSidebarPortal,
  ScheduleRangeErrorBanner,
  useConfirmDialog,
  useScheduleItemsRoutineSync,
  useDeferredAction,
  useToast,
  useMinuteClock,
  TodoAddDialog,
  useTourAction,
  TOUR_ACTIONS,
  type EventEditorItem,
  type DataService,
  type TodoStatus,
  WIDE_QUERY,
  type TranslationKey,
} from "@life-editor/shared";
import { ScheduleSidebar } from "./ScheduleSidebar";
import { CalendarDesktopLayout } from "./CalendarDesktopLayout";
import { CalendarNarrowLayout } from "./CalendarNarrowLayout";
import { ScheduleOverlayHost } from "./ScheduleOverlayHost";
import { useCreatePanelNotes } from "./useCreatePanelNotes";
import { useCalendarNav } from "./useCalendarNav";
import { useTagFilterPanel } from "./useTagFilterPanel";
import { useVisibleRangeItems } from "./useVisibleRangeItems";
import { useScheduleMutations } from "./useScheduleMutations";
import {
  useCancelDeferredPopover,
  useScheduleOverlays,
} from "./useScheduleOverlays";
import { useItemConversion } from "./useItemConversion";
import { useScheduleTodoChips } from "./useScheduleTodoChips";
import { useScheduleRepeats } from "./useScheduleRepeats";
import { useScheduleGridFilters } from "./useScheduleGridFilters";
import { useScheduleCreateFlow } from "./useScheduleCreateFlow";
import { useScheduleSelection } from "./useScheduleSelection";
import { useScheduleDayLabels } from "./useScheduleDayLabels";
import { useScheduleTodayAgenda } from "./useScheduleTodayAgenda";
import { toEditorItem } from "./scheduleViewModels";
import { useScheduleCopy } from "./scheduleCopy";
import { useTodoLinking } from "./useTodoLinking";
import { selectNarrowDay } from "./narrowDayTap";

/*
 * Calendar tab (target-IA host). Assembles the shared presentational parts
 * (ScheduleToolbar / WeekTimeGrid / MonthGrid / AgendaList / EventEditorPane /
 * RoutineSummaryCard) into the day/week/month calendar, the "今日の流れ"
 * rightSidebar (RightSidebarPortal), and the Mobile month screen whose day
 * taps open that same sidebar (#1148 — narrow's own day list was retired
 * there, and the Quick-capture sheet is now reached from the sidebar's pill).
 *
 * Data flows ONLY through useScheduleItemsContext (§3.1). The provider is
 * anchored on today (MainScreen injects no `date`), so context.items backs the
 * "今日の流れ" panel + the routine-completion summary, while the calendar grid
 * reads its own visible range via loadDateRange and patches it optimistically
 * (mirrors the pre-target ScheduleCalendarView). i18n is resolved here and
 * injected into the pure parts (§6.4).
 *
 * #889 lifted the VIEW half and the loose hook groups out into sibling files
 * under `web/src/schedule/`. The import block above is that inventory and is
 * deliberately the only copy of it (§0) — the list this paragraph used to
 * carry named four files and went stale on the very next extraction.
 *
 * What stays here is the wiring: the Provider reads, the order the hooks feed
 * each other in, and the decisions the parts must not be free to answer for
 * themselves — which of the two failure surfaces is right (#296), where the
 * sidebar portal and the single shared overlay set are mounted, and which
 * layout renders at all.
 */

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
  TranslationKey
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
  pendingSelectEvent,
  onConsumePendingEvent,
  pendingNewTodo = false,
  onConsumeNewTodo,
  pendingSelectTodoId = null,
  onConsumePendingSelect,
  pendingTodoTray = false,
  onConsumeTodoTray,
  onNavigateToItem,
}: {
  dataService: DataService;
  /**
   * "Open this event" intent from the command palette (#503) — the same
   * pending-select idiom Notes / Daily / Kanban consume, plus the date: the
   * grid shows one window at a time, so an id alone would select a row that is
   * not on screen.
   */
  pendingSelectEvent?: { id: string; date: string } | null;
  /** Called once the intent has been acted on, so re-entry does not re-select. */
  onConsumePendingEvent?: () => void;
  /*
   * The shell's three TODO intents (#1153). They used to be consumed by the
   * Kanban tab; with that tab retired this host is where they land, and each
   * one is the same pending-flag idiom the event intent above uses — consumed
   * once, so re-entering the section never re-fires it.
   */
  /** global:new-task — open the tray and its create dialog. */
  pendingNewTodo?: boolean;
  onConsumeNewTodo?: () => void;
  /** A todo to open, from a "[[" link click or the palette (#370 / #507). */
  pendingSelectTodoId?: string | null;
  onConsumePendingSelect?: () => void;
  /** nav:tasks — just show the tray. */
  pendingTodoTray?: boolean;
  onConsumeTodoTray?: () => void;
  /** Where a "[[" link inside a todo body goes (#507). */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
}) {
  const { t } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const {
    items: contextItems,
    isLoading,
    error,
    loadDateRange,
    createScheduleItem,
    updateScheduleItem,
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
  const syncVersion = useSyncDomains("schedule");
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
  // Scheduled TodoNodes → todo=blue chips (schedule redesign A-1). `nodes`
  // already excludes soft-deleted todos (useTodoTreeAPI). A-2 (#297) writes
  // scheduledAt back via updateNode on grid drag/resize.
  // addNode (#376): the creation panel's todo tab writes a NEW TodoNode that is
  // already scheduled into the target slot — the same provider the tray and the
  // chip drags write through, so there is no second source of todo truth.
  // refetch (#625): the Event <-> Todo conversion writes through the
  // DataService, not through this provider's own persist path, so the tree
  // in memory would keep showing the pre-conversion shape until Realtime got
  // around to it. The conversion asks for the truth directly.
  const {
    nodes: todoNodes,
    addNode,
    updateNode,
    setTodoStatus,
    toggleTodoStatus,
    softDelete: softDeleteTodo,
    refetch: refetchTodos,
  } = useTodoTreeContext();

  /*
   * Tutorial tour reporting (#1124), the todo half — moved here from the
   * retired Kanban board by #1153.
   *
   * Wrapped at the SOURCE, before anything is handed either writer: completion
   * has three routes now (the tray's checkbox, the detail's toggle, the
   * detail's status row) and every one of them lands on one of these two
   * functions. Wrapping the call sites instead would mean three copies of the
   * "did this actually finish it?" test, and the tray's own route goes through
   * useScheduleTodoChips a few lines down — a wrapper defined after that call
   * would arrive too late for it.
   *
   * The event half sits further down with the create/update flow; both use
   * this same reporter, which is stable for the component's lifetime.
   */
  const reportTourAction = useTourAction();

  const setTodoStatusReported = useCallback(
    (id: string, status: TodoStatus) => {
      setTodoStatus(id, status);
      if (status === "DONE") {
        reportTourAction(TOUR_ACTIONS.scheduleTodoCompleted);
      }
    },
    [reportTourAction, setTodoStatus],
  );

  const toggleTodoStatusReported = useCallback(
    (id: string) => {
      // Read the status BEFORE the flip: only finishing a todo advances the
      // step, and re-opening one must not. Two values since #873, so "not
      // DONE" is the whole test.
      const completes =
        (todoNodes.find((n) => n.id === id)?.status ?? "NOT_STARTED") !==
        "DONE";
      toggleTodoStatus(id);
      if (completes) {
        reportTourAction(TOUR_ACTIONS.scheduleTodoCompleted);
      }
    },
    [reportTourAction, todoNodes, toggleTodoStatus],
  );

  // #468 / #1173: saved tag groups as a filter lens. A group is a named set
  // of life tags, so the grid needs both halves — the groups (which exist, and
  // which tags each collects) and the assignments (which items carry those
  // tags). Both are already bulk-loaded on this branch (sectionDescriptors
  // mounts TagGroupProvider + WikiTagsUnifiedProvider around the Schedule
  // tree), so this adds no fetch.
  const { tagGroups } = useTagGroupContext();
  const { allTags, allAssignments } = useWikiTagsUnifiedContext();

  // Navigation + visible fetch window (#280 → useCalendarNav).
  const {
    today,
    anchorDate,
    setAnchorDate,
    setView,
    desktopView,
    effView,
    weekStart,
    weekEnd,
    rangeStart,
    rangeEnd,
    step,
    goToday,
    // #878: Mobile's main view IS the month, so `effView` is "month" there and
    // the fetch window, the step size and the period label follow without a
    // second switch here. A cell tap moves the anchor — which is the day the
    // list under the grid shows.
    pickMonthDay,
  } = useCalendarNav(isWide);

  // #467: jumping to a repeat's next occurrence has to put the calendar on
  // screen, and on Mobile the list that was tapped is a drawer sitting over it.
  // The OPTIONAL hook, for the same reason RightSidebarPortal uses it: a
  // section body has to survive being rendered without the shell's Provider
  // (standalone renders / tests). Outside it there is no drawer to close.
  const rightSidebar = useRightSidebarOptional();
  const closeSidebar = rightSidebar?.close;
  // #1148: narrow's day list is gone, so a month-cell tap is what puts a day's
  // plans on screen — it opens the same drawer.
  //
  // #1153: the todo tray is a sidebar tab now, so the intents that used to
  // switch to a whole section have to be able to OPEN it too. A no-op on
  // Desktop, where the panel is pushed in and already on screen.
  const openSidebar = rightSidebar?.open;
  // #889: everything that can be covering the grid — the single-click bubble
  // (#299), the detail overlay, the creation panel (target day + prefilled
  // window; Desktop shows it in an overlay, Mobile in the QuickCaptureSheet)
  // and the tag-filter panel. One group, because they answer one question.
  const {
    popover,
    setPopover,
    overlayOpen,
    setOverlayOpen,
    createPanel,
    setCreatePanel,
    tagFilterOpen,
    setTagFilterOpen,
  } = useScheduleOverlays();
  // #889: one clock, two shapes. `now` is the repeat engine's day key
  // (useScheduleRepeats); `nowMinutes` places the now-line and the
  // agenda divider inside the day. They used to be two states read from the
  // wall clock separately in one interval, which let them straddle a minute
  // boundary and disagree.
  const { now, nowMinutes } = useMinuteClock();

  // #355: the bubble popover is deferred so a double-click can claim the
  // gesture before it appears. Cancelled on unmount by the hook.
  const { defer: deferPopover, cancel: cancelPopover } =
    useDeferredAction(POPOVER_DELAY_MS);

  // #376 note tab: the picker's pool + the "create the note, then link it"
  // write. Loaded only while the creation panel is open (see the hook).
  // The link lands after the panel has closed, so a failure has to be said out
  // loud — there is nothing left on screen to show it.
  const { showToast } = useToast();
  // #997: optional, like every other Schedule consumer — a standalone render
  // with no UndoRedoProvider simply records no history.
  const undoRedo = useUndoRedoOptional();
  /*
   * #707: every "are you sure?" on this screen goes through ONE in-app dialog.
   * Stated as the invariant rather than as a roster — the roster stood here
   * for a while and was already one short (the todo detail's own delete, #775)
   * by the time #1279 routed the repeat-series delete through here too. A list
   * that has to be hand-updated goes stale without anything noticing.
   *
   * They used to be the browser's own alert / confirm, which draw outside the
   * theme and freeze the page hard enough to stall Playwright.
   *
   * The answer arrives in a promise now, so each call site continues in a
   * `.then` instead of straight-line code. Everything the guards decide is
   * unchanged — only the way the question is put.
   */
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
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

  /*
   * The TODO half of this host (#675 → useScheduleTodoChips): the chips derived
   * from scheduled TodoNodes, the "本日の Todo" tray they back, and every
   * gesture that writes a TodoNode. None of it reads `rangeItems`, the repeat
   * machinery or the mutation layer, which is what let it come out whole.
   *
   * `todoDetailId` moved in with it — it is the id of a TODO, which
   * `selectedId` cannot hold (#626).
   */
  const {
    rangeTodoChips,
    todayTodoChips,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    findTodoChip,
    todoDetailId,
    setTodoDetailId,
    handleTodoChipMove,
    handleTodoChipResize,
    handleTodoChipDropAllDay,
    handleTodoToggleComplete,
    handleTodoAddCandidate,
    handleTodoDelete,
    handleTodoDetailDelete,
  } = useScheduleTodoChips({
    todoNodes,
    updateNode,
    setTodoStatus: setTodoStatusReported,
    softDeleteTodo,
    today,
    rangeStart,
    rangeEnd,
    askConfirm,
  });

  /*
   * #889: what is selected, and the four gestures that pick it — the tap, the
   * activate, the open-detail and the long press / right-click. They read as
   * four handlers and are one rule (see useScheduleSelection for the three
   * questions all of them answer, and for what happened the last two times
   * only one of the pair was updated).
   *
   * It sits HERE rather than beside the other state because it needs
   * `setTodoDetailId` from the todo half above, and everything below —
   * the grid filters, the mutation layer, the creation flow — takes
   * `setSelectedId` from it.
   */
  const {
    selectedId,
    setSelectedId,
    sidebarTab,
    setSidebarTab,
    handleSelectItem,
    handleItemActivate,
    handleItemOpenDetail,
    handleItemContextMenu,
  } = useScheduleSelection({
    isWide,
    deferPopover,
    cancelPopover,
    setPopover,
    setOverlayOpen,
    setTodoDetailId,
  });

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

  // ── The grid's two filters, and everything drawn from them (#889) ─────────
  // #466: the grid's view of the range. The filter is applied HERE and nowhere
  // upstream — `rangeItems` stays the whole truth for `selected`, the mutation
  // layer and the context menu, so hiding a row never changes what an edit
  // writes and a hidden item stays editable from the flow tab. `hiddenRepeats`
  // rides along from the same call, so the toolbar's count cannot disagree
  // with what the grid actually dropped.
  const {
    repeatsHidden,
    hiddenRepeats,
    selectedTagIds,
    activeGroupId,
    groupChips,
    tagCounts,
    hiddenByTags,
    gridItems,
    monthItems,
    anchorDayItems,
    handleToggleRepeats,
    handleSelectGroup,
    handleToggleTag,
    revealOnGrid,
    clearTagLens,
  } = useScheduleGridFilters({
    rangeItems,
    rangeTodoChips,
    tagGroups,
    allTags,
    allAssignments,
    isWide,
    anchorDate,
    selected,
    setSelectedId,
    setPopover,
  });

  // #1173: everything the filter panel draws, assembled from the two Contexts
  // and the filter state above. It lives in a hook rather than inside the
  // panel because the panel is pure presentation (§3.1 / §6.4) — that is what
  // makes it testable in jsdom, which this host is not.
  const tagFilterPanel = useTagFilterPanel({
    selectedTagIds,
    tagCounts,
    onToggleTag: handleToggleTag,
    onClear: clearTagLens,
    onApplyGroup: handleSelectGroup,
  });

  /*
   * Palette "open this event" intent (#503). Three moves, in this order: clear
   * whatever is filtering the grid (#520), put the event's day in the window,
   * then select it. The row itself may not be in `rangeItems` for another
   * moment — the anchor change triggers the fetch and nothing pre-loads
   * outside the window — but selection is by id, so it simply starts showing
   * once the range lands.
   *
   * Consumed immediately (like pendingNewTodo), so coming back to the Calendar
   * later does not re-select an event the user has moved on from. #467 retired
   * the Mobile month agenda and the separate `mobileSelectedDay` it read, so
   * the anchor is now the only day either layout draws from — moving it is the
   * whole job.
   */
  useEffect(() => {
    if (!pendingSelectEvent) return;
    // All three of these are setStates in an effect — the shape the
    // cascading-render rule (react-hooks/set-state-in-effect) exists to catch.
    // They are still deliberate, for the same reason they always were: they
    // fire once per arrival (a user navigating from the palette, not a render
    // loop), and the intent exists only as a PROP, so there is no event
    // handler inside this component to move them into. Same shape and same
    // reasoning as the todo handoff (useTodoDetailTarget.ts:112).
    //
    // The `eslint-disable-next-line` this block used to carry is GONE, and its
    // absence is not a relaxation: the rule only sees LOCAL useState setters,
    // and since #889 all three arrive from hooks it cannot see through
    // (useScheduleGridFilters / useCalendarNav / useScheduleSelection), so
    // there is nothing left here for it to report — or for a directive to
    // suppress. Nothing forced the removal: a stale directive is a warning,
    // and `eslint .` passes with warnings (measured on this config), so it
    // could have sat here for years saying nothing. Putting the state back in
    // this file would bring back both the report and the need for the line.
    //
    // `setSelectedId` joined the deps for the same reason and is inert: it is
    // still React's own useState dispatch, handed straight out of the hook, so
    // it never changes identity — exhaustive-deps simply cannot prove that
    // through a custom hook and asks for it by name.
    revealOnGrid();
    setAnchorDate(pendingSelectEvent.date);
    setSelectedId(pendingSelectEvent.id);
    onConsumePendingEvent?.();
  }, [
    pendingSelectEvent,
    setAnchorDate,
    onConsumePendingEvent,
    revealOnGrid,
    setSelectedId,
  ]);

  // Mutation layer (#280 → useScheduleMutations): every write path plus the
  // #279 repeat/scope machinery (#299 retired the #278 pending-draft guard).
  const {
    scopeRequest,
    closeScopeRequest,
    handleScopeChoose,
    handleUpdate,
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
    onMoveTodoChip: handleTodoChipMove,
    onResizeTodoChip: handleTodoChipResize,
    onDropTodoChipAllDay: handleTodoChipDropAllDay,
    onRepeatConvertFailed: handleRepeatConvertError,
    copySuffix: t("scheduleScreen.copySuffix"),
  });

  /*
   * Tutorial tour reporting (#1124), the event half. Two of the Schedule steps
   * advance on a real write, so the host tells the tour when one lands. Wrapped
   * HERE rather than inside useScheduleMutations / useScheduleCreateFlow on
   * purpose: those two are deliberately context-free so they render under
   * `renderHook` with no Provider at all (see their headers), and reaching into
   * a Context from inside them would take that away. CalendarTab already needs
   * the whole Provider chain, so the coupling costs nothing new here.
   *
   * `reportTourAction` is declared with the todo wrappers above and is stable
   * for the component's lifetime (useTourAction), so neither wrapper adds a
   * dependency that changes as the tour walks.
   */
  const handleCreateReported = useCallback<typeof handleCreate>(
    (slot, title, onSaved) => {
      const id = handleCreate(slot, title, onSaved);
      reportTourAction(TOUR_ACTIONS.scheduleEventCreated);
      return id;
    },
    [handleCreate, reportTourAction],
  );

  const handleUpdateReported = useCallback<typeof handleUpdate>(
    (id, patch) => {
      handleUpdate(id, patch);
      // Only a TIME edit advances the step, because that is what the step
      // asks for — renaming the event teaches nothing about the calendar.
      // Read off the patch rather than the item: the pane sends only the
      // fields the user actually changed.
      if (patch.startTime !== undefined || patch.endTime !== undefined) {
        reportTourAction(TOUR_ACTIONS.scheduleEventTimeChanged);
      }
    },
    [handleUpdate, reportTourAction],
  );

  // #889: the creation panel's four openers and five committers, as one hook.
  // It has to sit here rather than beside the other handlers — `handleCreate`
  // comes out of the call above, and its own outputs are only read from the
  // JSX far below.
  const {
    handleToolbarAdd,
    handleGridCreateAt,
    handleMonthCreate,
    handleCreateSubmit,
    handleCreateSubmitAndOpen,
    handleCreateTodoSubmit,
    handlePlaceTodoSubmit,
  } = useScheduleCreateFlow({
    createPanel,
    setCreatePanel,
    setPopover,
    anchorDate,
    isWide,
    setSelectedId,
    setOverlayOpen,
    handleCreate: handleCreateReported,
    addNode,
    updateNode,
    attachNote,
    onAttachError: handleAttachError,
    clearTagLens,
  });

  // #355: drop a bubble still waiting its turn the moment anything else
  // opens (the hook holds the why, and the list of what counts as anything).
  useCancelDeferredPopover({
    overlayOpen,
    createPanel,
    tagFilterOpen,
    scopeRequest,
    todoDetailId,
    cancelPopover,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  // Every `t(...)` bundle this host injects into the shared parts (#673 / C6 —
  // pinned in web/tests/scheduleCopy.test.ts). No component state goes in, so
  // the whole bundle is readable from a test without the Provider chain.
  const {
    weekdayLabels,
    freqCopy,
    desktopViewOptions,
    toolbarLabels,
    sidebarTabs,
    repeatLabels,
    createPanelLabels,
    formatDuration,
    formatGapLabel,
  } = useScheduleCopy({
    isWide,
    notesError,
    selectedTagCount: selectedTagIds.length,
  });

  /*
   * #889: the date/label derivations, in one hook. Everything in it is bound
   * to a value that moves — the anchor day, today, the effective view, the
   * minute clock — which is why these are memos here rather than pure helpers
   * beside `formatShortDate` in scheduleCopy.ts.
   *
   * The dependency lists came out unchanged, deliberately: they are what keeps
   * the calendar from re-formatting itself on every keystroke elsewhere in
   * this file (`formatFullDay` alone feeds useScheduleRepeats' copy bundle).
   */
  const {
    formatDayDate,
    periodLabel,
    todayLabel,
    anchorDayLabel,
    formatFullDay,
    agendaLabels,
    anchorAgendaLabels,
  } = useScheduleDayLabels({
    anchorDate,
    today,
    view: effView,
    isWide,
    weekStart,
    weekEnd,
    nowMinutes,
  });

  /*
   * #1148: a narrow month-cell tap moves the anchor AND opens the drawer on
   * that day. `pickMonthDay` is unchanged and still the only thing that moves
   * the anchor; the rest lives in `narrowDayTap.ts`, where it is reachable by
   * a test — this host is not (rules/frontend.md §テスト環境の制約).
   *
   * Desktop does not get this: its sidebar is a push-in panel that is already
   * visible, so there is nothing for `open()` to do, and its cells run
   * `handleMonthCreate` (#224) instead.
   */
  const handleNarrowSelectDay = useCallback(
    (dateKey: string) =>
      selectNarrowDay(
        { pickDay: pickMonthDay, setSidebarTab, openSidebar },
        dateKey,
      ),
    [openSidebar, pickMonthDay, setSidebarTab],
  );

  // #889: TODAY, as the rightSidebar shows it — the merged agenda, its two
  // counters, the skipped list and its restore, and the editor's "generated
  // from" caption. Every one of them derives from `contextItems` (the
  // today-anchored provider list), never from the grid's visible range.
  const {
    toAgenda,
    handleAgendaToggle,
    skippedToday,
    handleRestoreSkipped,
    todayAgenda,
    originDetail,
  } = useScheduleTodayAgenda({
    contextItems,
    todayTodoChips,
    undismiss,
    reload,
    selected,
    routines,
    freqCopy,
    weekdayLabels,
    handleTodoToggleComplete,
  });

  /*
   * #1153: the two things the retired Todo tab owned, now owned here.
   *
   * `useTodoLinking` is the "[[" plumbing for the todo BODY — the detail
   * overlay gained a body editor when the board that had one went away, and an
   * editor without this opens no autocomplete and leaves a resolved link inert
   * (#507). It is called at this level rather than inside the overlay because
   * `dataService` lives here, exactly as Notes and Daily do it.
   *
   * `todoAddOpen` is the create dialog. Todos have no day when they are made
   * — that is what the tray's unscheduled group IS — so this deliberately does
   * NOT go through the calendar's creation panel, which exists to place
   * something on a slot.
   */
  const todoLinking = useTodoLinking({ dataService });
  const [todoAddOpen, setTodoAddOpen] = useState(false);

  /*
   * The create dialog opens from the shell intent by ADJUSTING STATE WHILE
   * RENDERING rather than from the effect below — React's own pattern, and the
   * shape the retired useTodoAddDialog used for exactly this flag. A
   * synchronous setState inside an effect cascades an extra render pass, which
   * is what react-hooks/set-state-in-effect objects to. The effect keeps the
   * parts that are not local state (the tab, the drawer, the consume).
   */
  const [prevPendingNewTodo, setPrevPendingNewTodo] = useState(pendingNewTodo);
  if (pendingNewTodo !== prevPendingNewTodo) {
    setPrevPendingNewTodo(pendingNewTodo);
    if (pendingNewTodo) setTodoAddOpen(true);
  }

  const handleCreateTodo = useCallback(
    (input: { title: string }) => {
      const node = addNode("task", null, input.title);
      setTodoAddOpen(false);
      // Straight into the detail: a title alone is rarely the whole thought,
      // and this is the surface that can take the rest of it.
      setTodoDetailId(node.id);
      // #1124: the only route that MAKES a todo, so it is the only one the
      // tour's create step can wait on. The tray's "add to today" moves an
      // existing one onto a day, which is not what the step teaches.
      reportTourAction(TOUR_ACTIONS.scheduleTodoCreated);
    },
    [addNode, reportTourAction, setTodoDetailId],
  );

  const editorItem: EventEditorItem | null = toEditorItem(selected);

  // ── Repeat section (#185 Step 3 / #408 / #889) ─────────────────────────────
  const {
    repeatValue,
    summaryRows,
    listDate,
    repeatRows,
    handleOpenRepeat,
    handleDeleteRepeat,
  } = useScheduleRepeats({
    routines,
    selected,
    sidebarTab,
    now,
    copy: { freq: freqCopy, weekdayLabels, formatFullDay },
    nav: { setAnchorDate, revealOnGrid, isWide, closeSidebar },
    writes: {
      ensureRoutineItemsForDateRange,
      deleteRoutine,
      reload,
      showToast,
    },
    // #1279: the series delete asks through the same dialog as everything else
    // on this screen — the row used to arm itself in place instead.
    askConfirm,
  });

  // #625 Event <-> Todo conversion. The whole path — the two blocking
  // checks, the five sentences the dialogs pick between, the per-id in-flight
  // guard and the two store re-reads — lives in useItemConversion (#889).
  const { handleConvertToTodo, handleConvertToEvent } = useItemConversion({
    dataService,
    rangeItems,
    contextItems,
    todoNodes,
    listDate,
    reload,
    refetchTodos,
    showToast,
    askConfirm,
    closePopover: () => setPopover(null),
    closeTodoDetail: () => setTodoDetailId(null),
    // #998: the row is about to stop being an event, so the surface that edits
    // events cannot stay open on it. Both, because "closed" differs by layout —
    // the overlay flag on Desktop, the selection on narrow (see detailFrameEl).
    closeEditor: () => {
      setOverlayOpen(false);
      setSelectedId(null);
    },
    push: undoRedo?.push,
  });

  const showLoading = isLoading && rangeItems.length === 0;
  // Full-screen error only when there is nothing to show; a range-fetch
  // failure with stale items on screen degrades to the retry banner below
  // (#296 — blanking a populated calendar over a transient error reads as
  // "my items vanished").
  const showError = !!error || (rangeError && rangeItems.length === 0);
  // The other half of that rule, and why the condition stayed behind when the
  // three surfaces moved into shared/ (<ScheduleStateCards>): WHICH of them is
  // right is a fact about this host's data, not something a card can look up.
  const rangeErrorBanner =
    rangeError && rangeItems.length > 0 ? (
      <ScheduleRangeErrorBanner
        labels={{
          message: t("scheduleScreen.loadError"),
          retry: t("scheduleScreen.retry"),
        }}
        onRetry={reload}
      />
    ) : null;

  /*
   * #1148: what the flow tab shows on NARROW — the anchor day rather than
   * today, because narrow no longer has a second list to read a picked day
   * from. Desktop is untouched: it keeps today, its own labels and its
   * now-line, which is why every field below is a fold rather than a
   * replacement.
   *
   * Both are computed behind `isWide` on purpose. The merge and the two counts
   * used to sit in the narrow JSX branch, where an untaken ternary is simply
   * never evaluated; hoisting them up here without the guard would make
   * Desktop pay for a list it does not draw.
   */
  const narrowDayAgenda = isWide
    ? null
    : toAgenda(
        anchorDayItems,
        rangeTodoChips.filter((c) => c.date === anchorDate),
      );

  /*
   * #1153: the shell's todo intents, each consumed once.
   *
   * All three open the tray rather than only switching state, because on
   * narrow the sidebar is a drawer: setting the tab of a panel nobody can see
   * would make every one of these read as doing nothing.
   */
  useEffect(() => {
    if (!pendingTodoTray) return;
    setSidebarTab("todo");
    openSidebar?.();
    onConsumeTodoTray?.();
  }, [onConsumeTodoTray, openSidebar, pendingTodoTray, setSidebarTab]);

  useEffect(() => {
    if (!pendingNewTodo) return;
    setSidebarTab("todo");
    openSidebar?.();
    onConsumeNewTodo?.();
  }, [onConsumeNewTodo, openSidebar, pendingNewTodo, setSidebarTab]);

  useEffect(() => {
    if (!pendingSelectTodoId) return;
    // The detail is an overlay, not a tab, so this one does not touch the
    // sidebar: a "[[" click asks for one todo, not for the list.
    setTodoDetailId(pendingSelectTodoId);
    onConsumePendingSelect?.();
  }, [onConsumePendingSelect, pendingSelectTodoId, setTodoDetailId]);

  // Shared rightSidebar (AppShell owns the frame -- a push-in panel on
  // Desktop, a drawer on Mobile). One portal either way so contentCount stays
  // 1 (#299 removed the old detail tab -- item detail now lives in a
  // body-level overlay). #889 moved the three tab bodies into
  // <ScheduleSidebar>; the layout fold that decides which one renders moved
  // with them.
  const sidebarPortal = (
    <RightSidebarPortal>
      <ScheduleSidebar
        isWide={isWide}
        tabs={sidebarTabs}
        tab={sidebarTab}
        onTabChange={setSidebarTab}
        flow={{
          // #1148: narrow follows the picked day; Desktop stays on today.
          todayLabel: isWide ? todayLabel : anchorDayLabel,
          agenda: narrowDayAgenda ?? todayAgenda,
          // The anchor variant's empty state names the day it is showing
          // (#774) — "今日は予定がありません" on some other day is a lie.
          agendaLabels: isWide ? agendaLabels : anchorAgendaLabels,
          // No now-line on a day that is not today: the hour it marks means
          // nothing there.
          nowMinutes: isWide || anchorDate === today ? nowMinutes : null,
          selectedId,
          // #691, arriving with the day list: narrow stands in for the week
          // grid, so its rows carry their duration and the gaps between them.
          dayflow: !isWide,
          formatGapLabel: isWide ? undefined : formatGapLabel,
          // #1148 option A: the phone's only create route now lives on this
          // heading row. Desktop keeps the toolbar button and gets no second
          // one.
          onAdd: isWide ? undefined : handleToolbarAdd,
          addLabel: isWide ? undefined : t("scheduleScreen.addCta"),
          skipped: skippedToday,
          summaryRows,
          onToggleComplete: handleAgendaToggle,
          onItemActivate: handleItemActivate,
          onItemDoubleClick: handleItemOpenDetail,
          onRestoreSkipped: handleRestoreSkipped,
        }}
        repeats={{
          hidden: repeatsHidden,
          rows: repeatRows,
          onOpen: handleOpenRepeat,
          onDelete: handleDeleteRepeat,
          onShowHidden: handleToggleRepeats,
        }}
        todo={{
          placed: todoPlaced,
          unplaced: todoUnplaced,
          addable: todoAddable,
          onToggleComplete: handleTodoToggleComplete,
          onAddCandidate: handleTodoAddCandidate,
          // #1153: both groups open the same overlay. They used to jump to the
          // Kanban tab, which no longer exists — and the overlay was already
          // the surface a chip press opened, so this makes one detail answer
          // for every route into a todo rather than two that could drift.
          onOpenTodo: setTodoDetailId,
          onOpenAddable: setTodoDetailId,
          onDelete: handleTodoDelete,
          onAdd: () => setTodoAddOpen(true),
        }}
      />
    </RightSidebarPortal>
  );

  /*
   * #889: the whole overlay layer, in one element. The two detail frames and
   * the chip lookup behind the bubble moved into <ScheduleOverlayHost> with the
   * set they feed — WHERE it mounts is still this host's call (both returns
   * below place it), but WHAT it contains no longer is.
   */
  const overlaysEl = (
    <ScheduleOverlayHost
      isWide={isWide}
      editor={{
        item: editorItem,
        overlayOpen,
        onCloseOverlay: () => setOverlayOpen(false),
        onClearSelection: () => setSelectedId(null),
        askConfirm,
        // The SERIES id, when this occurrence came from one — the tag slot
        // writes against it rather than against the regenerated row (#468).
        routineId: selected?.routineId,
        // #628: one commit per press, carrying everything that changed. It goes
        // to handleUpdate whole — that is what keeps a routine occurrence's
        // scope dialog (#279) to one appearance and makes cancelling it discard
        // the entire save rather than half of it. Nothing is written on blur any
        // more, so the day move and the all-day flip are plain capabilities
        // rather than callbacks: the pane holds them in its draft until the
        // button.
        handlers: {
          onSave: handleUpdateReported,
          onDismiss: handleDismiss,
          onDelete: handleDelete,
        },
        options: {
          originDetail,
          canEditDate: true,
          canEditAllDay: true,
          formatDuration,
        },
        repeat: {
          value: repeatValue,
          weekdayLabels,
          labels: repeatLabels,
          pending: repeatConverting,
          onChange: handleChangeRepeat,
          onDetach: handleDetachRepeat,
        },
        onConvertToTodo: handleConvertToTodo,
      }}
      todoDetail={{
        todoId: todoDetailId,
        todoNodes,
        onClose: () => setTodoDetailId(null),
        writes: {
          updateNode,
          toggleStatus: toggleTodoStatusReported,
          setStatus: setTodoStatusReported,
          onDelete: handleTodoDetailDelete,
        },
        onConvertToEvent: handleConvertToEvent,
        linking: todoLinking,
        onNavigateToItem,
        askConfirm,
      }}
      popover={{
        state: popover,
        selected,
        findTodoChip,
        onClose: () => setPopover(null),
        onOpenDetail: handleItemOpenDetail,
        itemActions: {
          onRename: handleRename,
          onDuplicate: handleDuplicate,
          onConvertToTodo: handleConvertToTodo,
          onDelete: handleDelete,
        },
        todoActions: {
          // The catch-all tree label: a rename is not a move, so none of the
          // position-shaped todoChip* words fit (useTodoTreeHistory).
          onRename: (id, title) =>
            updateNode(id, { title }, { undoLabel: "todoTreeChange" }),
          onDelete: handleTodoDelete,
          onConvertToEvent: handleConvertToEvent,
        },
      }}
      create={{
        panel: createPanel,
        anchorDate,
        onClose: () => setCreatePanel(null),
        pools: { todos: todoAddable, notes: noteOptions },
        handlers: {
          onSubmitEvent: handleCreateSubmit,
          onSubmitEventAndOpen: handleCreateSubmitAndOpen,
          onCreateTodo: handleCreateTodoSubmit,
          onPlaceTodo: handlePlaceTodoSubmit,
        },
        formatDuration,
        labels: createPanelLabels,
      }}
      tagFilter={{
        open: tagFilterOpen,
        onClose: () => setTagFilterOpen(false),
        panel: tagFilterPanel,
      }}
      scope={{
        request: scopeRequest,
        onChoose: handleScopeChoose,
        onClose: closeScopeRequest,
      }}
      confirm={{ request: confirmRequest, onResolve: resolveConfirm }}
    />
  );

  // ── Both layouts ──────────────────────────────────────────────────────────
  //
  // ONE return, with a ternary between the two bodies, so the portal and the
  // overlay set are placed once instead of at the tail of two separate ones.
  // That is #889's drift argument again: the two hand-listed overlay sets had
  // parted far enough that Desktop lost its <ConfirmDialog> and every confirm
  // asked there hung forever. What each body draws, and why, lives in its own
  // header comment.
  //
  // The narrow day's rows are still merged behind an `isWide` fold, just no
  // longer in this JSX: #1148 moved the list itself into the drawer, so the
  // merge moved up to where the sidebar's props are built. The guard came with
  // it for the same reason it existed — Desktop must not pay to merge a list
  // it does not draw.
  return (
    <>
      {sidebarPortal}
      {isWide ? (
        <CalendarDesktopLayout
          view={desktopView}
          toolbar={{
            periodLabel,
            viewOptions: desktopViewOptions,
            labels: toolbarLabels,
            repeatsHidden,
            hiddenRepeats,
            onToday: goToday,
            onPrev: () => step(-1),
            onNext: () => step(1),
            onChangeView: setView,
            onToggleRepeats: handleToggleRepeats,
            onOpenFilter: () => setTagFilterOpen(true),
            filterActive: selectedTagIds.length > 0,
            onAddEvent: handleToolbarAdd,
          }}
          lens={{
            chips: groupChips,
            activeId: activeGroupId,
            hiddenCount: hiddenByTags,
            onChange: handleSelectGroup,
            filtered: selectedTagIds.length > 0,
            onClear: clearTagLens,
          }}
          banner={rangeErrorBanner}
          state={{ loading: showLoading, error: showError, onRetry: reload }}
          data={{
            anchorDate,
            weekStart,
            today,
            monthItems,
            gridItems,
            selectedId,
            nowMinutes,
          }}
          labels={{ weekdays: weekdayLabels }}
          handlers={{
            onItemActivate: handleItemActivate,
            onItemDoubleClick: handleItemOpenDetail,
            onItemContextMenu: handleItemContextMenu,
            onMonthCreate: handleMonthCreate,
            onCreateAt: handleGridCreateAt,
            onMoveItem: handleMoveItem,
            onResizeItem: handleResizeItem,
            onDropAllDay: handleDropAllDay,
          }}
          format={{ fullDay: formatFullDay, dayDate: formatDayDate }}
        />
      ) : (
        <CalendarNarrowLayout
          header={{
            periodLabel,
            onPrev: () => step(-1),
            onNext: () => step(1),
            onToday: goToday,
          }}
          banner={rangeErrorBanner}
          state={{ loading: showLoading, error: showError, onRetry: reload }}
          month={{
            anchorDate,
            today,
            weekdayLabels,
            items: monthItems,
            onSelectDay: handleNarrowSelectDay,
            formatDayLabel: formatFullDay,
          }}
        />
      )}
      {overlaysEl}
      {/* #1153: mounted for BOTH layouts, like the overlay set beside it. The
          two returns above used to hand-list their own overlays and drifted
          (see the ScheduleOverlays header); a create dialog that existed on one
          width only would be the same mistake with a new name. */}
      <TodoAddDialog
        open={todoAddOpen}
        onClose={() => setTodoAddOpen(false)}
        onSubmit={handleCreateTodo}
        labels={{
          title: t("scheduleScreen.todoAddDialogTitle"),
          titleLabel: t("kanban.addTitleLabel"),
          titlePlaceholder: t("kanban.addTitlePlaceholder"),
          submit: t("kanban.addSubmit"),
          cancel: t("kanban.addCancel"),
        }}
      />
    </>
  );
}
