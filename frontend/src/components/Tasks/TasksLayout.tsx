import { useTranslation } from "react-i18next";
import { ListTree } from "lucide-react";
import type { TaskNode } from "../../types/taskTree";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { LAYOUT } from "../../constants/layout";
import { TaskTreeView } from "./TaskTreeView";

type TasksTab = "tree";

const TASKS_TABS: readonly TabItem<TasksTab>[] = [
  { id: "tree", labelKey: "tabs.tree", icon: ListTree },
];

interface TasksLayoutProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  filterFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
  onPlayTask?: (node: TaskNode) => void;
}

export function TasksLayout({
  selectedTaskId,
  onSelectTask,
  filterFolderId,
  onFilterChange,
  onPlayTask,
}: TasksLayoutProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <SectionHeader
        title={t("tasks.title")}
        tabs={TASKS_TABS}
        activeTab="tree"
        onTabChange={() => {}}
      />
      <div className="flex-1 min-h-0">
        <TaskTreeView
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          filterFolderId={filterFolderId}
          onFilterChange={onFilterChange}
          onPlayTask={onPlayTask}
        />
      </div>
    </div>
  );
}
