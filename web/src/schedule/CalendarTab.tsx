import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  useScheduleItemsContext,
  useRoutineContext,
  useRightSidebarOptional,
  useTranslation,
  useMediaQuery,
  WeekTimeGrid,
  MonthGrid,
  AgendaList,
  ScheduleToolbar,
  EventEditorPane,
  RoutineSummaryCard,
  RightSidebarPortal,
  RightSidebarToggle,
  ScheduleSidebarTabs,
  ScheduleItemContextMenu,
  SegmentedControl,
  BottomSheet,
  Modal,
  addDaysKey,
  addMonthsKey,
  startOfMonthKey,
  startOfWeekKey,
  monthGridKeys,
  minutesToTime,
  deriveScheduleStatus,
  type ScheduleStatus,
  type ScheduleItem,
  type WeekTimeGridItem,
  type MonthGridItem,
  type AgendaItem,
  type EventEditorItem,
  type RoutineSummaryRow,
  type SegmentedOption,
} from "@life-editor/shared";
import { CalendarView } from "./CalendarView";
import {
  buildWeekdayLabels,
  frequencyLabel,
  itemVariant,
  nowMinutesLocal,
  sortDayItems,
  todayLocalKey,
  type FrequencyLabelCopy,
} from "./scheduleLabels";

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
const FIELD =
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
const CREATE_DURATION_MIN = 60;

function makeOptimisticItem(
  id: string,
  date: string,
  title: string,
  startTime: string,
  endTime: string,
): ScheduleItem {
  const now = new Date().toISOString();
  return {
    id,
    date,
    title,
    startTime,
    endTime,
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: now,
    updatedAt: now,
  };
}

interface QuickCaptureLabels {
  title: string;
  placeholder: string;
  add: string;
  startTime: string;
  endTime: string;
}

function QuickCaptureSheet({
  open,
  onClose,
  onAdd,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, start: string, end: string) => void;
  labels: QuickCaptureLabels;
}) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, start, end);
    setTitle("");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={labels.title}>
      <div className="flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder={labels.placeholder}
          aria-label={labels.title}
          className={FIELD}
        />
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-lumen-text-secondary">
            {labels.startTime}
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label={labels.startTime}
              className={`${FIELD} tabular-nums`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-lumen-text-secondary">
            {labels.endTime}
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label={labels.endTime}
              className={`${FIELD} tabular-nums`}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={submit}
          className="rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg"
        >
          {labels.add}
        </button>
      </div>
    </BottomSheet>
  );
}

