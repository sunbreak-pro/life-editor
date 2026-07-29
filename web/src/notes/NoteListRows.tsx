import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Lock,
  Pin,
  Trash2,
} from "lucide-react";
import {
  TagHeadingIcon,
  tagGroupKey as groupKey,
  cn,
  type NoteNode,
  type NoteTagGroup,
  FOCUS_RING,
} from "@life-editor/shared";
import { tagDroppableId } from "./useNoteTagDnd";

/*
 * Desktop side-list rows for the Notes tab (extracted from NotesView.tsx —
 * hooks split, zero behavior change): the draggable note row and the droppable
 * tag heading. Both are presentational; the DnD wiring (sensors + handlers)
 * stays host-side in NotesView via useNoteTagDnd.
 */

// ---- Desktop draggable note row -------------------------------------------

export function DesktopNoteRow({
  node,
  dragId,
  selected,
  onSelect,
  onDelete,
  deleteLabel,
  dragHintLabel,
}: {
  node: NoteNode;
  dragId: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  deleteLabel: string;
  dragHintLabel: string;
}) {
  // dragId is group-scoped: the same note renders under every tag heading it
  // has, and @dnd-kit needs globally-unique draggable ids.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
  });

  return (
    // Grip removed (#312): the whole row is the drag activator now — press-drag
    // anywhere onto a tag heading assigns that tag. @dnd-kit's PointerSensor has
    // a 5px activation distance (useNoteTagDnd), so a plain click still falls
    // through to the inner select/delete buttons; only a >5px drag picks the row
    // up. `attributes`+`listeners` (tabIndex + keydown) make the row keyboard-
    // draggable, decoupled from the inner buttons' own Enter/click. We override
    // role back to "listitem" (attributes default it to "button") so the row
    // keeps the <ul> list semantics and the inner buttons aren't nested inside
    // an interactive role.
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-label={dragHintLabel}
      className={cn(
        "group relative flex cursor-grab items-center gap-2 rounded-lumen-md border px-2",
        "h-[36px] text-[13px]",
        isDragging && "opacity-40",
        selected
          ? "border-lumen-accent bg-lumen-accent-subtle"
          : "border-transparent hover:bg-lumen-hover",
        FOCUS_RING,
      )}
    >
      <FileText
        size={14}
        aria-hidden
        className={cn(
          "shrink-0",
          selected ? "text-lumen-accent" : "text-lumen-text-secondary",
        )}
      />

      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex flex-1 items-center gap-1.5 truncate text-left",
          FOCUS_RING,
        )}
      >
        <span
          className={cn(
            "truncate",
            node.isPinned ? "font-medium" : "",
            selected ? "text-lumen-accent" : "text-lumen-text",
          )}
        >
          {node.title || "(untitled)"}
        </span>
        {node.isPinned && (
          <Pin
            size={12}
            aria-label="Pinned"
            className="shrink-0 text-lumen-accent"
          />
        )}
        {node.hasPassword && (
          <Lock
            size={12}
            aria-label="Password protected"
            className="shrink-0 text-lumen-text-tertiary"
          />
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
        aria-label={`${deleteLabel}: ${node.title || "untitled"}`}
        className={cn(
          "shrink-0 text-lumen-text-tertiary opacity-0 transition-opacity",
          "hover:text-lumen-danger focus-visible:opacity-100 group-hover:opacity-100",
          FOCUS_RING,
        )}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}

// ---- Desktop droppable tag heading ----------------------------------------

export function DesktopTagHeading({
  group,
  collapsed,
  onToggle,
  collapseLabel,
  expandLabel,
}: {
  group: NoteTagGroup;
  collapsed: boolean;
  onToggle: (key: string) => void;
  collapseLabel: string;
  expandLabel: string;
}) {
  const isUntagged = group.tagId === null;
  // Untagged is a no-op drop target: disabled so it never becomes `over`.
  const { setNodeRef, isOver } = useDroppable({
    id: isUntagged ? "note-untagged-nodrop" : tagDroppableId(group.tagId!),
    disabled: isUntagged,
  });

  // Divider-style heading (#311): [tag icon] [color-band name] [count] ——rule.
  // The former chevron+dot+flat-name folder look is gone; the name sits in a
  // rounded color band (same tint math as TagPill) and a rule fills the row.
  const color = group.tagColor;
  const bandStyle = color
    ? { backgroundColor: `${color}22`, borderColor: `${color}66` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lumen-md",
        isOver && "bg-lumen-accent-subtle ring-1 ring-inset ring-lumen-accent",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(groupKey(group))}
        aria-expanded={!collapsed}
        aria-label={collapsed ? expandLabel : collapseLabel}
        className={cn(
          "flex w-full items-center gap-2 rounded-lumen-md px-1 py-1.5 text-left hover:bg-lumen-hover",
          FOCUS_RING,
        )}
      >
        <TagHeadingIcon icon={group.tagIcon} color={color} />
        <span
          className={cn(
            "min-w-0 shrink truncate rounded-full border px-2.5 py-0.5 text-[13px] font-semibold text-lumen-text",
            color ? "" : "border-lumen-border bg-lumen-bg-secondary",
          )}
          style={bandStyle}
        >
          {group.tagName}
        </span>
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-lumen-text-tertiary">
          {group.notes.length}
        </span>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-lumen-border" />
        {collapsed ? (
          <ChevronRight
            size={14}
            aria-hidden
            className="shrink-0 text-lumen-text-tertiary"
          />
        ) : (
          <ChevronDown
            size={14}
            aria-hidden
            className="shrink-0 text-lumen-text-tertiary"
          />
        )}
      </button>
    </div>
  );
}
