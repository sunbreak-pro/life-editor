import { useState } from "react";
import type { TabItem } from "../shared/SectionTabs";
import { SectionTabs } from "../shared/SectionTabs";
import { CalendarView } from "../Calendar/CalendarView";
import { OneDaySchedule } from "../Schedule/OneDaySchedule";
import { RoutinesTab } from "../Schedule/RoutinesTab";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendar } from "../../hooks/useCalendar";

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
    removeTemplateItem,
    getRoutineCompletionRate,
    routineStats,
  } = useScheduleContext();

  const today = new Date();
  const { tasksByDate } = useCalendar(
    nodes,
    today.getFullYear(),
    today.getMonth(),
    "incomplete",
    today,
  );

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
            date={today}
            tasksByDate={tasksByDate}
            onSelectTask={onCalendarSelectTask}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
          />
        ) : (
          <div className="py-4">
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
              onRemoveTemplateItem={removeTemplateItem}
              getCompletionRate={getRoutineCompletionRate}
              routineStats={routineStats}
            />
          </div>
        )}
      </div>
    </div>
  );
}
