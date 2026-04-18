import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Repeat,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
} from "lucide-react";
import { getDataService } from "../../services/dataServiceFactory";
import { useSyncContext } from "../../hooks/useSyncContext";
import { useServiceErrorHandler } from "../../hooks/useServiceErrorHandler";
import type { ScheduleItem } from "../../types/schedule";
import type { TaskNode } from "../../types/taskTree";
import {
  MobileScheduleItemForm,
  type ScheduleItemFormData,
} from "./MobileScheduleItemForm";

// --- Utilities ---

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function generateId(): string {
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// --- Swipeable delete ---

const SWIPE_DELETE_THRESHOLD = 80;

function SwipeableItem({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    locked: boolean | null;
  }>({ startX: 0, startY: 0, locked: null });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: null,
    };
    setIsTransitioning(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    if (touchRef.current.locked === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        touchRef.current.locked = Math.abs(deltaX) > Math.abs(deltaY);
      }
      return;
    }

    if (!touchRef.current.locked) return;
    const clampedX = Math.min(0, Math.max(-120, deltaX));
    setOffsetX(clampedX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchRef.current.locked !== true) return;
    setIsTransitioning(true);
    if (Math.abs(offsetX) > SWIPE_DELETE_THRESHOLD) {
      setOffsetX(-120);
    } else {
      setOffsetX(0);
    }
    touchRef.current.locked = null;
  }, [offsetX]);

  const resetSwipe = useCallback(() => {
    setIsTransitioning(true);
    setOffsetX(0);
  }, []);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex w-[120px] items-center justify-center bg-notion-danger">
        <button
          onClick={() => {
            onDelete();
            resetSwipe();
          }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Trash2 size={18} />
          <span className="text-xs">Delete</span>
        </button>
      </div>
      <div
        className="relative bg-notion-bg"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isTransitioning ? "transform 200ms ease-out" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (Math.abs(offsetX) > 10) resetSwipe();
        }}
      >
        {children}
      </div>
    </div>
  );
}

// --- Monthly Mini Calendar ---

