import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../types/taskTree";
import { TaskNodeCheckbox } from "./TaskNodeCheckbox";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { getFolderTag } from "../../../utils/folderTag";
import { fireTaskCompleteConfetti } from "../../../utils/confetti";
import { playEffectSound } from "../../../utils/playEffectSound";

interface SearchResultListProps {
  matchedNodes: TaskNode[];
  allNodes: TaskNode[];
  onSelectTask?: (id: string) => void;
  selectedTaskId?: string | null;
  onPlayTask?: (node: TaskNode) => void;
}

const SearchResultItem = memo(function SearchResultItem({
  node,
  allNodes,
  onSelectTask,
  isSelected,
}: {
  node: TaskNode;
  allNodes: TaskNode[];
  onSelectTask?: (id: string) => void;
  isSelected: boolean;
}) {
  const { t } = useTranslation();
  const { toggleTaskStatus, toggleExpanded } = useTaskTreeContext();

  const isFolder = node.type === "folder";
  const isDone = node.type === "task" && node.status === "DONE";
  const folderPath = getFolderTag(node.id, allNodes);
  const breadcrumb = folderPath
    ? folderPath.split("/").join(" > ")
    : t("search.rootLevel");

  const handleToggleStatus = useCallback(() => {
    if (node.status !== "DONE") {
      fireTaskCompleteConfetti();
      playEffectSound("/sounds/task_complete_sound.mp3");
    }
    toggleTaskStatus(node.id);
  }, [node.id, node.status, toggleTaskStatus]);

  const handleToggleExpand = useCallback(
    () => toggleExpanded(node.id),
    [toggleExpanded, node.id],
  );

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-notion-hover transition-colors cursor-pointer border-l-2 ${
        isSelected
          ? "bg-notion-hover border-l-notion-accent"
          : "border-l-transparent"
      } ${isDone ? "opacity-60 hover:opacity-90" : ""}`}
      onClick={() => onSelectTask?.(node.id)}
    >
      <TaskNodeCheckbox
        isFolder={isFolder}
        isDone={isDone}
        isExpanded={node.isExpanded}
        color={node.color}
        onToggleExpand={handleToggleExpand}
        onToggleStatus={handleToggleStatus}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm truncate ${isDone ? "line-through text-notion-text-secondary" : "text-notion-text"}`}
        >
          {node.title}
        </div>
        <div className="text-xs text-notion-text-secondary truncate">
          {breadcrumb}
        </div>
      </div>
    </div>
  );
});

export const SearchResultList = memo(function SearchResultList({
  matchedNodes,
  allNodes,
  onSelectTask,
  selectedTaskId,
}: SearchResultListProps) {
  return (
    <div className="space-y-0.5">
      {matchedNodes.map((node) => (
        <SearchResultItem
          key={node.id}
          node={node}
          allNodes={allNodes}
          onSelectTask={onSelectTask}
          isSelected={selectedTaskId === node.id}
        />
      ))}
    </div>
  );
});
