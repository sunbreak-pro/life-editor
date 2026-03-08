import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { useDebounce } from "../../../../hooks/useDebounce";
import type { TaskNode } from "../../../../types/taskTree";

interface DayFlowTaskPickerProps {
  date: Date;
  onClose: () => void;
  existingTaskIds: Set<string>;
}

interface TreeItem {
  type: "folder" | "task";
  node?: TaskNode;
  depth: number;
  isExpanded?: boolean;
  taskCount?: number;
}

export function DayFlowTaskPicker({
  date,
  onClose,
  existingTaskIds,
}: DayFlowTaskPickerProps) {
  const { t } = useTranslation();
  const { getChildren, updateNode } = useTaskTreeContext();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [searchValue, setSearchValue] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const debouncedSearch = useDebounce(searchValue, 150);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Focus search input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Build tree items
  const items = useMemo(() => {
    const result: TreeItem[] = [];
    const filterText = debouncedSearch.trim().toLowerCase();

    const countTodoTasks = (parentId: string): number => {
      return getChildren(parentId).reduce((acc, child) => {
        if (child.type === "task" && child.status === "TODO") return acc + 1;
        if (child.type === "folder") return acc + countTodoTasks(child.id);
        return acc;
      }, 0);
    };

    const hasMatchingTask = (parentId: string, text: string): boolean => {
      return getChildren(parentId).some((child) => {
        if (child.type === "task" && child.status === "TODO")
          return child.title.toLowerCase().includes(text);
        if (child.type === "folder") return hasMatchingTask(child.id, text);
        return false;
      });
    };

    const buildTree = (parentId: string | null, depth: number) => {
      const children = getChildren(parentId);
      const tasks = children.filter(
        (c) => c.type === "task" && c.status === "TODO",
      );
      const filtered = filterText
        ? tasks.filter((tt) => tt.title.toLowerCase().includes(filterText))
        : tasks;
      filtered.forEach((tt) => result.push({ type: "task", node: tt, depth }));

      const folders = children.filter((c) => c.type === "folder");
      folders.forEach((folder) => {
        const tc = countTodoTasks(folder.id);
        const hasMatching = filterText
          ? hasMatchingTask(folder.id, filterText)
          : tc > 0;
        if (!hasMatching) return;
        const expanded = expandedFolders.has(folder.id) || !!filterText;
        result.push({
          type: "folder",
          node: folder,
          depth,
          isExpanded: expanded,
          taskCount: tc,
        });
        if (expanded) buildTree(folder.id, depth + 1);
      });
    };

    // Root tasks
    const rootChildren = getChildren(null);
    const rootTasks = rootChildren.filter(
      (n) => n.type === "task" && n.status === "TODO",
    );
    const filteredRootTasks = filterText
      ? rootTasks.filter((tt) => tt.title.toLowerCase().includes(filterText))
      : rootTasks;
    filteredRootTasks.forEach((tt) =>
      result.push({ type: "task", node: tt, depth: 0 }),
    );

    // Root folders
    const rootFolders = rootChildren.filter((n) => n.type === "folder");
    rootFolders.forEach((folder) => {
      const tc = countTodoTasks(folder.id);
      const hasMatching = filterText
        ? hasMatchingTask(folder.id, filterText)
        : tc > 0;
      if (!hasMatching) return;
      const expanded = expandedFolders.has(folder.id) || !!filterText;
      result.push({
        type: "folder",
        node: folder,
        depth: 0,
        isExpanded: expanded,
        taskCount: tc,
      });
      if (expanded) buildTree(folder.id, 1);
    });

    return result;
  }, [getChildren, debouncedSearch, expandedFolders]);

  const handleToggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const handleSelectTask = (task: TaskNode) => {
    setSelectedTask(task);
    // Pre-fill time from existing scheduledAt if available
    if (task.scheduledAt) {
      const d = new Date(task.scheduledAt);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setStartTime(`${h}:${m}`);
      if (task.scheduledEndAt) {
        const de = new Date(task.scheduledEndAt);
        setEndTime(
          `${String(de.getHours()).padStart(2, "0")}:${String(de.getMinutes()).padStart(2, "0")}`,
        );
      } else {
        const dur = task.workDurationMinutes ?? 25;
        const endDate = new Date(d.getTime() + dur * 60000);
        setEndTime(
          `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`,
        );
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedTask) return;

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);

    const scheduledDate = new Date(date);
    scheduledDate.setHours(sh, sm, 0, 0);

    const scheduledEndDate = new Date(date);
    scheduledEndDate.setHours(eh, em, 0, 0);

    updateNode(selectedTask.id, {
      scheduledAt: scheduledDate.toISOString(),
      scheduledEndAt: scheduledEndDate.toISOString(),
      isAllDay: false,
    });

    onClose();
  };

  if (selectedTask) {
    return (
      <div
        ref={popoverRef}
        className="absolute right-0 top-full mt-1 w-72 bg-notion-bg border border-notion-border rounded-lg shadow-xl z-50 overflow-hidden"
      >
        {/* Time picker header */}
        <div className="px-3 py-2 border-b border-notion-border">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-notion-text-secondary" />
            <span className="text-xs font-medium text-notion-text truncate">
              {selectedTask.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-notion-text-secondary block mb-0.5">
                {t("calendar.startLabel")}
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-notion-hover border border-notion-border rounded text-notion-text"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-notion-text-secondary block mb-0.5">
                {t("calendar.endLabel")}
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-notion-hover border border-notion-border rounded text-notion-text"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-3 py-2">
          <button
            onClick={() => setSelectedTask(null)}
            className="px-3 py-1 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1 text-xs text-white bg-notion-accent hover:bg-notion-accent/90 rounded transition-colors"
          >
            {t("common.confirm")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 w-72 bg-notion-bg border border-notion-border rounded-lg shadow-xl z-50 overflow-hidden"
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notion-border">
        <Search size={14} className="text-notion-text-secondary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          placeholder={t("dayFlow.addTask")}
          className="flex-1 bg-transparent outline-none text-sm text-notion-text placeholder:text-notion-text-secondary"
        />
      </div>

      {/* Task list */}
      <div className="max-h-64 overflow-y-auto py-1">
        {items.map((item, idx) => {
          if (item.type === "folder") {
            return (
              <button
                key={`folder-${item.node!.id}-${idx}`}
                onClick={() => handleToggleFolder(item.node!.id)}
                className="w-full flex items-center py-1.5 text-xs hover:bg-notion-hover cursor-pointer transition-colors text-notion-text"
                style={{
                  paddingLeft: `${12 + item.depth * 14}px`,
                  paddingRight: 12,
                }}
              >
                {item.isExpanded ? (
                  <ChevronDown
                    size={10}
                    className="mr-1 text-notion-text-secondary/50"
                  />
                ) : (
                  <ChevronRight
                    size={10}
                    className="mr-1 text-notion-text-secondary/50"
                  />
                )}
                {item.node!.color && (
                  <span
                    className="w-2 h-2 rounded-full mr-1.5 shrink-0"
                    style={{ backgroundColor: item.node!.color }}
                  />
                )}
                <span className="truncate">{item.node!.title}</span>
                {item.taskCount != null && (
                  <span className="ml-auto text-[10px] text-notion-text-secondary">
                    {item.taskCount}
                  </span>
                )}
              </button>
            );
          }

          const isExisting = existingTaskIds.has(item.node!.id);
          return (
            <button
              key={item.node!.id}
              onClick={() => !isExisting && handleSelectTask(item.node!)}
              disabled={isExisting}
              className={`w-full text-left py-1.5 text-xs transition-colors truncate ${
                isExisting
                  ? "text-notion-text-secondary/50 cursor-not-allowed"
                  : "text-notion-text hover:bg-notion-hover cursor-pointer"
              }`}
              style={{ paddingLeft: `${12 + item.depth * 14}px` }}
            >
              {item.node!.title}
              {isExisting && (
                <span className="ml-1 text-[10px] text-notion-text-secondary/40">
                  (scheduled)
                </span>
              )}
            </button>
          );
        })}

        {items.length === 0 && (
          <div className="px-3 py-4 text-sm text-notion-text-secondary text-center">
            {t("dayFlow.noItems")}
          </div>
        )}
      </div>
    </div>
  );
}
