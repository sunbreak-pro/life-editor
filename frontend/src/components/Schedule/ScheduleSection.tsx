import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { LAYOUT } from "../../constants/layout";
import { CalendarView } from "../Tasks/Schedule/Calendar/CalendarView";
import { OneDaySchedule } from "../Tasks/Schedule/DayFlow/OneDaySchedule";
import { RoutinesTab } from "../Tasks/Schedule/Routine/RoutinesTab";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendar } from "../../hooks/useCalendar";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { formatDateKey } from "../../utils/dateKey";

type ScheduleTab = "calendar" | "dayflow" | "routine";

const SCHEDULE_TABS: readonly TabItem<ScheduleTab>[] = [
  { id: "calendar", labelKey: "tabs.calendar" },
  { id: "dayflow", labelKey: "tabs.dayflow" },
  { id: "routine", labelKey: "tabs.routine" },
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
  onStartTimer?: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
}

export function ScheduleSection({
  onCalendarSelectTask,
  onCreateTask,
  onStartTimer,
  onSelectTask,
}: ScheduleSectionProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ScheduleTab>("calendar");
  const [dayFlowDate, setDayFlowDate] = useState<Date>(() => new Date());

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
    toggleComplete,
    routineTags,
    createRoutineTag,
    updateRoutineTag,
    deleteRoutineTag,
    refreshRoutineStats,
  } = useScheduleContext();

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
      <div className="flex-1 min-h-0">
        {activeTab === "calendar" ? (
          <CalendarView
            onSelectTask={onSelectTask}
            onCreateTask={onCreateTask}
            onStartTimer={onStartTimer}
          />
        ) : activeTab === "dayflow" ? (
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
          />
        ) : (
          <RoutinesTab
            routines={routines}
            routineTags={routineTags}
            tagAssignments={tagAssignments}
            onCreateRoutine={createRoutine}
            onUpdateRoutine={updateRoutine}
            onDeleteRoutine={deleteRoutine}
            setTagsForRoutine={setTagsForRoutine}
            getCompletionRate={getRoutineCompletionRate}
            routineStats={routineStats}
            scheduleItems={scheduleItems}
            onToggleComplete={toggleComplete}
            onCreateRoutineTag={createRoutineTag}
            onUpdateRoutineTag={updateRoutineTag}
            onDeleteRoutineTag={deleteRoutineTag}
            refreshRoutineStats={refreshRoutineStats}
          />
        )}
      </div>
    </div>
  );
}
