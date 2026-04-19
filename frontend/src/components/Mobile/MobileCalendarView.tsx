import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Search,
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
import { MobileCalendarStrip } from "./MobileCalendarStrip";
import {
  buildDayItems,
  buildMonthItemMap,
  type DayItem,
} from "./schedule/dayItem";
import { MobileEventChip } from "./schedule/MobileEventChip";
import { MobileDaySheet } from "./schedule/MobileDaySheet";
import { MobileDayflowGrid } from "./schedule/MobileDayflowGrid";

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

const MAX_CHIPS_PER_CELL = 3;

// --- Monthly calendar (inline chips per cell + design-accurate grid) ---

interface MobileMonthlyCalendarProps {
  selectedDate: string;
  onDateSelect: (dateStr: string) => void;
  itemsByDate: Map<string, DayItem[]>;
}

function MobileMonthlyCalendar({
  selectedDate,
  onDateSelect,
  itemsByDate,
}: MobileMonthlyCalendarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const dayLabels =
    lang === "ja"
      ? ["月", "火", "水", "木", "金", "土", "日"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Keep month in sync when user picks a date outside current month.
  // React permits setState during render when adjusting state to props —
  // the next render will converge (no loop).
  const selectedObj = new Date(selectedDate + "T00:00:00");
  if (
    selectedObj.getFullYear() !== viewDate.year ||
    selectedObj.getMonth() !== viewDate.month
  ) {
    setViewDate({
      year: selectedObj.getFullYear(),
      month: selectedObj.getMonth(),
    });
  }

  const todayString = useMemo(() => formatDateStr(new Date()), []);

  const monthLabel = useMemo(() => {
    if (lang === "ja") return `${viewDate.year}年${viewDate.month + 1}月`;
    const d = new Date(viewDate.year, viewDate.month, 1);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }, [viewDate, lang]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const lastDay = new Date(viewDate.year, viewDate.month + 1, 0);

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = startDow - 1; i >= 0; i--) {
      days.push({ date: addDays(firstDay, -i - 1), inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        date: new Date(viewDate.year, viewDate.month, d),
        inMonth: true,
      });
    }
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

  const goToToday = useCallback(() => {
    const now = new Date();
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
    onDateSelect(formatDateStr(now));
  }, [onDateSelect]);

  return (
    <div className="flex flex-col border-b border-notion-border bg-notion-bg">
      {/* Month header */}
      <div className="flex items-center justify-between px-3.5 pb-2 pt-2.5">
        <div className="text-[22px] font-bold tracking-tight text-notion-text">
          {monthLabel}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            aria-label={t("mobile.calendar.search", "Search")}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg active:bg-notion-hover"
          >
            <Search size={18} className="text-notion-text-secondary" />
          </button>
          <button
            onClick={goToToday}
            aria-label={t("mobile.calendar.today", "Today")}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg active:bg-notion-hover"
          >
            <CalendarDays size={18} className="text-notion-text-secondary" />
          </button>
          <button
            onClick={() => navigateMonth(-1)}
            aria-label="Previous month"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg active:bg-notion-hover"
          >
            <ChevronLeft size={18} className="text-notion-text-secondary" />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            aria-label="Next month"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg active:bg-notion-hover"
          >
            <ChevronRight size={18} className="text-notion-text-secondary" />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 border-y border-notion-border bg-notion-bg-secondary">
        {dayLabels.map((l, i) => (
          <div
            key={l}
            className={`border-r border-notion-border py-1.5 text-center text-[11px] font-semibold last:border-r-0 ${
              i === 6
                ? "text-red-500"
                : i === 5
                  ? "text-red-400"
                  : "text-notion-text-secondary"
            }`}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 border-l border-notion-border">
        {calendarDays.map(({ date, inMonth }) => {
          const dateStr = formatDateStr(date);
          const items = itemsByDate.get(dateStr) ?? [];
          return (
            <DayCell
              key={dateStr}
              date={date}
              inMonth={inMonth}
              isToday={dateStr === todayString}
              isSelected={dateStr === selectedDate}
              items={items}
              onTap={() => onDateSelect(dateStr)}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Day cell ---

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: DayItem[];
  onTap: () => void;
}

function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  items,
  onTap,
}: DayCellProps) {
  const { t } = useTranslation();
  const day = date.getDate();
  const dow = date.getDay();
  const isSun = dow === 0;
  const isSat = dow === 6;

  const visible = items.slice(0, MAX_CHIPS_PER_CELL);
  const more = Math.max(0, items.length - MAX_CHIPS_PER_CELL);

  const monthLabel =
    day === 1 ? date.toLocaleDateString("en-US", { month: "short" }) : null;

  const numColor = !inMonth
    ? "text-notion-text-secondary/60"
    : isSun
      ? "text-red-500"
      : isSat
        ? "text-red-400"
        : "text-notion-text";

  return (
    <button
      onClick={onTap}
      className={`relative flex min-h-[78px] w-full min-w-0 max-w-full flex-col overflow-hidden border-b border-r border-notion-border px-[3px] pb-[3px] pt-1 text-left ${
        isSelected
          ? "bg-notion-accent/10"
          : inMonth
            ? "bg-notion-bg"
            : "bg-notion-bg-secondary/60"
      } ${inMonth ? "" : "opacity-85"}`}
      style={{ boxSizing: "border-box" }}
    >
      {isSelected && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: "inset 0 0 0 1.5px var(--color-notion-accent)" }}
        />
      )}
      {/* Date row */}
      <div className="flex items-center justify-between px-0.5 pb-0.5">
        {monthLabel ? (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-notion-text-secondary">
            {monthLabel}
          </span>
        ) : (
          <span />
        )}
        {isToday ? (
          <div
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-notion-accent text-[11px] font-semibold text-white"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {day}
          </div>
        ) : (
          <span
            className={`px-0.5 text-[11.5px] tabular-nums ${numColor} ${
              isSelected ? "font-bold" : "font-medium"
            }`}
          >
            {day}
          </span>
        )}
      </div>

      {/* Chips */}
      <div className="flex min-w-0 flex-col gap-[1.5px] overflow-hidden px-px">
        {visible.map((item) => (
          <MobileEventChip key={item.id} item={item} dimmed={!inMonth} />
        ))}
        {more > 0 && (
          <div className="mt-px pl-[5px] text-[9px] font-medium text-notion-text-secondary">
            {t("mobile.calendar.moreCount", "+{{count}}", { count: more })}
          </div>
        )}
      </div>
    </button>
  );
}

// --- Dayflow header ---

interface MobileDayflowHeaderProps {
  selectedDate: string;
  onDateSelect: (dateStr: string) => void;
}

function MobileDayflowHeader({
  selectedDate,
  onDateSelect,
}: MobileDayflowHeaderProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const d = new Date(selectedDate + "T00:00:00");
  const todayString = useMemo(() => formatDateStr(new Date()), []);
  const isToday = selectedDate === todayString;
  const dayLabels =
    lang === "ja"
      ? ["日", "月", "火", "水", "木", "金", "土"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = d.getDay();
  const dowColor =
    dow === 0
      ? "text-red-500"
      : dow === 6
        ? "text-red-400"
        : "text-notion-text";

  const navDay = (delta: number) => {
    onDateSelect(formatDateStr(addDays(d, delta)));
  };

  const title =
    lang === "ja"
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="flex items-center justify-between bg-notion-bg-secondary px-3.5 pb-2 pt-2.5">
      <div className="flex items-baseline gap-2.5">
        <div
          className={`text-[22px] font-bold tracking-tight ${
            isToday ? "text-notion-accent" : "text-notion-text"
          }`}
        >
          {title}
        </div>
        <div className={`text-[13px] font-semibold ${dowColor}`}>
          {dayLabels[dow]}
        </div>
        {isToday && (
          <span className="rounded-[10px] bg-notion-accent px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            {t("mobile.schedule.dayflow.todayBadge", "TODAY")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => navDay(-1)}
          aria-label="Previous day"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg active:bg-notion-hover"
        >
          <ChevronLeft size={16} className="text-notion-text-secondary" />
        </button>
        <button
          onClick={() => onDateSelect(formatDateStr(new Date()))}
          className="flex h-[30px] items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-notion-accent active:bg-notion-hover"
        >
          {t("mobile.schedule.dayflow.today", "Today")}
        </button>
        <button
          onClick={() => navDay(1)}
          aria-label="Next day"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg active:bg-notion-hover"
        >
          <ChevronRight size={16} className="text-notion-text-secondary" />
        </button>
      </div>
    </div>
  );
}

// --- Sub-tabs (Calendar / Dayflow) ---

type CalendarSubTab = "monthly" | "dayflow";

function ScheduleSubTabs({
  active,
  onChange,
}: {
  active: CalendarSubTab;
  onChange: (tab: CalendarSubTab) => void;
}) {
  const { t } = useTranslation();
  const tabs: Array<{
    id: CalendarSubTab;
    label: string;
    Icon: typeof CalendarDays;
  }> = [
    {
      id: "monthly",
      label: t("mobile.schedule.subTab.calendar", "Calendar"),
      Icon: CalendarDays,
    },
    {
      id: "dayflow",
      label: t("mobile.schedule.subTab.dayflow", "Day Flow"),
      Icon: List,
    },
  ];
  return (
    <div className="flex shrink-0 border-b border-notion-border bg-notion-bg">
      {tabs.map(({ id, label, Icon }) => {
        const on = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
              on
                ? "border-b-2 border-notion-accent text-notion-accent"
                : "text-notion-text-secondary"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// --- Main view ---

export function MobileCalendarView() {
  const { t } = useTranslation();
  const { syncVersion } = useSyncContext();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [subTab, setSubTab] = useState<CalendarSubTab>("monthly");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [monthItems, setMonthItems] = useState<ScheduleItem[]>([]);
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const { handle: handleError } = useServiceErrorHandler();
  const ds = getDataService();

  // Load month schedule items for the month containing selectedDate.
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

  const loadTasks = useCallback(async () => {
    try {
      const tree = await ds.fetchTaskTree();
      setTasks(tree.filter((t) => t.type === "task" && !t.isDeleted));
    } catch (e) {
      handleError(e, "errors.schedule.loadTasksFailed");
    }
  }, [ds, handleError]);

  useEffect(() => {
    loadMonthItems(selectedDate);
  }, [selectedDate, loadMonthItems]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, syncVersion]);

  useEffect(() => {
    if (syncVersion === 0) return;
    loadMonthItems(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncVersion, loadMonthItems]);

  // Unified items map (per-date DayItem[]) for both month cells and sheet.
  const itemsByDate = useMemo(
    () => buildMonthItemMap(monthItems, tasks),
    [monthItems, tasks],
  );

  // Strip count map (used by MobileCalendarStrip in Dayflow mode)
  const itemCountByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const [date, list] of itemsByDate) m.set(date, list.length);
    return m;
  }, [itemsByDate]);

  const dayItems = useMemo(
    () => buildDayItems(monthItems, tasks, selectedDate),
    [monthItems, tasks, selectedDate],
  );

  const todayString = useMemo(() => formatDateStr(new Date()), []);
  const isToday = selectedDate === todayString;

  // Handlers
  const handleSelectDate = useCallback(
    (ds: string) => {
      // Tapping the same day in Monthly mode toggles the sheet.
      if (ds === selectedDate && subTab === "monthly") {
        setSheetExpanded((e) => !e);
      } else {
        setSelectedDate(ds);
      }
    },
    [selectedDate, subTab],
  );

  const handleToggleScheduleComplete = useCallback(
    async (id: string) => {
      try {
        await ds.toggleScheduleItemComplete(id);
        await loadMonthItems(selectedDate);
      } catch (e) {
        handleError(e, "errors.schedule.toggleFailed");
      }
    },
    [ds, selectedDate, loadMonthItems, handleError],
  );

  const handleToggleTask = useCallback(
    async (item: DayItem) => {
      if (item.kind !== "task") return;
      const statusCycle: Record<string, TaskNode["status"]> = {
        NOT_STARTED: "IN_PROGRESS",
        IN_PROGRESS: "DONE",
        DONE: "NOT_STARTED",
      };
      const current = item.status;
      const next = statusCycle[current] ?? "NOT_STARTED";
      try {
        await ds.updateTask(item.source.id, {
          status: next,
          completedAt: next === "DONE" ? new Date().toISOString() : undefined,
        });
        await loadTasks();
      } catch (e) {
        handleError(e, "errors.schedule.toggleTaskFailed");
      }
    },
    [ds, loadTasks, handleError],
  );

  const handleEditEvent = useCallback((item: DayItem) => {
    // Only ScheduleItem-backed items are editable via the form
    if (item.kind === "routine" || item.kind === "event") {
      setEditingItem(item.source);
      setFormOpen(true);
    }
  }, []);

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
        await loadMonthItems(selectedDate);
      } catch (e) {
        handleError(e, "errors.schedule.saveFailed");
      }
    },
    [ds, editingItem, selectedDate, loadMonthItems, handleError],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await ds.softDeleteScheduleItem(id);
        setFormOpen(false);
        setEditingItem(null);
        await loadMonthItems(selectedDate);
      } catch (e) {
        handleError(e, "errors.schedule.deleteFailed");
      }
    },
    [ds, selectedDate, loadMonthItems, handleError],
  );

  const openAddForm = useCallback(() => {
    setEditingItem(null);
    setFormOpen(true);
  }, []);

  // FAB positioning — in Monthly mode it sits above the collapsed/expanded sheet.
  const fabBottomClass =
    subTab === "monthly"
      ? sheetExpanded
        ? "bottom-[calc(80dvh+12px)]"
        : "bottom-[calc(38dvh+12px)]"
      : "bottom-4";

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <ScheduleSubTabs active={subTab} onChange={setSubTab} />

      {subTab === "monthly" ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <MobileMonthlyCalendar
              selectedDate={selectedDate}
              onDateSelect={handleSelectDate}
              itemsByDate={itemsByDate}
            />
          </div>
          <MobileDaySheet
            dateStr={selectedDate}
            items={dayItems}
            expanded={sheetExpanded}
            isToday={isToday}
            onToggle={() => setSheetExpanded((e) => !e)}
            onExpand={() => setSheetExpanded(true)}
            onCollapse={() => setSheetExpanded(false)}
            onEditEvent={handleEditEvent}
            onToggleScheduleComplete={handleToggleScheduleComplete}
            onToggleTask={handleToggleTask}
            onAddItem={openAddForm}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MobileDayflowHeader
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
          <MobileCalendarStrip
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            itemCountByDate={itemCountByDate}
          />
          <MobileDayflowGrid
            dateStr={selectedDate}
            items={dayItems}
            onEditEvent={handleEditEvent}
          />
        </div>
      )}

      {/* FAB */}
      <button
        onClick={openAddForm}
        className={`absolute right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-notion-accent shadow-lg transition-[bottom] duration-300 ease-out active:opacity-80 ${fabBottomClass}`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label={t("mobile.schedule.create", "New Item")}
      >
        <Plus size={24} className="text-white" />
      </button>

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
