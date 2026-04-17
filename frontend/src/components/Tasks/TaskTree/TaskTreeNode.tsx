import { useState, useCallback, useMemo, memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext } from "@dnd-kit/sortable";
import { GripVertical, FolderCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../types/taskTree";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { useTimerContext } from "../../../hooks/useTimerContext";
import { useDragOverIndicator } from "../../../hooks/useDragOverIndicator";
import { resolveTaskColor } from "../../../utils/folderColor";

import { TaskNodeIndent } from "./TaskNodeIndent";
import { TaskNodeCheckbox } from "./TaskNodeCheckbox";
import { TaskStatusIcon } from "./TaskStatusIcon";
import { TaskNodeEditor } from "./TaskNodeEditor";
import { TaskNodeContent } from "./TaskNodeContent";
import { TaskNodeActions } from "./TaskNodeActions";
import { TaskNodeTimer, TaskNodeTimerBar } from "./TaskNodeTimer";
import { TaskNodeContextMenu } from "./TaskNodeContextMenu";

import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { CompletionToast } from "../../shared/CompletionToast";
import { computeFolderProgress } from "../../../utils/folderProgress";
import { fireTaskCompleteConfetti } from "../../../utils/confetti";
import { playEffectSound } from "../../../utils/playEffectSound";
import { sortTaskNodes } from "../../../utils/sortTaskNodes";
import type { SortMode } from "../../../utils/sortTaskNodes";

interface TaskTreeNodeProps {
  node: TaskNode;
  depth: number;
  isLastChild?: boolean;
  onPlayTask?: (node: TaskNode) => void;
  onSelectTask?: (id: string) => void;
  selectedTaskId?: string | null;
  sortMode?: SortMode;
  sortDirection?: "asc" | "desc";
  searchMatchIds?: Set<string>;
  isSearching?: boolean;
  activeTargetFolderId?: string | null;
  isCompletedItem?: boolean;
  completedFolderColor?: string;
  isStructureContainer?: boolean;
  completedTreeContainerIds?: Set<string>;
}

export const TaskTreeNode = memo(function TaskTreeNode({
  node,
  depth,
  isLastChild,
  onPlayTask,
  onSelectTask,
  selectedTaskId,
  sortMode = "manual",
  sortDirection = "asc",
  searchMatchIds,
  isSearching,
  activeTargetFolderId,
  isCompletedItem,
  completedFolderColor,
  isStructureContainer,
  completedTreeContainerIds,
}: TaskTreeNodeProps) {
  const {
    nodes,
    nodeMap,
    getChildren,
    updateNode,
    toggleExpanded,
    toggleTaskStatus,
    setTaskStatus,
    softDelete,
    addNode,
    moveToRoot,
    completeFolderWithChildren,
    uncompleteFolder,
  } = useTaskTreeContext();

  const timer = useTimerContext();
  const { t } = useTranslation();

  const [isEditing, setIsEditing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [completionToast, setCompletionToast] = useState<string | null>(null);

  // Subscribe to drag-over store — only re-renders when this node's indicator changes
  const dropPosition = useDragOverIndicator(node.id);

  const isFolder = node.type === "folder";
  const isSystemFolder = isFolder && node.folderType === "complete";
  const isInCompletedTree = isCompletedItem || isStructureContainer;

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: node.id,
    disabled: isCompletedItem || isStructureContainer || isSystemFolder,
  });

  const rawChildren = getChildren(node.id);
  const activeChildren = useMemo(() => {
    if (isInCompletedTree) {
      // In completed tree: show children that are part of the tree
      if (!completedTreeContainerIds) return [];
      const children = rawChildren.filter(
        (c) => c.status === "DONE" || completedTreeContainerIds.has(c.id),
      );
      return sortTaskNodes(children, sortMode, sortDirection);
    }
    // Include Complete system folders (they hold DONE tasks but aren't DONE themselves)
    const active = rawChildren.filter(
      (c) => c.status !== "DONE" || c.folderType === "complete",
    );
    const sorted = sortTaskNodes(active, sortMode, sortDirection);
    if (isSearching && searchMatchIds) {
      return sorted.filter((c) => searchMatchIds.has(c.id));
    }
    return sorted;
  }, [
    rawChildren,
    sortMode,
    sortDirection,
    isSearching,
    searchMatchIds,
    isInCompletedTree,
    completedTreeContainerIds,
  ]);

  const childIds = useMemo(
    () => activeChildren.map((c) => c.id),
    [activeChildren],
  );
  const isDone = node.type === "task" && node.status === "DONE";
  const isFolderDone = isFolder && node.status === "DONE";
  const isTimerActive = timer.activeTask?.id === node.id && timer.isRunning;
  const isSelected = selectedTaskId === node.id;
  const isCreateTarget = isFolder && activeTargetFolderId === node.id;

  const progress = useMemo(
    () => (isFolder ? computeFolderProgress(node.id, nodes) : undefined),
    [isFolder, node.id, nodes],
  );

  const inheritedColor = useMemo(
    () => (!isFolder ? resolveTaskColor(node.id, nodeMap) : undefined),
    [isFolder, node.id, nodeMap],
  );

  const transformStyle = useMemo(
    () => ({ opacity: isDragging ? 0 : 1 }),
    [isDragging],
  );

  const bgStyle = useMemo(
    () => ({
      ...(isFolder && node.color && !isSelected
        ? { backgroundColor: `${node.color}30` }
        : {}),
      ...(!isFolder && inheritedColor && !isSelected
        ? { backgroundColor: `${inheritedColor}18` }
        : {}),
      ...(isCompletedItem && completedFolderColor && !isSelected
        ? { backgroundColor: `${completedFolderColor}30` }
        : {}),
    }),
    [
      isFolder,
      node.color,
      isSelected,
      inheritedColor,
      isCompletedItem,
      completedFolderColor,
    ],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCompleteFolder = useCallback(() => {
    if (isFolderDone) {
      uncompleteFolder(node.id);
    } else {
      setShowConfirmDialog(true);
    }
  }, [isFolderDone, node.id, uncompleteFolder]);

  const handleConfirmComplete = useCallback(() => {
    completeFolderWithChildren(node.id);
    setShowConfirmDialog(false);
  }, [completeFolderWithChildren, node.id]);

  const handleToggleStatus = useCallback(() => {
    if (node.status === "IN_PROGRESS") {
      fireTaskCompleteConfetti();
      playEffectSound("/sounds/task_complete_sound.mp3", "taskComplete");
      setCompletionToast(t("taskTree.taskComplete", { name: node.title }));
    }
    toggleTaskStatus(node.id);
  }, [node.id, node.status, node.title, toggleTaskStatus, t]);

  const handleSetStatus = useCallback(
    (newStatus: import("../../../types/taskTree").TaskStatus) => {
      if (newStatus === "DONE" && node.status === "IN_PROGRESS") {
        fireTaskCompleteConfetti();
        playEffectSound("/sounds/task_complete_sound.mp3", "taskComplete");
        setCompletionToast(t("taskTree.taskComplete", { name: node.title }));
      }
      setTaskStatus(node.id, newStatus);
    },
    [node.id, node.status, node.title, setTaskStatus, t],
  );

  const handleToggleExpand = useCallback(
    () => toggleExpanded(node.id),
    [toggleExpanded, node.id],
  );

  const handleSave = useCallback(
    (value: string) => updateNode(node.id, { title: value }),
    [updateNode, node.id],
  );

  const handleCancelEdit = useCallback(() => setIsEditing(false), []);

  const handleStartEditing = useCallback(() => setIsEditing(true), []);

  const handleMakeFolder = useCallback(
    (n: TaskNode) => addNode("folder", n.id, t("taskTree.newFolderDefault")),
    [addNode, t],
  );

  const handleMakeTask = useCallback(
    (n: TaskNode) => addNode("task", n.id, t("taskTree.newTaskDefault")),
    [addNode, t],
  );

  const handleDelete = useCallback(
    () => softDelete(node.id),
    [softDelete, node.id],
  );

  // For structure containers: show as normal folder (not completed icon)
  const showAsCompleted = isCompletedItem && !isStructureContainer;

  return (
    <div>
      <div ref={setNodeRef} style={transformStyle} {...attributes}>
        {/* "above" drop indicator */}
        {dropPosition === "above" && !isDragging && !isInCompletedTree && (
          <div className="h-0.5 bg-notion-accent rounded-full mx-2" />
        )}

        {/* Content row */}
        <div
          data-sidebar-item
          data-sidebar-active={isSelected || undefined}
          className={`group flex items-center gap-0.5 py-1 rounded-md hover:bg-notion-hover transition-colors border-l-2 ${isSelected ? "bg-notion-hover border-l-notion-accent" : "border-l-transparent"} ${isFolder && dropPosition === "inside" && !isDragging && !isInCompletedTree ? "ring-2 ring-notion-accent bg-notion-accent/5" : ""} ${isDone || isFolderDone ? "opacity-60 hover:opacity-90" : ""} ${isCreateTarget && !isSelected ? "ring-1 ring-notion-accent/30" : ""}`}
          style={bgStyle}
          onClick={() => onSelectTask?.(node.id)}
          onContextMenu={
            isStructureContainer || isSystemFolder
              ? undefined
              : handleContextMenu
          }
        >
          {sortMode === "manual" &&
          !showAsCompleted &&
          !isStructureContainer &&
          !isSystemFolder ? (
            <button
              {...listeners}
              className="w-5.5 shrink-0 opacity-0 group-hover:opacity-100 p-0.5 cursor-grab text-notion-text-secondary"
            >
              <GripVertical size={18} />
            </button>
          ) : (
            <div className="w-5.5 shrink-0" />
          )}
          <TaskNodeIndent depth={depth} isLastChild={isLastChild} />
          {isSystemFolder ? (
            <button
              onClick={handleToggleExpand}
              className="shrink-0 p-0.5 text-green-500"
            >
              <FolderCheck size={16} />
            </button>
          ) : isFolder ? (
            <TaskNodeCheckbox
              isFolder={isFolder}
              isDone={isDone}
              isExpanded={node.isExpanded}
              isDragging={isDragging}
              color={node.color}
              isCompletedItem={showAsCompleted}
              onToggleExpand={handleToggleExpand}
              onToggleStatus={
                showAsCompleted ? handleCompleteFolder : handleToggleStatus
              }
            />
          ) : (
            <TaskStatusIcon
              status={
                (node.status as "NOT_STARTED" | "IN_PROGRESS" | "DONE") ??
                "NOT_STARTED"
              }
              onClick={handleToggleStatus}
              onSetStatus={handleSetStatus}
            />
          )}

          {isEditing && !isStructureContainer && !isSystemFolder ? (
            <TaskNodeEditor
              initialValue={node.title}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />
          ) : (
            <TaskNodeContent
              title={isSystemFolder ? t("taskTree.completeFolder") : node.title}
              isDone={isDone || isFolderDone}
              isFolder={isFolder}
              progress={progress}
              priority={node.priority}
              onSelectTask={
                isStructureContainer || isSystemFolder
                  ? undefined
                  : onSelectTask
              }
              onStartEditing={
                isStructureContainer || isSystemFolder
                  ? undefined
                  : handleStartEditing
              }
              onToggleExpand={handleToggleExpand}
              nodeId={node.id}
            />
          )}

          <TaskNodeTimer
            isActive={isTimerActive}
            remainingSeconds={timer.remainingSeconds}
            formatTime={timer.formatTime}
          />

          {!showAsCompleted && !isStructureContainer && !isSystemFolder && (
            <TaskNodeActions
              node={node}
              isDone={isDone}
              isTimerActive={isTimerActive}
              isFolderDone={isFolderDone}
              makeFolder={handleMakeFolder}
              makeTask={handleMakeTask}
              onPlayTask={onPlayTask}
              onDelete={handleDelete}
              onCompleteFolder={isFolder ? handleCompleteFolder : undefined}
            />
          )}
        </div>
      </div>

      {dropPosition === "below" && !isDragging && !isInCompletedTree && (
        <div className="h-0.5 bg-notion-accent rounded-full mx-2" />
      )}

      {contextMenu && !isStructureContainer && !isSystemFolder && (
        <TaskNodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isFolder={isFolder}
          isDone={isDone}
          isFolderDone={isFolderDone}
          hasParent={node.parentId !== null}
          onRename={handleStartEditing}
          onAddTask={() =>
            addNode("task", node.id, t("taskTree.newTaskDefault"))
          }
          onAddFolder={() =>
            addNode("folder", node.id, t("taskTree.newFolderDefault"))
          }
          onStartTimer={() => onPlayTask?.(node)}
          onMoveToRoot={() => moveToRoot(node.id)}
          onCompleteFolder={isFolder ? handleCompleteFolder : undefined}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
          hasSchedule={!!node.scheduledAt}
          reminderEnabled={!!node.reminderEnabled}
          onToggleReminder={
            node.scheduledAt
              ? () =>
                  updateNode(node.id, {
                    reminderEnabled: !node.reminderEnabled,
                  })
              : undefined
          }
        />
      )}

      {showConfirmDialog && (
        <ConfirmDialog
          message={t("taskTree.folderCompleteConfirm")}
          onConfirm={handleConfirmComplete}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

      {completionToast && (
        <CompletionToast
          taskName={completionToast}
          onDismiss={() => setCompletionToast(null)}
        />
      )}

      <TaskNodeTimerBar
        isActive={isTimerActive}
        progress={timer.progress}
        depth={depth}
      />

      {isFolder &&
        !isDragging &&
        (node.isExpanded || isSearching) &&
        (isInCompletedTree ? (
          // Completed tree: render children from the completed tree
          <div>
            {activeChildren.map((child, index) => (
              <TaskTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                isLastChild={index === activeChildren.length - 1}
                onSelectTask={onSelectTask}
                selectedTaskId={selectedTaskId}
                sortMode={sortMode}
                sortDirection={sortDirection}
                isCompletedItem={!completedTreeContainerIds?.has(child.id)}
                isStructureContainer={
                  completedTreeContainerIds?.has(child.id) ?? false
                }
                completedTreeContainerIds={completedTreeContainerIds}
                completedFolderColor={node.color || inheritedColor}
              />
            ))}
          </div>
        ) : (
          // Incomplete tree: existing logic (no completed sub-section)
          <SortableContext items={childIds}>
            <div>
              {activeChildren.map((child, index) => (
                <TaskTreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  isLastChild={index === activeChildren.length - 1}
                  onPlayTask={onPlayTask}
                  onSelectTask={onSelectTask}
                  selectedTaskId={selectedTaskId}
                  sortMode={sortMode}
                  sortDirection={sortDirection}
                  searchMatchIds={searchMatchIds}
                  isSearching={isSearching}
                  activeTargetFolderId={activeTargetFolderId}
                />
              ))}
            </div>
          </SortableContext>
        ))}
    </div>
  );
});