export function CalendarTab({
  onOpenRoutines,
}: {
  onOpenRoutines: () => void;
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
    deleteScheduleItem,
  } = useScheduleItemsContext();
  const { routines } = useRoutineContext();
  // Null-safe: the section can render without a RightSidebarProvider (tests /
  // standalone). `open` re-opens the panel when a calendar item is picked.
  const rightSidebar = useRightSidebarOptional();
  const openSidebar = rightSidebar?.open;

  const today = useMemo(() => todayLocalKey(), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const [view, setView] = useState("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which rightSidebar tab is showing on Desktop ("今日の流れ" ↔ "詳細").
  const [sidebarTab, setSidebarTab] = useState<"flow" | "detail">("flow");
  const [rangeItems, setRangeItems] = useState<ScheduleItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mobileSelectedDay, setMobileSelectedDay] = useState(today);
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
      setSelectedId(id);
      if (isWide) {
        setSidebarTab("detail");
        openSidebar?.();
      }
    },
    [isWide, openSidebar],
  );

  // The single `view` state carries both layouts; each layout normalises it to
  // its own option set (Desktop day/week/month ↔ Mobile list/time/month) so a
  // resize keeps a sensible view without a second piece of state.
  const desktopView =
    view === "list"
      ? "day"
      : view === "time"
        ? "week"
        : view === "day" || view === "week" || view === "month"
          ? view
          : "week";
  const mobileView =
    view === "day"
      ? "list"
      : view === "week"
        ? "time"
        : view === "list" || view === "time" || view === "month"
          ? view
          : "list";
  const effView = isWide ? desktopView : mobileView;

  const weekStart = useMemo(() => startOfWeekKey(anchorDate, 0), [anchorDate]);
  const weekEnd = useMemo(() => addDaysKey(weekStart, 6), [weekStart]);
  const monthRows = useMemo(() => monthGridKeys(anchorDate, 0), [anchorDate]);

  // Visible fetch window per effective view (day/list/time = single day).
  const [rangeStart, rangeEnd] = useMemo<[string, string]>(() => {
    if (effView === "month") {
      const first = monthRows[0][0];
      const last = monthRows[monthRows.length - 1][6];
      return [first, last];
    }
    if (isWide && effView === "week") return [weekStart, weekEnd];
    return [anchorDate, anchorDate];
  }, [effView, isWide, monthRows, weekStart, weekEnd, anchorDate]);

  // Read the visible range (cancelled-guard mirrors useScheduleItemsAPI). Edits
  // patch rangeItems optimistically below, so only navigation + retry reload.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await loadDateRange(rangeStart, rangeEnd);
      if (!cancelled) {
        setRangeItems(list.filter((i) => !i.isDeleted && !i.isDismissed));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDateRange, rangeStart, rangeEnd, reloadKey]);

  const patchRange = useCallback((id: string, patch: Partial<ScheduleItem>) => {
    setRangeItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }, []);

  const handleUpdate = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      patchRange(id, patch);
      updateScheduleItem(id, patch);
    },
    [patchRange, updateScheduleItem],
  );

  const handleToggle = useCallback(
    (id: string) => {
      // Mirror the provider's toggle field set (completed + completedAt) on the
      // local range copy so the grid/agenda stay consistent without a refetch.
      setRangeItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                completed: !i.completed,
                completedAt: !i.completed ? new Date().toISOString() : null,
              }
            : i,
        ),
      );
      toggleComplete(id);
    },
    [toggleComplete],
  );

  const createAtTimes = useCallback(
    (date: string, start: string, end: string, title: string): string => {
      const id = createScheduleItem(date, title, start, end);
      setRangeItems((prev) => [
        ...prev,
        makeOptimisticItem(id, date, title, start, end),
      ]);
      return id;
    },
    [createScheduleItem],
  );

  const handleCreateAt = useCallback(
    (dateISO: string, minutes: number) => {
      const start = minutesToTime(minutes);
      const end = minutesToTime(minutes + CREATE_DURATION_MIN);
      const id = createAtTimes(
        dateISO,
        start,
        end,
        t("scheduleCalendar.newEvent"),
      );
      handleSelectItem(id);
    },
    [createAtTimes, handleSelectItem, t],
  );

  const handleAddEvent = useCallback(() => {
    const id = createAtTimes(
      anchorDate,
      "09:00",
      "10:00",
      t("scheduleCalendar.newEvent"),
    );
    // The detail editor now lives in the rightSidebar (not the main grid), so
    // the month layout can edit a new event in place — no jump to day view
    // (#224). handleSelectItem opens the detail panel on Desktop.
    handleSelectItem(id);
  }, [createAtTimes, handleSelectItem, anchorDate, t]);

  // Month-cell day tap → create a default-time event on that day and open its
  // detail panel in place, instead of switching to the day view (#224).
  const handleCreateOnDay = useCallback(
    (day: string) => {
      setAnchorDate(day);
      const id = createAtTimes(
        day,
        "09:00",
        "10:00",
        t("scheduleCalendar.newEvent"),
      );
      handleSelectItem(id);
    },
    [createAtTimes, handleSelectItem, t],
  );

  const handleQuickAdd = useCallback(
    (title: string, start: string, end: string) => {
      createAtTimes(anchorDate, start, end, title);
    },
    [createAtTimes, anchorDate],
  );

  const handleMoveItem = useCallback(
    (id: string, dateISO: string, startISO: string, endISO: string) => {
      const patch = { date: dateISO, startTime: startISO, endTime: endISO };
      patchRange(id, patch);
      updateScheduleItem(id, patch);
    },
    [patchRange, updateScheduleItem],
  );

  const handleResizeItem = useCallback(
    (id: string, endISO: string) => {
      patchRange(id, { endTime: endISO });
      updateScheduleItem(id, { endTime: endISO });
    },
    [patchRange, updateScheduleItem],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismiss(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [dismiss],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteScheduleItem(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [deleteScheduleItem],
  );

  // ── Context menu (rename / duplicate / delete) ─────────────────────────────

  const handleItemContextMenu = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      setContextMenu({ id, x: pos.x, y: pos.y });
    },
    [],
  );

  const handleRename = useCallback(
    (id: string, title: string) => {
      handleUpdate(id, { title });
    },
    [handleUpdate],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const src =
        rangeItems.find((i) => i.id === id) ??
        contextItems.find((i) => i.id === id);
      if (!src) return;
      const title = `${src.title}${t("scheduleScreen.copySuffix")}`;
      // createScheduleItem folds date/title/times + isAllDay/content/noteId/
      // memo into a single INSERT (#223 → QA fix): memo used to be patched with
      // a follow-up updateScheduleItem, but that UPDATE could race ahead of the
      // create's INSERT (unordered Promises) and miss the row. Carrying memo in
      // the create arg makes the memo write atomic AND keeps duplicate on one
      // undo entry (the create's own undo), so Ctrl+Z removes the copy once.
      const newId = createScheduleItem(
        src.date,
        title,
        src.startTime,
        src.endTime,
        {
          isAllDay: src.isAllDay,
          content: src.content ?? undefined,
          noteId: src.noteId ?? undefined,
          memo: src.memo ?? undefined,
        },
      );
      setRangeItems((prev) => [
        ...prev,
        {
          ...makeOptimisticItem(
            newId,
            src.date,
            title,
            src.startTime,
            src.endTime,
          ),
          isAllDay: src.isAllDay ?? false,
          content: src.content ?? null,
          noteId: src.noteId ?? null,
          memo: src.memo ?? null,
        },
      ]);
      handleSelectItem(newId);
    },
    [rangeItems, contextItems, createScheduleItem, handleSelectItem, t],
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

  const step = useCallback(
    (dir: number) => {
      const next =
        effView === "month"
          ? addMonthsKey(anchorDate, dir)
          : isWide && effView === "week"
            ? addDaysKey(anchorDate, dir * 7)
            : addDaysKey(anchorDate, dir);
      setAnchorDate(next);
      // Month nav: keep the Mobile month-agenda day inside the shown month —
      // a stale day from the previous month sits outside the fetched range and
      // renders an always-empty agenda until the user taps a cell.
      if (effView === "month") setMobileSelectedDay(startOfMonthKey(next));
    },
    [effView, isWide, anchorDate],
  );
  const goToday = useCallback(() => {
    setAnchorDate(today);
    setMobileSelectedDay(today);
  }, [today]);

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

  const gridItems = useMemo<WeekTimeGridItem[]>(
    () =>
      rangeItems.map((i) => ({
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
    [rangeItems, now],
  );
  const monthItems = useMemo<MonthGridItem[]>(
    () =>
      rangeItems.map((i) => ({
        id: i.id,
        date: i.date,
        title: i.title,
        variant: itemVariant(i),
        completed: i.completed,
        isAllDay: i.isAllDay,
      })),
    [rangeItems],
  );

  const toAgenda = useCallback(
    (arr: ScheduleItem[]): AgendaItem[] =>
      sortDayItems(arr).map((i) => ({
        id: i.id,
        title: i.title,
        startTime: i.startTime,
        endTime: i.endTime,
        isAllDay: i.isAllDay,
        completed: i.completed,
        status: deriveScheduleStatus(i, now),
        variant: itemVariant(i),
      })),
    [now],
  );

  const todayItems = useMemo(
    () => contextItems.filter((i) => !i.isDeleted && !i.isDismissed),
    [contextItems],
  );
  const todayAgenda = useMemo(
    () => toAgenda(todayItems),
    [todayItems, toAgenda],
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

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      rangeItems.find((i) => i.id === selectedId) ??
      contextItems.find((i) => i.id === selectedId) ??
      null
    );
  }, [selectedId, rangeItems, contextItems]);

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
        onClick={() => setReloadKey((k) => k + 1)}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-[13px] font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {t("scheduleScreen.retry")}
      </button>
    </div>
  );
  const showLoading = isLoading && rangeItems.length === 0;
  const showError = !!error;

  // Shared rightSidebar (AppShell owns the frame). Desktop shows a 2-tab
  // switcher ("今日の流れ" ↔ "詳細") inside ONE portal so contentCount stays 1;
  // Mobile shows only the flow (its item editor lives in the BottomSheet below).
  const sidebarTabs = useMemo(
    () => [
      { id: "flow", label: t("scheduleScreen.todayFlow") },
      { id: "detail", label: t("scheduleScreen.tabDetail") },
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

  const sidebarPortal = (
    <RightSidebarPortal>
      {isWide ? (
        <ScheduleSidebarTabs
          tabs={sidebarTabs}
          value={sidebarTab}
          onChange={(id) => setSidebarTab(id as "flow" | "detail")}
          label={t("scheduleScreen.detailPanelLabel")}
        >
          {sidebarTab === "flow" ? flowBody : detailBody}
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
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          {showLoading ? (
            loadingCard
          ) : showError ? (
            errorCard
          ) : mobileView === "list" ? (
            <AgendaList
              items={toAgenda(anchorDayItems)}
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
                items={toAgenda(monthDayItems)}
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
    </>
  );
}
