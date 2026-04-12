import { memo, useCallback, useRef, useState } from "react";
import { EditableTitle } from "../shared/EditableTitle";
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
import { renderIcon } from "../../utils/iconRenderer";
import { NoteNodeContextMenu } from "./NoteNodeContextMenu";
import { IconPicker } from "../common/IconPicker";

interface NoteTreeNodeProps {
  node: NoteNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onChangeIcon?: (id: string, icon: string | undefined) => void;
  onTogglePin?: (id: string) => void;
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
  onRename,
  onChangeIcon,
  onTogglePin,
}: NoteTreeNodeProps) {
  const dropPosition = useNoteDragOverIndicator(node.id);
  const isFolder = node.type === "folder";

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: node.id,
  });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleStartRename = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSaveRename = useCallback(
    (trimmed: string) => {
      if (trimmed !== node.title && onRename) {
        onRename(node.id, trimmed);
      }
      setIsEditing(false);
    },
    [node.id, node.title, onRename],
  );

  const handleCancelRename = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleOpenIconPicker = useCallback(() => {
    setShowIconPicker(true);
  }, []);

  const handleSelectIcon = useCallback(
    (iconName: string) => {
      onChangeIcon?.(node.id, iconName);
      setShowIconPicker(false);
    },
    [node.id, onChangeIcon],
  );

  const handleRemoveIcon = useCallback(() => {
    onChangeIcon?.(node.id, undefined);
    setShowIconPicker(false);
  }, [node.id, onChangeIcon]);

  const folderIcon = isFolder ? (
    node.icon ? (
      renderIcon(node.icon, {
        size: 14,
        className: "shrink-0 text-notion-text-secondary",
      })
    ) : (
      <Folder size={14} className="shrink-0 text-notion-text-secondary" />
    )
  ) : null;

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
        onContextMenu={handleContextMenu}
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
          <div ref={iconRef}>{folderIcon}</div>
        ) : node.isPinned ? (
          <Heart
            size={14}
            className="shrink-0 text-red-400"
            fill="currentColor"
          />
        ) : (
          <StickyNote size={14} className="shrink-0 text-yellow-500/70" />
        )}

        {/* Title or inline editor */}
        {isEditing ? (
          <EditableTitle
            value={node.title}
            onSave={handleSaveRename}
            onCancel={handleCancelRename}
            checkComposing
            className="flex-1 min-w-0 bg-transparent border-b border-notion-border outline-none text-[13px] text-notion-text px-0.5"
          />
        ) : (
          <span className="truncate flex-1 min-w-0">
            {node.title || "Untitled"}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        {!isEditing && (
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
        )}
      </div>

      {/* Drop indicator: below */}
      {dropPosition === "below" && !isDragging && (
        <div
          className="h-0.5 bg-notion-accent rounded-full mx-2"
          style={{ marginLeft: `${depth * 16 + 8}px` }}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <NoteNodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={node}
          onRename={handleStartRename}
          onChangeIcon={handleOpenIconPicker}
          onTogglePin={() => onTogglePin?.(node.id)}
          onDelete={() => onDelete?.(node.id)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Icon picker */}
      {showIconPicker && (
        <IconPicker
          value={node.icon}
          onSelect={handleSelectIcon}
          onClose={() => setShowIconPicker(false)}
          anchorRect={iconRef.current?.getBoundingClientRect() ?? null}
          onRemove={node.icon ? handleRemoveIcon : undefined}
        />
      )}
    </div>
  );
});
