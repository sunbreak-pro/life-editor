import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  pointerWithin,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  ListTree,
  CheckCircle2,
  Plus,
  Filter,
} from "lucide-react";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";

import { useTranslation } from "react-i18next";
import { useTaskTreeDnd } from "../../../hooks/useTaskTreeDnd";
import { useTaskTreeKeyboard } from "../../../hooks/useTaskTreeKeyboard";
import { TaskTreeNode } from "./TaskTreeNode";
import { InlineCreateInput } from "./InlineCreateInput";

import { FolderDropdown } from "../Folder/FolderDropdown";
import { SortDropdown } from "./SortDropdown";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useDebounce } from "../../../hooks/useDebounce";
import { flattenFolders } from "../../../utils/flattenFolders";
import { getDescendantTasks } from "../../../utils/getDescendantTasks";
import { getSearchMatchIds } from "../../../utils/filterTreeBySearch";
import { sortTaskNodes } from "../../../utils/sortTaskNodes";
import type { SortMode } from "../../../utils/sortTaskNodes";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import type { TaskNode } from "../../../types/taskTree";

interface TaskTreeProps {
  onPlayTask?: (node: TaskNode) => void;
  onSelectTask?: (id: string) => void;
  selectedTaskId?: string | null;
  filterFolderId?: string | null;
  onFilterChange?: (id: string | null) => void;
  searchQuery?: string;
}

function DroppableSection({
  id,
  children,
}: {
  id: string;
  children: (isOver: boolean) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef}>{children(isOver)}</div>;
}

