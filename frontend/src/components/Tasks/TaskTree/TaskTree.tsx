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
  Inbox,
  FolderOpen,
  CheckCircle2,
  Plus,
  LucideFolderPlus,
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
import { flattenFolders } from "../../../utils/flattenFolders";
import { getDescendantTasks } from "../../../utils/getDescendantTasks";
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
    undo,
    redo,
  } = useTaskTreeContext();

  const [showCompleted, setShowCompleted] = useState(false);
  const [isCreatingInboxTask, setIsCreatingInboxTask] = useState(false);
  const [isCreatingProjectFolder, setIsCreatingProjectFolder] = useState(false);
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

  const {
    sensors,
    activeNode,
    overInfo,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useTaskTreeDnd({ nodes, moveNode, moveNodeInto, moveToRoot });

  const rootChildren = useMemo(() => getChildren(null), [getChildren]);
  const inboxTasks = useMemo(
    () =>
      sortTaskNodes(
        rootChildren.filter((n) => n.type === "task" && n.status !== "DONE"),
        sortMode,
      ),
    [rootChildren, sortMode],
  );
  const folders = useMemo(() => {
    if (!filterFolderId) {
      return rootChildren.filter(
        (n) => n.type === "folder" && n.status !== "DONE",
      );
    }
    const target = nodes.find((n) => n.id === filterFolderId);
    if (!target)
      return rootChildren.filter(
        (n) => n.type === "folder" && n.status !== "DONE",
      );
    return target.status !== "DONE" ? [target] : [];
  }, [rootChildren, filterFolderId, nodes]);

  const completedRootTasks = useMemo(() => {
    if (!filterFolderId) {
      return rootChildren.filter(
        (n) => n.type === "task" && n.status === "DONE",
      );
    }
    // When filtered, show completed tasks from the filtered folder's subtree
    const descendants = getDescendantTasks(filterFolderId, nodes);
    return descendants.filter((n) => n.type === "task" && n.status === "DONE");
  }, [rootChildren, filterFolderId, nodes]);

  const completedFolders = useMemo(() => {
    if (!filterFolderId) {
      return rootChildren.filter(
        (n) => n.type === "folder" && n.status === "DONE",
      );
    }
    return []; // Don't show completed folders when filtering
  }, [rootChildren, filterFolderId]);
  const hasCompleted =
    completedRootTasks.length > 0 || completedFolders.length > 0;

  const inboxIds = useMemo(() => inboxTasks.map((n) => n.id), [inboxTasks]);
  const folderIds = useMemo(() => folders.map((n) => n.id), [folders]);

  const visibleNodes = useMemo(() => {
    const result: TaskNode[] = [];
    const addVisible = (list: TaskNode[]) => {
      for (const node of list) {
        result.push(node);
        if (node.type === "folder" && node.isExpanded) {
          addVisible(getChildren(node.id));
        }
      }
    };
    addVisible(inboxTasks);
    addVisible(folders);
    return result;
  }, [inboxTasks, folders, getChildren]);

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
    undo,
    redo,
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
        {/* Inbox Section */}
        <DroppableSection id="droppable-inbox-section">
          {(isOver) => (
            <div>
              <div
                className={`flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-notion-text-secondary rounded-md transition-colors ${
                  isOver
                    ? "bg-notion-accent/10 ring-1 ring-notion-accent/30"
                    : ""
                }`}
              >
                <Inbox size={14} />
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    {t("taskTree.inbox")}{" "}
                    {inboxTasks.length > 0 && (
                      <div className="font-normal">({inboxTasks.length})</div>
                    )}
                    <SortDropdown
                      sortMode={sortMode}
                      onSortChange={setSortMode}
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingInboxTask(true);
                    }}
                    className="hover:text-notion-text transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <SortableContext items={inboxIds}>
                <div className="space-y-0.5">
                  {inboxTasks.map((node) => (
                    <TaskTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      onPlayTask={onPlayTask}
                      onSelectTask={onSelectTask}
                      selectedTaskId={selectedTaskId}
                      sortMode={sortMode}
                      overInfo={overInfo}
                    />
                  ))}
                </div>
              </SortableContext>
              {isCreatingInboxTask && (
                <InlineCreateInput
                  placeholder={t("taskTree.newTask")}
                  onSubmit={(title) => addNode("task", null, title)}
                  onCancel={() => setIsCreatingInboxTask(false)}
                />
              )}
            </div>
          )}
        </DroppableSection>

        <div className="border-t border-notion-border my-1" />

        {/* Projects Section */}
        <DroppableSection id="droppable-projects-section">
          {(isOver) => (
            <div>
              <div
                className={`flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-notion-text-secondary rounded-md transition-colors ${
                  isOver
                    ? "bg-notion-accent/10 ring-1 ring-notion-accent/30"
                    : ""
                }`}
              >
                <FolderOpen size={14} />
                <div className="flex-row flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    {t("taskTree.projects")}
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
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingProjectFolder(true);
                    }}
                    className="hover:text-notion-text transition-colors"
                  >
                    <LucideFolderPlus size={14} />
                  </button>
                </div>
              </div>
              <SortableContext items={folderIds}>
                <div>
                  {folders.map((node) => (
                    <TaskTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      onPlayTask={onPlayTask}
                      onSelectTask={onSelectTask}
                      selectedTaskId={selectedTaskId}
                      sortMode={sortMode}
                      overInfo={overInfo}
                    />
                  ))}
                </div>
              </SortableContext>
              {isCreatingProjectFolder && (
                <InlineCreateInput
                  placeholder={t("taskTree.newFolder")}
                  onSubmit={(title) => addNode("folder", null, title)}
                  onCancel={() => setIsCreatingProjectFolder(false)}
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
    </div>
  );
}
