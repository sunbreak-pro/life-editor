import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import type { TaskNode } from "../../../types/taskTree";
import { FolderSidebarContent } from "./FolderSidebarContent";
import { TaskDetailEmpty } from "./TaskDetailEmpty";
import { TaskSidebarContent } from "./TaskSidebarContent";

interface TaskDetailPanelProps {
  selectedNodeId: string | null;
  onPlayTask?: (node: TaskNode) => void;
  onSelectTask?: (id: string) => void;
}

export function TaskDetailPanel({
  selectedNodeId,
  onPlayTask,
  onSelectTask,
}: TaskDetailPanelProps) {
  const { nodes, updateNode, softDelete, toggleTaskStatus, setTaskStatus } =
    useTaskTreeContext();

  const node = selectedNodeId
    ? (nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;

  return (
    <div className="h-full flex flex-col bg-notion-bg">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {!node ? (
            <TaskDetailEmpty />
          ) : node.type === "task" ? (
            <TaskSidebarContent
              node={node}
              nodes={nodes}
              updateNode={updateNode}
              softDelete={softDelete}
              onPlayTask={onPlayTask}
              toggleTaskStatus={toggleTaskStatus}
              setTaskStatus={setTaskStatus}
            />
          ) : (
            <FolderSidebarContent
              node={node}
              nodes={nodes}
              updateNode={updateNode}
              onSelectTask={onSelectTask}
              toggleTaskStatus={toggleTaskStatus}
              setTaskStatus={setTaskStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}
