import type { TaskNode } from "../../types/taskTree";
import { TaskTree } from "./TaskTree";
import { TaskTreeHeader } from "./TaskTree/TaskTreeHeader";
import { TaskDetailPanel } from "./TaskDetail/TaskDetailPanel";

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
  return (
    <div className="h-full flex min-h-0">
      <div className="w-1/2 min-w-[300px] flex flex-col border-r border-notion-border">
        <TaskTreeHeader
          filterFolderId={filterFolderId}
          onFilterChange={onFilterChange}
        />
        <div className="flex-1 overflow-y-auto">
          <TaskTree
            onPlayTask={onPlayTask}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTaskId}
            filterFolderId={filterFolderId}
            onFilterChange={onFilterChange}
          />
        </div>
      </div>
      <div className="flex-1 min-w-[280px] overflow-y-auto">
        <TaskDetailPanel
          selectedNodeId={selectedTaskId}
          onPlayTask={onPlayTask}
        />
      </div>
    </div>
  );
}
