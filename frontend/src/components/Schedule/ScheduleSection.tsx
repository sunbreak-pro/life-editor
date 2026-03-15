import { useState, useCallback, useMemo, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { LAYOUT } from "../../constants/layout";
import { CalendarView } from "../Tasks/Schedule/Calendar/CalendarView";
import { OneDaySchedule } from "../Tasks/Schedule/DayFlow/OneDaySchedule";
import type { DayFlowFilterTab } from "../Tasks/Schedule/DayFlow/OneDaySchedule";
import { DayFlowSidebarContent } from "../Tasks/Schedule/DayFlow/DayFlowSidebarContent";
import type { CategoryProgress } from "../Tasks/Schedule/DayFlow/DayFlowSidebarContent";
import { ScheduleSidebarContent } from "./ScheduleSidebarContent";
import { CalendarSidebarContent } from "../Tasks/Schedule/Calendar/CalendarSidebarContent";
import type { CalendarContentFilter } from "../../types/calendarItem";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendar } from "../../hooks/useCalendar";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { formatDateKey } from "../../utils/dateKey";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type ScheduleTab = "calendar" | "dayflow";

const SCHEDULE_TABS: readonly TabItem<ScheduleTab>[] = [
  { id: "calendar", labelKey: "tabs.calendar" },
  { id: "dayflow", labelKey: "tabs.dayflow" },
];

interface ScheduleSectionProps {
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
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: (title: string) => void;
}

export function ScheduleSection({
  onCalendarSelectTask,
  onCreateTask,
  onSelectMemo,
  onSelectNote,
  onCreateNote,
}: ScheduleSectionProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ScheduleTab>("calendar");
  const [dayFlowDate, setDayFlowDate] = useState<Date>(() => new Date());
  const [dayFlowFilterTab, setDayFlowFilterTab] =
    useState<DayFlowFilterTab>("all");

  // Calendar filter state (managed here for sidebar)
  const [calendarFilter] = useState<"incomplete" | "completed">("incomplete");
  const [calendarFilterFolderId, setCalendarFilterFolderId] = useState<
    string | null
  >(null);
  const [calendarContentFilter, setCalendarContentFilter] =
    useState<CalendarContentFilter>("all");

  // Calendar progress date state
  const [calendarProgressDate, setCalendarProgressDate] = useState<Date>(
    () => new Date(),
  );
  const [calendarProgressFilter, setCalendarProgressFilter] =
    useState<DayFlowFilterTab>("all");

  const { nodes, getTaskColor, getFolderTagForTask, updateNode } =
    useTaskTreeContext();

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
    tagAssignments,
    routineStats,
    scheduleItems,
    toggleComplete,
    loadItemsForDate,
  } = useScheduleContext();

  const { portalTarget: rightSidebarTarget, requestOpen } =
    useContext(RightSidebarContext);

  // Always open right sidebar for both tabs
  useEffect(() => {
    requestOpen();
  }, [activeTab, requestOpen]);

  // DayFlow category progress calculation
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

  // Calendar progress: load items for calendarProgressDate and compute progress
  const calendarProgressDateKey = formatDateKey(calendarProgressDate);

  // Calendar progress uses its own date for tasks lookup
  const { tasksByDate: calendarTasksByDate } = useCalendar(
    nodes,
    calendarProgressDate.getFullYear(),
    calendarProgressDate.getMonth(),
    "incomplete",
    calendarProgressDate,
  );

  // Load schedule items for calendar progress date
  useEffect(() => {
    loadItemsForDate(calendarProgressDateKey);
  }, [calendarProgressDateKey, loadItemsForDate]);

  const calendarCategoryProgress = useMemo((): Record<
    DayFlowFilterTab,
    CategoryProgress
  > => {
    const routineItems = scheduleItems.filter((i) => i.routineId !== null);
    const otherItems = scheduleItems.filter((i) => i.routineId === null);
    const dayTasks = calendarTasksByDate.get(calendarProgressDateKey) ?? [];
    const allDayTasks = allTasksByDate.get(calendarProgressDateKey) ?? [];
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
  }, [
    scheduleItems,
    calendarTasksByDate,
    allTasksByDate,
    calendarProgressDateKey,
  ]);

  // Handle date selection from CalendarView
  const handleCalendarDateSelect = useCallback((date: Date) => {
    setCalendarProgressDate(date);
  }, []);

  const handleUpdateTaskTime = useCallback(
    (taskId: string, scheduledAt: string, scheduledEndAt: string) => {
      updateNode(taskId, { scheduledAt, scheduledEndAt });
    },
    [updateNode],
  );

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <SectionHeader
        title={t("sidebar.schedule")}
        tabs={SCHEDULE_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {rightSidebarTarget &&
        createPortal(
          <ScheduleSidebarContent routineStats={routineStats}>
            {activeTab === "dayflow" && (
              <DayFlowSidebarContent
                date={dayFlowDate}
                activeFilter={dayFlowFilterTab}
                onFilterChange={setDayFlowFilterTab}
                categoryProgress={categoryProgress}
                routines={routines}
                tagAssignments={tagAssignments}
                scheduleItems={scheduleItems}
                onToggleComplete={toggleComplete}
              />
            )}
            {activeTab === "calendar" && (
              <CalendarSidebarContent
                progressDate={calendarProgressDate}
                categoryProgress={calendarCategoryProgress}
                activeProgressFilter={calendarProgressFilter}
                onProgressFilterChange={(tab) => {
                  setCalendarProgressFilter(tab);
                  const mapping: Record<
                    DayFlowFilterTab,
                    CalendarContentFilter
                  > = {
                    all: "all",
                    tasks: "tasks",
                    routine: "all",
                    others: "all",
                  };
                  setCalendarContentFilter(mapping[tab]);
                }}
                routines={routines}
                scheduleItems={scheduleItems}
                tagAssignments={tagAssignments}
                onToggleComplete={toggleComplete}
              />
            )}
          </ScheduleSidebarContent>,
          rightSidebarTarget,
        )}

      <div className="flex-1 min-h-0">
        {activeTab === "calendar" ? (
          <CalendarView
            onSelectTask={(taskId) =>
              onCalendarSelectTask(taskId, {} as React.MouseEvent)
            }
            onCreateTask={onCreateTask}
            onSelectMemo={onSelectMemo}
            onSelectNote={onSelectNote}
            onCreateNote={onCreateNote}
            filter={calendarFilter}
            filterFolderId={calendarFilterFolderId}
            onFilterFolderChange={setCalendarFilterFolderId}
            contentFilter={calendarContentFilter}
            onDateSelect={handleCalendarDateSelect}
          />
        ) : (
          <OneDaySchedule
            date={dayFlowDate}
            tasksByDate={tasksByDate}
            allTasksByDate={allTasksByDate}
            onSelectTask={onCalendarSelectTask}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            onUpdateTaskTime={handleUpdateTaskTime}
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
