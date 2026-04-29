import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Zap, Check, Folder } from "lucide-react";
import type { TaskNode } from "../../../types/taskTree";
import { buildFolderPath } from "./folderPath";

export function FolderBreadcrumb({
  path,
  className = "",
}: {
  path: string[];
  className?: string;
}) {
  if (path.length === 0) return null;
  return (
    <div
      className={`flex items-center gap-1 text-[10px] font-medium text-notion-text-secondary ${className}`}
    >
      <Folder size={10} className="shrink-0" />
      <span className="truncate">{path.join(" › ")}</span>
    </div>
  );
}

interface MobileTaskSelectorProps {
  tree: TaskNode[];
  nodeMap: Map<string, TaskNode>;
  activeTaskId: string | null;
  onSelect: (task: TaskNode) => void;
  onClear: () => void;
  onClose: () => void;
}

export function MobileTaskSelector({
  tree,
  nodeMap,
  activeTaskId,
  onSelect,
  onClear,
  onClose,
}: MobileTaskSelectorProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const tasks = useMemo(
    () =>
      tree.filter(
        (n) => n.type === "task" && !n.isDeleted && n.status !== "DONE",
      ),
    [tree],
  );

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((n) => n.title.toLowerCase().includes(q));
  }, [tasks, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl bg-notion-bg"
        style={{ maxHeight: "70svh" }}
      >
        <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
          <h3 className="text-sm font-semibold text-notion-text">
            {t("mobile.work.selectTask", "Select a task")}
          </h3>
          <button
            onClick={onClose}
            className="text-sm text-notion-text-secondary active:opacity-60"
          >
            {t("common.close", "Close")}
          </button>
        </div>

        <div className="border-b border-notion-border px-4 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("mobile.work.searchTask", "Search tasks...")}
            className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-notion-text placeholder:text-notion-text-secondary/50 focus:border-notion-accent focus:outline-none"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <button
            onClick={onClear}
            className="flex w-full items-center gap-3 border-b border-notion-border px-4 py-3 text-left active:bg-notion-hover"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-notion-bg-secondary">
              <Zap size={14} className="text-notion-text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-notion-text">
                {t("mobile.work.freeSessionOption", "Free Session")}
              </div>
              <div className="text-[11px] text-notion-text-secondary">
                {t(
                  "mobile.work.freeSessionHint",
                  "Focus without a specific task",
                )}
              </div>
            </div>
            {activeTaskId === null && (
              <Check size={16} className="shrink-0 text-notion-accent" />
            )}
          </button>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-notion-text-secondary">
              {t("mobile.work.noTasks", "No tasks found")}
            </div>
          ) : (
            filtered.map((task) => {
              const path = buildFolderPath(task.id, nodeMap);
              const selected = task.id === activeTaskId;
              return (
                <button
                  key={task.id}
                  onClick={() => onSelect(task)}
                  className="flex w-full items-start gap-3 border-b border-notion-border px-4 py-3 text-left active:bg-notion-hover"
                >
                  <div className="min-w-0 flex-1">
                    <FolderBreadcrumb path={path} className="mb-0.5" />
                    <div className="truncate text-sm text-notion-text">
                      {task.title}
                    </div>
                  </div>
                  {selected && (
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-notion-accent"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
