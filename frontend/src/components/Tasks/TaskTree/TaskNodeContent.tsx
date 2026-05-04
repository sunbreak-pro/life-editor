import { memo } from "react";
import type { FolderProgress } from "../../../utils/folderProgress";
import type { Priority } from "../../../types/priority";
import { PriorityBadge } from "../../shared/PriorityBadge";

interface TaskNodeContentProps {
  title: string;
  isDone: boolean;
  isFolder: boolean;
  progress?: FolderProgress;
  priority?: Priority | null;
  onSelectTask?: (id: string) => void;
  onStartEditing: () => void;
  onToggleExpand?: () => void;
  nodeId: string;
}

export const TaskNodeContent = memo(function TaskNodeContent({
  title,
  isDone,
  isFolder,
  progress,
  priority,
  onSelectTask,
  onStartEditing,
  onToggleExpand,
  nodeId,
}: TaskNodeContentProps) {
  return (
    <span
      onClick={() => {
        if (isFolder) {
          onToggleExpand?.();
        }
        if (onSelectTask) onSelectTask(nodeId);
      }}
      onDoubleClick={() => {
        onStartEditing();
      }}
      className={`flex-1 min-w-0 text-[15px] cursor-pointer flex items-center gap-1 ${
        isDone ? "line-through text-notion-text-secondary" : "text-notion-text"
      } ${isFolder ? "font-medium" : ""}`}
    >
      {!isFolder && priority && <PriorityBadge priority={priority} size={12} />}
      <span className="truncate">{title}</span>
      {isFolder && progress && progress.total > 0 && (
        <span className="ml-1.5 text-xs text-notion-text-secondary font-normal shrink-0">
          {progress.completed}/{progress.total}
        </span>
      )}
    </span>
  );
});
