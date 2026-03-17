import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { formatDateKey, formatDayFlowDate } from "../../../../utils/dateKey";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { TimeGridClickPanel } from "./TimeGridClickPanel";
import type { TabItem } from "../../../shared/SectionTabs";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { getTextColorForBg } from "../../../../constants/folderColors";
import { TIME_GRID } from "../../../../constants/timeGrid";

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
  getTaskColor?: (taskId: string) => string | undefined;
  getFolderTag?: (taskId: string) => string;
  onUpdateTaskTime?: (
    taskId: string,
    scheduledAt: string,
    scheduledEndAt: string,
  ) => void;
  onPrevDate: () => void;
  onNextDate: () => void;
  onToday: () => void;
  filterTab: DayFlowFilterTab;
  onFilterTabChange: (tab: DayFlowFilterTab) => void;
  onToggleTaskStatus?: (taskId: string) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onNavigateTask?: (taskId: string, e: React.MouseEvent) => void;
  onUpdateTaskTimeMemo?: (taskId: string, memo: string | null) => void;
}

export function OneDaySchedule({
  date,
  tasksByDate,
  allTasksByDate,
  getTaskColor,
  getFolderTag,
  onUpdateTaskTime,
  onPrevDate,
  onNextDate,
  onToday,
  filterTab,
  onFilterTabChange,
  onToggleTaskStatus,
  onUnscheduleTask,
  onNavigateTask,
  onUpdateTaskTimeMemo,
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
    updateScheduleItem,
    deleteScheduleItem,
    refreshRoutineStats,
  } = useScheduleContext();
  const dateKey = formatDateKey(date);
  const isToday = dateKey === formatDateKey(new Date());
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<number[]>(
    [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(
    filterDropdownRef,
    () => setShowFilterDropdown(false),
    showFilterDropdown,
  );

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

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(
        0,
        (now.getHours() - 1) * TIME_GRID.SLOT_HEIGHT,
      );
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

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
    if (selectedFilterTagIds.length > 0) {
      items = items.filter((i) => {
        if (!i.routineId) return false;
        const rTagIds = routineTagMap.get(i.routineId) ?? [];
        return selectedFilterTagIds.some((id) => rTagIds.includes(id));
      });
    }
    return items;
  }, [scheduleItems, filterTab, selectedFilterTagIds, routineTagMap]);

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

  const handleUpdateMemo = (id: string, memo: string | null) => {
    updateScheduleItem(id, { memo });
  };

  const handleUpdateScheduleItemTime = (
    id: string,
    startTime: string,
    endTime: string,
  ) => {
    updateScheduleItem(id, { startTime, endTime });
  };

  const handleUpdateTaskTime = (
    taskId: string,
    startTime: string,
    endTime: string,
  ) => {
    // Convert HH:MM to ISO date time strings for the current date
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startDate = new Date(date);
    startDate.setHours(sh, sm, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(eh, em, 0, 0);
    onUpdateTaskTime?.(taskId, startDate.toISOString(), endDate.toISOString());
  };

  const totalHeight =
    (TIME_GRID.END_HOUR - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;

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
        <div className="relative ml-auto" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown((v) => !v)}
            className={`p-1.5 rounded-md transition-colors ${
              filterTab !== "all"
                ? "text-notion-accent bg-notion-accent/10"
                : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
            }`}
          >
            <Filter size={14} />
          </button>
          {showFilterDropdown && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-notion-bg border border-notion-border rounded-lg shadow-xl py-1">
              {DAY_FLOW_FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onFilterTabChange(tab.id);
                    if (tab.id !== "all" && tab.id !== "routine") {
                      setSelectedFilterTagIds([]);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                    filterTab === tab.id
                      ? "text-notion-accent bg-notion-accent/5"
                      : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      filterTab === tab.id
                        ? "bg-notion-accent"
                        : "bg-transparent"
                    }`}
                  />
                  {t(tab.labelKey)}
                </button>
              ))}
              {(filterTab === "all" || filterTab === "routine") &&
                routineTags.length > 0 && (
                  <>
                    <div className="border-t border-notion-border my-1" />
                    <div className="flex items-center gap-1 flex-wrap px-3 py-1.5">
                      <button
                        onClick={() => setSelectedFilterTagIds([])}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                          selectedFilterTagIds.length === 0
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
                            setSelectedFilterTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id],
                            )
                          }
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                            selectedFilterTagIds.includes(tag.id)
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
                  </>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Main content - TimeGrid + MemoColumn in shared scroll container */}
      <div className="flex-1 min-h-0 p-3">
        <div className="border border-notion-border rounded-lg overflow-hidden bg-notion-bg h-full">
          <div ref={scrollRef} className="overflow-y-auto h-full">
            <ScheduleTimeGrid
              date={date}
              scheduleItems={filteredScheduleItems}
              tasks={filteredDayTasks}
              onToggleComplete={toggleComplete}
              onCreateItem={handleCreateItem}
              getTaskColor={getTaskColor}
              getFolderTag={getFolderTag}
              onUpdateMemo={handleUpdateMemo}
              onUpdateScheduleItemTime={handleUpdateScheduleItemTime}
              onUpdateTaskTime={handleUpdateTaskTime}
              externalScroll
              onToggleTaskStatus={onToggleTaskStatus}
              onDeleteScheduleItem={deleteScheduleItem}
              onUnscheduleTask={onUnscheduleTask}
              onNavigateTask={onNavigateTask}
              onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
            />
          </div>
        </div>

        {/* Create panel */}
        {createPopover && (
          <TimeGridClickPanel
            position={createPopover.position}
            defaultStartTime={createPopover.startTime}
            defaultEndTime={createPopover.endTime}
            date={date}
            existingTaskIds={existingTaskIds}
            onCreateScheduleItem={(title, startTime, endTime) => {
              createScheduleItem(dateKey, title, startTime, endTime);
            }}
            onClose={() => setCreatePopover(null)}
          />
        )}
      </div>
    </div>
  );
}
