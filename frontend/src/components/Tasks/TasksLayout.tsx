import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../types/taskTree";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { LAYOUT } from "../../constants/layout";
import { TaskTreeView } from "./TaskTreeView";
import { ScheduleTabView } from "./ScheduleTabView";
import { RoutinesTab } from "./Schedule/Routine/RoutinesTab";
import { useScheduleContext } from "../../hooks/useScheduleContext";

type TopTab = "tasks" | "schedule" | "routine";

const TOP_TABS: readonly TabItem<TopTab>[] = [
  { id: "tasks", labelKey: "tabs.taskTree" },
  { id: "schedule", labelKey: "tabs.schedule" },
  { id: "routine", labelKey: "tabs.routine" },
];

interface TasksLayoutProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  filterFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
  onPlayTask?: (node: TaskNode) => void;
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
}

export function TasksLayout({
  selectedTaskId,
  onSelectTask,
  filterFolderId,
  onFilterChange,
  onPlayTask,
  onCalendarSelectTask,
  onCreateTask,
  onStartTimer,
}: TasksLayoutProps) {
  const { t } = useTranslation();
  const [topTab, setTopTab] = useState<TopTab>("tasks");
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
        title={t("tasks.title")}
        tabs={TOP_TABS}
        activeTab={topTab}
        onTabChange={setTopTab}
      />
      <div className="flex-1 min-h-0">
        {topTab === "tasks" ? (
          <TaskTreeView
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            filterFolderId={filterFolderId}
            onFilterChange={onFilterChange}
            onPlayTask={onPlayTask}
          />
        ) : topTab === "schedule" ? (
          <ScheduleTabView
            onCalendarSelectTask={onCalendarSelectTask}
            onCreateTask={onCreateTask}
            onStartTimer={onStartTimer}
            onSelectTask={onSelectTask}
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
