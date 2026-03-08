import { useState, useCallback, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../types/taskTree";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { useTimerContext } from "../../../hooks/useTimerContext";
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
  overInfo?: { overId: string; position: "above" | "below" | "inside" } | null;
  searchMatchIds?: Set<string>;
  isSearching?: boolean;
}

export function TaskTreeNode({
  node,
  depth,
  isLastChild,
  onPlayTask,
  onSelectTask,
  selectedTaskId,
  sortMode = "manual",
  overInfo,
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

  const inheritedColor = !isFolder
    ? resolveTaskColor(node.id, nodes)
    : undefined;

  const transformStyle = {
    opacity: isDragging ? 0 : 1,
  };

  const bgStyle = {
    ...(isFolder && node.color && !isSelected
      ? { backgroundColor: `${node.color}30` }
      : {}),
    ...(!isFolder && inheritedColor && !isSelected
      ? { backgroundColor: `${inheritedColor}18` }
      : {}),
  };

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

  return (
    <div>
      <div ref={setNodeRef} style={transformStyle} {...attributes}>
        {/* "above" drop indicator */}
        {overInfo?.overId === node.id &&
          overInfo.position === "above" &&
          !isDragging && (
            <div className="h-0.5 bg-notion-accent rounded-full mx-2" />
          )}

        {/* Content row */}
        <div
          className={`group flex items-center gap-0.5 py-1 rounded-md hover:bg-notion-hover transition-colors border-l-2 ${isSelected ? "bg-notion-hover border-l-notion-accent" : "border-l-transparent"} ${isFolder && overInfo?.overId === node.id && overInfo.position === "inside" && !isDragging ? "ring-2 ring-notion-accent bg-notion-accent/5" : ""} ${isDone || isFolderDone ? "opacity-60 hover:opacity-90" : ""}`}
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
            color={node.color}
            onToggleExpand={() => toggleExpanded(node.id)}
            onToggleStatus={handleToggleStatus}
          />

          {isEditing ? (
            <TaskNodeEditor
              initialValue={node.title}
              onSave={(value) => {
                updateNode(node.id, { title: value });
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <TaskNodeContent
              title={node.title}
              isDone={isDone || isFolderDone}
              isFolder={isFolder}
              progress={progress}
              onSelectTask={onSelectTask}
              onStartEditing={() => setIsEditing(true)}
              onToggleExpand={() => toggleExpanded(node.id)}
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
            makeFolder={(node) =>
              addNode("folder", node.id, t("taskTree.newFolderDefault"))
            }
            makeTask={(node) =>
              addNode("task", node.id, t("taskTree.newTaskDefault"))
            }
            onPlayTask={onPlayTask}
            onDelete={() => softDelete(node.id)}
            onCompleteFolder={isFolder ? handleCompleteFolder : undefined}
          />
        </div>
      </div>

      {overInfo?.overId === node.id &&
        overInfo.position === "below" &&
        !isDragging && (
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
          onRename={() => setIsEditing(true)}
          onAddTask={() =>
            addNode("task", node.id, t("taskTree.newTaskDefault"))
          }
          onAddFolder={() =>
            addNode("folder", node.id, t("taskTree.newFolderDefault"))
          }
          onStartTimer={() => onPlayTask?.(node)}
          onMoveToRoot={() => moveToRoot(node.id)}
          onCompleteFolder={isFolder ? handleCompleteFolder : undefined}
          onDelete={() => softDelete(node.id)}
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

      {isFolder && (node.isExpanded || isSearching) && (
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
                overInfo={overInfo}
                searchMatchIds={searchMatchIds}
                isSearching={isSearching}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
