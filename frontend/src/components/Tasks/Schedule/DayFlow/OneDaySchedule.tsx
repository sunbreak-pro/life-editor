import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { TaskNode } from "../../../../types/taskTree";
import type { ScheduleItem } from "../../../../types/schedule";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { formatDateKey } from "../../../../utils/dateKey";
import { CompactDateNav } from "./CompactDateNav";
import { ScheduleTimeGrid } from "./ScheduleTimeGrid";
import { TimeGridClickPanel } from "./TimeGridClickPanel";
import { RoutineDeleteConfirmDialog } from "./RoutineDeleteConfirmDialog";
import type { TabItem } from "../../../shared/SectionTabs";
import { TIME_GRID } from "../../../../constants/timeGrid";

export type DayFlowFilterTab =
  | "all"
  | "routine"
  | "tasks"
  | "others"
  | "daily"
  | "notes";

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
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, title: string) => void;
  onStartTimer?: (task: TaskNode) => void;
  isDualColumn?: boolean;
  onToggleDualColumn?: () => void;
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
  onDeleteTask,
  onUpdateTaskTitle,
  onStartTimer,
  isDualColumn,
  onToggleDualColumn,
}: OneDayScheduleProps) {
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
    dismissScheduleItem,
    refreshRoutineStats,
    updateRoutine,
  } = useScheduleContext();
  const dateKey = formatDateKey(date);
  const isToday = dateKey === formatDateKey(new Date());
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<number[]>(
    [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const [routineDeleteTarget, setRoutineDeleteTarget] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);

  const handleRequestRoutineDelete = useCallback(
    (item: ScheduleItem, e: React.MouseEvent) => {
      setRoutineDeleteTarget({
        item,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [],
  );

  const handleDismissOnly = useCallback(() => {
    if (!routineDeleteTarget) return;
    dismissScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, dismissScheduleItem]);

  const handleArchiveRoutine = useCallback(() => {
    if (!routineDeleteTarget?.item.routineId) return;
    updateRoutine(routineDeleteTarget.item.routineId, { isArchived: true });
    deleteScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, updateRoutine, deleteScheduleItem]);

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
      <CompactDateNav
        date={date}
        isToday={isToday}
        onPrevDate={onPrevDate}
        onNextDate={onNextDate}
        onToday={onToday}
        filterTab={filterTab}
        onFilterTabChange={onFilterTabChange}
        selectedFilterTagIds={selectedFilterTagIds}
        onSelectedFilterTagIdsChange={setSelectedFilterTagIds}
        routineTags={routineTags}
        isDualColumn={isDualColumn}
        onToggleDualColumn={onToggleDualColumn}
      />

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
              onRequestRoutineDelete={handleRequestRoutineDelete}
              onUnscheduleTask={onUnscheduleTask}
              onNavigateTask={onNavigateTask}
              onUpdateTaskTimeMemo={onUpdateTaskTimeMemo}
              onDeleteTask={onDeleteTask}
              onUpdateTaskTitle={onUpdateTaskTitle}
              onStartTimer={onStartTimer}
              enablePreview
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

        {/* Routine delete confirmation */}
        {routineDeleteTarget && (
          <RoutineDeleteConfirmDialog
            title={routineDeleteTarget.item.title}
            position={routineDeleteTarget.position}
            onDismissOnly={handleDismissOnly}
            onArchiveRoutine={handleArchiveRoutine}
            onCancel={() => setRoutineDeleteTarget(null)}
          />
        )}
      </div>
    </div>
  );
}
