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
  FolderPlus,
} from "lucide-react";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";

import { useTranslation } from "react-i18next";
import {
  useTaskTreeDnd,
  DragOverStoreContext,
} from "../../../hooks/useTaskTreeDnd";
import { useTaskTreeKeyboard } from "../../../hooks/useTaskTreeKeyboard";
import { useToast } from "../../../context/ToastContext";
import type { MoveRejectionReason } from "../../../types/moveResult";
import { TaskTreeNode } from "./TaskTreeNode";
import { SearchResultList } from "./SearchResultList";
import { InlineCreateInput } from "./InlineCreateInput";

import { SortDropdown } from "./SortDropdown";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useDebounce } from "../../../hooks/useDebounce";

import {
  getSearchMatchIds,
  getDirectSearchMatches,
} from "../../../utils/filterTreeBySearch";
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

  const directMatches = useMemo(
    () => getDirectSearchMatches(nodes, debouncedQuery),
    [nodes, debouncedQuery],
  );

  const { t } = useTranslation();
  const { showToast } = useToast();

  const handleMoveRejected = useMemo(() => {
    const reasonToMessageKey: Partial<Record<MoveRejectionReason, string>> = {
      circular_reference: "taskTree.move.circularReference",
    };
    return (reason: MoveRejectionReason) => {
      const key = reasonToMessageKey[reason];
      if (key) {
        showToast("warning", t(key));
      }
    };
  }, [showToast, t]);

  const {
    sensors,
    activeNode,
    dragOverStore,
    handleDragStart: rawHandleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  } = useTaskTreeDnd({
    nodes,
    moveNode,
    moveNodeInto,
    moveToRoot,
    onMoveRejected: handleMoveRejected,
  });

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
    let tasks = rootChildren.filter(
      (n) => n.type === "task" && n.status === "DONE",
    );
    if (isSearching) {
      tasks = tasks.filter((n) => searchMatchIds.has(n.id));
    }
    return tasks;
  }, [rootChildren, isSearching, searchMatchIds]);

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

  const activeTargetFolderId = useMemo(() => {
    if (!selectedTaskId) return null;
    const selected = nodes.find((n) => n.id === selectedTaskId);
    if (!selected) return null;
    return selected.type === "folder"
      ? selected.id
      : (selected.parentId ?? null);
  }, [selectedTaskId, nodes]);

  const rootItemIds = useMemo(() => rootItems.map((n) => n.id), [rootItems]);

  const visibleNodes = useMemo(() => {
    if (isSearching) return directMatches;
    const result: TaskNode[] = [];
    const addVisible = (list: TaskNode[]) => {
      for (const node of list) {
        result.push(node);
        if (node.type === "folder" && node.isExpanded) {
          const children = getChildren(node.id);
          addVisible(children);
        }
      }
    };
    addVisible(rootItems);
    return result;
  }, [rootItems, getChildren, isSearching, directMatches]);

  useTaskTreeKeyboard({
    selectedTaskId: selectedTaskId ?? null,
    visibleNodes,
    nodes,
    onSelectTask,
    toggleExpanded,
    toggleTaskStatus,
    moveNodeInto,
    moveToRoot,
    onMoveRejected: handleMoveRejected,
  });

  return (
    <div
      className={`space-y-1 ${isControlled ? "max-w-3xl mx-auto px-4" : ""}`}
    >
      {isSearching ? (
        directMatches.length > 0 ? (
          <SearchResultList
            matchedNodes={directMatches}
            allNodes={nodes}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTaskId}
            onPlayTask={onPlayTask}
          />
        ) : (
          <div className="px-4 py-8 text-center text-sm text-notion-text-secondary">
            {t("search.noResults")}
          </div>
        )
      ) : (
        <>
          <DragOverStoreContext.Provider value={dragOverStore}>
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
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
                          <SortDropdown
                            sortMode={sortMode}
                            onSortChange={setSortMode}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCreatingRootItem("folder");
                            }}
                            className="hover:text-notion-text transition-colors"
                            title={t("taskTree.newFolder")}
                          >
                            <FolderPlus size={14} />
                          </button>
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
                            activeTargetFolderId={activeTargetFolderId}
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
                        onSubmit={(title) =>
                          addNode(
                            isCreatingRootItem!,
                            isCreatingRootItem === "folder"
                              ? (filterFolderId ?? null)
                              : null,
                            title,
                          )
                        }
                        onCancel={() => setIsCreatingRootItem(null)}
                      />
                    )}
                  </div>
                )}
              </DroppableSection>

              <DragOverlay>
                {activeNode ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-notion-bg border border-notion-border shadow-lg text-[15px] text-notion-text opacity-50">
                    <GripVertical
                      size={14}
                      className="text-notion-text-secondary"
                    />
                    <span>{activeNode.title}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </DragOverStoreContext.Provider>

          {hasCompleted && (
            <div className="pt-2 border-t border-notion-border">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-xs text-notion-text-secondary hover:text-notion-text mb-1 px-2"
              >
                {showCompleted ? (
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
              {showCompleted && (
                <div className="space-y-0.5">
                  {completedRootTasks.map((task) => (
                    <TaskTreeNode
                      key={task.id}
                      node={task}
                      depth={0}
                      onSelectTask={onSelectTask}
                      selectedTaskId={selectedTaskId}
                      sortMode={sortMode}
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
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
