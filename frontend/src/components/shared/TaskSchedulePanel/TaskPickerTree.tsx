import { useState, useMemo, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { useDebounce } from "../../../hooks/useDebounce";
import { TaskPickerNode } from "./TaskPickerNode";
import type { TaskNode } from "../../../types/taskTree";

interface TaskPickerTreeProps {
  selectedTaskId: string | null;
  onSelectTask: (task: TaskNode) => void;
  existingTaskIds?: Set<string>;
}

export function TaskPickerTree({
  selectedTaskId,
  onSelectTask,
  existingTaskIds,
}: TaskPickerTreeProps) {
  const { t } = useTranslation();
  const { getChildren } = useTaskTreeContext();
  const [searchValue, setSearchValue] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const debouncedSearch = useDebounce(searchValue, 150);

  const onToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const { visibleNodeIds, forceExpandedIds, isSearching } = useMemo(() => {
    const filterText = debouncedSearch.trim().toLowerCase();
    if (!filterText) {
      return {
        visibleNodeIds: undefined,
        forceExpandedIds: undefined,
        isSearching: false,
      };
    }

    const matchedTaskIds = new Set<string>();
    const ancestorIds = new Set<string>();

    // Collect all nodes to build parent lookup
    const allNodes: TaskNode[] = [];
    const collectAll = (parentId: string | null) => {
      const children = getChildren(parentId);
      for (const child of children) {
        allNodes.push(child);
        if (child.type === "folder") collectAll(child.id);
      }
    };
    collectAll(null);

    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // Find matching tasks
    for (const node of allNodes) {
      if (
        node.type === "task" &&
        node.status !== "DONE" &&
        node.title.toLowerCase().includes(filterText)
      ) {
        matchedTaskIds.add(node.id);
        // Walk up ancestors
        let current = node;
        while (current.parentId) {
          ancestorIds.add(current.parentId);
          const parent = nodeMap.get(current.parentId);
          if (!parent) break;
          current = parent;
        }
      }
    }

    const visible = new Set([...matchedTaskIds, ...ancestorIds]);
    return {
      visibleNodeIds: visible,
      forceExpandedIds: ancestorIds,
      isSearching: true,
    };
  }, [debouncedSearch, getChildren]);

  const rootChildren = getChildren(null);
  const hasResults =
    !isSearching || (visibleNodeIds && visibleNodeIds.size > 0);

  return (
    <div>
      <div className="relative mb-2">
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={t("schedulePanel.searchTasks")}
          className="w-full pl-7 pr-7 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
          autoFocus
        />
        {searchValue && (
          <button
            onClick={() => setSearchValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="max-h-32 overflow-y-auto border border-notion-border rounded-md">
        {hasResults ? (
          rootChildren.map((child) => (
            <TaskPickerNode
              key={child.id}
              node={child}
              depth={0}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              existingTaskIds={existingTaskIds}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              isSearching={isSearching}
              visibleNodeIds={visibleNodeIds}
              forceExpandedIds={forceExpandedIds}
              getChildren={getChildren}
            />
          ))
        ) : (
          <p className="text-xs text-notion-text-secondary text-center py-3">
            {t("schedulePanel.noTasksFound")}
          </p>
        )}
      </div>
    </div>
  );
}
