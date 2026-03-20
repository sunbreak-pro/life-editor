import { useMemo } from "react";
import { CircleDot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";

interface InProgressTasksListProps {
  onSelectTask?: (taskId: string) => void;
}

export function InProgressTasksList({
  onSelectTask,
}: InProgressTasksListProps) {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();

  const inProgressTasks = useMemo(
    () =>
      nodes.filter(
        (n) => n.type === "task" && n.status === "IN_PROGRESS" && !n.isDeleted,
      ),
    [nodes],
  );

  if (inProgressTasks.length === 0) return null;

  return (
    <div className="border border-notion-border rounded-lg p-2">
      <div className="flex items-center gap-1">
        <CircleDot size={12} className="text-blue-500" />
        <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
          {t("taskStatus.inProgress")}
        </span>
        <span className="text-[10px] text-notion-text-secondary ml-auto">
          {inProgressTasks.length}
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {inProgressTasks.map((task) => (
          <button
            key={task.id}
            data-sidebar-item
            onClick={() => onSelectTask?.(task.id)}
            className="w-full text-left px-1.5 py-1 rounded hover:bg-notion-hover text-xs text-notion-text truncate transition-colors"
          >
            {task.title}
          </button>
        ))}
      </div>
    </div>
  );
}
