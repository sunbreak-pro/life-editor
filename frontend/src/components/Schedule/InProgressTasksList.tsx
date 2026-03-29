import { useMemo } from "react";
import { CircleDot, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { formatDateKey } from "../../utils/dateKey";

interface InProgressTasksListProps {
  date?: Date;
  onSelectTask?: (taskId: string) => void;
}

export function InProgressTasksList({
  date,
  onSelectTask,
}: InProgressTasksListProps) {
  const { t } = useTranslation();
  const { nodes, setTaskStatus } = useTaskTreeContext();

  const dateKey = date ? formatDateKey(date) : null;

  const inProgressTasks = useMemo(
    () =>
      nodes.filter((n) => {
        if (n.type !== "task" || n.status !== "IN_PROGRESS" || n.isDeleted)
          return false;
        if (!dateKey) return true;
        if (!n.scheduledAt) return false;
        return formatDateKey(new Date(n.scheduledAt)) === dateKey;
      }),
    [nodes, dateKey],
  );

  const completedTasks = useMemo(
    () =>
      nodes
        .filter((n) => {
          if (n.type !== "task" || n.status !== "DONE" || n.isDeleted)
            return false;
          if (!dateKey) return true;
          if (!n.scheduledAt) return false;
          return formatDateKey(new Date(n.scheduledAt)) === dateKey;
        })
        .sort((a, b) =>
          (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
        )
        .slice(0, 10),
    [nodes, dateKey],
  );

  if (inProgressTasks.length === 0 && completedTasks.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* In Progress Section */}
      {inProgressTasks.length > 0 && (
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
              <div
                key={task.id}
                data-sidebar-item
                className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-notion-hover transition-colors group"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTaskStatus(task.id, "DONE");
                  }}
                  className="shrink-0 w-4 h-4 rounded-full border-2 border-blue-400 hover:border-green-500 hover:bg-green-100 transition-colors"
                  title={t("taskStatus.markDone")}
                />
                <button
                  onClick={() => onSelectTask?.(task.id)}
                  className="flex-1 text-left text-xs text-notion-text truncate hover:underline"
                >
                  {task.title}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Section */}
      {completedTasks.length > 0 && (
        <div className="border border-notion-border rounded-lg p-2">
          <div className="flex items-center gap-1">
            <CheckCircle2 size={12} className="text-green-500" />
            <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
              {t("taskStatus.done")}
            </span>
            <span className="text-[10px] text-notion-text-secondary ml-auto">
              {completedTasks.length}
            </span>
          </div>
          <div className="mt-1.5 space-y-0.5">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                data-sidebar-item
                className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-notion-hover transition-colors"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTaskStatus(task.id, "IN_PROGRESS");
                  }}
                  className="shrink-0 w-4 h-4 flex items-center justify-center"
                  title={t("taskStatus.markInProgress")}
                >
                  <CheckCircle2
                    size={14}
                    className="text-green-500 hover:text-blue-500 transition-colors"
                  />
                </button>
                <button
                  onClick={() => onSelectTask?.(task.id)}
                  className="flex-1 text-left text-xs text-notion-text/60 truncate line-through hover:underline"
                >
                  {task.title}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
