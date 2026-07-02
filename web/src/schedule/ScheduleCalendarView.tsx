import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useScheduleItemsContext,
  useMediaQuery,
  useTranslation,
  WeekTimeGrid,
  BottomSheet,
  addDaysKey,
  startOfWeekKey,
  minutesToTime,
  type WeekTimeGridItem,
  type ScheduleItem,
} from "@life-editor/shared";
import { DebouncedTextInput } from "../components/DebouncedTextInput";

/*
 * Web Schedule calendar (W8) — the 2-layer-model "complex screen".
 *
 *   wide (≥ md)   — shared <WeekTimeGrid> (7-day time grid) + a right-pane
 *                   editor for the selected event. Week navigation.
 *   narrow (< md) — a 1-day agenda (time-ordered list) with day navigation;
 *                   tapping an event opens the SAME editor in a BottomSheet.
 *
 * Data: schedule_items are READ for the visible week via the existing
 * useScheduleItemsContext().loadDateRange (no CRUD rewrite — W8 scope). Edits
 * go through the existing updateScheduleItem / toggleComplete; the local
 * weekItems copy is patched optimistically so the grid reflects the change
 * without a refetch. RoutineScheduleSync / ScheduleView / CalendarView are
 * untouched. i18n is resolved here and injected into the shared grid (§6.4).
 */

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface EditorLabels {
  title: string;
  startTime: string;
  endTime: string;
  complete: string;
}

function EventEditor({
  item,
  labels,
  onUpdate,
  onToggle,
}: {
  item: ScheduleItem;
  labels: EditorLabels;
  onUpdate: (
    id: string,
    patch: { title?: string; startTime?: string; endTime?: string },
  ) => void;
  onToggle: (id: string) => void;
}) {
  const inputCls =
    "mt-1 w-full rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text";
  return (
    <div className="space-y-3 rounded-md border border-ink-border bg-ink-bg-secondary p-3">
      <label className="flex items-center gap-2 text-sm text-ink-text">
        <input
          type="checkbox"
          checked={item.completed}
          onChange={() => onToggle(item.id)}
          aria-label={labels.complete}
        />
        <span className={item.completed ? "line-through" : ""}>
          {labels.complete}
        </span>
      </label>
      <div>
        <span className="mb-1 block text-xs text-ink-text-secondary">
          {labels.title}
        </span>
        <DebouncedTextInput
          key={`title-${item.id}`}
          value={item.title}
          onCommit={(title) => onUpdate(item.id, { title })}
          aria-label={labels.title}
          className="w-full rounded-md border border-ink-border bg-ink-bg px-2 py-1 text-sm text-ink-text"
        />
      </div>
      <div className="flex gap-3">
        <label className="flex-1 text-xs text-ink-text-secondary">
          {labels.startTime}
          <input
            type="time"
            value={item.startTime}
            onChange={(e) => onUpdate(item.id, { startTime: e.target.value })}
            aria-label={labels.startTime}
            className={inputCls}
          />
        </label>
        <label className="flex-1 text-xs text-ink-text-secondary">
          {labels.endTime}
          <input
            type="time"
            value={item.endTime}
            onChange={(e) => onUpdate(item.id, { endTime: e.target.value })}
            aria-label={labels.endTime}
            className={inputCls}
          />
        </label>
      </div>
    </div>
  );
}

