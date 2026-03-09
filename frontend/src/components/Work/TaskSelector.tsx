import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, Inbox, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useDebounce } from "../../hooks/useDebounce";
import type { TaskNode } from "../../types/taskTree";

interface TaskSelectorProps {
  currentTitle: string;
}

interface TreeItem {
  type: "inbox-header" | "folder" | "task";
  node?: TaskNode;
  depth: number;
  isExpanded?: boolean;
  taskCount?: number;
}

export function TaskSelector({ currentTitle }: TaskSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [newTaskValue, setNewTaskValue] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { getChildren, addNode, updateNode } = useTaskTreeContext();
  const timer = useTimerContext();
  const debouncedSearch = useDebounce(newTaskValue, 150);

  // Inline editing state for Untitled tasks
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const editTitleRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Detect Untitled task and enter editing mode
  useEffect(() => {
    if (timer.activeTask?.title === "Untitled") {
      setIsEditingTitle(true);
      setEditTitleValue("");
    }
  }, [timer.activeTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the edit input when entering editing mode
  useEffect(() => {
    if (isEditingTitle && editTitleRef.current) {
      editTitleRef.current.focus();
    }
  }, [isEditingTitle]);

  const commitRename = () => {
    const trimmed = editTitleValue.trim();
    if (trimmed && timer.activeTask) {
      updateNode(timer.activeTask.id, { title: trimmed });
      timer.updateActiveTaskTitle(trimmed);
    }
    setIsEditingTitle(false);
  };

  // Parse "FolderName/taskName" input pattern (debounced for filtering)
  const parsedInput = useMemo(() => {
    const idx = debouncedSearch.indexOf("/");
    if (idx < 0)
      return {
        folderName: "",
        taskName: debouncedSearch,
        folder: null as TaskNode | null,
      };
    const folderName = debouncedSearch.substring(0, idx).trim();
    const taskName = debouncedSearch.substring(idx + 1).trim();
    const rootChildren = getChildren(null);
    const folder =
      rootChildren.find(
        (n) =>
          n.type === "folder" &&
          n.title.toLowerCase() === folderName.toLowerCase(),
      ) ?? null;
    return { folderName, taskName, folder };
  }, [debouncedSearch, getChildren]);

  // Build hierarchical tree of TODO tasks
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
      // Tasks at this level
      const tasks = children.filter(
        (c) => c.type === "task" && c.status === "TODO",
      );
      const filtered = filterText
        ? tasks.filter((t) => t.title.toLowerCase().includes(filterText))
        : tasks;
      filtered.forEach((t) => result.push({ type: "task", node: t, depth }));
      // Sub-folders
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

    // If a folder is matched via "FolderName/" input, show only that folder
    if (parsedInput.folder) {
      const folder = parsedInput.folder;
      const tc = countTodoTasks(folder.id);
      result.push({
        type: "folder",
        node: folder,
        depth: 0,
        isExpanded: true,
        taskCount: tc,
      });
      // Collect all tasks recursively for "FolderName/" mode
      const collectAll = (pid: string, d: number) => {
        const ch = getChildren(pid);
        const searchText = parsedInput.taskName.toLowerCase();
        const tasks = ch.filter(
          (c) => c.type === "task" && c.status === "TODO",
        );
        const matched = searchText
          ? tasks.filter((t) => t.title.toLowerCase().includes(searchText))
          : tasks;
        matched.forEach((t) =>
          result.push({ type: "task", node: t, depth: d }),
        );
        ch.filter((c) => c.type === "folder").forEach((f) =>
          collectAll(f.id, d),
        );
      };
      collectAll(folder.id, 1);
      return result;
    }

    // Inbox (root tasks)
    const rootChildren = getChildren(null);
    const inboxTasks = rootChildren.filter(
      (n) => n.type === "task" && n.status === "TODO",
    );
    const filteredInbox = filterText
      ? inboxTasks.filter((t) => t.title.toLowerCase().includes(filterText))
      : inboxTasks;
    if (filteredInbox.length > 0) {
      result.push({ type: "inbox-header", depth: 0 });
      filteredInbox.forEach((t) =>
        result.push({ type: "task", node: t, depth: 1 }),
      );
    }

    // Root folders (recursive tree)
    const rootFolders = rootChildren.filter((n) => n.type === "folder");
    rootFolders.forEach((folder) => {
      const tc = countTodoTasks(folder.id);
      const hasMatching = filterText
        ? hasMatchingTask(folder.id, filterText)
        : tc > 0;
      if (!hasMatching && !filterText) return;
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
  }, [getChildren, parsedInput, debouncedSearch, expandedFolders]);

  const handleSelectTask = (task: TaskNode) => {
    timer.openForTask(task.id, task.title, task.workDurationMinutes);
    setNewTaskValue("");
    setIsOpen(false);
  };

  const handleCreateTask = () => {
    // Use live input (not debounced) for task creation
    const slashIdx = newTaskValue.indexOf("/");
    if (slashIdx >= 0) {
      const folderName = newTaskValue.substring(0, slashIdx).trim();
      const taskName = newTaskValue.substring(slashIdx + 1).trim();
      if (!taskName) return;
      const rootChildren = getChildren(null);
      const folder = rootChildren.find(
        (n) =>
          n.type === "folder" &&
          n.title.toLowerCase() === folderName.toLowerCase(),
      );
      if (folder) {
        const newNode = addNode("task", folder.id, taskName);
        if (!newNode) return;
        timer.openForTask(newNode.id, newNode.title);
      } else {
        const newNode = addNode("task", null, newTaskValue.trim());
        if (!newNode) return;
        timer.openForTask(newNode.id, newNode.title);
      }
    } else {
      const trimmed = newTaskValue.trim();
      if (!trimmed) return;
      const newNode = addNode("task", null, trimmed);
      if (!newNode) return;
      timer.openForTask(newNode.id, newNode.title);
    }
    setNewTaskValue("");
    setIsOpen(false);
  };

  const handleHeaderClick = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleClearTask = () => {
    timer.clearTask();
    setIsOpen(false);
  };

  const placeholder = parsedInput.folder
    ? t("taskSelector.newTaskIn", { folder: parsedInput.folder.title })
    : t("taskSelector.createNewTask");

  return (
    <div className="relative" ref={dropdownRef}>
      {isEditingTitle ? (
        <input
          ref={editTitleRef}
          type="text"
          value={editTitleValue}
          onChange={(e) => setEditTitleValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setIsEditingTitle(false);
          }}
          onBlur={commitRename}
          placeholder={t("taskSelector.taskName")}
          className="text-lg font-semibold text-notion-text bg-transparent outline-none border-b border-notion-accent max-w-full"
        />
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 font-semibold text-notion-text hover:text-notion-accent transition-colors max-w-full text-lg"
        >
          <span className="truncate">{currentTitle}</span>
          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-notion-bg border border-notion-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* New task input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-notion-border">
            <Plus size={14} className="text-notion-text-secondary shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={newTaskValue}
              onChange={(e) => setNewTaskValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTask();
                if (e.key === "Escape") setIsOpen(false);
              }}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-notion-text placeholder:text-notion-text-secondary"
            />
          </div>

          {/* Task list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {items.map((item, idx) => {
              if (item.type === "inbox-header") {
                return (
                  <div
                    key="inbox-header"
                    className="w-full flex items-center gap-1.5 py-1.5 text-sm text-notion-text-secondary"
                    style={{ paddingLeft: 12, paddingRight: 12 }}
                  >
                    <Inbox size={12} />
                    <span>Inbox</span>
                  </div>
                );
              }

              if (item.type === "folder") {
                return (
                  <button
                    key={`folder-${item.node!.id}-${idx}`}
                    onClick={() => handleHeaderClick(item.node!.id)}
                    className="w-full flex items-center py-1.5 hover:bg-notion-hover cursor-pointer transition-colors text-notion-text text-sm"
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
                      <span className="ml-auto text-xs text-notion-text-secondary opacity-75">
                        {item.taskCount}
                      </span>
                    )}
                  </button>
                );
              }

              const isActive = timer.activeTask?.id === item.node?.id;
              return (
                <button
                  key={item.node!.id}
                  onClick={() => handleSelectTask(item.node!)}
                  className={`w-full text-left py-1.5 hover:bg-notion-hover transition-colors truncate text-sm ${
                    isActive
                      ? "text-notion-accent bg-notion-accent/5 font-medium"
                      : "text-notion-text"
                  }`}
                  style={{ paddingLeft: `${12 + item.depth * 14}px` }}
                >
                  {item.node!.title}
                </button>
              );
            })}

            {items.length === 0 && (
              <div className="px-3 py-4 text-notion-text-secondary text-center">
                {t("taskSelector.noTasks")}
              </div>
            )}
          </div>

          {/* Free session option */}
          {timer.activeTask && (
            <div className="border-t border-notion-border">
              <button
                onClick={handleClearTask}
                className="w-full flex items-center gap-2 px-3 py-2 text-notion-text-secondary hover:bg-notion-hover transition-colors"
              >
                <X size={14} />
                <span>{t("work.freeSession")}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