function MobileMonthlyCalendar({
  selectedDate,
  onDateSelect,
  itemCountByDate,
  taskCountByDate,
}: {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  itemCountByDate: Map<string, number>;
  taskCountByDate: Map<string, number>;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const dayLabels =
    lang === "ja"
      ? ["月", "火", "水", "木", "金", "土", "日"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const todayString = useMemo(() => formatDateStr(new Date()), []);

  const monthLabel = useMemo(() => {
    if (lang === "ja") {
      return `${viewDate.year}年${viewDate.month + 1}月`;
    }
    const d = new Date(viewDate.year, viewDate.month, 1);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }, [viewDate, lang]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const lastDay = new Date(viewDate.year, viewDate.month + 1, 0);

    // Day of week for first day (0=Sun, adjust to Mon=0)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: Array<{ date: Date; inMonth: boolean }> = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      days.push({ date: addDays(firstDay, -i - 1), inMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        date: new Date(viewDate.year, viewDate.month, d),
        inMonth: true,
      });
    }

    // Next month padding (fill to complete the grid row)
    while (days.length % 7 !== 0) {
      const lastDate = days[days.length - 1].date;
      days.push({ date: addDays(lastDate, 1), inMonth: false });
    }

    return days;
  }, [viewDate]);

  const navigateMonth = useCallback((direction: -1 | 1) => {
    setViewDate((prev) => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      return { year: newYear, month: newMonth };
    });
  }, []);

  return (
    <div className="border-b border-notion-border bg-notion-bg px-2 pb-2">
      {/* Month header */}
      <div className="flex items-center justify-between px-2 py-2">
        <button
          onClick={() => navigateMonth(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full active:bg-notion-hover"
        >
          <ChevronLeft size={18} className="text-notion-text-secondary" />
        </button>
        <button
          onClick={() => {
            const now = new Date();
            setViewDate({ year: now.getFullYear(), month: now.getMonth() });
            onDateSelect(formatDateStr(now));
          }}
          className="text-sm font-semibold text-notion-text active:opacity-60"
        >
          {monthLabel}
        </button>
        <button
          onClick={() => navigateMonth(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full active:bg-notion-hover"
        >
          <ChevronRight size={18} className="text-notion-text-secondary" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7">
        {dayLabels.map((label, i) => (
          <div
            key={label}
            className={`py-0.5 text-center text-[10px] font-medium ${
              i >= 5
                ? "text-notion-text-secondary/60"
                : "text-notion-text-secondary"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map(({ date, inMonth }) => {
          const dateStr = formatDateStr(date);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayString;
          const scheduleCount = itemCountByDate.get(dateStr) ?? 0;
          const taskCount = taskCountByDate.get(dateStr) ?? 0;
          const hasItems = scheduleCount > 0 || taskCount > 0;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              className={`flex flex-col items-center py-0.5 ${
                !inMonth ? "opacity-30" : ""
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  isSelected
                    ? "bg-notion-accent text-white"
                    : isToday
                      ? "border border-notion-accent text-notion-accent"
                      : "text-notion-text"
                }`}
              >
                {date.getDate()}
              </div>
              <div className="flex h-1.5 items-center gap-0.5">
                {hasItems && (
                  <>
                    {scheduleCount > 0 && (
                      <span
                        className={`h-1 w-1 rounded-full ${
                          isSelected ? "bg-white/60" : "bg-notion-accent"
                        }`}
                      />
                    )}
                    {taskCount > 0 && (
                      <span
                        className={`h-1 w-1 rounded-full ${
                          isSelected ? "bg-white/60" : "bg-notion-success"
                        }`}
                      />
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Schedule item row ---

function ScheduleItemRow({
  item,
  onToggle,
  onEdit,
  showTime,
}: {
  item: ScheduleItem;
  onToggle: (id: string) => void;
  onEdit: (item: ScheduleItem) => void;
  showTime: boolean;
}) {
  const isRoutine = !!item.routineId;
  const isDone = item.completed;

  return (
    <div
      className="flex items-center gap-3 border-b border-notion-border px-4 py-3 active:bg-notion-hover"
      onClick={() => onEdit(item)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id);
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          isDone
            ? "border-notion-accent bg-notion-accent"
            : isRoutine
              ? "border-notion-success"
              : "border-notion-border"
        }`}
        style={{ minWidth: 28, minHeight: 28 }}
      >
        {isDone && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-white"
          >
            <path
              d="M3 7L6 10L11 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isRoutine && (
            <Repeat size={12} className="shrink-0 text-notion-success" />
          )}
          <span
            className={`truncate text-sm ${
              isDone
                ? "text-notion-text-secondary line-through"
                : "text-notion-text"
            }`}
          >
            {item.title}
          </span>
        </div>
        {showTime && (
          <span className="mt-0.5 block text-xs text-notion-text-secondary">
            {item.startTime} - {item.endTime}
          </span>
        )}
        {item.memo && (
          <span className="mt-0.5 block truncate text-xs text-notion-text-secondary/70">
            {item.memo}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Task row (for scheduled tasks) ---

function TaskRow({
  task,
  onToggle,
}: {
  task: TaskNode;
  onToggle: (task: TaskNode) => void;
}) {
  const isDone = task.status === "DONE";
  const isInProgress = task.status === "IN_PROGRESS";

  return (
    <div className="flex items-center gap-3 border-b border-notion-border px-4 py-3">
      <button
        onClick={() => onToggle(task)}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          isDone
            ? "border-notion-accent bg-notion-accent"
            : isInProgress
              ? "border-notion-warning bg-notion-warning/20"
              : "border-notion-border"
        }`}
        style={{ minWidth: 28, minHeight: 28 }}
      >
        {isDone && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-white"
          >
            <path
              d="M3 7L6 10L11 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <span
          className={`truncate text-sm ${
            isDone
              ? "text-notion-text-secondary line-through"
              : "text-notion-text"
          }`}
        >
          {task.title}
        </span>
        {task.scheduledAt && (
          <span className="mt-0.5 block text-xs text-notion-text-secondary">
            {task.scheduledAt.slice(11, 16)}
            {task.scheduledEndAt && ` - ${task.scheduledEndAt.slice(11, 16)}`}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Main Calendar View ---

type CalendarSubTab = "monthly" | "dayflow";

export function MobileCalendarView() {
  const { t } = useTranslation();
  const { syncVersion } = useSyncContext();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [subTab, setSubTab] = useState<CalendarSubTab>("monthly");
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [monthItems, setMonthItems] = useState<ScheduleItem[]>([]);
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const { handle: handleError } = useServiceErrorHandler();

  const ds = getDataService();

  // Load schedule items for selected date
  const loadDayItems = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const result = await ds.fetchScheduleItemsByDate(date);
        setScheduleItems(
          result.sort((a, b) => a.startTime.localeCompare(b.startTime)),
        );
      } catch (e) {
        handleError(e, "errors.schedule.loadFailed");
      } finally {
        setLoading(false);
      }
    },
    [ds, handleError],
  );

  // Load tasks (all, then filter by scheduled date)
  const loadTasks = useCallback(async () => {
    try {
      const tree = await ds.fetchTaskTree();
      setTasks(tree.filter((t) => t.type === "task" && !t.isDeleted));
    } catch (e) {
      handleError(e, "errors.schedule.loadTasksFailed");
    }
  }, [ds, handleError]);

  // Load month items for dot indicators
  const loadMonthItems = useCallback(
    async (date: string) => {
      try {
        const d = new Date(date + "T00:00:00");
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const result = await ds.fetchScheduleItemsByDateRange(
          formatDateStr(firstDay),
          formatDateStr(lastDay),
        );
        setMonthItems(result);
      } catch (e) {
        handleError(e, "errors.schedule.loadMonthFailed");
      }
    },
    [ds, handleError],
  );

  // Date-scoped fetches: re-run when the user selects a different date.
  useEffect(() => {
    loadDayItems(selectedDate);
    loadMonthItems(selectedDate);
  }, [selectedDate, loadDayItems, loadMonthItems]);

  // Full task list is expensive. Reload only on mount and when sync pulls
  // new data — not on every date change.
  useEffect(() => {
    loadTasks();
  }, [loadTasks, syncVersion]);

  // After a sync pull, refresh the currently-visible date's schedule items.
  useEffect(() => {
    if (syncVersion === 0) return;
    loadDayItems(selectedDate);
    loadMonthItems(selectedDate);
    // selectedDate intentionally omitted — this effect handles the post-sync refresh;
    // date-change refresh is handled by the first effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncVersion, loadDayItems, loadMonthItems]);

  // Aggregate counts for calendar dots
  const itemCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of monthItems) {
      map.set(item.date, (map.get(item.date) ?? 0) + 1);
    }
    return map;
  }, [monthItems]);

  const taskCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.scheduledAt) {
        const dateStr = task.scheduledAt.split("T")[0];
        map.set(dateStr, (map.get(dateStr) ?? 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  // Tasks scheduled for the selected date
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.scheduledAt?.startsWith(selectedDate)),
    [tasks, selectedDate],
  );

  // Handlers
  const handleToggleSchedule = useCallback(
    async (id: string) => {
      try {
        await ds.toggleScheduleItemComplete(id);
        await loadDayItems(selectedDate);
        await loadMonthItems(selectedDate);
      } catch (e) {
        handleError(e, "errors.schedule.toggleFailed");
      }
    },
    [ds, selectedDate, loadDayItems, loadMonthItems, handleError],
  );

  const handleToggleTask = useCallback(
    async (task: TaskNode) => {
      const statusCycle: Record<string, string> = {
        NOT_STARTED: "IN_PROGRESS",
        IN_PROGRESS: "DONE",
        DONE: "NOT_STARTED",
      };
      const currentStatus = task.status ?? "NOT_STARTED";
      const newStatus = (statusCycle[currentStatus] ??
        "NOT_STARTED") as TaskNode["status"];
      try {
        await ds.updateTask(task.id, {
          status: newStatus,
          completedAt:
            newStatus === "DONE" ? new Date().toISOString() : undefined,
        });
        await loadTasks();
      } catch (e) {
        handleError(e, "errors.schedule.toggleTaskFailed");
      }
    },
    [ds, loadTasks, handleError],
  );

  const handleSave = useCallback(
    async (data: ScheduleItemFormData) => {
      try {
        if (editingItem) {
          await ds.updateScheduleItem(editingItem.id, {
            title: data.title,
            startTime: data.startTime,
            endTime: data.endTime,
            memo: data.memo || null,
            isAllDay: data.isAllDay,
          });
        } else {
          await ds.createScheduleItem(
            generateId(),
            data.date,
            data.title,
            data.isAllDay ? "00:00" : data.startTime,
            data.isAllDay ? "23:59" : data.endTime,
            undefined,
            undefined,
            undefined,
            data.isAllDay,
          );
        }
        setFormOpen(false);
        setEditingItem(null);
        await loadDayItems(selectedDate);
        await loadMonthItems(selectedDate);
      } catch (e) {
        handleError(e, "errors.schedule.saveFailed");
      }
    },
    [ds, editingItem, selectedDate, loadDayItems, loadMonthItems, handleError],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await ds.softDeleteScheduleItem(id);
        setFormOpen(false);
        setEditingItem(null);
        await loadDayItems(selectedDate);
        await loadMonthItems(selectedDate);
      } catch (e) {
        handleError(e, "errors.schedule.deleteFailed");
      }
    },
    [ds, selectedDate, loadDayItems, loadMonthItems, handleError],
  );

  const formattedDate = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [selectedDate]);

  const allDayItems = scheduleItems.filter((i) => i.isAllDay);
  const timedItems = scheduleItems.filter((i) => !i.isAllDay);
  const totalDayItems = scheduleItems.length + dayTasks.length;

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tab: Monthly / DayFlow */}
      <div className="flex shrink-0 border-b border-notion-border">
        <button
          onClick={() => setSubTab("monthly")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
            subTab === "monthly"
              ? "border-b-2 border-notion-accent text-notion-accent"
              : "text-notion-text-secondary"
          }`}
        >
          <CalendarDays size={14} />
          {t("mobile.calendar.monthly", "Monthly")}
        </button>
        <button
          onClick={() => setSubTab("dayflow")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
            subTab === "dayflow"
              ? "border-b-2 border-notion-accent text-notion-accent"
              : "text-notion-text-secondary"
          }`}
        >
          <List size={14} />
          {t("mobile.calendar.dayflow", "Day Flow")}
        </button>
      </div>

      {/* Calendar header (Monthly shows full calendar, DayFlow shows strip) */}
      {subTab === "monthly" ? (
        <MobileMonthlyCalendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          itemCountByDate={itemCountByDate}
          taskCountByDate={taskCountByDate}
        />
      ) : (
        <MobileCalendarStrip
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          itemCountByDate={itemCountByDate}
        />
      )}

      {/* Day header */}
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-2">
        <span className="text-sm font-medium text-notion-text">
          {formattedDate}
        </span>
        <span className="text-xs text-notion-text-secondary">
          {totalDayItems > 0
            ? t("mobile.calendar.itemCount", "{{count}} items", {
                count: totalDayItems,
              })
            : ""}
        </span>
      </div>

      {/* Day content list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </div>
        ) : totalDayItems === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12">
            <Clock size={32} className="text-notion-text-secondary/40" />
            <p className="text-sm text-notion-text-secondary">
              {t("mobile.calendar.empty", "No items for this day")}
            </p>
            <button
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
              className="mt-2 rounded-lg bg-notion-accent px-4 py-2 text-sm font-medium text-white active:opacity-80"
            >
              {t("mobile.schedule.addFirst", "Add item")}
            </button>
          </div>
        ) : (
          <div>
            {/* Scheduled tasks */}
            {dayTasks.length > 0 && (
              <div className="border-b border-notion-border/50 pb-1">
                <div className="px-4 pt-2 pb-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-notion-text-secondary">
                    {t("mobile.calendar.tasks", "Tasks")}
                  </span>
                </div>
                {dayTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggleTask}
                  />
                ))}
              </div>
            )}

            {/* All-day schedule items */}
            {allDayItems.length > 0 && (
              <div className="border-b border-notion-border/50 px-4 py-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-notion-text-secondary">
                  {t("mobile.schedule.allDay", "All day")}
                </span>
                {allDayItems.map((item) => (
                  <SwipeableItem
                    key={item.id}
                    onDelete={() => handleDelete(item.id)}
                  >
                    <ScheduleItemRow
                      item={item}
                      onToggle={handleToggleSchedule}
                      onEdit={(i) => {
                        setEditingItem(i);
                        setFormOpen(true);
                      }}
                      showTime={false}
                    />
                  </SwipeableItem>
                ))}
              </div>
            )}

            {/* Timed schedule items */}
            {timedItems.length > 0 && (
              <div>
                {scheduleItems.length > 0 &&
                  (allDayItems.length > 0 || dayTasks.length > 0) && (
                    <div className="px-4 pt-2 pb-1">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-notion-text-secondary">
                        {t("mobile.calendar.schedule", "Schedule")}
                      </span>
                    </div>
                  )}
                {timedItems.map((item) => (
                  <SwipeableItem
                    key={item.id}
                    onDelete={() => handleDelete(item.id)}
                  >
                    <ScheduleItemRow
                      item={item}
                      onToggle={handleToggleSchedule}
                      onEdit={(i) => {
                        setEditingItem(i);
                        setFormOpen(true);
                      }}
                      showTime
                    />
                  </SwipeableItem>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB - Create schedule item */}
      {totalDayItems > 0 && (
        <button
          onClick={() => {
            setEditingItem(null);
            setFormOpen(true);
          }}
          className="absolute right-4 bottom-20 z-30 mb-[env(safe-area-inset-bottom)] flex h-14 w-14 items-center justify-center rounded-full bg-notion-accent shadow-lg active:opacity-80"
          aria-label={t("mobile.schedule.create", "New Item")}
        >
          <Plus size={24} className="text-white" />
        </button>
      )}

      {/* Schedule item form */}
      <MobileScheduleItemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSave}
        onDelete={editingItem ? () => handleDelete(editingItem.id) : undefined}
        editingItem={editingItem}
        defaultDate={selectedDate}
      />
    </div>
  );
}

// --- Inline calendar strip for DayFlow sub-tab ---

function MobileCalendarStrip({
  selectedDate,
  onDateSelect,
  itemCountByDate,
}: {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  itemCountByDate: Map<string, number>;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dayLabels =
    lang === "ja"
      ? ["月", "火", "水", "木", "金", "土", "日"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const todayString = useMemo(() => formatDateStr(new Date()), []);
  const selectedDateObj = useMemo(
    () => new Date(selectedDate + "T00:00:00"),
    [selectedDate],
  );

  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const [weekMonday, setWeekMonday] = useState<Date>(() =>
    getMonday(selectedDateObj),
  );

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i)),
    [weekMonday],
  );

  const navigateWeek = useCallback((direction: -1 | 1) => {
    setWeekMonday((prev) => addDays(prev, direction * 7));
  }, []);

  return (
    <div className="border-b border-notion-border bg-notion-bg px-2 pb-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <button
          onClick={() => navigateWeek(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full active:bg-notion-hover"
        >
          <ChevronLeft size={16} className="text-notion-text-secondary" />
        </button>
        <button
          onClick={() => {
            const now = new Date();
            setWeekMonday(getMonday(now));
            onDateSelect(formatDateStr(now));
          }}
          className="text-xs font-medium text-notion-text-secondary active:opacity-60"
        >
          {t("mobile.calendar.today", "Today")}
        </button>
        <button
          onClick={() => navigateWeek(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full active:bg-notion-hover"
        >
          <ChevronRight size={16} className="text-notion-text-secondary" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {weekDates.map((date, i) => {
          const dateStr = formatDateStr(date);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayString;
          const count = itemCountByDate.get(dateStr) ?? 0;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <span
                className={`text-[10px] ${
                  i >= 5
                    ? "text-notion-text-secondary/60"
                    : "text-notion-text-secondary"
                }`}
              >
                {dayLabels[i]}
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${
                  isSelected
                    ? "bg-notion-accent text-white"
                    : isToday
                      ? "border border-notion-accent text-notion-accent"
                      : "text-notion-text"
                }`}
              >
                {date.getDate()}
              </div>
              <div className="flex h-1 items-center">
                {count > 0 && (
                  <span
                    className={`h-1 w-1 rounded-full ${
                      isSelected ? "bg-white/60" : "bg-notion-accent"
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
