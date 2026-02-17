import {
  Play,
  Pause,
  Trash2,
  LucideFolderPlus,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../types/taskTree";

interface TaskNodeActionsProps {
  node: TaskNode;
  isDone: boolean;
  isTimerActive: boolean;
  isFolderDone?: boolean;
  makeFolder: (node: TaskNode) => void;
  makeTask: (node: TaskNode) => void;
  onPlayTask?: (node: TaskNode) => void;
  onDelete: (id: string) => void;
  onCompleteFolder?: () => void;
}

export function TaskNodeActions({
  node,
  isDone,
  isTimerActive,
  isFolderDone,
  onPlayTask,
  onDelete,
  makeFolder,
  makeTask,
  onCompleteFolder,
}: TaskNodeActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
      {node.type === "folder" && onCompleteFolder && (
        <button
          onClick={onCompleteFolder}
          className={`p-1 ${
            isFolderDone
              ? "text-notion-accent hover:text-notion-text-secondary"
              : "text-notion-text-secondary hover:text-notion-success"
          }`}
          title={
            isFolderDone
              ? t("taskActions.markIncomplete")
              : t("taskActions.completeFolder")
          }
        >
          <CheckCircle2 size={14} />
        </button>
      )}
      {node.type === "folder" && (
        <button
          onClick={() => makeTask(node)}
          className="p-1 text-notion-text-secondary hover:text-notion-success"
        >
          <Plus size={14} />
        </button>
      )}
      {node.type === "folder" && (
        <button
          onClick={() => makeFolder(node)}
          className="p-1 text-notion-text-secondary hover:text-notion-success"
        >
          <LucideFolderPlus size={14} />
        </button>
      )}
      {!isDone && onPlayTask && (
        <button
          onClick={() => onPlayTask(node)}
          className="p-1 text-notion-text-secondary hover:text-notion-accent"
        >
          {isTimerActive ? <Pause size={14} /> : <Play size={14} />}
        </button>
      )}
      <button
        onClick={() => onDelete(node.id)}
        className="p-1 text-notion-text-secondary hover:text-notion-danger"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