export function ScheduleCalendarView() {
  const { t, i18n } = useTranslation();
  const {
    loadDateRange,
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
  } = useScheduleItemsContext();
  const isWide = useMediaQuery("(min-width: 768px)", true);

  const today = useMemo(() => todayLocal(), []);
  const [anchorDate, setAnchorDate] = useState<string>(today);
  const weekStart = useMemo(() => startOfWeekKey(anchorDate, 0), [anchorDate]);
  const weekEnd = useMemo(() => addDaysKey(weekStart, 6), [weekStart]);

  const [weekItems, setWeekItems] = useState<ScheduleItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Read the visible week whenever it (or the data layer) changes. The async
  // IIFE + cancelled guard mirrors useScheduleItemsAPI's own load effect — the
  // setState lands after the await, not synchronously in the effect body.
  // Mutations patch `weekItems` optimistically (below), so no refetch is
  // needed on edit; this effect only reloads on week navigation.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await loadDateRange(weekStart, weekEnd);
      if (!cancelled) setWeekItems(list.filter((i) => !i.isDeleted));
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDateRange, weekStart, weekEnd]);

  const patchLocal = useCallback((id: string, patch: Partial<ScheduleItem>) => {
    setWeekItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }, []);

  const handleUpdate = useCallback(
    (
      id: string,
      patch: { title?: string; startTime?: string; endTime?: string },
    ) => {
      patchLocal(id, patch);
      updateScheduleItem(id, patch);
    },
    [patchLocal, updateScheduleItem],
  );

  const handleToggle = useCallback(
    (id: string) => {
      // Mirror the provider's field set (useScheduleItemsAPI.toggleComplete):
      // flip `completed` AND derive `completedAt`, so the optimistic weekItems
      // copy stays internally consistent. The provider's server-reconciled row
      // lands on ITS own `items` state, which this view doesn't consume, so we
      // must keep both fields aligned locally.
      setWeekItems((prev) =>
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

  // Empty-slot click → create a default-duration event at the snapped time.
  // The provider's createScheduleItem returns the new id synchronously and
  // persists in the background; we mirror its optimistic row onto our own
  // weekItems (this view doesn't consume the provider's `items`) and select it
  // so the editor opens immediately. The grid passes `minutes` already snapped.
  const CREATE_DURATION_MIN = 60;
  const handleCreateAt = useCallback(
    (dateISO: string, minutes: number) => {
      const startTime = minutesToTime(minutes);
      const endTime = minutesToTime(minutes + CREATE_DURATION_MIN);
      const title = t("scheduleCalendar.newEvent");
      const id = createScheduleItem(dateISO, title, startTime, endTime);
      const nowIso = new Date().toISOString();
      const optimistic: ScheduleItem = {
        id,
        date: dateISO,
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
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setWeekItems((prev) => [...prev, optimistic]);
      setSelectedId(id);
    },
    [createScheduleItem, t],
  );

  // Drag-to-move: vertical = new start/end time, horizontal = new day. Patch
  // locally for an instant re-layout, then persist all three fields at once.
  const handleMoveItem = useCallback(
    (id: string, dateISO: string, startISO: string, endISO: string) => {
      const patch = { date: dateISO, startTime: startISO, endTime: endISO };
      patchLocal(id, patch);
      updateScheduleItem(id, patch);
    },
    [patchLocal, updateScheduleItem],
  );

  // Bottom-handle drag-to-resize: only the end time changes.
  const handleResizeItem = useCallback(
    (id: string, endISO: string) => {
      patchLocal(id, { endTime: endISO });
      updateScheduleItem(id, { endTime: endISO });
    },
    [patchLocal, updateScheduleItem],
  );

  const weekdayLabels = useMemo(
    () => [
      t("scheduleCalendar.weekdaySun"),
      t("scheduleCalendar.weekdayMon"),
      t("scheduleCalendar.weekdayTue"),
      t("scheduleCalendar.weekdayWed"),
      t("scheduleCalendar.weekdayThu"),
      t("scheduleCalendar.weekdayFri"),
      t("scheduleCalendar.weekdaySat"),
    ],
    [t],
  );

  const gridItems: WeekTimeGridItem[] = useMemo(
    () =>
      weekItems.map((i) => ({
        id: i.id,
        date: i.date,
        title: i.title,
        startTime: i.startTime,
        endTime: i.endTime,
        isAllDay: i.isAllDay,
        completed: i.completed,
      })),
    [weekItems],
  );

  const selected = useMemo(
    () => weekItems.find((i) => i.id === selectedId) ?? null,
    [weekItems, selectedId],
  );

  const dayAgenda = useMemo(
    () =>
      weekItems
        .filter((i) => i.date === anchorDate)
        .slice()
        .sort((a, b) => {
          if (!!a.isAllDay !== !!b.isAllDay) return a.isAllDay ? -1 : 1;
          return a.startTime.localeCompare(b.startTime);
        }),
    [weekItems, anchorDate],
  );

  const monthDayFmt = useMemo(
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
      return monthDayFmt.format(new Date(y, m - 1, d));
    },
    [monthDayFmt],
  );
  const anchorLabel = useMemo(() => {
    const [y, m, d] = anchorDate.split("-").map(Number);
    return new Intl.DateTimeFormat(i18n.language, {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    }).format(new Date(y, m - 1, d));
  }, [anchorDate, i18n.language]);

  const editorLabels: EditorLabels = {
    title: t("scheduleCalendar.title"),
    startTime: t("scheduleCalendar.startTime"),
    endTime: t("scheduleCalendar.endTime"),
    complete: t("scheduleCalendar.complete"),
  };

  const navBtn =
    "rounded-md border border-ink-border p-1 text-ink-text hover:bg-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent";
  const stepBy = (delta: number) => setAnchorDate((a) => addDaysKey(a, delta));

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAnchorDate(today)}
          className="rounded-md border border-ink-border px-2 py-1 text-sm text-ink-text hover:bg-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
        >
          {t("scheduleCalendar.today")}
        </button>
        <span className="text-sm font-medium text-ink-text">
          {isWide
            ? `${formatDayDate(weekStart)} – ${formatDayDate(weekEnd)}`
            : anchorLabel}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => stepBy(isWide ? -7 : -1)}
          aria-label={t(
            isWide ? "scheduleCalendar.prevWeek" : "scheduleCalendar.prevDay",
          )}
          className={navBtn}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => stepBy(isWide ? 7 : 1)}
          aria-label={t(
            isWide ? "scheduleCalendar.nextWeek" : "scheduleCalendar.nextDay",
          )}
          className={navBtn}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </header>
  );

  if (isWide) {
    return (
      <section className="space-y-3">
        {header}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <WeekTimeGrid
            weekStart={weekStart}
            items={gridItems}
            selectedId={selectedId}
            onSelectItem={setSelectedId}
            onCreateAt={handleCreateAt}
            onMoveItem={handleMoveItem}
            onResizeItem={handleResizeItem}
            weekdayLabels={weekdayLabels}
            allDayLabel={t("scheduleCalendar.allDay")}
            createSlotLabel={t("scheduleCalendar.createSlot")}
            todayKey={today}
            formatDayDate={formatDayDate}
          />
          <aside className="min-w-0">
            {selected ? (
              <EventEditor
                item={selected}
                labels={editorLabels}
                onUpdate={handleUpdate}
                onToggle={handleToggle}
              />
            ) : (
              <p className="rounded-md border border-ink-border bg-ink-bg-secondary px-4 py-6 text-sm text-ink-text-secondary">
                {t("scheduleCalendar.selectHint")}
              </p>
            )}
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {header}
      <ul className="space-y-2">
        {dayAgenda.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="flex w-full items-center gap-3 rounded-md border border-ink-border bg-ink-bg px-3 py-2 text-left hover:bg-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent"
            >
              <span className="w-20 shrink-0 text-xs tabular-nums text-ink-text-secondary">
                {item.isAllDay
                  ? t("scheduleCalendar.allDay")
                  : `${item.startTime}–${item.endTime}`}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm text-ink-text ${
                  item.completed ? "line-through" : ""
                }`}
              >
                {item.title || " "}
              </span>
            </button>
          </li>
        ))}
        {dayAgenda.length === 0 && (
          <li className="rounded-md border border-ink-border bg-ink-bg-secondary px-3 py-6 text-center text-sm text-ink-text-secondary">
            {t("scheduleCalendar.empty")}
          </li>
        )}
      </ul>
      <BottomSheet
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.title || t("scheduleCalendar.title")}
      >
        {selected && (
          <EventEditor
            item={selected}
            labels={editorLabels}
            onUpdate={handleUpdate}
            onToggle={handleToggle}
          />
        )}
      </BottomSheet>
    </section>
  );
}
