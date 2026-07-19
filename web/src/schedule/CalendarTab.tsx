import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  useScheduleItemsContext,
  useRoutineContext,
  useTaskTreeContext,
  useRightSidebarOptional,
  useTranslation,
  useMediaQuery,
  useWeekStartPref,
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
  RepeatScopeDialog,
  SegmentedControl,
  BottomSheet,
  Modal,
  useScheduleItemsRoutineSync,
  addDaysKey,
  addMonthsKey,
  startOfMonthKey,
  startOfWeekKey,
  monthGridKeys,
  minutesToTime,
  deriveScheduleStatus,
  tasksToCalendarChips,
  taskChipId,
  isTaskChip,
  todayCalendarKey,
  normalizeDesktopView,
  normalizeMobileView,
  visibleCalendarRange,
  makeOptimisticScheduleItem,
  buildWeekdayLabels,
  frequencyLabel,
  itemVariant,
  nowMinutesLocal,
  sortDayItems,
  type FrequencyLabelCopy,
  type TaskCalendarChip,
  type ScheduleStatus,
  type ScheduleItem,
  type WeekTimeGridItem,
  type MonthGridItem,
  type AgendaItem,
  type EventEditorItem,
  type FrequencyEditorValue,
  type RepeatScope,
  type RoutineNode,
  type RoutineSummaryRow,
  type SegmentedOption,
  type DataService,
} from "@life-editor/shared";
import { CalendarView } from "./CalendarView";

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
  dataService,
  onOpenRoutines,
}: {
  dataService: DataService;
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
  const {
    routines,
    routineGroups,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setGroupsForRoutine,
    getGroupIdsForRoutine,
    detachRoutine,
    updateFutureOccurrences,
  } = useRoutineContext();
  // Range materialiser (#279): after an Event→Repeats conversion, the new
  // routine's occurrences are generated for the visible range right away —
  // the always-on RoutineScheduleSync only covers today.
  const { ensureRoutineItemsForDateRange } = useScheduleItemsRoutineSync({
    dataService,
  });
  // Scheduled TaskNodes → task=blue chips (schedule redesign A-1). `nodes`
  // already excludes soft-deleted tasks (useTaskTreeAPI). Read-only in A-1.
  const { nodes: taskNodes } = useTaskTreeContext();
  // Null-safe: the section can render without a RightSidebarProvider (tests /
  // standalone). `open` re-opens the panel when a calendar item is picked.
  const rightSidebar = useRightSidebarOptional();
  const openSidebar = rightSidebar?.open;

  const today = useMemo(() => todayCalendarKey(), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const [view, setView] = useState("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which rightSidebar tab is showing on Desktop ("今日の流れ" ↔ "詳細").
  const [sidebarTab, setSidebarTab] = useState<"flow" | "detail">("flow");
  const [rangeItems, setRangeItems] = useState<ScheduleItem[]>([]);
  // The [start, end] the CURRENT rangeItems actually came from (#278 guard):
  // set together with setRangeItems when a fetch settles, so absence of an
  // id in rangeItems is only trusted once the covering fetch has resolved.
  const [fetchedRange, setFetchedRange] = useState<[string, string] | null>(
    null,
  );
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
  // A click-created event stays a "pending draft" until first edited (#278).
  // While one is live and untouched, empty-slot / month-cell clicks must not
  // spawn another default item — they re-focus the pending draft instead.
  const [pendingDraft, setPendingDraft] = useState<{
    id: string;
    date: string;
  } | null>(null);
  // #279: pending this/future/all chooser. Edits/deletes of a routine-derived
  // occurrence are parked here until the user picks a scope in the dialog.
  const [scopeRequest, setScopeRequest] = useState<{
    mode: "edit" | "delete";
    item: ScheduleItem;
    patch?: Partial<ScheduleItem>;
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

  // The single `view` state carries both layouts; the normalisation lives in
  // shared calendarView (#280) so a resize keeps a sensible view without a
  // second piece of state.
  const desktopView = normalizeDesktopView(view);
  const mobileView = normalizeMobileView(view);
  const effView = isWide ? desktopView : mobileView;

  // Week-start pref (#217): read once per mount (same reload semantics as the
  // other lightweight prefs — a Settings change applies on section re-entry).
  const { weekStartsOn } = useWeekStartPref();
  const weekStart = useMemo(
    () => startOfWeekKey(anchorDate, weekStartsOn),
    [anchorDate, weekStartsOn],
  );
  const weekEnd = useMemo(() => addDaysKey(weekStart, 6), [weekStart]);
  const monthRows = useMemo(
    () => monthGridKeys(anchorDate, weekStartsOn),
    [anchorDate, weekStartsOn],
  );

  // Visible fetch window per effective view (day/list/time = single day).
  const [rangeStart, rangeEnd] = useMemo<[string, string]>(
    () =>
      visibleCalendarRange({
        effView,
        isWide,
        anchorDate,
        weekStart,
        weekEnd,
        monthRows,
      }),
    [effView, isWide, monthRows, weekStart, weekEnd, anchorDate],
  );

  // Read the visible range (cancelled-guard mirrors useScheduleItemsAPI). Edits
  // patch rangeItems optimistically below, so only navigation + retry reload.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await loadDateRange(rangeStart, rangeEnd);
      if (!cancelled) {
        setRangeItems(list.filter((i) => !i.isDeleted && !i.isDismissed));
        setFetchedRange([rangeStart, rangeEnd]);
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

  // Any real edit (field commit / drag / toggle) or removal counts as
  // "saved / discarded" and releases the pending-draft guard (#278).
  const resolveDraft = useCallback((id: string) => {
    setPendingDraft((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  const findScheduleItem = useCallback(
    (id: string): ScheduleItem | undefined =>
      rangeItems.find((i) => i.id === id) ??
      contextItems.find((i) => i.id === id),
    [rangeItems, contextItems],
  );

  const applyOccurrencePatch = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      patchRange(id, patch);
      updateScheduleItem(id, patch);
      resolveDraft(id);
    },
    [patchRange, updateScheduleItem, resolveDraft],
  );

  // Field edits route through here. A routine-derived occurrence with a
  // series-propagatable patch (title / times, never date or memo — the
  // routine template has neither a concrete date nor a memo) parks the patch
  // in the scope dialog (#279); everything else applies to the single row.
  const handleUpdate = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      const item = findScheduleItem(id);
      const propagatable =
        patch.date === undefined &&
        (patch.title !== undefined ||
          patch.startTime !== undefined ||
          patch.endTime !== undefined);
      if (item?.routineId && propagatable) {
        setScopeRequest({ mode: "edit", item, patch });
        return;
      }
      applyOccurrencePatch(id, patch);
    },
    [findScheduleItem, applyOccurrencePatch],
  );

  const handleToggle = useCallback(
    (id: string) => {
      // A-1: task chips don't own a ScheduleItem completion. Completion for
      // scheduled tasks is wired in Step 3 (TaskTree completion API). No-op.
      if (isTaskChip(id)) return;
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
      resolveDraft(id);
    },
    [toggleComplete, resolveDraft],
  );

  const createAtTimes = useCallback(
    (date: string, start: string, end: string, title: string): string => {
      const id = createScheduleItem(date, title, start, end);
      setRangeItems((prev) => [
        ...prev,
        makeOptimisticScheduleItem(id, date, title, start, end),
      ]);
      return id;
    },
    [createScheduleItem],
  );

  // True = a pending draft exists → block this create and bring the draft
  // back into view/selection instead (#278). Self-heals when the draft
  // vanished through a path the handlers don't own (undo, sync) — but only
  // once a SETTLED fetch covering the draft's date says it is gone:
  // rangeItems holds the previous range's list while a navigation fetch is
  // in flight, and trusting that stale absence would re-open the very
  // duplicate-create hole this guard exists to close.
  const draftGuardBlocks = useCallback((): boolean => {
    if (!pendingDraft) return false;
    const fetchSettled =
      !!fetchedRange &&
      pendingDraft.date >= fetchedRange[0] &&
      pendingDraft.date <= fetchedRange[1];
    const live =
      rangeItems.some((i) => i.id === pendingDraft.id) ||
      contextItems.some(
        (i) => i.id === pendingDraft.id && !i.isDeleted && !i.isDismissed,
      );
    if (fetchSettled && !live) {
      setPendingDraft(null);
      return false;
    }
    // Jump only when the draft is off-screen — an unconditional anchor move
    // would flip the month view to the adjacent month for a draft sitting on
    // a spillover cell that is already visible.
    const inVisibleRange =
      pendingDraft.date >= rangeStart && pendingDraft.date <= rangeEnd;
    if (!inVisibleRange) setAnchorDate(pendingDraft.date);
    handleSelectItem(pendingDraft.id);
    return true;
  }, [
    pendingDraft,
    fetchedRange,
    rangeItems,
    contextItems,
    rangeStart,
    rangeEnd,
    handleSelectItem,
  ]);

  const handleCreateAt = useCallback(
    (dateISO: string, minutes: number) => {
      if (draftGuardBlocks()) return;
      const start = minutesToTime(minutes);
      const end = minutesToTime(minutes + CREATE_DURATION_MIN);
      const id = createAtTimes(
        dateISO,
        start,
        end,
        t("scheduleCalendar.newEvent"),
      );
      setPendingDraft({ id, date: dateISO });
      handleSelectItem(id);
    },
    [draftGuardBlocks, createAtTimes, handleSelectItem, t],
  );

  const handleAddEvent = useCallback(() => {
    if (draftGuardBlocks()) return;
    const id = createAtTimes(
      anchorDate,
      "09:00",
      "10:00",
      t("scheduleCalendar.newEvent"),
    );
    // The detail editor now lives in the rightSidebar (not the main grid), so
    // the month layout can edit a new event in place — no jump to day view
    // (#224). handleSelectItem opens the detail panel on Desktop.
    setPendingDraft({ id, date: anchorDate });
    handleSelectItem(id);
  }, [draftGuardBlocks, createAtTimes, handleSelectItem, anchorDate, t]);

  // Month-cell day tap → create a default-time event on that day and open its
  // detail panel in place, instead of switching to the day view (#224).
  const handleCreateOnDay = useCallback(
    (day: string) => {
      if (draftGuardBlocks()) return;
      setAnchorDate(day);
      const id = createAtTimes(
        day,
        "09:00",
        "10:00",
        t("scheduleCalendar.newEvent"),
      );
      setPendingDraft({ id, date: day });
      handleSelectItem(id);
    },
    [draftGuardBlocks, createAtTimes, handleSelectItem, t],
  );

  const handleQuickAdd = useCallback(
    (title: string, start: string, end: string) => {
      createAtTimes(anchorDate, start, end, title);
    },
    [createAtTimes, anchorDate],
  );

  const handleMoveItem = useCallback(
    (id: string, dateISO: string, startISO: string, endISO: string) => {
      // A-1: task chips are read-only (WeekTimeGrid also omits their drag
      // affordances). Step 2 wires drag → updateTaskNode(scheduledAt). No-op.
      if (isTaskChip(id)) return;
      const item = findScheduleItem(id);
      // Same-day drag of a routine occurrence is a time edit → scope dialog
      // (#279). A cross-day drag stays occurrence-level without asking: the
      // routine template has no concrete date to propagate a day move to.
      if (item?.routineId && dateISO === item.date) {
        setScopeRequest({
          mode: "edit",
          item,
          patch: { startTime: startISO, endTime: endISO },
        });
        return;
      }
      applyOccurrencePatch(id, {
        date: dateISO,
        startTime: startISO,
        endTime: endISO,
      });
    },
    [findScheduleItem, applyOccurrencePatch],
  );

  const handleResizeItem = useCallback(
    (id: string, endISO: string) => {
      if (isTaskChip(id)) return; // A-1: task chips read-only (see handleMoveItem)
      const item = findScheduleItem(id);
      if (item?.routineId) {
        setScopeRequest({ mode: "edit", item, patch: { endTime: endISO } });
        return;
      }
      applyOccurrencePatch(id, { endTime: endISO });
    },
    [findScheduleItem, applyOccurrencePatch],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismiss(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
      resolveDraft(id);
    },
    [dismiss, resolveDraft],
  );

  // Delete routes every entry point (editor pane, context menu) through one
  // gate: a routine-derived occurrence opens the scope dialog (#279) — a
  // plain single-row delete would let the generator revive it (Issue 017) —
  // while a manual item soft-deletes directly.
  const handleDelete = useCallback(
    (id: string) => {
      const item = findScheduleItem(id);
      if (item?.routineId) {
        setScopeRequest({ mode: "delete", item });
        return;
      }
      deleteScheduleItem(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
      resolveDraft(id);
    },
    [findScheduleItem, deleteScheduleItem, resolveDraft],
  );

  // ── Context menu (rename / duplicate / delete) ─────────────────────────────

  const handleItemContextMenu = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      if (isTaskChip(id)) return; // A-1: no rename/duplicate/delete on task chips
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

  // Deliberately NOT routed through the #278 draft guard: Duplicate is an
  // explicit context-menu action (not an accidental empty-slot click), and
  // the copy carries a real title, so it neither scatters default drafts nor
  // becomes one itself.
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
          ...makeOptimisticScheduleItem(
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

  // Frequency change from the editor. For a routine occurrence this is a
  // series edit (patch the source routine). For a manual event, choosing a
  // frequency spins up a routine seeded from the event, then drops the
  // standalone seed — the generator materialises occurrences going forward.
  const handleChangeRepeat = useCallback(
    (patch: Partial<FrequencyEditorValue>) => {
      if (!selected) return;
      if (selected.routineId != null) {
        const { groupIds, ...rest } = patch;
        if (groupIds !== undefined)
          setGroupsForRoutine(selected.routineId, groupIds);
        if (Object.keys(rest).length > 0) {
          updateRoutine(selected.routineId, rest);
        }
        return;
      }
      // Manual → turn a repeat on. group is not offered here (allowGroup=false),
      // so only a concrete daily/weekdays/interval type reaches this branch.
      const type = patch.frequencyType;
      if (!type || type === "group") return;
      const [yy, mm, dd] = selected.date.split("-").map(Number);
      const seedWeekday = new Date(yy, mm - 1, dd).getDay();
      const frequencyDays = type === "weekdays" ? [seedWeekday] : [];
      const frequencyInterval = type === "interval" ? 1 : null;
      const frequencyStartDate = type === "interval" ? selected.date : null;
      const routineId = createRoutine(
        selected.title,
        selected.startTime,
        selected.endTime,
        type,
        frequencyDays,
        frequencyInterval,
        frequencyStartDate,
      );
      handleDelete(selected.id);
      // #279: materialise the new routine's occurrences for the visible range
      // right away — otherwise the converted event vanishes from the week
      // view (the always-on generator only covers today, and rangeItems only
      // reloads on navigation). Passing ONLY the new routine keeps the
      // range-ensure's frequency-mismatch cleanup away from other routines'
      // (possibly hand-moved) occurrences.
      const now = new Date().toISOString();
      const optimisticRoutine: RoutineNode = {
        id: routineId,
        title: selected.title,
        startTime: selected.startTime,
        endTime: selected.endTime,
        isArchived: false,
        isVisible: true,
        isDeleted: false,
        deletedAt: null,
        order: 0,
        frequencyType: type,
        frequencyDays,
        frequencyInterval,
        frequencyStartDate,
        createdAt: now,
        updatedAt: now,
      };
      // Clamp the ensure window: never materialise BEFORE today or before
      // the seed — a repeat conceptually starts at the converted occurrence,
      // and fabricating not-done rows into past days would pollute the life
      // record (tier-1 rule 1 spirit). A past-dated seed re-materialises
      // exactly its own day (1:1 replacement of the deleted seed event, so
      // the converted item stays visible), nothing in between.
      const seedDate = selected.date;
      const windowStart = [rangeStart, seedDate, today].reduce((a, b) =>
        a >= b ? a : b,
      );
      void (async () => {
        if (seedDate < windowStart) {
          await ensureRoutineItemsForDateRange(seedDate, seedDate, [
            optimisticRoutine,
          ]);
        }
        if (windowStart <= rangeEnd) {
          await ensureRoutineItemsForDateRange(windowStart, rangeEnd, [
            optimisticRoutine,
          ]);
          // Second idempotent pass: the always-on today generator can race
          // the first batch on today's row (23505 → whole-batch rollback
          // inside ensure). The re-run's pre-check sees the winner and fills
          // in the remaining days.
          await ensureRoutineItemsForDateRange(windowStart, rangeEnd, [
            optimisticRoutine,
          ]);
        }
        setReloadKey((k) => k + 1);
      })();
    },
    [
      selected,
      setGroupsForRoutine,
      updateRoutine,
      createRoutine,
      handleDelete,
      ensureRoutineItemsForDateRange,
      rangeStart,
      rangeEnd,
      today,
    ],
  );

  // "なし" selected → turn the repeat off (detach the series from today on).
  const handleDetachRepeat = useCallback(() => {
    if (!selected || selected.routineId == null) return; // manual = no-op
    const routineId = selected.routineId;
    const occurrenceId = selected.id;
    setSelectedId((cur) => (cur === occurrenceId ? null : cur));
    void (async () => {
      try {
        // Reconcile off the SERVER's own delete set (the returned ids) rather
        // than a client-side date predicate — the two must not drift (the
        // service's "today" honours the day-start-hour pref; a local
        // todayLocalKey memo would disagree in the late-night window).
        const { deletedScheduleItemIds } = await detachRoutine(routineId);
        const removed = new Set(deletedScheduleItemIds);
        setRangeItems((prev) =>
          prev
            .filter((i) => !removed.has(i.id))
            // Survivors keep their row but lose the routine origin (the band
            // goes away) — mirrors the server NULLing routine_item_id.
            .map((i) =>
              i.routineId === routineId ? { ...i, routineId: null } : i,
            ),
        );
      } catch {
        // Detach did not land server-side: force a full range reload so the
        // view returns to the DB truth (nothing navigated to trigger it).
        setReloadKey((k) => k + 1);
      }
    })();
  }, [selected, detachRoutine]);

  // #279: apply the scope the user picked in the RepeatScopeDialog.
  // Edit — this: single-row patch (the manual edit then wins over any later
  // series propagation, tier-1 §Schedule rule 2); future/all: patch the
  // routine template + the still-unedited, not-done, not-dismissed
  // materialised rows from the anchor date (all = from the epoch).
  // Delete — this: Dismiss (a plain delete would be revived by the
  // generator, Issue 017); future: detach the series from this occurrence's
  // date (past/completed survive as detached records); all: soft-delete the
  // routine with full cascade (Trash-restorable).
  const handleScopeChoose = useCallback(
    (scope: RepeatScope) => {
      const req = scopeRequest;
      setScopeRequest(null);
      if (!req?.item.routineId) return;
      const routineId = req.item.routineId;

      // A FUTURE-dated anchor needs the days between today and the anchor
      // materialised BEFORE the series is mutated: those occurrences only
      // exist on demand, and both detachRoutine (routine soft-deleted) and a
      // template update would otherwise erase / rewrite days the user did
      // not select. The fresh rows carry the PRE-edit template, so they
      // survive a "future" edit (fromDate filter) and a "future" delete
      // (start_at < anchor ⇒ detached survivors) alike.
      const fillUpToAnchor = async (routine: RoutineNode, anchor: string) => {
        if (anchor <= today) return;
        const end = addDaysKey(anchor, -1);
        const start = today;
        if (start <= end) {
          await ensureRoutineItemsForDateRange(start, end, [routine]);
        }
      };

      if (req.mode === "edit") {
        const patch = req.patch ?? {};
        if (scope === "this") {
          applyOccurrencePatch(req.item.id, patch);
          return;
        }
        const routine = routines.find((r) => r.id === routineId);
        if (!routine) {
          // Routines not loaded (or the routine vanished): propagating
          // without the pre-edit template would drop the manual-edit
          // protection (rule 2) — degrade to a this-only edit.
          applyOccurrencePatch(req.item.id, patch);
          return;
        }
        const updates: {
          title?: string;
          startTime?: string;
          endTime?: string;
        } = {};
        if (patch.title !== undefined) updates.title = patch.title;
        if (patch.startTime !== undefined) updates.startTime = patch.startTime;
        if (patch.endTime !== undefined) updates.endTime = patch.endTime;
        // The PRE-edit template identifies never-individually-edited rows —
        // manual edits win over the series edit (tier-1 §Schedule rule 2).
        const template = {
          title: routine.title,
          startTime: routine.startTime,
          endTime: routine.endTime,
        };
        const fromDate = scope === "future" ? req.item.date : "0000-01-01";
        // Optimistic: the edited occurrence itself reflects the change now.
        applyOccurrencePatch(req.item.id, patch);
        void (async () => {
          try {
            if (scope === "future") {
              await fillUpToAnchor(routine, req.item.date);
            }
            await updateFutureOccurrences(
              routineId,
              updates,
              fromDate,
              template,
            );
            // Template update so future generation follows the new values.
            updateRoutine(routineId, updates);
          } catch {
            // Propagation did not land — the range reload below restores the
            // DB truth either way.
          } finally {
            setReloadKey((k) => k + 1);
          }
        })();
        return;
      }

      // delete
      if (scope === "this") {
        handleDismiss(req.item.id);
        return;
      }
      setSelectedId((cur) => (cur === req.item.id ? null : cur));
      if (scope === "future") {
        const routine = routines.find((r) => r.id === routineId);
        void (async () => {
          try {
            if (routine) await fillUpToAnchor(routine, req.item.date);
            const { deletedScheduleItemIds } = await detachRoutine(
              routineId,
              req.item.date,
            );
            const removed = new Set(deletedScheduleItemIds);
            setRangeItems((prev) =>
              prev
                .filter((i) => !removed.has(i.id))
                .map((i) =>
                  i.routineId === routineId ? { ...i, routineId: null } : i,
                ),
            );
            // The pre-anchor fill may have written rows inside the visible
            // range — re-read so they show as detached survivors.
            if (routine && req.item.date > today) setReloadKey((k) => k + 1);
          } catch {
            setReloadKey((k) => k + 1);
          }
        })();
        return;
      }
      void (async () => {
        try {
          const { deletedScheduleItemIds } = await deleteRoutine(routineId);
          const removed = new Set(deletedScheduleItemIds);
          // deleteRoutine swallows service errors (hook-wide log-and-continue
          // convention) and returns [] — an empty cascade is also legitimate,
          // so re-read instead of guessing which one happened.
          if (removed.size === 0) {
            setReloadKey((k) => k + 1);
            return;
          }
          setRangeItems((prev) => prev.filter((i) => !removed.has(i.id)));
        } catch {
          setReloadKey((k) => k + 1);
        }
      })();
    },
    [
      scopeRequest,
      routines,
      applyOccurrencePatch,
      updateFutureOccurrences,
      updateRoutine,
      handleDismiss,
      detachRoutine,
      deleteRoutine,
      ensureRoutineItemsForDateRange,
      today,
    ],
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
      onClose={() => setScopeRequest(null)}
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
