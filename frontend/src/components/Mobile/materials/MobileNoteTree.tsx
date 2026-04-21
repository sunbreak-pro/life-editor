import { memo } from "react";
import type { NoteNode } from "../../../types/note";
import { MobileNoteTreeItem } from "./MobileNoteTreeItem";

interface MobileNoteTreeProps {
  notes: NoteNode[];
  parentId: string | null;
  depth: number;
  expandedIds: Set<string>;
  onSelect: (node: NoteNode) => void;
  onToggleExpand: (id: string) => void;
  onLongPress: (node: NoteNode, anchor: { x: number; y: number }) => void;
  renderExtra?: (node: NoteNode) => React.ReactNode;
}

export const MobileNoteTree = memo(function MobileNoteTree({
  notes,
  parentId,
  depth,
  expandedIds,
  onSelect,
  onToggleExpand,
  onLongPress,
  renderExtra,
}: MobileNoteTreeProps) {
  const children = notes
    .filter((n) => n.parentId === parentId && !n.isDeleted)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  if (children.length === 0) return null;

  return (
    <ul>
      {children.map((node) => {
        const isExpanded = expandedIds.has(node.id);
        return (
          <div key={node.id}>
            <MobileNoteTreeItem
              node={node}
              depth={depth}
              isExpanded={isExpanded}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onLongPress={onLongPress}
              renderExtra={renderExtra}
            />
            {node.type === "folder" && isExpanded && (
              <MobileNoteTree
                notes={notes}
                parentId={node.id}
                depth={depth + 1}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                onLongPress={onLongPress}
                renderExtra={renderExtra}
              />
            )}
          </div>
        );
      })}
    </ul>
  );
});
