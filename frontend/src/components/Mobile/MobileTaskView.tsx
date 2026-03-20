import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import type { TaskNode } from "../../types/taskTree";

export function MobileTaskView() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);

  const ds = getDataService();

  const loadTasks = useCallback(async () => {
    try {
      const tree = await ds.fetchTaskTree();
      setTasks(tree);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoading(false);
    }
  }, [ds]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleToggle(task: TaskNode) {
    // 3-state cycle: NOT_STARTED → IN_PROGRESS → DONE → NOT_STARTED
    const statusCycle: Record<string, string> = {
      NOT_STARTED: "IN_PROGRESS",
      IN_PROGRESS: "DONE",
      DONE: "NOT_STARTED",
    };
    const currentStatus = task.status ?? "NOT_STARTED";
    const newStatus = statusCycle[currentStatus] ?? "NOT_STARTED";
    try {
      await ds.updateTask(task.id, {
        status: newStatus,
        completedAt:
          newStatus === "DONE" ? new Date().toISOString() : undefined,
      });
      await loadTasks();
    } catch (e) {
      console.error("Failed to toggle task:", e);
    }
  }

  // Build tree structure
  const rootTasks = tasks.filter((t) => !t.parentId);
  const getChildren = (parentId: string) =>
    tasks
      .filter((t) => t.parentId === parentId)
      .sort((a, b) => a.order - b.order);

  function renderTask(task: TaskNode, depth: number = 0) {
    const children = getChildren(task.id);
    const isFolder = task.type === "folder";

    return (
      <div key={task.id}>
        <div
          className="flex items-center gap-2 border-b border-notion-border px-4 py-2.5"
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          {isFolder ? (
            <span className="text-sm text-notion-text-secondary">📁</span>
          ) : (
            <button
              onClick={() => handleToggle(task)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                task.status === "DONE"
                  ? "border-notion-accent bg-notion-accent text-white"
                  : "border-notion-border"
              }`}
            >
              {task.status === "DONE" && <span className="text-xs">✓</span>}
            </button>
          )}
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              task.status === "DONE"
                ? "text-notion-text-secondary line-through"
                : "text-notion-text-primary"
            }`}
          >
            {task.title}
          </span>
        </div>
        {children.map((child) => renderTask(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
        <h2 className="text-sm font-medium text-notion-text-primary">
          {t("mobile.tabs.tasks", "Tasks")}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("mobile.task.empty", "No tasks yet")}
          </div>
        ) : (
          rootTasks
            .sort((a, b) => a.order - b.order)
            .map((task) => renderTask(task))
        )}
      </div>
    </div>
  );
}
