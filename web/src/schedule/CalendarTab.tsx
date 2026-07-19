import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  useScheduleItemsContext,
  useRoutineContext,
  useSyncContext,
  useTaskTreeContext,
  useRightSidebarOptional,
  useTranslation,
  useMediaQuery,
  WeekTimeGrid,
  MonthGrid,
  AgendaList,
  TodayTodoTray,
  ScheduleToolbar,
  EventEditorPane,
  RoutineSummaryCard,
  RightSidebarPortal,
  RightSidebarToggle,
  ScheduleSidebarTabs,
  ScheduleItemContextMenu,
  RepeatScopeDialog,
  QuickCaptureSheet,
  SegmentedControl,
  BottomSheet,
  Modal,
  useScheduleItemsRoutineSync,
  buildGroupForRoutineMap,
  minutesToTime,
  deriveScheduleStatus,
  tasksToCalendarChips,
  taskChipId,
  isTaskChip,
  unwrapTaskChipId,
  localDateTimeToISO,
  pickAddableTasks,
  buildWeekdayLabels,
  frequencyLabel,
  itemVariant,
  nowMinutesLocal,
  sortDayItems,
  type FrequencyLabelCopy,
  type TaskCalendarChip,
  type TodayTodoRow,
  type ScheduleStatus,
  type ScheduleItem,
  type WeekTimeGridItem,
  type MonthGridItem,
  type AgendaItem,
  type EventEditorItem,
  type FrequencyEditorValue,
  type RoutineSummaryRow,
  type SegmentedOption,
  type DataService,
} from "@life-editor/shared";
import { CalendarView } from "./CalendarView";
import { useCalendarNav } from "./useCalendarNav";
import { useVisibleRangeItems } from "./useVisibleRangeItems";
import { useScheduleMutations } from "./useScheduleMutations";

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
export function CalendarTab({
  dataService,
  onOpenRoutines,
  onOpenTasks,
}: {
  dataService: DataService;
  onOpenRoutines: () => void;
  /** Jump to the Tasks section (Today's Todo tray title click — A-3 / #298). */
  onOpenTasks: () => void;
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
  } = useScheduleItemsContext();
  const {
    routines,
    routineGroups,
    convertEventToRoutine,
    updateRoutine,
    deleteRoutine,
    setGroupsForRoutine,
    getGroupIdsForRoutine,
    detachRoutine,
    updateFutureOccurrences,
  } = useRoutineContext();
  // Realtime change cursor: rows written outside the visible-range store
  // (the always-on generator, undo, another device) refetch the range when
  // this bumps (#296 — pre-fix they stayed invisible until navigation).
  const { syncVersion } = useSyncContext();
  // Range materialiser (#279): after an Event→Repeats conversion, the new
  // routine's occurrences are generated for the visible range right away —
  // the always-on RoutineScheduleSync only covers today.
  const { ensureRoutineItemsForDateRange } = useScheduleItemsRoutineSync({
    dataService,
  });
  // Scheduled TaskNodes → task=blue chips (schedule redesign A-1). `nodes`
  // already excludes soft-deleted tasks (useTaskTreeAPI). A-2 (#297) writes
  // scheduledAt back via updateNode on grid drag/resize.
  const { nodes: taskNodes, updateNode, setTaskStatus } = useTaskTreeContext();
  // Null-safe: the section can render without a RightSidebarProvider (tests /
  // standalone). `open` re-opens the panel when a calendar item is picked.
  const rightSidebar = useRightSidebarOptional();
  const openSidebar = rightSidebar?.open;

  // Navigation + visible fetch window (#280 → useCalendarNav).
  const {
    today,
    anchorDate,
    setAnchorDate,
    setView,
    desktopView,
    mobileView,
    effView,
    weekStartsOn,
    weekStart,
    weekEnd,
    rangeStart,
    rangeEnd,
    mobileSelectedDay,
    setMobileSelectedDay,
    step,
    goToday,
  } = useCalendarNav(isWide);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which rightSidebar tab is showing on Desktop ("今日の流れ" / "詳細" / "本日の
  // Todo" — the A-3 tray, #298).
  const [sidebarTab, setSidebarTab] = useState<"flow" | "detail" | "todo">(
    "flow",
  );
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(() => nowMinutesLocal());
  // Real "now" Date, ticked alongside nowMinutes. Drives deriveScheduleStatus
  // (#222) — nowMinutes alone (minutes-from-midnight) can't compare across days.
  const [now, setNow] = useState(() => new Date());
  // Right-click context menu on a calendar item (Desktop only, #223).
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // 1-minute now ticker (drives the now-line + agenda divider). Cleared on
  // unmount so it never leaks across section changes.
  useEffect(() => {
    const id = setInterval(() => {
      setNowMinutes(nowMinutesLocal());
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Unified item selection. On Desktop it also flips the shared rightSidebar to
  // its "詳細" tab and opens the panel if collapsed (done here, at the event, not
  // in an effect — react-hooks/set-state-in-effect). Mobile keeps the editor in
  // its BottomSheet, so the tab/open side-effects are wide-only.
  const handleSelectItem = useCallback(
    (id: string) => {
      // A-1: task chips are read-only display — clicking one must not open the
      // ScheduleItem editor (the id isn't a ScheduleItem). No-op here.
      if (isTaskChip(id)) return;
      setSelectedId(id);
      if (isWide) {
        setSidebarTab("detail");
        openSidebar?.();
      }
    },
    [isWide, openSidebar],
  );

  // A-2 (#297): grid drag of a task chip → write scheduledAt/scheduledEndAt on
  // the underlying TaskNode. The grid hands both new times on the same day
  // (it moves the block preserving duration), so both fields are rewritten.
  // isAllDay:false — a timed grid placement is by definition not all-day
  // (an all-day chip sits in the all-day lane and is not drag-moved here).
  // updateNode is optimistic, so the chip re-derives at the new position
  // without a manual patch. Schedule AC10 (bidirectional) closes here.
  const handleTaskChipMove = useCallback(
    (chipId: string, dateISO: string, startISO: string, endISO: string) => {
      const taskId = unwrapTaskChipId(chipId);
      updateNode(taskId, {
        scheduledAt: localDateTimeToISO(dateISO, startISO),
        scheduledEndAt: localDateTimeToISO(dateISO, endISO),
        isAllDay: false,
      });
    },
    [updateNode],
  );

  // A-2 (#297): resize gives only the new end time — keep the task's current
  // day (from its scheduledAt) and rewrite scheduledEndAt on it.
  const handleTaskChipResize = useCallback(
    (chipId: string, endISO: string) => {
      const taskId = unwrapTaskChipId(chipId);
      const task = taskNodes.find((n) => n.id === taskId);
      if (!task?.scheduledAt) return;
      const start = new Date(task.scheduledAt);
      if (Number.isNaN(start.getTime())) return;
      const dateKey = `${start.getFullYear()}-${String(
        start.getMonth() + 1,
      ).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      updateNode(taskId, {
        scheduledEndAt: localDateTimeToISO(dateKey, endISO),
      });
    },
    [taskNodes, updateNode],
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

  // "Add to today" (案 c staging): give the task scheduledAt = today midnight +
  // all-day (time undefined). It then surfaces in the tray's unplaced group and
  // as an all-day chip on the grid; dragging it into the time body (place)
  // promotes it to placed. DDL zero — reuses the existing scheduledAt columns.
  const handleTodoAddCandidate = useCallback(
    (taskId: string) => {
      updateNode(taskId, {
        scheduledAt: localDateTimeToISO(today, "00:00"),
        isAllDay: true,
      });
    },
    [today, updateNode],
  );

  // Visible-range optimistic store (#280 → useVisibleRangeItems): edits patch
  // rangeItems optimistically; navigation, reload(), retry and Realtime
  // (syncVersion) refetch.
  const {
    rangeItems,
    setRangeItems,
    fetchedRange,
    patchRange,
    reload,
    rangeError,
  } = useVisibleRangeItems({
    loadDateRange,
    rangeStart,
    rangeEnd,
    refreshKey: syncVersion,
  });

  // `group`-frequency lookup for the range materialiser (#296): built with
  // the same shared helper RoutineScheduleSync uses, so the ensure cleanup
  // never mistakes group-driven rows for stale ones.
  const groupForRoutine = useMemo(
    () =>
      buildGroupForRoutineMap(routines, routineGroups, getGroupIdsForRoutine),
    [routines, routineGroups, getGroupIdsForRoutine],
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
  // #278 pending-draft guard and the #279 repeat/scope machinery.
  const {
    scopeRequest,
    closeScopeRequest,
    handleScopeChoose,
    handleUpdate,
    handleToggle,
    handleCreateAt,
    handleAddEvent,
    handleCreateOnDay,
    handleQuickAdd,
    handleMoveItem,
    handleResizeItem,
    handleDismiss,
    handleDelete,
    handleRename,
    handleDuplicate,
    handleChangeRepeat,
    handleDetachRepeat,
  } = useScheduleMutations({
    rangeItems,
    setRangeItems,
    patchRange,
    fetchedRange,
    reload,
    contextItems,
    rangeStart,
    rangeEnd,
    today,
    anchorDate,
    setAnchorDate,
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
    setGroupsForRoutine,
    detachRoutine,
    updateFutureOccurrences,
    ensureRoutineItemsForDateRange,
    groupForRoutine,
    onMoveTaskChip: handleTaskChipMove,
    onResizeTaskChip: handleTaskChipResize,
    newEventTitle: t("scheduleCalendar.newEvent"),
    copySuffix: t("scheduleScreen.copySuffix"),
  });

  // ── Context menu (rename / duplicate / delete: handlers in the mutation
  // layer; only the menu position state lives here) ──────────────────────────

  const handleItemContextMenu = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      if (isTaskChip(id)) return; // A-1: no rename/duplicate/delete on task chips
      setContextMenu({ id, x: pos.x, y: pos.y });
    },
    [],
  );

  // ── Derived data ─────────────────────────────────────────────────────────

  const weekdayLabels = useMemo(() => buildWeekdayLabels(t), [t]);
  const freqCopy = useMemo<FrequencyLabelCopy>(
    () => ({
      daily: t("scheduleScreen.frequencyDaily"),
      weekdaysFallback: t("scheduleScreen.frequencyWeekdays"),
      group: t("scheduleScreen.frequencyGroup"),
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
  const mobileViewOptions: SegmentedOption[] = [
    { id: "list", label: t("scheduleScreen.viewList") },
    { id: "time", label: t("scheduleScreen.viewTime") },
    { id: "month", label: t("scheduleScreen.viewMonth") },
  ];

  const toolbarLabels = {
    today: t("scheduleScreen.today"),
    prev: t("scheduleScreen.prev"),
    next: t("scheduleScreen.next"),
    openSettings: t("scheduleScreen.openSettings"),
    view: t("scheduleScreen.viewLabel"),
  };

  // Scheduled-task chips (schedule redesign A-1). `rangeTaskChips` backs the
  // grid + month (visible range); `todayTaskChips` backs the "今日の流れ" flow,
  // which always shows today regardless of the grid's visible range. Task chips
  // are merged only at this derived (map) layer — never into `rangeItems`
  // (the optimistic ScheduleItem mutation store).
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

  const gridItems = useMemo<WeekTimeGridItem[]>(
    () => [
      ...rangeItems.map((i) => ({
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
      ...rangeTaskChips.map((c) => ({
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
    [rangeItems, now, rangeTaskChips],
  );
  const monthItems = useMemo<MonthGridItem[]>(
    () => [
      ...rangeItems.map((i) => ({
        id: i.id,
        date: i.date,
        title: i.title,
        variant: itemVariant(i),
        completed: i.completed,
        isAllDay: i.isAllDay,
      })),
      ...rangeTaskChips.map((c) => ({
        id: taskChipId(c.id),
        date: c.date,
        title: c.title,
        variant: "task" as const,
        completed: c.completed,
        isAllDay: c.isAllDay,
      })),
    ],
    [rangeItems, rangeTaskChips],
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

  const anchorDayItems = useMemo(
    () => rangeItems.filter((i) => i.date === anchorDate),
    [rangeItems, anchorDate],
  );
  const monthDayItems = useMemo(
    () => rangeItems.filter((i) => i.date === mobileSelectedDay),
    [rangeItems, mobileSelectedDay],
  );

  const editorItem: EventEditorItem | null = selected
    ? {
        id: selected.id,
        title: selected.title,
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
      groupIds: getGroupIdsForRoutine(selectedRoutine.id),
    };
  }, [selectedRoutine, getGroupIdsForRoutine]);

  const repeatGroups = useMemo(
    () =>
      routineGroups.map((g) => ({ id: g.id, name: g.name, color: g.color })),
    [routineGroups],
  );

  const repeatLabels = useMemo(
    () => ({
      frequency: t("scheduleScreen.frequency"),
      frequencyNone: t("scheduleScreen.frequencyNone"),
      frequencyDaily: t("scheduleScreen.frequencyDaily"),
      frequencyWeekdays: t("scheduleScreen.frequencyWeekdays"),
      frequencyInterval: t("scheduleScreen.frequencyInterval"),
      frequencyGroup: t("scheduleScreen.frequencyGroup"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
      startDate: t("scheduleScreen.startDate"),
      groups: t("scheduleScreen.groupsLabel"),
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
  const editorLabels = {
    complete: t("scheduleScreen.complete"),
    statusLabels,
    title: t("scheduleScreen.title"),
    startTime: t("scheduleScreen.startTime"),
    endTime: t("scheduleScreen.endTime"),
    memo: t("scheduleScreen.memo"),
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
      onChangeStart={(id, value) => handleUpdate(id, { startTime: value })}
      onChangeEnd={(id, value) => handleUpdate(id, { endTime: value })}
      onToggleComplete={handleToggle}
      onChangeMemo={(id, memo) => handleUpdate(id, { memo })}
      onDismiss={handleDismiss}
      onDelete={handleDelete}
      labels={editorLabels}
      repeat={repeatValue}
      repeatGroups={repeatGroups}
      repeatWeekdayLabels={weekdayLabels}
      repeatLabels={repeatLabels}
      onChangeRepeat={handleChangeRepeat}
      onDetachRepeat={handleDetachRepeat}
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
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-[13px] font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
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

  // Shared rightSidebar (AppShell owns the frame). Desktop shows a 2-tab
  // switcher ("今日の流れ" ↔ "詳細") inside ONE portal so contentCount stays 1;
  // Mobile shows only the flow (its item editor lives in the BottomSheet below).
  const sidebarTabs = useMemo(
    () => [
      { id: "flow", label: t("scheduleScreen.todayFlow") },
      { id: "detail", label: t("scheduleScreen.tabDetail") },
      { id: "todo", label: t("scheduleScreen.tabTodo") },
    ],
    [t],
  );

  const flowBody = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {/* Wide mode already labels the tab "今日の流れ"; the heading would be a
            duplicate, so it is Mobile-only (no tabs there). */}
        {!isWide && (
          <h3 className="text-sm font-semibold text-lumen-text">
            {t("scheduleScreen.todayFlow")}
          </h3>
        )}
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
        onSelectItem={handleSelectItem}
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
          onOpenRoutines={onOpenRoutines}
        />
      )}
    </div>
  );

  const detailBody = (
    <div className="flex flex-col gap-3">
      {editorPane ?? (
        <p className="rounded-md border border-lumen-border bg-lumen-bg-secondary px-4 py-6 text-center text-sm text-lumen-text-secondary">
          {t("scheduleScreen.selectHint")}
        </p>
      )}
    </div>
  );

  // A-3 (#298): "本日の Todo" tray — placed / unplaced task groups + an add
  // picker. Desktop-only (it rides the tab switcher; Mobile shows only flow).
  const todoBody = (
    <TodayTodoTray
      placed={todoPlaced}
      unplaced={todoUnplaced}
      addable={todoAddable}
      onToggleComplete={handleTodoToggleComplete}
      onAddCandidate={handleTodoAddCandidate}
      onOpenTask={() => onOpenTasks()}
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
      }}
    />
  );

  const sidebarPortal = (
    <RightSidebarPortal>
      {isWide ? (
        <ScheduleSidebarTabs
          tabs={sidebarTabs}
          value={sidebarTab}
          onChange={(id) => setSidebarTab(id as "flow" | "detail" | "todo")}
          label={t("scheduleScreen.detailPanelLabel")}
        >
          {sidebarTab === "flow"
            ? flowBody
            : sidebarTab === "detail"
              ? detailBody
              : todoBody}
        </ScheduleSidebarTabs>
      ) : (
        flowBody
      )}
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

  const contextMenuTarget = contextMenu
    ? (rangeItems.find((i) => i.id === contextMenu.id) ??
      contextItems.find((i) => i.id === contextMenu.id) ??
      null)
    : null;
  const contextMenuEl =
    contextMenu && contextMenuTarget ? (
      <ScheduleItemContextMenu
        position={{ x: contextMenu.x, y: contextMenu.y }}
        currentTitle={contextMenuTarget.title}
        labels={{
          rename: t("scheduleScreen.rename"),
          duplicate: t("scheduleScreen.duplicate"),
          delete: t("scheduleScreen.delete"),
        }}
        onRename={(title) => handleRename(contextMenu.id, title)}
        onDuplicate={() => handleDuplicate(contextMenu.id)}
        onDelete={() => handleDelete(contextMenu.id)}
        onClose={() => setContextMenu(null)}
      />
    ) : null;

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
            onOpenSettings={() => setCalendarsOpen(true)}
            onAddEvent={handleAddEvent}
            addEventLabel={t("scheduleScreen.addEvent")}
            labels={toolbarLabels}
          />
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
                onSelectDay={handleCreateOnDay}
                onSelectItem={handleSelectItem}
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
            // Item detail moved into the rightSidebar "詳細" tab, so the grid
            // takes the full width the editor <aside> used to share.
            <div className="min-h-0 flex-1">
              <WeekTimeGrid
                weekStart={desktopView === "day" ? anchorDate : weekStart}
                days={desktopView === "day" ? 1 : 7}
                items={gridItems}
                selectedId={selectedId}
                onSelectItem={handleSelectItem}
                onItemContextMenu={handleItemContextMenu}
                onCreateAt={handleCreateAt}
                onMoveItem={handleMoveItem}
                onResizeItem={handleResizeItem}
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
        {contextMenuEl}
        {scopeDialogEl}
      </>
    );
  }

  // ── Mobile ───────────────────────────────────────────────────────────────
  return (
    <>
      {sidebarPortal}
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
            className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-[13px] font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {t("scheduleScreen.today")}
          </button>
        </div>
        <SegmentedControl
          className="shrink-0"
          options={mobileViewOptions}
          value={mobileView}
          onChange={setView}
          label={t("scheduleScreen.viewLabel")}
        />
        {rangeErrorBanner}
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          {showLoading ? (
            loadingCard
          ) : showError ? (
            errorCard
          ) : mobileView === "list" ? (
            <AgendaList
              items={toAgenda(
                anchorDayItems,
                rangeTaskChips.filter((c) => c.date === anchorDate),
              )}
              nowMinutes={anchorDate === today ? nowMinutes : null}
              onToggleComplete={handleToggle}
              onSelectItem={handleSelectItem}
              selectedId={selectedId}
              labels={agendaLabels}
              className="rounded-md border border-lumen-border bg-lumen-bg px-2"
            />
          ) : mobileView === "time" ? (
            <WeekTimeGrid
              weekStart={anchorDate}
              days={1}
              items={gridItems}
              selectedId={selectedId}
              onSelectItem={handleSelectItem}
              onCreateAt={handleCreateAt}
              onMoveItem={handleMoveItem}
              onResizeItem={handleResizeItem}
              taskInteractive
              weekdayLabels={weekdayLabels}
              allDayLabel={t("scheduleScreen.allDay")}
              statusLabels={statusLabels}
              createSlotLabel={t("scheduleCalendar.createSlot")}
              todayKey={today}
              nowMinutes={nowMinutes}
              formatDayDate={formatDayDate}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <MonthGrid
                monthKey={anchorDate}
                items={monthItems}
                todayKey={today}
                weekStartsOn={weekStartsOn}
                weekdayLabels={weekdayLabels}
                compact
                onSelectDay={(day) => setMobileSelectedDay(day)}
                onSelectItem={(id) => handleSelectItem(id)}
                formatMoreCount={(n) =>
                  t("scheduleScreen.moreCount", { count: n })
                }
                formatDayLabel={formatFullDay}
                ariaLabel={t("scheduleScreen.calendar")}
              />
              <AgendaList
                items={toAgenda(
                  monthDayItems,
                  rangeTaskChips.filter((c) => c.date === mobileSelectedDay),
                )}
                nowMinutes={mobileSelectedDay === today ? nowMinutes : null}
                onToggleComplete={handleToggle}
                onSelectItem={handleSelectItem}
                selectedId={selectedId}
                labels={agendaLabels}
                className="rounded-md border border-lumen-border bg-lumen-bg px-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* FAB → Quick capture (safe-area aware). */}
      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        aria-label={t("scheduleScreen.addEvent")}
        className="fixed bottom-6 right-6 z-30 mb-[env(safe-area-inset-bottom)] flex size-14 items-center justify-center rounded-full bg-lumen-accent text-lumen-on-accent shadow-lumen-lg transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg"
      >
        <Plus aria-hidden className="size-6" />
      </button>

      <QuickCaptureSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onAdd={handleQuickAdd}
        labels={{
          title: t("scheduleScreen.quickAddTitle"),
          placeholder: t("scheduleScreen.quickAddPlaceholder"),
          add: t("scheduleScreen.addEvent"),
          startTime: t("scheduleScreen.startTime"),
          endTime: t("scheduleScreen.endTime"),
        }}
      />

      <BottomSheet
        open={!!editorPane}
        onClose={() => setSelectedId(null)}
        title={t("scheduleScreen.detailTitle")}
      >
        {editorPane}
      </BottomSheet>

      {scopeDialogEl}
    </>
  );
}
