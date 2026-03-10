import { memo } from "react";
import type { FolderProgress } from "../../../utils/folderProgress";

interface TaskNodeContentProps {
  title: string;
  isDone: boolean;
  isFolder: boolean;
  progress?: FolderProgress;
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
      className={`flex-1 text-[15px] cursor-pointer truncate ${
        isDone ? "line-through text-notion-text-secondary" : "text-notion-text"
      } ${isFolder ? "font-medium" : ""}`}
    >
      {title}
      {isFolder && progress && progress.total > 0 && (
        <span className="ml-1.5 text-xs text-notion-text-secondary font-normal">
          {progress.completed}/{progress.total}
        </span>
      )}
    </span>
  );
});
