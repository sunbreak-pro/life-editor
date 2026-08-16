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
  RightSidebarToggle,
  RepeatScopeDialog,
  QuickCaptureSheet,
  ItemCreatePanel,
  ItemActionPopover,
  ItemDetailOverlay,
  TodoDetailPanel,
  STATUS_TEXT_KEY,
  StatusFilterChips,
  ResponsiveDetailFrame,
  Modal,
  ConfirmDialog,
  useConfirmDialog,
  useScheduleItemsRoutineSync,
  useDeferredAction,
  useInFlightGuard,
  useToast,
  eventToTodoBlock,
  todoToEventBlock,
  todoToEventPlacement,
  ItemConversionError,
  logServiceError,
  minutesToTime,
  isTodoChip,
  unwrapTodoChipId,
  todoScheduleSlot,
  frequencyLabel,
  nextRoutineOccurrence,
  applyRepeatFilter,
  applyCalendarLens,
  buildCalendarMemberIds,
  pickSelectableCalendars,
  nowMinutesLocal,
  todayCalendarKey,
  type TodoCalendarChip,
  type ScheduleItem,
  type ItemCreateNoteDraft,
  type ItemCreateSlot,
  type WeekTimeGridItem,
  type MonthGridItem,
  type AgendaItem,
  type EventEditorItem,
  type FrequencyEditorValue,
  type RoutineSummaryRow,
  type RepeatListRow,
  type StatusFilterChip,
  type DataService,
  MobileFab,
  WIDE_QUERY,
  type TranslationKey,
} from "@life-editor/shared";
import { CalendarView } from "./CalendarView";
import { ScheduleSidebar } from "./ScheduleSidebar";
import { TagPicker } from "../wikitag/TagPicker";
import { TagColorControls } from "../wikitag/TagColorControls";
import { useCreatePanelNotes } from "./useCreatePanelNotes";
import { useCalendarNav } from "./useCalendarNav";
import { useVisibleRangeItems } from "./useVisibleRangeItems";
import { useScheduleMutations } from "./useScheduleMutations";
import { useScheduleTodoChips } from "./useScheduleTodoChips";
import { decideUnsavedClose } from "./unsavedCloseGuard";
import { timedPlacement, placeTodoWrite } from "./todoChipUndoWiring";
import { itemTapRoute, todoChipPanelModel } from "./todoChipPanel";
import { agendaEmptyKey } from "./agendaEmptyLabel";
import {
  toAgendaItems,
  toEditorItem,
  toMonthGridItems,
  toWeekGridItems,
} from "./scheduleViewModels";
import {
  formatFullDay as formatFullDayKey,
  formatPeriodLabel,
  formatShortDate,
  formatTodoSchedule,
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
   * Consumed immediately (like pendingNewTodo), so coming back to the Calendar
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
    // reasoning as the todo handoff (useTodoDetailTarget.ts:112).
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
    [isWide, deferPopover],
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
    [isWide],
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
    onMoveTodoChip: handleTodoChipMove,
    onResizeTodoChip: handleTodoChipResize,
    onDropTodoChipAllDay: handleTodoChipDropAllDay,
    onRepeatConvertFailed: handleRepeatConvertError,
    copySuffix: t("scheduleScreen.copySuffix"),
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

  // #468: every panel path that actually PUTS something on the grid closes
  // through here, and clearing the lens is the point. A brand-new row carries
  // no tag, so while a calendar lens is on it is filtered out the instant it
  // exists — no block on the grid, no toast, and any selection made below
  // points at something nobody can see. The add button reads as broken.
  // Showing the thing that was just created is what the click asked for;
  // auto-filing it into the active calendar would be a write the user never
  // asked for.
  //
  // Placing an EXISTING todo gets the same treatment: it only survives the lens
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
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      if (!createPanel) return;
      // #376: the note rides along with the create, but only once the row is
      // really there — `wiki_tag_connections` carries an FK to `items_meta`,
      // and the id handleCreate returns is the optimistic one (see the
      // ORDERING note in useCreatePanelNotes).
      const id = handleCreate(slot, title, (saved) => {
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
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      if (!createPanel) return;
      const id = handleCreate(slot, title, (saved) => {
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

  // #376 todo tab — the timed counterpart of the #298 tray. The tray stages a
  // todo as "today, time TBD" (all-day); this panel commits it to a concrete
  // day + window, which is what makes it show up as a placed block rather than
  // an all-day candidate (the shape itself: todoChipUndoWiring.timedPlacement).
  //
  // The day comes off the slot, not off `createPanel` (#940): the panel's date
  // field is what the user last said, and the gesture that opened it is only
  // the seed. `createPanel` still gates the call — a submit with the panel
  // closed is not a thing — but it no longer decides the day.
  const scheduleTodoAt = useCallback(
    (slot: ItemCreateSlot) => {
      if (!createPanel) return null;
      return timedPlacement(slot.date, slot.start, slot.end);
    },
    [createPanel],
  );

  const handleCreateTodoSubmit = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      const placement = scheduleTodoAt(slot);
      if (!placement) return;
      // Root-level todo (parentId null), matching every other "quick create"
      // entry — the panel carries no place-in-the-tree control, and the Todos
      // section is where re-parenting belongs.
      addNode("task", null, title, {
        ...placement,
        // Same ordering rule as the event path: the node is optimistic until
        // the tree sync lands, and the guard in useTodoTreeAPI can drop the
        // write entirely (tree not loaded), which reports `null` here.
        onSaved: (saved) => {
          if (saved) attachNote(saved.id, note);
          else if (note) handleAttachError();
        },
      });
      finishCreatePanel();
    },
    [scheduleTodoAt, addNode, attachNote, handleAttachError, finishCreatePanel],
  );

  const handlePlaceTodoSubmit = useCallback(
    (
      todoId: string,
      slot: ItemCreateSlot,
      note: ItemCreateNoteDraft | null,
    ) => {
      if (!createPanel) return;
      // Undoable only when no note rides along (#569): a note attaches a
      // separate link row this panel has no un-write for, and an undo that
      // moved the todo back while leaving the note on it would be a half
      // reversal the toast claims was whole. See placeTodoWrite.
      const { patch, options } = placeTodoWrite(
        slot.date,
        slot.start,
        slot.end,
        note != null,
      );
      updateNode(todoId, patch, options);
      // No onSaved wait here, unlike the create paths: this todo was picked
      // out of a pool that came from the DB, so its `items_meta` row is
      // already there and the link's FK is satisfied right now.
      attachNote(todoId, note);
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
    [isWide, cancelPopover],
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
  // below — grid rows, todo chips, chip counts — un-narrows together.
  const calendarMemberIds = useMemo(
    () =>
      isWide && activeCalendar
        ? buildCalendarMemberIds(allAssignments, activeCalendar.tagId)
        : null,
    [isWide, activeCalendar, allAssignments],
  );
  // Both grid layers go through the lens together. Narrowing only the schedule
  // rows would hide the other calendars' events while every todo chip stayed
  // put — todos carry the same life-tags (KanbanView) and a chip's id IS the
  // todo's items_meta.id, so the same membership set applies unchanged.
  // `hiddenByCalendar` is the total across both, so the "N hidden" line counts
  // the todo chips it actually took away.
  const {
    events: gridRangeItems,
    todoChips: gridTodoChips,
    hiddenCount: hiddenByCalendar,
  } = useMemo(
    () =>
      applyCalendarLens(repeatFilteredItems, rangeTodoChips, calendarMemberIds),
    [repeatFilteredItems, rangeTodoChips, calendarMemberIds],
  );

  // Chip row data. The count comes out of the SAME call the grid uses, over the
  // same post-repeat lists, so the number on a chip is exactly what clicking it
  // leaves on screen — including the todo chips.
  const calendarChips = useMemo<StatusFilterChip[]>(
    () =>
      selectableCalendars.map((c) => ({
        id: c.id,
        label: c.title,
        count: applyCalendarLens(
          repeatFilteredItems,
          rangeTodoChips,
          buildCalendarMemberIds(allAssignments, c.tagId),
        ).visibleCount,
      })),
    [selectableCalendars, repeatFilteredItems, rangeTodoChips, allAssignments],
  );

  const gridItems = useMemo<WeekTimeGridItem[]>(
    () => toWeekGridItems(gridRangeItems, gridTodoChips, now),
    [gridRangeItems, now, gridTodoChips],
  );
  const monthItems = useMemo<MonthGridItem[]>(
    () => toMonthGridItems(gridRangeItems, gridTodoChips),
    [gridRangeItems, gridTodoChips],
  );

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

  // The Mobile day list — #467 made it the only thing narrow draws, so this is
  // the Mobile grid. Filtered like the Desktop grid is, though Mobile shows
  // neither toggle; with both filters off it is the same array.
  const anchorDayItems = useMemo(
    () => gridRangeItems.filter((i) => i.date === anchorDate),
    [gridRangeItems, anchorDate],
  );

  const editorItem: EventEditorItem | null = toEditorItem(selected, now);

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
        // `onCascadeChanged` (#708): an undo restores the occurrences and the
        // seed event straight through the DataService, so the visible range
        // has to be re-read there too — same reason as the reload below.
        const { landed } = await deleteRoutine(id, {
          onCascadeChanged: reload,
        });
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

  /*
   * #736: the todo-chip detail (TodoDetailPanel, below) commits on its own save
   * button too, so the same silent discard was possible on this screen — the
   * event editor beside it asked, and the todo panel did not.
   *
   * Guarded here rather than inside the panel because the three ways out of it
   * all belong to this file: the overlay's own onClose (Escape, the backdrop,
   * the close button), the convert-to-event button, and the "open in Todos"
   * hand-off. Each tears the panel down, and the draft dies with it.
   *
   * The flag is NOT cleared on an agreed discard (unlike the event editor
   * above): the panel is its only owner and re-reports `false` the moment it
   * unmounts, so clearing here could only ever be wrong — the convert path asks
   * its OWN question afterwards, and a refusal there leaves the draft on screen
   * with the flag already wiped.
   */
  const todoDetailDirtyRef = useRef(false);
  const requestTodoDetailClose = useCallback(
    async (proceed: () => void) => {
      const decision = await decideUnsavedClose({
        dirty: todoDetailDirtyRef.current,
        askDiscard: () =>
          askConfirm({
            message: t("common.unsavedCloseConfirm"),
            confirmLabel: t("common.discard"),
            cancelLabel: t("common.cancel"),
            danger: true,
          }),
      });
      if (decision.close) proceed();
    },
    [askConfirm, t],
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
    originEvent: t("scheduleScreen.originEvent"),
    skipThisDay: t("scheduleScreen.skipThisDay"),
    delete: t("scheduleScreen.delete"),
  };

  const editorPane = editorItem ? (
    <EventEditorPane
      item={editorItem}
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
   * #625: Event <-> Todo conversion.
   *
   * The write keeps the item's id, so both surfaces stay pointed at the same
   * row and its tags/links survive — but the row changes ROLE, which means the
   * list it was in stops holding it and another list starts. Neither store
   * finds that out on its own here: the schedule range reloads and the todo
   * tree refetches, and the item is simply gone from one surface and present
   * on the other. No navigation (per the Issue) — jumping the user to the
   * other section after a one-line action reads as losing their place.
   *
   * The guard is per-id and claimed synchronously (#434): the confirm dialog
   * plus an async write is exactly the window in which a second click lands,
   * and a second conversion of the same id would hit a row whose role has
   * already moved — recoverable, but it would report a failure for something
   * that actually worked.
   *
   * #739 (D-20260811-sched-1): Event→Todo now KEEPS the day and the time span
   * — they land in the Todo's own chip slot — so the row does not leave the
   * calendar, it changes what it IS. The only loss left is the repeat, which
   * is what the dialog says and all it says.
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
        // Acknowledge-only: there is nothing to decide, so the dialog carries
        // one button. The wording is the user's own (D-20260810-sched-5).
        void askConfirm({
          message: t("itemConvert.routineBlocked"),
          confirmLabel: t("common.ok"),
        });
        return;
      }
      void askConfirm({
        message: t("itemConvert.toTodoConfirm", {
          title: item.title || t("scheduleCalendar.newEvent"),
        }),
        confirmLabel: t("itemConvert.toTodo"),
        cancelLabel: t("common.cancel"),
      }).then((ok) => {
        if (!ok) return;
        // Still claimed synchronously on the way out of the dialog (#434): the
        // answer arrives in an event handler, so nothing runs between this and
        // the write that could let a second click through.
        if (!beginConvert(id)) return;
        setPopover(null);
        // order 0 = the top of the root group, the slot addNode aims a new
        // todo at. It does NOT shift the existing siblings down the way
        // addNode does: that would be a second, unrelated write over every
        // root row, and a tie in sort_order only costs an arbitrary order
        // between two rows.
        void dataService
          .convertEventToTodo(id, { order: 0 })
          .then(() => {
            reload();
            void refetchTodos();
          })
          .then(() => showToast("success", t("itemConvert.toTodoDone")))
          .catch((err) => {
            logServiceError(
              "ItemConversion",
              `convertEventToTodo (${id})`,
              err,
            );
            showToast("danger", t("itemConvert.failed"));
          })
          .finally(() => endConvert(id));
      });
    },
    [
      rangeItems,
      contextItems,
      dataService,
      reload,
      refetchTodos,
      showToast,
      askConfirm,
      beginConvert,
      endConvert,
      t,
    ],
  );

  const handleConvertToEvent = useCallback(
    (id: string) => {
      const todo = todoNodes.find((n) => n.id === id);
      if (!todo) return;
      // D-20260810-sched-4. The service repeats this check against the DB
      // (soft-deleted children are invisible here but still hold the FK); this
      // one exists so the common case gets a sentence instead of a red toast.
      const blocked = todoToEventBlock(todoNodes, id);
      if (blocked) {
        void askConfirm({
          message: t("itemConvert.childrenBlocked", {
            title: blocked.title,
            count: blocked.childCount,
          }),
          confirmLabel: t("common.ok"),
        });
        return;
      }
      void askConfirm({
        // A child Todo loses its parent link (events have no hierarchy), and
        // the dialog is the only place that can say so before it happens.
        message: t(
          todo.parentId != null
            ? "itemConvert.toEventConfirmChild"
            : "itemConvert.toEventConfirm",
          { title: todo.title || t("common.untitled") },
        ),
        confirmLabel: t("itemConvert.toEvent"),
        cancelLabel: t("common.cancel"),
      }).then((ok) => {
        if (!ok) return;
        if (!beginConvert(id)) return;
        setPopover(null);
        setTodoDetailId(null);
        void dataService
          .convertTodoToEvent(id, todoToEventPlacement(todo, listDate))
          .then(() => {
            reload();
            void refetchTodos();
          })
          .catch((err) => {
            logServiceError(
              "ItemConversion",
              `convertTodoToEvent (${id})`,
              err,
            );
            // The DB sees children the live tree cannot (trashed ones still
            // hold the 0009 FK), so that refusal gets its own sentence —
            // "conversion failed" would send the user looking for a network
            // problem.
            showToast(
              "danger",
              err instanceof ItemConversionError && err.reason === "children"
                ? t("itemConvert.childrenBlockedServer")
                : t("itemConvert.failed"),
            );
          })
          .finally(() => endConvert(id));
      });
    },
    [
      todoNodes,
      dataService,
      listDate,
      reload,
      refetchTodos,
      showToast,
      askConfirm,
      beginConvert,
      endConvert,
      t,
    ],
  );

  const calendarsModal = (
    <Modal
      open={calendarsOpen}
      onClose={() => setCalendarsOpen(false)}
      title={t("scheduleScreen.calendarsTitle")}
      size="lg"
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
  // The todo action set. Deliberately not the event one: a todo has no
  // duplicate write and its detail lives in another section (todoChipPanel.ts).
  const todoChipPanel = popoverTodoChip
    ? todoChipPanelModel(
        popoverTodoChip,
        {
          // NOT scheduleScreen.untitled — that one reads "無題の繰り返し",
          // written for the repeat list. A todo is neither.
          untitled: t("common.untitled"),
          allDay: t("scheduleScreen.allDay"),
          rename: t("scheduleScreen.rename"),
          delete: t("todoDetail.todoDelete"),
          convertToEvent: t("itemConvert.toEvent"),
        },
        {
          onRename: (title) =>
            updateNode(
              popoverTodoChip.id,
              { title },
              // The catch-all tree label: a rename is not a move, so none of
              // the position-shaped todoChip* words fit (useTodoTreeHistory).
              { undoLabel: "todoTreeChange" },
            ),
          onDelete: () => handleTodoDelete(popoverTodoChip.id),
          onConvertToEvent: () => handleConvertToEvent(popoverTodoChip.id),
        },
      )
    : null;

  // #299 single-click bubble (Desktop): summary + quick actions + "詳細を編集".
  // `selected` is the popover's item (activate sets selectedId + popover to the
  // same id); guard against a transient mismatch. Portalled to body → does not
  // touch the rightSidebar contentCount invariant.
  const popoverEl =
    !isWide || !popover ? null : todoChipPanel ? (
      <ItemActionPopover
        key={popover.id}
        position={{ x: popover.x, y: popover.y }}
        summary={
          <div className="flex flex-col gap-0.5">
            <p className="truncate font-semibold text-lumen-text">
              {todoChipPanel.title}
            </p>
            <p className="text-lumen-text-secondary">
              {todoChipPanel.timeLabel}
            </p>
          </div>
        }
        actions={todoChipPanel.actions}
        onEditDetail={() => handleItemOpenDetail(popover.id)}
        // #626: the primary hand-off now opens the in-Schedule todo detail
        // (tags editable in place); "open in Todos" moved inside that panel.
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

  /*
   * #626: todo-chip detail overlay (Desktop) — the same TodoDetailPanel +
   * TagPicker pair Kanban renders, so a todo's tags are editable without
   * leaving Schedule. Deliberately NOT EventEditorPane: that pane edits a
   * schedule_item and a todo has none (#564), so the todo counterpart is the
   * panel the Todos section already trusts. Resolved against the live tree —
   * a todo deleted elsewhere while open simply closes the overlay.
   *
   * The #564 hand-off survives as the button under the panel: in-place editing
   * covers tags/title/status, and anything deeper still lives in Todos.
   *
   * #761: the body is built once and framed twice — the Desktop overlay below,
   * and the Mobile BottomSheet at the end of the narrow branch. One body rather
   * than two copies: the save button, the convert and the hand-off each carry a
   * guard, and a second literal is how one of the two layouts eventually loses
   * one of them. Only ever one frame is mounted (the layouts are separate
   * returns, and both frames render nothing while closed).
   */
  const todoDetailTodo =
    todoDetailId != null
      ? (todoNodes.find((n) => n.id === todoDetailId) ?? null)
      : null;
  // #736: every exit from the panel — Escape, the backdrop, the close button,
  // the sheet's close button — funnels through this one guard.
  const closeTodoDetail = () => {
    void requestTodoDetailClose(() => setTodoDetailId(null));
  };
  const todoDetailBody = todoDetailTodo && (
    <div className="flex flex-col gap-3">
      <TodoDetailPanel
        todoId={todoDetailTodo.id}
        title={todoDetailTodo.title}
        status={todoDetailTodo.status}
        // #713: the same save button Todos now has. No content editor on
        // this surface (the body stays in Todos), so the press only ever
        // carries the title — but the panel's contract allows an empty
        // patch, and writing one would raise a no-op undo entry.
        onSave={(id, patch) => {
          if (patch.title === undefined) return;
          updateNode(id, patch, { undoLabel: "todoTreeChange" });
        }}
        onToggleStatus={toggleTodoStatus}
        // #775: the panel's own delete, so the sheet that is Mobile's only way
        // into a todo is not a one-way door. It fires raw — the confirm, the
        // cascade count and the close all belong to the handler above.
        onDelete={handleTodoDetailDelete}
        titleLabel={t("todoDetail.titleLabel")}
        statusLabel={t("todoDetail.status")}
        statusText={t(STATUS_TEXT_KEY[todoDetailTodo.status ?? "NOT_STARTED"])}
        saveLabel={t("todoDetail.save")}
        savedLabel={t("todoDetail.saved")}
        unsavedLabel={t("todoDetail.unsaved")}
        deleteLabel={t("todoDetail.todoDelete")}
        // #877: which day the todo is set for. On narrow this sheet is the
        // only way into a todo, and it named the title, the status and the
        // tags while staying silent about the one field that decides where the
        // row appears — so a todo pulled up from the day list could not answer
        // "is this today's?". Read from the same helper the chips are built
        // from (todoScheduleSlot), so the row and the chip cannot disagree.
        scheduleLabel={t("todoDetail.schedule")}
        scheduleText={formatTodoSchedule(
          i18n.language,
          todoScheduleSlot(todoDetailTodo),
          {
            allDay: t("scheduleScreen.allDay"),
            unscheduled: t("todoDetail.scheduleNone"),
          },
        )}
        // #736: the panel reports its pending title here; the three exits
        // below read the flag before they tear the panel down. A ref rather
        // than state — nothing on screen depends on it, and re-rendering
        // the whole calendar on every keystroke would be a steep price.
        onDirtyChange={(dirty) => {
          todoDetailDirtyRef.current = dirty;
        }}
        // Same omission as Kanban: TagPicker's own kind badge captions the
        // row, so TodoDetailPanel's generic tagsLabel would repeat it.
        tagsSlot={
          <TagPicker
            itemId={todoDetailTodo.id}
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
              role out from under it. #736: which is why a pending title has to
              be asked about FIRST — the conversion unmounts the panel, and the
              draft would go with it without a word. */}
      <button
        type="button"
        onClick={() => {
          void requestTodoDetailClose(() =>
            handleConvertToEvent(todoDetailTodo.id),
          );
        }}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {t("itemConvert.toEvent")}
      </button>
      {/* #736: the hand-off leaves the section entirely, so it is a close
              like any other as far as a pending title is concerned. */}
      <button
        type="button"
        onClick={() => {
          void requestTodoDetailClose(() => {
            setTodoDetailId(null);
            onOpenTodos();
          });
        }}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {t("scheduleScreen.todoOpenInTodos")}
      </button>
    </div>
  );

  //
  // #761 gave narrow the same panel: a todo row in the Mobile day list had no
  // detail surface at all — the tap was dropped before it could ask for one
  // (itemTapRoute) — so the row read as broken next to an event that opens.
  // It arrives in a sheet, matching the event editor beside it, which is the
  // same width split #889 folded into one frame here.
  const todoDetailFrameEl = (
    <ResponsiveDetailFrame
      wide={isWide}
      open={!!todoDetailTodo}
      title={t("materials.todos.detailTitle")}
      closeLabel={t("common.close")}
      onClose={closeTodoDetail}
    >
      {todoDetailBody}
    </ResponsiveDetailFrame>
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
          initial={{
            date: createPanel.date,
            start: createPanel.start,
            end: createPanel.end,
          }}
          pools={{ todos: todoAddable, notes: noteOptions }}
          handlers={{
            onSubmitEvent: handleCreateSubmit,
            onSubmitEventAndOpen: handleCreateSubmitAndOpen,
            onCreateTodo: handleCreateTodoSubmit,
            onPlaceTodo: handlePlaceTodoSubmit,
          }}
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
          )}
        </div>
        {calendarsModal}
        {popoverEl}
        {detailFrameEl}
        {todoDetailFrameEl}
        {createOverlayEl}
        {scopeDialogEl}
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
            {/* #878: the month the grid below is showing. It is a heading
                again, not a control — #692's chevron opened the month on a
                sheet, and with the month AS the main view there is nothing
                left for a tap to reveal. */}
            <h2 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-lumen-text">
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
            <div className="min-h-0 flex-1 overflow-y-auto pb-24">
              {loadingCard}
            </div>
          ) : showError ? (
            <div className="min-h-0 flex-1 overflow-y-auto pb-24">
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
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-24">
                <p className="shrink-0 text-xs text-lumen-text-secondary">
                  {anchorDayLabel}
                </p>
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
            </>
          )}
        </div>

        {/* FAB → creation panel. */}
        <MobileFab
          onClick={handleToolbarAdd}
          label={t("scheduleScreen.addEvent")}
        />
      </div>

      {/* Mobile creation panel (#299 → #376): the FAB opens with defaults, an
          empty-slot tap opens with the tapped slot's time prefilled. Same panel
          as the Desktop overlay, so the todo tab is reachable here too. */}
      <QuickCaptureSheet
        open={!!createPanel}
        onClose={() => setCreatePanel(null)}
        sheetTitle={t("scheduleScreen.addItem")}
        closeLabel={t("common.close")}
        initial={{
          // The sheet outlives the open state (BottomSheet stays mounted), so
          // the anchor day stands in while there is no gesture to read.
          date: createPanel?.date ?? anchorDate,
          start: createPanel?.start,
          end: createPanel?.end,
        }}
        pools={{ todos: todoAddable, notes: noteOptions }}
        handlers={{
          onSubmitEvent: handleCreateSubmit,
          onSubmitEventAndOpen: handleCreateSubmitAndOpen,
          onCreateTodo: handleCreateTodoSubmit,
          onPlaceTodo: handlePlaceTodoSubmit,
        }}
        formatDuration={formatDuration}
        labels={createPanelLabels}
      />

      {/* The same two frame consts the Desktop branch places (#889) — the
          width inside them picks the sheet here and the overlay there. Full
          height on narrow, like the Notes/Todos detail screens; the cap and
          the hand-rolled scroller this used to carry (#633) moved into
          <BottomSheet fullScreen> with #874. */}
      {detailFrameEl}

      {/* #761: narrow's todo detail. Mounted after the editor, though the two
          are never open together — a tap resolves to exactly one of them
          (itemTapRoute). */}
      {todoDetailFrameEl}

      {scopeDialogEl}

      {/* #707: mounted last so it portals ABOVE the editor overlay / sheet it
          is usually asked from — the discard question has to sit on top of the
          thing it is about. It holds no place in the tree while nothing is
          being asked. */}
      {confirmRequest && (
        <ConfirmDialog
          open
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          cancelLabel={confirmRequest.cancelLabel}
          danger={confirmRequest.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
    </>
  );
}
