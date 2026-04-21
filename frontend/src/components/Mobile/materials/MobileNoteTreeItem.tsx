import {
  ChevronDown,
  ChevronRight,
  Folder,
  Heart,
  Lock,
  StickyNote,
} from "lucide-react";
import { memo, useRef } from "react";
import { useWikiTagsOptional } from "../../../hooks/useWikiTagsOptional";
import type { NoteNode } from "../../../types/note";

interface MobileNoteTreeItemProps {
  node: NoteNode;
  depth: number;
  isExpanded: boolean;
  onSelect: (node: NoteNode) => void;
  onToggleExpand: (id: string) => void;
  onLongPress: (node: NoteNode, anchor: { x: number; y: number }) => void;
  renderExtra?: (node: NoteNode) => React.ReactNode;
}

const LONG_PRESS_MS = 500;

export const MobileNoteTreeItem = memo(function MobileNoteTreeItem({
  node,
  depth,
  isExpanded,
  onSelect,
  onToggleExpand,
  onLongPress,
  renderExtra,
}: MobileNoteTreeItemProps) {
  const timerRef = useRef<number | null>(null);
  const anchorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggeredRef = useRef(false);
  const isFolder = node.type === "folder";
  const wikiCtx = useWikiTagsOptional();
  const tags = !isFolder && wikiCtx ? wikiCtx.getTagsForEntity(node.id) : [];
  const visibleTags = tags.slice(0, 2);
  const extraTagCount = Math.max(0, tags.length - visibleTags.length);

  const startLongPress = (x: number, y: number) => {
    anchorRef.current = { x, y };
    triggeredRef.current = false;
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      onLongPress(node, anchorRef.current);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = () => {
    if (triggeredRef.current) return;
    if (isFolder) {
      onToggleExpand(node.id);
    } else {
      onSelect(node);
    }
  };

  return (
    <li
      className="flex cursor-pointer items-center gap-2 border-b border-notion-border px-3 py-2.5 active:bg-notion-hover"
      style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
      onClick={handleClick}
      onTouchStart={(e) => {
        const t = e.touches[0];
        startLongPress(t.clientX, t.clientY);
      }}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") startLongPress(e.clientX, e.clientY);
      }}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(node, { x: e.clientX, y: e.clientY });
      }}
    >
      {isFolder ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-notion-text-secondary"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}

      <span className="shrink-0 text-notion-text-secondary">
        {isFolder ? <Folder size={16} /> : <StickyNote size={16} />}
      </span>

      <span className="flex-1 truncate text-sm text-notion-text-primary">
        {node.title || "Untitled"}
      </span>

      {visibleTags.map((tag) => (
        <span
          key={tag.id}
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
          style={{
            backgroundColor: tag.color + "22",
            color: tag.textColor || tag.color,
          }}
        >
          {tag.name}
        </span>
      ))}
      {extraTagCount > 0 && (
        <span className="shrink-0 text-[10px] text-notion-text-secondary">
          +{extraTagCount}
        </span>
      )}

      {node.hasPassword && (
        <Lock size={14} className="shrink-0 text-notion-text-secondary" />
      )}
      {node.isPinned && (
        <Heart size={14} className="shrink-0 fill-red-400 text-red-400" />
      )}
      {renderExtra?.(node)}
    </li>
  );
});
