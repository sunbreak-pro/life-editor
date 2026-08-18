import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useScheduleItemsContext,
  useRoutineContext,
  useSyncDomains,
  useTodoTreeContext,
  useCalendarContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  useMediaQuery,
  useRightSidebarOptional,
  WeekTimeGrid,
  MonthGrid,
  AgendaList,
  ScheduleToolbar,
  EventEditorPane,
  RightSidebarPortal,
  CalendarLensRow,
  ResponsiveDetailFrame,
  ItemRoleBadge,
  useConfirmDialog,
  useScheduleItemsRoutineSync,
  useDeferredAction,
  useToast,
  minutesToTime,
  isTodoChip,
  unwrapTodoChipId,
  frequencyLabel,
  useMinuteClock,
  type TodoCalendarChip,
  type ScheduleItem,
  type AgendaItem,
  type EventEditorItem,
  type DataService,
  AddPill,
  WIDE_QUERY,
  type TranslationKey,
} from "@life-editor/shared";
import { ScheduleSidebar } from "./ScheduleSidebar";
import { TagPicker } from "../wikitag/TagPicker";
import { TagColorControls } from "../wikitag/TagColorControls";
import { useCreatePanelNotes } from "./useCreatePanelNotes";
import { useCalendarNav } from "./useCalendarNav";
import { useVisibleRangeItems } from "./useVisibleRangeItems";
import { useScheduleMutations } from "./useScheduleMutations";
import { useScheduleOverlays } from "./useScheduleOverlays";
import { useItemConversion } from "./useItemConversion";
import { ScheduleOverlays } from "./ScheduleOverlays";
import { ScheduleTodoDetail } from "./ScheduleTodoDetail";
import { useScheduleTodoChips } from "./useScheduleTodoChips";
import { useScheduleRepeats } from "./useScheduleRepeats";
import { useScheduleGridFilters } from "./useScheduleGridFilters";
import { useScheduleCreateFlow } from "./useScheduleCreateFlow";
import { decideUnsavedClose } from "./unsavedCloseGuard";
import { itemTapRoute } from "./todoChipPanel";
import { agendaEmptyKey } from "./agendaEmptyLabel";
import { useScheduleRoleLabels } from "./scheduleRoleLabels";
import { toAgendaItems, toEditorItem } from "./scheduleViewModels";
import {
  formatFullDay as formatFullDayKey,
  formatPeriodLabel,
  formatShortDate,
  useScheduleCopy,
} from "./scheduleCopy";

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
  onOpenTodos,
  pendingSelectEvent,
  onConsumePendingEvent,
}: {
  dataService: DataService;
  /** Jump to the Todos section (Today's Todo tray title click — A-3 / #298). */
  onOpenTodos: () => void;
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
  const roleLabels = useScheduleRoleLabels();
  const isWide = useMediaQuery(WIDE_QUERY, true);
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
    // #878: Mobile's main view IS the month, so `effView` is "month" there and
    // the fetch window, the step size and the period label follow without a
    // second switch here. A cell tap moves the anchor — which is the day the
    // list under the grid shows.
    pickMonthDay,
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
  // #889: everything that can be covering the grid — the single-click bubble
  // (#299), the detail overlay, the creation panel (target day + prefilled
  // window; Desktop shows it in an overlay, Mobile in the QuickCaptureSheet)
  // and the calendars modal. One group, because they answer one question.
  const {
    popover,
    setPopover,
    overlayOpen,
    setOverlayOpen,
    createPanel,
    setCreatePanel,
    calendarsOpen,
    setCalendarsOpen,
  } = useScheduleOverlays();
  // #889: one clock, two shapes. `now` compares across days for
  // deriveScheduleStatus (#222); `nowMinutes` places the now-line and the
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
  /*
   * #707: every "are you sure?" on this screen — the two conversions, their
   * two refusals, the cascade delete and the unsaved-draft discard — goes
   * through ONE in-app dialog. They used to be the browser's own alert /
   * confirm, which draw outside the theme (so the same screen asked
   * in two visibly different ways: this one through the OS, the repeat-delete
   * guard in-app) and freeze the page hard enough to stall Playwright.
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
  // Memoised because the hook keeps it in the deps of both delete handlers, and
  // a fresh object per render would rebuild them on every keystroke elsewhere
  // in this file.
  const todoDeleteCopy = useMemo(
    () => ({
      confirm: (name: string) => t("todoDetail.todoDeleteConfirm", { name }),
      cascadeConfirm: (name: string, count: number) =>
        t("todoDetail.todoDeleteCascadeConfirm", { name, count }),
      untitled: t("common.untitled"),
      confirmLabel: t("todoDetail.delete"),
      cancelLabel: t("common.cancel"),
    }),
    [t],
  );
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
    setTodoStatus,
    softDeleteTodo,
    today,
    rangeStart,
    rangeEnd,
    askConfirm,
    copy: todoDeleteCopy,
  });

  // Selection = highlight only (#299). The grid ring follows selectedId; the
  // duplicate handler re-selects the copy. Bubble / overlay opening is handled
  // by the activate/open-detail handlers below.
  const handleSelectItem = useCallback((id: string) => {
    // A chip id is not a ScheduleItem id, and this path exists to point the
    // schedule-item surfaces (editor pane / mutation layer) at a row. Todo
    // chips DO answer a click since #564 — through handleItemActivate, which
    // opens their own panel — so this guard is about the id's shape, not about
    // chips being read-only.
    if (isTodoChip(id)) return;
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
  // #564: todo chips come through here too. They used to be dropped on the
  // spot (the A-1 "read-only display" rule), which by now was only true of the
  // click — #297/#298/#569 had made the same chip draggable, so the all-day
  // lane ended up with chips that answered a drag but not a click. They open
  // the same bubble with the todo action set (see todoChipPanel.ts).
  //
  // #761: on NARROW they used to be dropped instead, selection included, for
  // want of a surface to send them to. They now open the todo detail sheet —
  // see itemTapRoute.
  const handleItemActivate = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      if (itemTapRoute(id, isWide) === "todoSheet") {
        // Deliberately not selected on the way in: `selectedId` drives the
        // EVENT surfaces (the ring, the narrow editor sheet), and a chip id
        // resolves none of them.
        setTodoDetailId(unwrapTodoChipId(id));
        return;
      }
      setSelectedId(id);
      if (isWide) deferPopover(() => setPopover({ id, x: pos.x, y: pos.y }));
    },
    [isWide, deferPopover, setPopover, setTodoDetailId],
  );

  // #299 "詳細を編集" (bubble) / double-click: open the detail-edit surface —
  // the body-level overlay on Desktop, the BottomSheet on Mobile (selectedId
  // drives it). Closes any open bubble; one still waiting to appear is dropped
  // by the "another surface opened" effect below (#355).
  //
  // #564: a todo chip's detail is not this overlay — EventEditorPane edits a
  // schedule_item, and a todo has none. #626 gives the chip its own in-place
  // surface on Desktop (TodoDetailPanel in an ItemDetailOverlay), so tags are
  // editable without leaving Schedule.
  //
  // #761: narrow gets the same panel in a BottomSheet, so it no longer answers
  // with a jump to another section. The Todos hand-off is still there — as a
  // button inside the panel, where it is the user's choice rather than the only
  // thing the row can do.
  const handleItemOpenDetail = useCallback(
    (id: string) => {
      setPopover(null);
      if (isTodoChip(id)) {
        setTodoDetailId(unwrapTodoChipId(id));
        return;
      }
      setSelectedId(id);
      if (isWide) setOverlayOpen(true);
    },
    [isWide, setOverlayOpen, setPopover, setTodoDetailId],
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

  // ── The grid's two filters, and everything drawn from them (#889) ─────────
  const {
    repeatsHidden,
    hiddenRepeats,
    activeCalendar,
    calendarChips,
    hiddenByCalendar,
    gridItems,
    monthItems,
    anchorDayItems,
    handleToggleRepeats,
    handleSelectCalendar,
    revealOnGrid,
    clearCalendarLens,
  } = useScheduleGridFilters({
    rangeItems,
    rangeTodoChips,
    calendars,
    allTags,
    allAssignments,
    isWide,
    now,
    anchorDate,
    selected,
    setSelectedId,
    setPopover,
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
    // Local setStates, which the cascading-render rule flags. ONE directive
    // because the rule reports only the first such call in an effect; it has
    // to sit above whichever line comes first, or the directive itself goes
    // unused (a warning) and the real report moves. Since #889 that is
    // setSelectedId: the rule only sees LOCAL useState setters, and both
    // revealOnGrid and setAnchorDate now arrive from hooks it cannot see
    // through (useScheduleGridFilters / useCalendarNav).
    //
    // They fire once per arrival — a user navigating from the palette, not a
    // render loop — and the intent exists only as a PROP, so there is no event
    // handler inside this component to move them into. Same shape and same
    // reasoning as the todo handoff (useTodoDetailTarget.ts:112).
    revealOnGrid();
    setAnchorDate(pendingSelectEvent.date);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(pendingSelectEvent.id);
    onConsumePendingEvent?.();
  }, [pendingSelectEvent, setAnchorDate, onConsumePendingEvent, revealOnGrid]);

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
    onMoveTodoChip: handleTodoChipMove,
    onResizeTodoChip: handleTodoChipResize,
    onDropTodoChipAllDay: handleTodoChipDropAllDay,
    onRepeatConvertFailed: handleRepeatConvertError,
    copySuffix: t("scheduleScreen.copySuffix"),
  });

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
    handleCreate,
    addNode,
    updateNode,
    attachNote,
    onAttachError: handleAttachError,
    clearCalendarLens,
  });

  /*
   * #761: the agenda's completion tag, for BOTH kinds of row. The lists mix
   * schedule items and todo chips, and the two have different write paths — a
   * chip's completion is a TodoTree status, not a schedule_item's `completed`
   * flag — so the row's id is what decides which one runs. Sending a chip id to
   * `handleToggle` would look up a schedule_item that is not there and write
   * nothing: the same silent no-op the Issue is about.
   */
  const handleAgendaToggle = useCallback(
    (id: string) => {
      if (isTodoChip(id)) handleTodoToggleComplete(unwrapTodoChipId(id));
      else handleToggle(id);
    },
    [handleTodoToggleComplete, handleToggle],
  );

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
      todoDetailId != null
    ) {
      cancelPopover();
    }
  }, [
    overlayOpen,
    createPanel,
    calendarsOpen,
    scopeRequest,
    todoDetailId,
    cancelPopover,
  ]);

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
      // Same narrow routing as handleItemActivate — a long press is the
      // gesture that produces this on a phone, and it must not land somewhere
      // the tap beside it does not (#761).
      if (itemTapRoute(id, isWide) === "todoSheet") {
        cancelPopover();
        setTodoDetailId(unwrapTodoChipId(id));
        return;
      }
      cancelPopover();
      setSelectedId(id);
      if (isWide) setPopover({ id, x: pos.x, y: pos.y });
    },
    [isWide, cancelPopover, setPopover, setTodoDetailId],
  );

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
    statusLabels,
    createPanelLabels,
    formatDuration,
    formatGapLabel,
  } = useScheduleCopy({ isWide, notesError });

  const formatDayDate = useCallback(
    (key: string) => formatShortDate(i18n.language, key),
    [i18n.language],
  );

  const periodLabel = useMemo(
    () =>
      formatPeriodLabel({
        language: i18n.language,
        anchorDate,
        view: effView,
        isWide,
        weekStart,
        weekEnd,
      }),
    [anchorDate, effView, isWide, i18n.language, weekStart, weekEnd],
  );

  // #353 put the target day on screen as a caption, because the three gestures
  // that open the panel (toolbar / empty slot / month cell) each carry their
  // own day and none of them said so. #940 turned that caption into the date
  // input inside the panel, which formats itself — so the label is gone and
  // the day is now something the user can change rather than only read.

  const todayLabel = useMemo(
    () => formatFullDayKey(i18n.language, today),
    [today, i18n.language],
  );

  // #878: the day the Mobile list under the month grid is showing. No year —
  // the header right above it names the month and the year already.
  const anchorDayLabel = useMemo(
    () => formatFullDayKey(i18n.language, anchorDate),
    [anchorDate, i18n.language],
  );

  // Month-cell accessible names (MonthGrid falls back to the raw ISO key —
  // a screen reader would announce "2026-07-09").
  const formatFullDay = useCallback(
    (key: string) => formatFullDayKey(i18n.language, key),
    [i18n.language],
  );

  // #466: the grid's view of the range. The filter is applied HERE and nowhere
  // upstream — `rangeItems` stays the whole truth for `selected`, the mutation
  // layer and the context menu, so hiding a row never changes what an edit
  // writes and a hidden item stays editable from the flow tab. `hiddenRepeats`
  // rides along from the same call, so the toolbar's count cannot disagree
  // with what the grid actually dropped.
  // Merge schedule items + todo chips into a single sorted agenda.
  //
  // #761: todo rows carry a derived status too. They used to be left without
  // one — the A-3 note below said completion "lands in Step 3 (TodoTree API)",
  // and it did (handleTodoToggleComplete, used by the tray since #298) — but
  // the agenda was never wired to it, so the Mobile day list ended up with todo
  // rows that showed no tag and answered no press while the event beside them
  // did both. The status is derived exactly as an event's is: the chip carries
  // the same date / start / all-day / completed facts.
  const toAgenda = useCallback(
    (arr: ScheduleItem[], chips: TodoCalendarChip[] = []): AgendaItem[] =>
      toAgendaItems(arr, chips, now),
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
    () => toAgenda(todayItems, todayTodoChips),
    [todayItems, todayTodoChips, toAgenda],
  );
  const todayDone = todayItems.filter((i) => i.completed).length;
  const todayTotal = todayItems.length;

  const editorItem: EventEditorItem | null = toEditorItem(selected, now);

  const originDetail = useMemo(() => {
    if (!selected || selected.routineId == null) return undefined;
    const r = routines.find((x) => x.id === selected.routineId);
    return r ? frequencyLabel(r, freqCopy, weekdayLabels) : undefined;
  }, [selected, routines, freqCopy, weekdayLabels]);

  // ── Repeat section (#185 Step 3 / #408 / #889) ─────────────────────────────
  const {
    repeatValue,
    summaryRows,
    routineDone,
    routineTotal,
    listDate,
    repeatRows,
    handleOpenRepeat,
    handleDeleteRepeat,
  } = useScheduleRepeats({
    routines,
    selected,
    todayItems,
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
  });

  const agendaLabels = {
    allDay: t("scheduleScreen.allDay"),
    empty: t("scheduleScreen.emptyToday"),
    nowLabel: minutesToTime(nowMinutes),
    complete: t("scheduleScreen.complete"),
    statusLabels,
  };
  /*
   * #774: the same labels for the Mobile day list, whose empty state has to
   * name the day it is actually showing. The list above is the Dayflow tab —
   * always today — so it keeps `emptyToday` as it stands.
   */
  const anchorAgendaLabels = {
    ...agendaLabels,
    empty: t(agendaEmptyKey(anchorDate, today)),
  };
  /*
   * #628: an unsaved draft must not disappear silently. The pane owns the
   * draft, so it reports the dirty flag here and the close affordances —
   * Escape, backdrop, the sheet's close button — ask before they throw it away.
   * A ref rather than state: nothing on screen depends on it, and re-rendering
   * the whole calendar on every keystroke in the memo field would be a steep
   * price for a flag only event handlers read. The pane clears it on unmount,
   * so a closed editor can never leave a stale "dirty" behind.
   *
   * The decision itself sits in `decideUnsavedClose` (pinned in web/tests, same
   * arrangement as todoChipUndoWiring): CalendarTab needs the whole Provider
   * chain to render, so nothing reachable only from inside it can be tested.
   */
  const editorDirtyRef = useRef(false);
  /*
   * #707: the answer is awaited now, so the surfaces cannot branch on a return
   * value any more — they hand in what closing MEANS for them and this runs it
   * once the user has agreed. Same guard, same two facts it protects
   * (`decideUnsavedClose`); only the question moved in-app.
   */
  const requestEditorClose = useCallback(
    async (close: () => void) => {
      const decision = await decideUnsavedClose({
        dirty: editorDirtyRef.current,
        askDiscard: () =>
          askConfirm({
            message: t("common.unsavedCloseConfirm"),
            confirmLabel: t("common.discard"),
            cancelLabel: t("common.cancel"),
            // Throwing away typed-in work is the destructive answer here, even
            // though nothing is deleted from the database.
            danger: true,
          }),
      });
      if (decision.clearDirty) editorDirtyRef.current = false;
      if (decision.close) close();
    },
    [askConfirm, t],
  );

  // #625 Event <-> Todo conversion. The whole path — the two blocking
  // checks, the five sentences the dialogs pick between, the per-id in-flight
  // guard and the two store re-reads — lives in useItemConversion (#889).
  // #998 hoisted it above `editorPane`, which now references
  // handleConvertToTodo; it used to sit 150 lines further down.
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
  });

  /*
   * #998: the narrow sheet's convert entry runs the same unsaved-draft guard as
   * the close — with one difference that matters. The pending flag is NOT
   * cleared on an agreed discard: the conversion asks its OWN question next
   * (the routine refusal, or the confirm), and a refusal there leaves the draft
   * on screen. With the flag already wiped, the next exit would throw it away
   * without asking. Same reasoning as ScheduleTodoDetail's requestClose (#736).
   */
  const requestEditorConvert = useCallback(
    async (id: string) => {
      const decision = await decideUnsavedClose({
        dirty: editorDirtyRef.current,
        askDiscard: () =>
          askConfirm({
            message: t("common.unsavedCloseConfirm"),
            confirmLabel: t("common.discard"),
            cancelLabel: t("common.cancel"),
            danger: true,
          }),
      });
      if (decision.close) handleConvertToTodo(id);
    },
    [askConfirm, t, handleConvertToTodo],
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
    save: t("scheduleScreen.save"),
    saved: t("scheduleScreen.saved"),
    unsaved: t("scheduleScreen.unsaved"),
    seriesHint: t("scheduleScreen.seriesEditHint"),
    originRoutine: t("scheduleScreen.originRoutine"),
    skipThisDay: t("scheduleScreen.skipThisDay"),
    delete: t("scheduleScreen.delete"),
  };

  const editorPane = editorItem ? (
    <EventEditorPane
      item={editorItem}
      // #995: narrow only — Desktop's <Modal> has no scroller for `sticky` to
      // resolve against.
      stickyFooter={!isWide}
      labels={editorLabels}
      // #628: one commit per press, carrying everything that changed. It goes
      // to handleUpdate whole — that is what keeps a routine occurrence's
      // scope dialog (#279) to one appearance and makes cancelling it discard
      // the entire save rather than half of it. Nothing is written on blur any
      // more, so the day move and the all-day flip are plain capabilities
      // rather than callbacks: the pane holds them in its draft until the
      // button.
      handlers={{
        onSave: handleUpdate,
        onToggleComplete: handleToggle,
        onDirtyChange: (dirty) => {
          editorDirtyRef.current = dirty;
        },
        onDismiss: handleDismiss,
        onDelete: handleDelete,
      }}
      options={{
        originDetail,
        canEditDate: true,
        canEditAllDay: true,
        formatDuration,
      }}
      repeat={{
        value: repeatValue,
        weekdayLabels,
        labels: repeatLabels,
        pending: repeatConverting,
        onChange: handleChangeRepeat,
        onDetach: handleDetachRepeat,
      }}
      // #998: narrow only. Desktop already reaches the conversion from the
      // single-click bubble (#625) — ScheduleOverlays draws that when isWide —
      // and a second entry inside the overlay would be a Desktop-visible change
      // this Issue does not ask for.
      convert={
        isWide
          ? undefined
          : {
              label: t("itemConvert.toTodo"),
              onConvert: (id) => {
                void requestEditorConvert(id);
              },
            }
      }
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
          todayLabel,
          agenda: todayAgenda,
          agendaLabels,
          nowMinutes,
          selectedId,
          doneCount: todayDone,
          totalCount: todayTotal,
          skipped: skippedToday,
          summaryRows,
          routineDoneCount: routineDone,
          routineTotalCount: routineTotal,
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
          onOpenTodo: onOpenTodos,
          onDelete: handleTodoDelete,
        }}
      />
    </RightSidebarPortal>
  );

  /*
   * #564: the chip behind an open bubble, when the bubble belongs to a TODO
   * chip rather than a schedule item.
   *
   * Resolved against the unfiltered `rangeTodoChips` for the same reason
   * `selected` reads `rangeItems`: the calendar lens narrows what the grid
   * DRAWS, and a panel already on screen has to keep acting on its item even if
   * the row behind it stops being drawn (a rename can move it out of the lens).
   *
   * `todayTodoChips` is the second half of the same pair `selected` uses
   * (rangeItems ?? contextItems): the "今日の流れ" agenda always lists TODAY, so
   * with the grid parked on another week its todo rows are in no range chip at
   * all — and looking only at the range would leave that surface with exactly
   * the silently-dead click this Issue is about.
   */
  const popoverTodoChip = popover ? findTodoChip(popover.id) : null;
  // #299 detail-edit overlay (Desktop): the former rightSidebar "詳細" tab body
  // (EventEditorPane) now rides a body-level modal. Mobile keeps the BottomSheet.
  // #628: Escape and the backdrop both land on this one onClose, so guarding it
  // covers every Desktop exit at once.
  //
  // #889: one frame const for both layouts. The overlay and the sheet used to
  // be written out separately — the overlay here, the sheet at the end of the
  // narrow branch — with the same title, the same body and the same close
  // guard in each. What differs is only what "closed" MEANS: Desktop drops the
  // overlay flag, Mobile clears the selection, because on Mobile the selection
  // IS the sheet.
  const detailFrameEl = (
    <ResponsiveDetailFrame
      wide={isWide}
      open={isWide ? overlayOpen && !!editorPane : !!editorPane}
      title={t("scheduleScreen.detailTitle")}
      // #1044: the kind is a glyph in the header now, not a word in the body.
      // Always "event" — a routine OCCURRENCE is still an `items_meta.role =
      // 'event'` row (the UI presents Routine as "an Event with a repeat"), and
      // "routine" is outside the designed kind set, so it would resolve to the
      // neutral fallback.
      titleIcon={<ItemRoleBadge role="event" labels={roleLabels} compact />}
      closeLabel={t("common.close")}
      // #628: Escape, the backdrop and the close button all land here, so the
      // one guard covers every exit on either layout.
      onClose={() => {
        void requestEditorClose(() =>
          isWide ? setOverlayOpen(false) : setSelectedId(null),
        );
      }}
    >
      {editorPane}
    </ResponsiveDetailFrame>
  );

  const todoDetailFrameEl = (
    <ScheduleTodoDetail
      todoId={todoDetailId}
      todoNodes={todoNodes}
      isWide={isWide}
      onClose={() => setTodoDetailId(null)}
      writes={{
        updateNode,
        toggleStatus: toggleTodoStatus,
        onDelete: handleTodoDetailDelete,
      }}
      onConvertToEvent={handleConvertToEvent}
      onOpenTodos={onOpenTodos}
      askConfirm={askConfirm}
    />
  );

  /*
   * #889: every body-level overlay, mounted once for both layouts.
   *
   * The two returns used to hand-list their own — and the lists had drifted:
   * Desktop never mounted the <ConfirmDialog>, so every ask() there returned a
   * promise nothing ever settled (a dirty editor could not be closed at all, a
   * todo delete with children never ran, the Event↔Todo conversion stopped at
   * the confirm). One element, placed by both branches, is what keeps the sets
   * from parting again.
   */
  const overlaysEl = (
    <ScheduleOverlays
      isWide={isWide}
      frames={{ editor: detailFrameEl, todoDetail: todoDetailFrameEl }}
      popover={{
        state: popover,
        selected,
        todoChip: popoverTodoChip,
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
      calendars={{
        open: calendarsOpen,
        onClose: () => setCalendarsOpen(false),
      }}
      scope={{
        request: scopeRequest,
        onChoose: handleScopeChoose,
        onClose: closeScopeRequest,
      }}
      confirm={{ request: confirmRequest, onResolve: resolveConfirm }}
    />
  );

  // #889: the Desktop main area, hoisted out of the return so the layout
  // below reads as what it is — toolbar, lens, body, overlays. Same three
  // states the narrow branch shows, in the wrappers Desktop needs.
  const desktopBody = showLoading ? (
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
        formatMoreCount={(n) => t("scheduleScreen.moreCount", { count: n })}
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
        data={{
          weekStart: desktopView === "day" ? anchorDate : weekStart,
          days: desktopView === "day" ? 1 : 7,
          items: gridItems,
          selectedId,
          todayKey: today,
          nowMinutes,
        }}
        labels={{
          weekdays: weekdayLabels,
          allDay: t("scheduleScreen.allDay"),
          status: statusLabels,
          createSlot: t("scheduleCalendar.createSlot"),
        }}
        handlers={{
          onItemActivate: handleItemActivate,
          onItemDoubleClick: handleItemOpenDetail,
          onItemContextMenu: handleItemContextMenu,
          onCreateAt: handleGridCreateAt,
          onMoveItem: handleMoveItem,
          onResizeItem: handleResizeItem,
          onDropAllDay: handleDropAllDay,
        }}
        display={{ todoInteractive: true, fillHeight: true }}
        format={{ dayDate: formatDayDate }}
      />
    </div>
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
          {/* #468 calendar lens — Desktop only. Its "why is this empty" rules
              (no chips ⇒ no row; the hidden count is the lens's own, not a
              running total) live in the component now (#889). */}
          <CalendarLensRow
            chips={calendarChips}
            activeId={activeCalendar?.id ?? null}
            onChange={handleSelectCalendar}
            labels={{
              filterLabel: t("scheduleScreen.calendarFilterLabel"),
              hidden: t("scheduleScreen.calendarFilterHidden", {
                count: hiddenByCalendar,
              }),
              showAll: t("scheduleScreen.calendarFilterShow"),
            }}
          />
          {rangeErrorBanner}
          {desktopBody}
        </div>
        {overlaysEl}
      </>
    );
  }

  // ── Mobile ───────────────────────────────────────────────────────────────
  //
  // One screen — the month grid, the picked day's list under it, and the FAB
  // (#878, ユーザー確定 2026-08-15). Still no switcher: narrow has one view, it
  // is just no longer the same view as the drawer beside it.
  //
  // #467 made this a bare day list, and #692 hung the month off the header on a
  // sheet. What that left was a main area showing a day list next to a drawer
  // showing a day list — the same UI answering the same question twice — while
  // the month, the one thing the drawer cannot show, was behind a tap. So the
  // two swapped places: the calendar is the main view, the day is what a cell
  // tap chooses, and the drawer keeps today's flow.
  //
  // The Timeline option does NOT come back with it: a 24-hour time grid on a
  // phone puts the whole day behind a scroll and turns every block into a drag
  // target too small to hit. And the month is `compact` here (day badge + dot
  // row), which is what makes 42 cells legible — the dots say WHERE something
  // is, the list under the grid says WHAT.
  //
  // The steppers now page by MONTHS (`effView` is "month" on narrow), so a
  // far-off day is two taps rather than the day-at-a-time walk #467 accepted.
  return (
    <>
      {sidebarPortal}
      {/*
       * The narrow column. It used to be the FAB's anchor (#632) and carried
       * `relative` for that; #1034 moved creation into the day-list header, so
       * nothing is absolutely positioned in here any more. The inner div keeps
       * the gutter so the list still lines up.
       */}
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
              {periodLabel}
            </h2>
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
          {showLoading ? (
            <div className="min-h-0 flex-1 overflow-y-auto pb-3">
              {loadingCard}
            </div>
          ) : showError ? (
            <div className="min-h-0 flex-1 overflow-y-auto pb-3">
              {errorCard}
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
                  monthKey={anchorDate}
                  items={monthItems}
                  todayKey={today}
                  selectedKey={anchorDate}
                  weekStartsOn={weekStartsOn}
                  weekdayLabels={weekdayLabels}
                  onSelectDay={pickMonthDay}
                  formatMoreCount={(n) =>
                    t("scheduleScreen.moreCount", { count: n })
                  }
                  formatDayLabel={formatFullDay}
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
                    {anchorDayLabel}
                  </p>
                  <AddPill
                    onClick={handleToolbarAdd}
                    label={t("scheduleScreen.addCta")}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pb-3">
                  <AgendaList
                    items={toAgenda(
                      anchorDayItems,
                      rangeTodoChips.filter((c) => c.date === anchorDate),
                    )}
                    nowMinutes={anchorDate === today ? nowMinutes : null}
                    onToggleComplete={handleAgendaToggle}
                    onItemActivate={handleItemActivate}
                    onItemDoubleClick={handleItemOpenDetail}
                    selectedId={selectedId}
                    /* #691: Mobile stands in for the week grid here, so the row
                     has to say how long it runs and where the day is free.
                     Desktop's sidebar column stays one line tall (no props). */
                    dayflow
                    formatGapLabel={formatGapLabel}
                    labels={anchorAgendaLabels}
                    className="rounded-md border border-lumen-border bg-lumen-bg px-2"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {overlaysEl}
    </>
  );
}
