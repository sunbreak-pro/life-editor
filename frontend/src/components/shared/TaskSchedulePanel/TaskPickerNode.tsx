import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Circle,
  Clock,
} from "lucide-react";
import type { TaskNode } from "../../../types/taskTree";

interface TaskPickerNodeProps {
  node: TaskNode;
  depth: number;
  selectedTaskId: string | null;
  onSelectTask: (task: TaskNode) => void;
  existingTaskIds?: Set<string>;
  expandedIds: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  isSearching: boolean;
  visibleNodeIds?: Set<string>;
  forceExpandedIds?: Set<string>;
  getChildren: (parentId: string | null) => TaskNode[];
}

export function TaskPickerNode({
  node,
  depth,
  selectedTaskId,
  onSelectTask,
  existingTaskIds,
  expandedIds,
  onToggleExpand,
  isSearching,
  visibleNodeIds,
  forceExpandedIds,
  getChildren,
}: TaskPickerNodeProps) {
  if (node.status === "DONE") return null;
  if (isSearching && visibleNodeIds && !visibleNodeIds.has(node.id))
    return null;

  const isFolder = node.type === "folder";
  const isExpanded = isSearching
    ? (forceExpandedIds?.has(node.id) ?? false)
    : (expandedIds[node.id] ?? false);
  const isSelected = !isFolder && selectedTaskId === node.id;
  const isScheduled = !isFolder && (existingTaskIds?.has(node.id) ?? false);
  const paddingLeft = 8 + depth * 16;

  const children = isFolder ? getChildren(node.id) : [];

  if (isFolder) {
    return (
      <>
        <button
          onClick={() => onToggleExpand(node.id)}
          className={`w-full text-left py-1 text-xs flex items-center gap-1 text-notion-text hover:bg-notion-hover transition-colors`}
          style={{ paddingLeft, paddingRight: 8 }}
        >
          {isExpanded ? (
            <ChevronDown
              size={12}
              className="shrink-0 text-notion-text-secondary"
            />
          ) : (
            <ChevronRight
              size={12}
              className="shrink-0 text-notion-text-secondary"
            />
          )}
          {node.color && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: node.color }}
            />
          )}
          {isExpanded ? (
            <FolderOpen
              size={12}
              className="shrink-0 text-notion-text-secondary"
            />
          ) : (
            <Folder size={12} className="shrink-0 text-notion-text-secondary" />
          )}
          <span className="truncate">{node.title}</span>
        </button>
        {isExpanded &&
          children.map((child) => (
            <TaskPickerNode
              key={child.id}
              node={child}
              depth={depth + 1}
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
          ))}
      </>
    );
  }

  return (
    <button
      onClick={() => onSelectTask(node)}
      className={`w-full text-left py-1 text-xs flex items-center gap-1.5 transition-colors ${
        isSelected
          ? "bg-notion-accent/10 text-notion-accent"
          : "text-notion-text hover:bg-notion-hover"
      }`}
      style={{ paddingLeft, paddingRight: 8 }}
    >
      <Circle
        size={10}
        className={`shrink-0 ${isSelected ? "text-notion-accent" : "text-notion-text-secondary"}`}
      />
      <span className="truncate">{node.title}</span>
      {isScheduled && (
        <Clock
          size={10}
          className="shrink-0 text-notion-text-secondary ml-auto"
        />
      )}
    </button>
  );
}
