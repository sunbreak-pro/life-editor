import { useState, useCallback, useMemo, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import type { TabItem } from "../shared/SectionTabs";
import { VerticalNavList } from "../shared/VerticalNavList";
import { CalendarView } from "./Schedule/Calendar/CalendarView";
import { OneDaySchedule } from "./Schedule/DayFlow/OneDaySchedule";
import type { DayFlowFilterTab } from "./Schedule/DayFlow/OneDaySchedule";
import { DayFlowSidebarContent } from "./Schedule/DayFlow/DayFlowSidebarContent";
import type { CategoryProgress } from "./Schedule/DayFlow/DayFlowSidebarContent";
import { CalendarSidebarContent } from "./Schedule/Calendar/CalendarSidebarContent";
import { ScheduleSidebarContent } from "../Schedule/ScheduleSidebarContent";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendar } from "../../hooks/useCalendar";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { formatDateKey } from "../../utils/dateKey";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type ScheduleSubTab = "calendar" | "dayflow";

const SCHEDULE_TABS: readonly TabItem<ScheduleSubTab>[] = [
  { id: "calendar", labelKey: "tabs.calendar" },
  { id: "dayflow", labelKey: "tabs.dayflow" },
];

interface ScheduleTabViewProps {
  onCalendarSelectTask: (taskId: string, e: React.MouseEvent) => void;
  onCreateTask?: (
    title: string,
    parentId: string | null,
    schedule: {
      scheduledAt: string;
      scheduledEndAt?: string;
      isAllDay?: boolean;
    },
  ) => void;
  onStartTimer?: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
}

export function ScheduleTabView({
  onCalendarSelectTask,
  onCreateTask,
  onStartTimer,
  onSelectTask,
}: ScheduleTabViewProps) {
  const [subTab, setSubTab] = useState<ScheduleSubTab>("calendar");
  const [dayFlowDate, setDayFlowDate] = useState<Date>(() => new Date());
  const [dayFlowFilterTab, setDayFlowFilterTab] =
    useState<DayFlowFilterTab>("all");

  // Calendar filter state
  const [calendarFilter, setCalendarFilter] = useState<
    "incomplete" | "completed"
  >("incomplete");
  const [calendarFilterFolderId, setCalendarFilterFolderId] = useState<
    string | null
  >(null);

  const { nodes, getTaskColor, getFolderTagForTask } = useTaskTreeContext();

  const { tasksByDate } = useCalendar(
    nodes,
    dayFlowDate.getFullYear(),
    dayFlowDate.getMonth(),
    "incomplete",
    dayFlowDate,
  );

  const allTasksByDate = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    for (const task of nodes) {
      if (task.type !== "task" || !task.scheduledAt || task.isDeleted) continue;
      const key = formatDateKey(new Date(task.scheduledAt));
      const existing = map.get(key);
      if (existing) existing.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [nodes]);

  const goToPrev = useCallback(() => {
    setDayFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goToNext = useCallback(() => {
    setDayFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    setDayFlowDate(new Date());
  }, []);

  const {
    routines,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    tagAssignments,
    setTagsForRoutine,
    getRoutineCompletionRate,
    routineStats,
    scheduleItems,
    routineTags,
    createRoutineTag,
    updateRoutineTag,
    deleteRoutineTag,
    toggleComplete,
  } = useScheduleContext();

  const { portalTarget: rightSidebarTarget, requestOpen } =
    useContext(RightSidebarContext);

  useEffect(() => {
    requestOpen();
  }, [requestOpen]);

  // Category progress calculation
  const dateKey = formatDateKey(dayFlowDate);
  const categoryProgress = useMemo((): Record<
    DayFlowFilterTab,
    CategoryProgress
  > => {
    const routineItems = scheduleItems.filter((i) => i.routineId !== null);
    const otherItems = scheduleItems.filter((i) => i.routineId === null);
    const dayTasks = tasksByDate.get(dateKey) ?? [];
    const allDayTasks = allTasksByDate.get(dateKey) ?? [];
    const taskItems = [...dayTasks, ...allDayTasks];
    const completedTasks = taskItems.filter((t) => t.status === "DONE").length;

    const routineCompleted = routineItems.filter((i) => i.completed).length;
    const otherCompleted = otherItems.filter((i) => i.completed).length;

    const allTotal = routineItems.length + otherItems.length + taskItems.length;
    const allCompleted = routineCompleted + otherCompleted + completedTasks;

    return {
      all: { completed: allCompleted, total: allTotal },
      tasks: { completed: completedTasks, total: taskItems.length },
      routine: { completed: routineCompleted, total: routineItems.length },
      others: { completed: otherCompleted, total: otherItems.length },
    };
  }, [scheduleItems, tasksByDate, allTasksByDate, dateKey]);

  return (
    <div className="h-full flex flex-col">
      {rightSidebarTarget &&
        createPortal(
          <ScheduleSidebarContent routineStats={routineStats}>
            <VerticalNavList
              items={SCHEDULE_TABS}
              activeItem={subTab}
              onItemChange={setSubTab}
            />
            {subTab === "dayflow" && (
              <DayFlowSidebarContent
                activeFilter={dayFlowFilterTab}
                onFilterChange={setDayFlowFilterTab}
                categoryProgress={categoryProgress}
                routines={routines}
                routineTags={routineTags}
                tagAssignments={tagAssignments}
                onCreateRoutine={createRoutine}
                onUpdateRoutine={updateRoutine}
                onDeleteRoutine={deleteRoutine}
                setTagsForRoutine={setTagsForRoutine}
                getCompletionRate={getRoutineCompletionRate}
                onCreateRoutineTag={createRoutineTag}
                onUpdateRoutineTag={updateRoutineTag}
                onDeleteRoutineTag={deleteRoutineTag}
                scheduleItems={scheduleItems}
                onToggleComplete={toggleComplete}
              />
            )}
            {subTab === "calendar" && (
              <CalendarSidebarContent
                filter={calendarFilter}
                onFilterChange={setCalendarFilter}
                filterFolderId={calendarFilterFolderId}
                onFilterFolderChange={setCalendarFilterFolderId}
                routines={routines}
                scheduleItems={scheduleItems}
                tagAssignments={tagAssignments}
                onToggleComplete={toggleComplete}
              />
            )}
          </ScheduleSidebarContent>,
          rightSidebarTarget,
        )}
      <div className="flex-1 min-h-0 overflow-auto">
        {subTab === "calendar" ? (
          <CalendarView
            onSelectTask={onSelectTask}
            onCreateTask={onCreateTask}
            onStartTimer={onStartTimer}
            filter={calendarFilter}
            filterFolderId={calendarFilterFolderId}
          />
        ) : (
          <OneDaySchedule
            date={dayFlowDate}
            tasksByDate={tasksByDate}
            allTasksByDate={allTasksByDate}
            onSelectTask={onCalendarSelectTask}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            onPrevDate={goToPrev}
            onNextDate={goToNext}
            onToday={goToToday}
            filterTab={dayFlowFilterTab}
            onFilterTabChange={setDayFlowFilterTab}
          />
        )}
      </div>
    </div>
  );
}
