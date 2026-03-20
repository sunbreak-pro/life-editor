import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Search, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { useConfirmableSubmit } from "../../../../hooks/useConfirmableSubmit";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { useDebounce } from "../../../../hooks/useDebounce";
import { TimeInput } from "../../../shared/TimeInput";
import type { TaskNode } from "../../../../types/taskTree";

interface TimeGridClickPanelProps {
  position: { x: number; y: number };
  defaultStartTime: string;
  defaultEndTime: string;
  date: Date;
  existingTaskIds: Set<string>;
  onCreateScheduleItem: (
    title: string,
    startTime: string,
    endTime: string,
  ) => void;
  onClose: () => void;
}

type ActiveTab = "tasks" | "scheduleItem";

interface TreeItem {
  type: "folder" | "task";
  node?: TaskNode;
  depth: number;
  isExpanded?: boolean;
  taskCount?: number;
}

export function TimeGridClickPanel({
  position,
  defaultStartTime,
  defaultEndTime,
  date,
  existingTaskIds,
  onCreateScheduleItem,
  onClose,
}: TimeGridClickPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("tasks");

  useClickOutside(ref, onClose, true);

  // Position calculation
  const panelWidth = 300;
  const panelHeight = 360;
  const margin = 16;
  const left = Math.min(position.x, window.innerWidth - panelWidth - margin);
  const spaceBelow = window.innerHeight - position.y - margin;
  const top =
    spaceBelow >= panelHeight
      ? position.y
      : Math.max(margin, position.y - panelHeight);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-notion-bg border border-notion-border rounded-lg shadow-xl overflow-hidden"
      style={{ left, top, width: panelWidth }}
    >
      {/* Tab header */}
      <div className="flex border-b border-notion-border">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "tasks"
              ? "text-notion-accent border-b-2 border-notion-accent"
              : "text-notion-text-secondary hover:text-notion-text"
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab("scheduleItem")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "scheduleItem"
              ? "text-notion-accent border-b-2 border-notion-accent"
              : "text-notion-text-secondary hover:text-notion-text"
          }`}
        >
          Schedule Item
        </button>
      </div>

      {activeTab === "tasks" ? (
        <TaskPickerTab
          date={date}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          existingTaskIds={existingTaskIds}
          onClose={onClose}
        />
      ) : (
        <ScheduleItemTab
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          onSubmit={onCreateScheduleItem}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// ---- Task Picker Tab ----
function TaskPickerTab({
  date,
  defaultStartTime,
  defaultEndTime,
  existingTaskIds,
  onClose,
}: {
  date: Date;
  defaultStartTime: string;
  defaultEndTime: string;
  existingTaskIds: Set<string>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { getChildren, updateNode } = useTaskTreeContext();
  const [searchValue, setSearchValue] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const debouncedSearch = useDebounce(searchValue, 150);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo(() => {
    const result: TreeItem[] = [];
    const filterText = debouncedSearch.trim().toLowerCase();

    const countTodoTasks = (parentId: string): number => {
      return getChildren(parentId).reduce((acc, child) => {
        if (child.type === "task" && child.status !== "DONE") return acc + 1;
        if (child.type === "folder") return acc + countTodoTasks(child.id);
        return acc;
      }, 0);
    };

    const hasMatchingTask = (parentId: string, text: string): boolean => {
      return getChildren(parentId).some((child) => {
        if (child.type === "task" && child.status !== "DONE")
          return child.title.toLowerCase().includes(text);
        if (child.type === "folder") return hasMatchingTask(child.id, text);
        return false;
      });
    };

    const buildTree = (parentId: string | null, depth: number) => {
      const children = getChildren(parentId);
      const tasks = children.filter(
        (c) => c.type === "task" && c.status !== "DONE",
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

    const rootChildren = getChildren(null);
    const rootTasks = rootChildren.filter(
      (n) => n.type === "task" && n.status !== "DONE",
    );
    const filteredRootTasks = filterText
      ? rootTasks.filter((tt) => tt.title.toLowerCase().includes(filterText))
      : rootTasks;
    filteredRootTasks.forEach((tt) =>
      result.push({ type: "task", node: tt, depth: 0 }),
    );

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
      <div className="p-3">
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
        <div className="flex justify-end gap-2 mt-2">
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
    <>
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
    </>
  );
}

// ---- Schedule Item Tab ----
function ScheduleItemTab({
  defaultStartTime,
  defaultEndTime,
  onSubmit,
  onClose,
}: {
  defaultStartTime: string;
  defaultEndTime: string;
  onSubmit: (title: string, startTime: string, endTime: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);

  const handleSubmit = () => {
    onSubmit(title.trim() || "Untitled", startTime, endTime);
    onClose();
  };

  const {
    inputRef: confirmInputRef,
    handleKeyDown,
    handleBlur,
    handleFocus,
  } = useConfirmableSubmit(handleSubmit, onClose);

  useEffect(() => {
    confirmInputRef.current?.focus();
  }, [confirmInputRef]);

  return (
    <div className="p-3">
      <input
        ref={confirmInputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={t("schedule.itemTitlePlaceholder", "Schedule item name")}
        className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
      />

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1">
          <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
            {t("schedule.start", "Start")}
          </label>
          <TimeInput
            hour={parseInt(startTime.split(":")[0] || "0", 10)}
            minute={parseInt(startTime.split(":")[1] || "0", 10)}
            onChange={(h, m) =>
              setStartTime(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
              )
            }
            minuteStep={1}
            size="sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
            {t("schedule.end", "End")}
          </label>
          <TimeInput
            hour={parseInt(endTime.split(":")[0] || "0", 10)}
            minute={parseInt(endTime.split(":")[1] || "0", 10)}
            onChange={(h, m) =>
              setEndTime(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
              )
            }
            minuteStep={1}
            size="sm"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full mt-2 px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors"
      >
        {t("schedule.create", "Create")}
      </button>
    </div>
  );
}
