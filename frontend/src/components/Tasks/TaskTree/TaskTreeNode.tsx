import { useState, useCallback, useMemo, memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../types/taskTree";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { useTimerContext } from "../../../hooks/useTimerContext";
import { useDragOverIndicator } from "../../../hooks/useDragOverIndicator";
import { resolveTaskColor } from "../../../utils/folderColor";

import { TaskNodeIndent } from "./TaskNodeIndent";
import { TaskNodeCheckbox } from "./TaskNodeCheckbox";
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
  searchMatchIds?: Set<string>;
  isSearching?: boolean;
}

export const TaskTreeNode = memo(function TaskTreeNode({
  node,
  depth,
  isLastChild,
  onPlayTask,
  onSelectTask,
  selectedTaskId,
  sortMode = "manual",
  searchMatchIds,
  isSearching,
}: TaskTreeNodeProps) {
  const {
    nodes,
    getChildren,
    updateNode,
    toggleExpanded,
    toggleTaskStatus,
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

  // Step 1: Subscribe to drag-over store — only re-renders when this node's indicator changes
  const dropPosition = useDragOverIndicator(node.id);

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: node.id,
  });

  const rawChildren = getChildren(node.id);
  const children = useMemo(() => {
    const sorted = sortTaskNodes(rawChildren, sortMode);
    if (isSearching && searchMatchIds) {
      return sorted.filter((c) => searchMatchIds.has(c.id));
    }
    return sorted;
  }, [rawChildren, sortMode, isSearching, searchMatchIds]);
  const childIds = useMemo(() => children.map((c) => c.id), [children]);
  const isFolder = node.type === "folder";
  const isDone = node.type === "task" && node.status === "DONE";
  const isFolderDone = isFolder && node.status === "DONE";
  const isTimerActive = timer.activeTask?.id === node.id && timer.isRunning;
  const isSelected = selectedTaskId === node.id;

  const progress = useMemo(
    () => (isFolder ? computeFolderProgress(node.id, nodes) : undefined),
    [isFolder, node.id, nodes],
  );

  // Step 4: Memoize resolveTaskColor
  const inheritedColor = useMemo(
    () => (!isFolder ? resolveTaskColor(node.id, nodes) : undefined),
    [isFolder, node.id, nodes],
  );

  // Step 4: Memoize style objects
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
    }),
    [isFolder, node.color, isSelected, inheritedColor],
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
    if (node.status !== "DONE") {
      fireTaskCompleteConfetti();
      playEffectSound("/sounds/task_complete_sound.mp3");
      setCompletionToast(t("taskTree.taskComplete", { name: node.title }));
    }
    toggleTaskStatus(node.id);
  }, [node.id, node.status, node.title, toggleTaskStatus, t]);

  // Step 3: Stabilize inline callbacks with useCallback
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

  return (
    <div>
      <div ref={setNodeRef} style={transformStyle} {...attributes}>
        {/* "above" drop indicator */}
        {dropPosition === "above" && !isDragging && (
          <div className="h-0.5 bg-notion-accent rounded-full mx-2" />
        )}

        {/* Content row */}
        <div
          className={`group flex items-center gap-0.5 py-1 rounded-md hover:bg-notion-hover transition-colors border-l-2 ${isSelected ? "bg-notion-hover border-l-notion-accent" : "border-l-transparent"} ${isFolder && dropPosition === "inside" && !isDragging ? "ring-2 ring-notion-accent bg-notion-accent/5" : ""} ${isDone || isFolderDone ? "opacity-60 hover:opacity-90" : ""}`}
          style={bgStyle}
          onContextMenu={handleContextMenu}
        >
          {sortMode === "manual" ? (
            <button
              {...listeners}
              className="opacity-0 group-hover:opacity-100 p-0.5 cursor-grab text-notion-text-secondary"
            >
              <GripVertical size={18} />
            </button>
          ) : (
            <div className="w-5.5 shrink-0" />
          )}
          <TaskNodeIndent depth={depth} isLastChild={isLastChild} />
          <TaskNodeCheckbox
            isFolder={isFolder}
            isDone={isDone}
            isExpanded={node.isExpanded}
            isDragging={isDragging}
            color={node.color}
            onToggleExpand={handleToggleExpand}
            onToggleStatus={handleToggleStatus}
          />

          {isEditing ? (
            <TaskNodeEditor
              initialValue={node.title}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />
          ) : (
            <TaskNodeContent
              title={node.title}
              isDone={isDone || isFolderDone}
              isFolder={isFolder}
              progress={progress}
              onSelectTask={onSelectTask}
              onStartEditing={handleStartEditing}
              onToggleExpand={handleToggleExpand}
              nodeId={node.id}
            />
          )}

          <TaskNodeTimer
            isActive={isTimerActive}
            remainingSeconds={timer.remainingSeconds}
            formatTime={timer.formatTime}
          />

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
        </div>
      </div>

      {dropPosition === "below" && !isDragging && (
        <div className="h-0.5 bg-notion-accent rounded-full mx-2" />
      )}

      {contextMenu && (
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

      {isFolder && !isDragging && (node.isExpanded || isSearching) && (
        <SortableContext items={childIds}>
          <div>
            {children.map((child, index) => (
              <TaskTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                isLastChild={index === children.length - 1}
                onPlayTask={onPlayTask}
                onSelectTask={onSelectTask}
                selectedTaskId={selectedTaskId}
                sortMode={sortMode}
                searchMatchIds={searchMatchIds}
                isSearching={isSearching}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
});
