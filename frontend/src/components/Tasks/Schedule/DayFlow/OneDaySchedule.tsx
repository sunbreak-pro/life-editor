import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { formatDateKey, formatDayFlowDate } from "../../../../utils/dateKey";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { ScheduleItemCreatePopover } from "./ScheduleItemCreatePopover";
import { DayFlowTaskPicker } from "./DayFlowTaskPicker";
import { SectionTabs } from "../../../shared/SectionTabs";
import type { TabItem } from "../../../shared/SectionTabs";
import { getTextColorForBg } from "../../../../constants/folderColors";
import {
  RoutineManagementPanel,
  type RoutineManagementProps,
} from "./RoutineManagementPanel";

export type DayFlowFilterTab = "all" | "routine" | "tasks" | "others";

export const DAY_FLOW_FILTER_TABS: readonly TabItem<DayFlowFilterTab>[] = [
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
  filterTab: DayFlowFilterTab;
  onFilterTabChange: (tab: DayFlowFilterTab) => void;
  routineManagement: RoutineManagementProps;
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
  filterTab,
  onFilterTabChange,
  routineManagement,
}: OneDayScheduleProps) {
  const { t, i18n } = useTranslation();
  const {
    scheduleItems,
    loadItemsForDate,
    createScheduleItem,
    toggleComplete,
    routines,
    routineTags,
    tagAssignments,
    ensureRoutineItemsForDate,
    refreshRoutineStats,
  } = useScheduleContext();
  const dateKey = formatDateKey(date);
  const isToday = dateKey === formatDateKey(new Date());
  const [selectedFilterTagId, setSelectedFilterTagId] = useState<number | null>(
    null,
  );
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const routineTagMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const [routineId, tagIds] of tagAssignments) {
      map.set(routineId, tagIds);
    }
    return map;
  }, [tagAssignments]);
  const [createPopover, setCreatePopover] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);

  // Load schedule items when date changes
  useEffect(() => {
    loadItemsForDate(dateKey);
  }, [dateKey, loadItemsForDate]);

  // Auto-insert routine items when date/routines/tags change
  useEffect(() => {
    if (routines.length > 0) {
      ensureRoutineItemsForDate(dateKey, routines, tagAssignments);
    }
  }, [dateKey, routines, tagAssignments, ensureRoutineItemsForDate]);

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
    let items = scheduleItems;
    switch (filterTab) {
      case "routine":
        items = items.filter((i) => i.routineId !== null);
        break;
      case "others":
        items = items.filter((i) => i.routineId === null);
        break;
      case "tasks":
        return [];
    }
    if (selectedFilterTagId != null) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const rTagIds = routineTagMap.get(i.routineId) ?? [];
        return rTagIds.includes(selectedFilterTagId);
      });
    }
    return items;
  }, [scheduleItems, filterTab, selectedFilterTagId, routineTagMap]);

  const filteredDayTasks = useMemo(() => {
    if (filterTab === "routine" || filterTab === "others") return [];
    return dayTasks;
  }, [dayTasks, filterTab]);

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

      {/* Filter tabs */}
      <SectionTabs
        tabs={DAY_FLOW_FILTER_TABS}
        activeTab={filterTab}
        onTabChange={onFilterTabChange}
        size="sm"
      />

      {/* Tag filter chips (all/routine only) */}
      {(filterTab === "all" || filterTab === "routine") &&
        routineTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap px-3 pb-1.5">
            <button
              onClick={() => setSelectedFilterTagId(null)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                selectedFilterTagId === null
                  ? "bg-notion-text text-notion-bg"
                  : "bg-notion-hover text-notion-text-secondary hover:text-notion-text"
              }`}
            >
              All
            </button>
            {routineTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() =>
                  setSelectedFilterTagId(
                    selectedFilterTagId === tag.id ? null : tag.id,
                  )
                }
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                  selectedFilterTagId === tag.id
                    ? "ring-1 ring-notion-text"
                    : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: tag.color + "E6",
                  color: getTextColorForBg(tag.color),
                  fontWeight: "bold",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        )}

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0 p-3">
        {/* Time Grid (full-width or flex-1 when routine management visible) */}
        <div
          className={
            filterTab === "routine" ? "flex-1 h-full" : "w-full h-full"
          }
        >
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

        {/* Routine management panel (routine filter only) */}
        {filterTab === "routine" && (
          <div className="w-80 h-full shrink-0">
            <RoutineManagementPanel {...routineManagement} />
          </div>
        )}

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
