import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { formatDateKey, formatDayFlowDate } from "../../../../utils/dateKey";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { ScheduleItemCreatePopover } from "./ScheduleItemCreatePopover";
import { TodayFlowTab } from "./TodayFlowTab";
import { DayFlowTaskPicker } from "./DayFlowTaskPicker";
import { SectionTabs } from "../../../shared/SectionTabs";
import type { TabItem } from "../../../shared/SectionTabs";

type DayFlowFilterTab = "all" | "routine" | "tasks" | "others";

const DAY_FLOW_FILTER_TABS: readonly TabItem<DayFlowFilterTab>[] = [
  { id: "all", labelKey: "dayFlow.filterAll" },
  { id: "routine", labelKey: "dayFlow.filterRoutine" },
  { id: "tasks", labelKey: "dayFlow.filterTasks" },
  { id: "others", labelKey: "dayFlow.filterOthers" },
];

interface OneDayScheduleProps {
  date: Date;
  tasksByDate: Map<string, TaskNode[]>;
  allTasksByDate: Map<string, TaskNode[]>;
  onSelectTask: (taskId: string, e: React.MouseEvent) => void;
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  onPrevDate: () => void;
  onNextDate: () => void;
  onToday: () => void;
}

export function OneDaySchedule({
  date,
  tasksByDate,
  allTasksByDate,
  onSelectTask,
  getTaskColor,
  getFolderTag,
  onPrevDate,
  onNextDate,
  onToday,
}: OneDayScheduleProps) {
  const { t, i18n } = useTranslation();
  const {
    scheduleItems,
    loadItemsForDate,
    createScheduleItem,
    toggleComplete,
    routines,
    templates,
    ensureTemplateItemsForDate,
    refreshRoutineStats,
  } = useScheduleContext();
  const dateKey = formatDateKey(date);
  const isToday = dateKey === formatDateKey(new Date());
  const [filterTab, setFilterTab] = useState<DayFlowFilterTab>("all");
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [createPopover, setCreatePopover] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);

  // Load schedule items when date changes
  useEffect(() => {
    loadItemsForDate(dateKey);
  }, [dateKey, loadItemsForDate]);

  // Auto-insert template items when date/templates change
  useEffect(() => {
    if (templates.length > 0 && routines.length > 0) {
      ensureTemplateItemsForDate(dateKey, templates, routines);
    }
  }, [dateKey, templates, routines, ensureTemplateItemsForDate]);

  // Load routine stats on mount and when routines change
  useEffect(() => {
    if (routines.length > 0) {
      refreshRoutineStats(routines);
    }
  }, [routines, refreshRoutineStats]);

  const dayTasks = useMemo(
    () => tasksByDate.get(dateKey) ?? [],
    [tasksByDate, dateKey],
  );

  const allDayTasks = useMemo(
    () => allTasksByDate.get(dateKey) ?? [],
    [allTasksByDate, dateKey],
  );

  // Filtered data based on active filter tab
  const filteredScheduleItems = useMemo(() => {
    switch (filterTab) {
      case "routine":
        return scheduleItems.filter((i) => i.routineId !== null);
      case "others":
        return scheduleItems.filter((i) => i.routineId === null);
      case "tasks":
        return [];
      default:
        return scheduleItems;
    }
  }, [scheduleItems, filterTab]);

  const filteredDayTasks = useMemo(() => {
    if (filterTab === "routine" || filterTab === "others") return [];
    return dayTasks;
  }, [dayTasks, filterTab]);

  const filteredAllDayTasks = useMemo(() => {
    if (filterTab === "routine" || filterTab === "others") return [];
    return allDayTasks;
  }, [allDayTasks, filterTab]);

  // Task IDs already scheduled for this date (for task picker exclusion)
  const existingTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of dayTasks) {
      ids.add(task.id);
    }
    for (const task of allDayTasks) {
      ids.add(task.id);
    }
    return ids;
  }, [dayTasks, allDayTasks]);

  const handleCreateItem = (
    startTime: string,
    endTime: string,
    e: React.MouseEvent,
  ) => {
    setCreatePopover({
      startTime,
      endTime,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Date navigation header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notion-border">
        <button
          onClick={onPrevDate}
          className="p-1 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-notion-text min-w-20 text-center">
          {formatDayFlowDate(date, i18n.language)}
        </span>
        <button
          onClick={onNextDate}
          className="p-1 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        {!isToday && (
          <button
            onClick={onToday}
            className="ml-1 px-2 py-0.5 text-[10px] font-medium text-notion-accent border border-notion-accent/30 rounded hover:bg-notion-accent/10 transition-colors"
          >
            {t("calendarHeader.today", "Today")}
          </button>
        )}
        <div className="ml-auto relative">
          <button
            onClick={() => setShowTaskPicker(!showTaskPicker)}
            className="p-1 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
            title={t("dayFlow.addTask")}
          >
            <Plus size={16} />
          </button>
          {showTaskPicker && (
            <DayFlowTaskPicker
              date={date}
              onClose={() => setShowTaskPicker(false)}
              existingTaskIds={existingTaskIds}
            />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0 p-3">
        {/* Left: Time Grid */}
        <div className="flex-1 min-w-75 h-full">
          <ScheduleTimeGrid
            date={date}
            scheduleItems={filteredScheduleItems}
            tasks={filteredDayTasks}
            onToggleComplete={toggleComplete}
            onClickItem={() => {}}
            onClickTask={onSelectTask}
            onCreateItem={handleCreateItem}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTag}
          />
        </div>

        {/* Right: Day Flow */}
        <div className="flex-1 min-w-75 h-full border border-notion-border rounded-lg bg-notion-bg overflow-y-auto flex flex-col">
          <SectionTabs
            tabs={DAY_FLOW_FILTER_TABS}
            activeTab={filterTab}
            onTabChange={setFilterTab}
            size="sm"
          />
          <div className="flex-1 overflow-y-auto">
            <TodayFlowTab
              items={filteredScheduleItems}
              onToggleComplete={toggleComplete}
              tasks={filteredAllDayTasks}
              onSelectTask={onSelectTask}
              getTaskColor={getTaskColor}
            />
          </div>
        </div>

        {/* Create popover */}
        {createPopover && (
          <ScheduleItemCreatePopover
            position={createPopover.position}
            defaultStartTime={createPopover.startTime}
            defaultEndTime={createPopover.endTime}
            onSubmit={(title, startTime, endTime) => {
              createScheduleItem(dateKey, title, startTime, endTime);
            }}
            onClose={() => setCreatePopover(null)}
          />
        )}
      </div>
    </div>
  );
}
