import { useState, useCallback } from "react";
import { ListChecks, CheckCircle2 } from "lucide-react";
import type { TaskNode } from "../../types/taskTree";
import { TaskTree } from "../Tasks/TaskTree/TaskTree";
import { TaskTreeHeader } from "../Tasks/TaskTree/TaskTreeHeader";
import { TaskDetailContent } from "../Tasks/TaskDetail/TaskDetailContent";
import { SectionTabs } from "../shared/SectionTabs";
import type { TabItem } from "../shared/SectionTabs";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useResizablePanel } from "../../hooks/useResizablePanel";
import { STORAGE_KEYS } from "../../constants/storageKeys";

type TaskTreeTab = "incomplete" | "completed";

const TASK_TREE_TABS: readonly TabItem<TaskTreeTab>[] = [
  { id: "incomplete", labelKey: "tabs.incomplete", icon: ListChecks },
  { id: "completed", labelKey: "tabs.complete", icon: CheckCircle2 },
];

interface ScheduleTasksContentProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  filterFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
  onPlayTask?: (node: TaskNode) => void;
  sidebarSearchQuery?: string;
}

export function ScheduleTasksContent({
  selectedTaskId,
  onSelectTask,
  filterFolderId,
  onFilterChange,
  onPlayTask,
  sidebarSearchQuery,
}: ScheduleTasksContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useLocalStorage<TaskTreeTab>(
    STORAGE_KEYS.TASK_TREE_TAB,
    "incomplete",
  );

  const { width, dragWidth, handleMouseDown, containerRef } = useResizablePanel(
    {
      storageKey: STORAGE_KEYS.SCHEDULE_TASKS_LEFT_WIDTH,
      defaultWidth: 340,
      minWidth: 250,
      maxWidth: 600,
    },
  );

  const currentWidth = dragWidth ?? width;

  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchQuery("");
    setIsSearchOpen(false);
  }, []);

  return (
    <div ref={containerRef} className="h-full flex min-h-0">
      {/* Left column: Tree */}
      <div
        className="flex flex-col border-r border-notion-border shrink-0 relative"
        style={{ width: currentWidth }}
      >
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
            searchQuery={sidebarSearchQuery || searchQuery}
            activeTab={activeTab}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-notion-accent/30 transition-colors z-10"
        />
      </div>

      {/* Right column: Detail */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <TaskDetailContent
          selectedNodeId={selectedTaskId}
          onPlayTask={onPlayTask}
          onSelectTask={onSelectTask}
        />
      </div>
    </div>
  );
}