export function TaskTree({
  onPlayTask,
  onSelectTask,
  selectedTaskId,
  filterFolderId: externalFilterFolderId,
  onFilterChange: externalOnFilterChange,
  searchQuery = "",
}: TaskTreeProps) {
  const {
    nodes,
    getChildren,
    addNode,
    moveNode,
    moveNodeInto,
    moveToRoot,
    toggleExpanded,
    toggleTaskStatus,
  } = useTaskTreeContext();

  const [showCompleted, setShowCompleted] = useState(false);
  const [isCreatingRootItem, setIsCreatingRootItem] = useState<
    "task" | "folder" | null
  >(null);
  const [internalFilterFolderId, setInternalFilterFolderId] = useLocalStorage<
    string | null
  >(STORAGE_KEYS.TASK_TREE_FOLDER_FILTER, null, {
    serialize: (v) => v ?? "",
    deserialize: (v) => v || null,
  });

  // Controlled mode: use external props if provided
  const isControlled = externalFilterFolderId !== undefined;
  const filterFolderId = isControlled
    ? externalFilterFolderId
    : internalFilterFolderId;
  const setFilterFolderId = useMemo(() => {
    if (isControlled && externalOnFilterChange) {
      return externalOnFilterChange;
    }
    return setInternalFilterFolderId;
  }, [isControlled, externalOnFilterChange, setInternalFilterFolderId]);
  const [sortMode, setSortMode] = useLocalStorage<SortMode>(
    STORAGE_KEYS.TASK_TREE_SORT_MODE,
    "manual",
  );

  // Reset filter if the folder no longer exists
  useEffect(() => {
    if (filterFolderId && !nodes.find((n) => n.id === filterFolderId)) {
      setFilterFolderId(null);
    }
  }, [filterFolderId, nodes, setFilterFolderId]);

  const debouncedQuery = useDebounce(searchQuery, 200);
  const searchMatchIds = useMemo(
    () => getSearchMatchIds(nodes, debouncedQuery),
    [nodes, debouncedQuery],
  );
  const isSearching = debouncedQuery.trim().length > 0;

  const {
    sensors,
    activeNode,
    overInfo,
    handleDragStart: rawHandleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useTaskTreeDnd({ nodes, moveNode, moveNodeInto, moveToRoot });

  const handleDragStart: typeof rawHandleDragStart = (event) => {
    if (isSearching) return;
    rawHandleDragStart(event);
  };

  const rootChildren = useMemo(() => getChildren(null), [getChildren]);
  const rootItems = useMemo(() => {
    let items: TaskNode[];
    if (!filterFolderId) {
      items = rootChildren.filter((n) => n.status !== "DONE");
    } else {
      const target = nodes.find((n) => n.id === filterFolderId);
      if (!target) {
        items = rootChildren.filter((n) => n.status !== "DONE");
      } else {
        items = target.status !== "DONE" ? [target] : [];
      }
    }
    if (isSearching) {
      items = items.filter((n) => searchMatchIds.has(n.id));
    }
    return sortTaskNodes(items, sortMode);
  }, [
    rootChildren,
    filterFolderId,
    nodes,
    sortMode,
    isSearching,
    searchMatchIds,
  ]);

  const completedRootTasks = useMemo(() => {
    let tasks: TaskNode[];
    if (!filterFolderId) {
      tasks = rootChildren.filter(
        (n) => n.type === "task" && n.status === "DONE",
      );
    } else {
      const descendants = getDescendantTasks(filterFolderId, nodes);
      tasks = descendants.filter(
        (n) => n.type === "task" && n.status === "DONE",
      );
    }
    if (isSearching) {
      tasks = tasks.filter((n) => searchMatchIds.has(n.id));
    }
    return tasks;
  }, [rootChildren, filterFolderId, nodes, isSearching, searchMatchIds]);

  const completedFolders = useMemo(() => {
    if (filterFolderId) return [];
    let result = rootChildren.filter(
      (n) => n.type === "folder" && n.status === "DONE",
    );
    if (isSearching) {
      result = result.filter((n) => searchMatchIds.has(n.id));
    }
    return result;
  }, [rootChildren, filterFolderId, isSearching, searchMatchIds]);
  const hasCompleted =
    completedRootTasks.length > 0 || completedFolders.length > 0;

  const rootItemIds = useMemo(() => rootItems.map((n) => n.id), [rootItems]);

  const visibleNodes = useMemo(() => {
    const result: TaskNode[] = [];
    const addVisible = (list: TaskNode[]) => {
      for (const node of list) {
        result.push(node);
        if (node.type === "folder" && (node.isExpanded || isSearching)) {
          const children = getChildren(node.id);
          const filtered = isSearching
            ? children.filter((c) => searchMatchIds.has(c.id))
            : children;
          addVisible(filtered);
        }
      }
    };
    addVisible(rootItems);
    return result;
  }, [rootItems, getChildren, isSearching, searchMatchIds]);

  const { t } = useTranslation();

  const filterFolderLabel = useMemo(() => {
    if (!filterFolderId) return t("folderFilter.all");
    const flat = flattenFolders(nodes);
    return (
      flat.find((f) => f.id === filterFolderId)?.title ?? t("folderFilter.all")
    );
  }, [filterFolderId, nodes, t]);

  useTaskTreeKeyboard({
    selectedTaskId: selectedTaskId ?? null,
    visibleNodes,
    nodes,
    onSelectTask,
    toggleExpanded,
    toggleTaskStatus,
    moveNodeInto,
    moveToRoot,
  });

  return (
    <div
      className={`space-y-1 ${isControlled ? "max-w-3xl mx-auto px-4" : ""}`}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Root Section */}
        <DroppableSection id="droppable-root-section">
          {(isOver) => (
            <div>
              <div
                className={`flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-notion-text-secondary rounded-md transition-colors ${
                  isOver
                    ? "bg-notion-accent/10 ring-1 ring-notion-accent/30"
                    : ""
                }`}
              >
                <ListTree size={14} />
                <div className="flex-row flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    {t("taskTree.title")}
                    <FolderDropdown
                      selectedId={filterFolderId}
                      onSelect={setFilterFolderId}
                      rootLabel={t("folderFilter.all")}
                      trigger={
                        <button
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                            filterFolderId
                              ? "bg-notion-accent/10 text-notion-accent"
                              : "text-notion-text-secondary hover:text-notion-text"
                          }`}
                          title={t("folderFilter.filterByFolder")}
                        >
                          <Filter size={10} />
                          <span className="max-w-20 truncate">
                            {filterFolderLabel}
                          </span>
                          <ChevronDown size={10} />
                        </button>
                      }
                    />
                    <SortDropdown
                      sortMode={sortMode}
                      onSortChange={setSortMode}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCreatingRootItem("task");
                      }}
                      className="hover:text-notion-text transition-colors"
                      title={t("taskTree.newTask")}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <SortableContext items={rootItemIds}>
                <div className="space-y-0.5">
                  {rootItems.map((node) => (
                    <TaskTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      onPlayTask={onPlayTask}
                      onSelectTask={onSelectTask}
                      selectedTaskId={selectedTaskId}
                      sortMode={sortMode}
                      overInfo={overInfo}
                      searchMatchIds={isSearching ? searchMatchIds : undefined}
                      isSearching={isSearching}
                    />
                  ))}
                </div>
              </SortableContext>
              {isCreatingRootItem && (
                <InlineCreateInput
                  placeholder={
                    isCreatingRootItem === "task"
                      ? t("taskTree.newTask")
                      : t("taskTree.newFolder")
                  }
                  onSubmit={(title) => addNode(isCreatingRootItem, null, title)}
                  onCancel={() => setIsCreatingRootItem(null)}
                />
              )}
            </div>
          )}
        </DroppableSection>

        <DragOverlay>
          {activeNode ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-notion-bg border border-notion-border shadow-lg text-[15px] text-notion-text opacity-50">
              <GripVertical size={14} className="text-notion-text-secondary" />
              <span>{activeNode.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isSearching &&
        visibleNodes.length === 0 &&
        completedRootTasks.length === 0 &&
        completedFolders.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-notion-text-secondary">
            {t("search.noResults")}
          </div>
        )}

      {hasCompleted && (
        <div className="pt-2 border-t border-notion-border">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-xs text-notion-text-secondary hover:text-notion-text mb-1 px-2"
          >
            {showCompleted || isSearching ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            <CheckCircle2 size={14} />
            <span>
              {t("taskTree.completed")} (
              {completedRootTasks.length + completedFolders.length})
            </span>
          </button>
          {(showCompleted || isSearching) && (
            <div className="space-y-0.5">
              {completedRootTasks.map((task) => (
                <TaskTreeNode
                  key={task.id}
                  node={task}
                  depth={0}
                  onSelectTask={onSelectTask}
                  selectedTaskId={selectedTaskId}
                  sortMode={sortMode}
                  searchMatchIds={isSearching ? searchMatchIds : undefined}
                  isSearching={isSearching}
                />
              ))}
              {completedFolders.map((folder) => (
                <TaskTreeNode
                  key={folder.id}
                  node={folder}
                  depth={0}
                  onSelectTask={onSelectTask}
                  selectedTaskId={selectedTaskId}
                  sortMode={sortMode}
                  searchMatchIds={isSearching ? searchMatchIds : undefined}
                  isSearching={isSearching}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
