import { useState, useCallback, useMemo } from "react";
import type { TabItem } from "../shared/SectionTabs";
import { SectionTabs } from "../shared/SectionTabs";
import { CalendarView } from "./Schedule/Calendar/CalendarView";
import { OneDaySchedule } from "./Schedule/DayFlow/OneDaySchedule";
import { RoutinesTab } from "./Schedule/Routine/RoutinesTab";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendar } from "../../hooks/useCalendar";
import { formatDateKey } from "../../utils/dateKey";

type ScheduleSubTab = "calendar" | "dayflow" | "routine";

const SCHEDULE_TABS: readonly TabItem<ScheduleSubTab>[] = [
  { id: "calendar", labelKey: "tabs.calendar" },
  { id: "dayflow", labelKey: "tabs.dayflow" },
  { id: "routine", labelKey: "tabs.routine" },
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
  onCreateNote?: (title: string) => void;
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
  onStartTimer?: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
}

export function ScheduleTabView({
  onCalendarSelectTask,
  onCreateTask,
  onCreateNote,
  onSelectMemo,
  onSelectNote,
  onStartTimer,
  onSelectTask,
}: ScheduleTabViewProps) {
  const [subTab, setSubTab] = useState<ScheduleSubTab>("calendar");
  const [dayFlowDate, setDayFlowDate] = useState<Date>(() => new Date());

  const { nodes, getTaskColor, getFolderTagForTask } = useTaskTreeContext();
  const {
    routines,
    templates,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addTemplateItem,
    updateTemplateItem,
    removeTemplateItem,
    getRoutineCompletionRate,
    routineStats,
    scheduleItems,
    toggleComplete,
  } = useScheduleContext();

  const { tasksByDate } = useCalendar(
    nodes,
    dayFlowDate.getFullYear(),
    dayFlowDate.getMonth(),
    "incomplete",
    dayFlowDate,
  );

  // All tasks by date (including DONE) for DayFlow right panel
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

  return (
    <div className="h-full flex flex-col">
      <SectionTabs
        tabs={SCHEDULE_TABS}
        activeTab={subTab}
        onTabChange={setSubTab}
        size="sm"
      />
      <div className="flex-1 min-h-0 overflow-auto">
        {subTab === "calendar" ? (
          <CalendarView
            onSelectTask={onSelectTask}
            onCreateTask={onCreateTask}
            onCreateNote={onCreateNote}
            onSelectMemo={onSelectMemo}
            onSelectNote={onSelectNote}
            onStartTimer={onStartTimer}
          />
        ) : subTab === "dayflow" ? (
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
            templates={templates}
            onCreateRoutine={createRoutine}
            onUpdateRoutine={updateRoutine}
            onDeleteRoutine={deleteRoutine}
            onCreateTemplate={createTemplate}
            onUpdateTemplate={updateTemplate}
            onDeleteTemplate={deleteTemplate}
            onAddTemplateItem={addTemplateItem}
            onUpdateTemplateItem={updateTemplateItem}
            onRemoveTemplateItem={removeTemplateItem}
            getCompletionRate={getRoutineCompletionRate}
            routineStats={routineStats}
            scheduleItems={scheduleItems}
            onToggleComplete={toggleComplete}
          />
        )}
      </div>
    </div>
  );
}
