import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../types/taskTree";
import type { TabItem } from "../shared/SectionTabs";
import { SectionTabs } from "../shared/SectionTabs";
import { LAYOUT } from "../../constants/layout";
import { TaskTreeView } from "./TaskTreeView";
import { ScheduleTabView } from "./ScheduleTabView";

type TopTab = "tasks" | "schedule";

const TOP_TABS: readonly TabItem<TopTab>[] = [
  { id: "tasks", labelKey: "tabs.taskTree" },
  { id: "schedule", labelKey: "tabs.schedule" },
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
  onCreateNote?: (title: string) => void;
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
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
  onCreateNote,
  onSelectMemo,
  onSelectNote,
  onStartTimer,
}: TasksLayoutProps) {
  const { t } = useTranslation();
  const [topTab, setTopTab] = useState<TopTab>("tasks");

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <h2 className={`text-2xl font-bold text-notion-text ${LAYOUT.TITLE_MB}`}>
        {t("tasks.title")}
      </h2>
      <SectionTabs tabs={TOP_TABS} activeTab={topTab} onTabChange={setTopTab} />
      <div className={`flex-1 min-h-0 ${LAYOUT.TABS_MT}`}>
        {topTab === "tasks" ? (
          <TaskTreeView
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            filterFolderId={filterFolderId}
            onFilterChange={onFilterChange}
            onPlayTask={onPlayTask}
          />
        ) : (
          <ScheduleTabView
            onCalendarSelectTask={onCalendarSelectTask}
            onCreateTask={onCreateTask}
            onCreateNote={onCreateNote}
            onSelectMemo={onSelectMemo}
            onSelectNote={onSelectNote}
            onStartTimer={onStartTimer}
            onSelectTask={onSelectTask}
          />
        )}
      </div>
    </div>
  );
}
