import { memo, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  Folder,
  StickyNote,
  Heart,
  Trash2,
  Pencil,
} from "lucide-react";
import type { NoteNode } from "../../types/note";
import { useNoteDragOverIndicator } from "../../hooks/useNoteDragOverIndicator";

interface NoteTreeNodeProps {
  node: NoteNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export const NoteTreeNode = memo(function NoteTreeNode({
  node,
  depth,
  isExpanded,
  isSelected,
  onSelect,
  onToggleExpand,
  onDelete,
  onEdit,
}: NoteTreeNodeProps) {
  const dropPosition = useNoteDragOverIndicator(node.id);
  const isFolder = node.type === "folder";

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: node.id,
  });

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleExpand(node.id);
    } else {
      onSelect(node.id);
    }
  }, [isFolder, node.id, onSelect, onToggleExpand]);

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(node.id);
    },
    [node.id, onToggleExpand],
  );

  return (
    <div ref={setNodeRef} className="relative">
      {/* Drop indicator: above */}
      {dropPosition === "above" && !isDragging && (
        <div
          className="h-0.5 bg-notion-accent rounded-full mx-2"
          style={{ marginLeft: `${depth * 16 + 8}px` }}
        />
      )}

      <div
        onClick={handleClick}
        className={`
          group flex items-center gap-0.5 px-1 py-0.5 rounded-md cursor-pointer text-[13px]
          transition-colors duration-75
          ${isDragging ? "opacity-0" : ""}
          ${isSelected && !isFolder ? "bg-notion-accent/10 text-notion-accent" : "hover:bg-notion-hover text-notion-text"}
          ${isFolder && dropPosition === "inside" && !isDragging ? "ring-2 ring-notion-accent bg-notion-accent/5" : ""}
        `}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-notion-text-secondary"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>

        {/* Folder chevron or spacer */}
        {isFolder ? (
          <button
            onClick={handleChevronClick}
            className="shrink-0 text-notion-text-secondary hover:text-notion-text"
          >
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        ) : null}

        {/* Icon */}
        {isFolder ? (
          <Folder size={14} className="shrink-0 text-notion-text-secondary" />
        ) : node.isPinned ? (
          <Heart
            size={14}
            className="shrink-0 text-red-400"
            fill="currentColor"
          />
        ) : (
          <StickyNote size={14} className="shrink-0 text-yellow-500/70" />
        )}

        {/* Title */}
        <span className="truncate flex-1 min-w-0">
          {node.title || "Untitled"}
        </span>

        {/* Action buttons (visible on hover) */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          {onEdit && !isFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node.id);
              }}
              className="p-0.5 rounded hover:bg-notion-hover-strong text-notion-text-secondary"
            >
              <Pencil size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="p-0.5 rounded hover:bg-notion-hover-strong text-notion-text-secondary hover:text-red-400"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Drop indicator: below */}
      {dropPosition === "below" && !isDragging && (
        <div
          className="h-0.5 bg-notion-accent rounded-full mx-2"
          style={{ marginLeft: `${depth * 16 + 8}px` }}
        />
      )}
    </div>
  );
});
