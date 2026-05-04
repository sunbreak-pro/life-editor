import { useState, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { ListChecks, CheckCircle2 } from "lucide-react";
import type { TaskNode } from "../../types/taskTree";
import { TaskTree } from "./TaskTree";
import { TaskTreeHeader } from "./TaskTree/TaskTreeHeader";
import { TaskDetailContent } from "./TaskDetail/TaskDetailContent";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import { SectionTabs } from "../shared/SectionTabs";
import type { TabItem } from "../shared/SectionTabs";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { STORAGE_KEYS } from "../../constants/storageKeys";

export type TaskTreeTab = "incomplete" | "completed";

const TASK_TREE_TABS: readonly TabItem<TaskTreeTab>[] = [
  { id: "incomplete", labelKey: "tabs.incomplete", icon: ListChecks },
  { id: "completed", labelKey: "tabs.complete", icon: CheckCircle2 },
];

interface TaskTreeViewProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  filterFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
  onPlayTask?: (node: TaskNode) => void;
}

export function TaskTreeView({
  selectedTaskId,
  onSelectTask,
  filterFolderId,
  onFilterChange,
  onPlayTask,
}: TaskTreeViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useLocalStorage<TaskTreeTab>(
    STORAGE_KEYS.TASK_TREE_TAB,
    "incomplete",
  );

  const rightSidebarCtx = useContext(RightSidebarContext);
  const portalTarget = rightSidebarCtx?.portalTarget;

  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchQuery("");
    setIsSearchOpen(false);
  }, []);

  const treePanel = (
    <>
      <TaskTreeHeader
        filterFolderId={filterFolderId}
        onFilterChange={onFilterChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearchOpen={isSearchOpen}
        onSearchOpen={handleSearchOpen}
        onSearchClose={handleSearchClose}
        onSelectTask={onSelectTask}
      />
      <SectionTabs
        tabs={TASK_TREE_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        size="sm"
      />
      <div className="flex-1 overflow-y-auto">
        <TaskTree
          onPlayTask={onPlayTask}
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTaskId}
          filterFolderId={filterFolderId}
          onFilterChange={onFilterChange}
          searchQuery={searchQuery}
          activeTab={activeTab}
        />
      </div>
    </>
  );

  const sidebarContent = portalTarget
    ? createPortal(
        <div className="flex flex-col h-full">{treePanel}</div>,
        portalTarget,
      )
    : null;

  // Fallback: if no portal target (right sidebar closed), show inline left/right split
  if (!portalTarget) {
    return (
      <div className="h-full flex min-h-0">
        <div className="w-1/2 min-w-75 flex flex-col border-r border-notion-border">
          {treePanel}
        </div>
        <div className="flex-1 min-w-100 overflow-y-auto">
          <TaskDetailContent
            selectedNodeId={selectedTaskId}
            onPlayTask={onPlayTask}
            onSelectTask={onSelectTask}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex min-h-0">
      {sidebarContent}
      <div className="flex-1 overflow-y-auto">
        <TaskDetailContent
          selectedNodeId={selectedTaskId}
          onPlayTask={onPlayTask}
          onSelectTask={onSelectTask}
        />
      </div>
    </div>
  );
}
