import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  useScheduleItemsContext,
  useRoutineContext,
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
  SegmentedControl,
  BottomSheet,
  Modal,
  addDaysKey,
  addMonthsKey,
  startOfMonthKey,
  startOfWeekKey,
  monthGridKeys,
  minutesToTime,
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

  const today = useMemo(() => todayLocalKey(), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const [view, setView] = useState("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rangeItems, setRangeItems] = useState<ScheduleItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mobileSelectedDay, setMobileSelectedDay] = useState(today);
  const [nowMinutes, setNowMinutes] = useState(() => nowMinutesLocal());

  // 1-minute now ticker (drives the now-line + agenda divider). Cleared on
  // unmount so it never leaks across section changes.
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(nowMinutesLocal()), 60_000);
    return () => clearInterval(id);
  }, []);

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
      setSelectedId(id);
    },
    [createAtTimes, t],
  );

  const handleAddEvent = useCallback(() => {
    const id = createAtTimes(
      anchorDate,
      "09:00",
      "10:00",
      t("scheduleCalendar.newEvent"),
    );
    setSelectedId(id);
    // The month layout has no editor pane, so adding from it would leave the
    // new event selected but uneditable — jump to the day view instead.
    if (desktopView === "month") setView("day");
  }, [createAtTimes, anchorDate, t, desktopView]);

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
        variant: itemVariant(i),
      })),
    [rangeItems],
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

  const toAgenda = (arr: ScheduleItem[]): AgendaItem[] =>
    sortDayItems(arr).map((i) => ({
      id: i.id,
      title: i.title,
      startTime: i.startTime,
      endTime: i.endTime,
      isAllDay: i.isAllDay,
      completed: i.completed,
      variant: itemVariant(i),
    }));

  const todayItems = useMemo(
    () => contextItems.filter((i) => !i.isDeleted && !i.isDismissed),
    [contextItems],
  );
  const todayAgenda = useMemo(() => toAgenda(todayItems), [todayItems]);
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

  const agendaLabels = {
    allDay: t("scheduleScreen.allDay"),
    empty: t("scheduleScreen.emptyToday"),
    nowLabel: minutesToTime(nowMinutes),
    complete: t("scheduleScreen.complete"),
  };
  const editorLabels = {
    complete: t("scheduleScreen.complete"),
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

  // "今日の流れ" — pushed into the shared detail panel (AppShell owns the frame).
  const todayFlow = (
    <RightSidebarPortal>
      <div className="flex flex-col gap-3 p-1">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-lumen-text">
            {t("scheduleScreen.todayFlow")}
          </h3>
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
          onSelectItem={setSelectedId}
          selectedId={selectedId}
          labels={agendaLabels}
        />
      </div>
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

  // ── Desktop ────────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <>
        {todayFlow}
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-3 md:px-6">
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
                onSelectDay={(day) => {
                  setAnchorDate(day);
                  setView("day");
                }}
                onSelectItem={(id) => {
                  const it = rangeItems.find((x) => x.id === id);
                  if (it) {
                    setAnchorDate(it.date);
                    setView("day");
                  }
                  setSelectedId(id);
                }}
                formatMoreCount={(n) =>
                  t("scheduleScreen.moreCount", { count: n })
                }
                formatDayLabel={formatFullDay}
                ariaLabel={t("scheduleScreen.calendar")}
                className="h-full"
              />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
              <WeekTimeGrid
                weekStart={desktopView === "day" ? anchorDate : weekStart}
                days={desktopView === "day" ? 1 : 7}
                items={gridItems}
                selectedId={selectedId}
                onSelectItem={setSelectedId}
                onCreateAt={handleCreateAt}
                onMoveItem={handleMoveItem}
                onResizeItem={handleResizeItem}
                weekdayLabels={weekdayLabels}
                allDayLabel={t("scheduleScreen.allDay")}
                createSlotLabel={t("scheduleCalendar.createSlot")}
                todayKey={today}
                nowMinutes={nowMinutes}
                fillHeight
                formatDayDate={formatDayDate}
              />
              <aside className="min-w-0 overflow-y-auto">
                {editorPane ?? (
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
              </aside>
            </div>
          )}
        </div>
        {calendarsModal}
      </>
    );
  }

  // ── Mobile ───────────────────────────────────────────────────────────────
  return (
    <>
      {todayFlow}
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3">
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
              onSelectItem={setSelectedId}
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
              onSelectItem={setSelectedId}
              onCreateAt={handleCreateAt}
              onMoveItem={handleMoveItem}
              onResizeItem={handleResizeItem}
              weekdayLabels={weekdayLabels}
              allDayLabel={t("scheduleScreen.allDay")}
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
                onSelectItem={(id) => setSelectedId(id)}
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
                onSelectItem={setSelectedId}
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
