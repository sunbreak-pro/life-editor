import { useCallback, useMemo } from "react";
import {
  Frame,
  Type,
  StickyNote,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronDown as ChevronDownFold,
} from "lucide-react";
import type { PaperNode } from "../../../../types/paperBoard";

interface PaperLayersPanelProps {
  nodes: PaperNode[];
  selectedNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
  onUpdateNodeZIndex: (id: string, zIndex: number) => void;
}

function getNodeIcon(nodeType: string) {
  switch (nodeType) {
    case "frame":
      return Frame;
    case "text":
      return Type;
    case "card":
      return StickyNote;
    default:
      return Type;
  }
}

function getNodeLabel(node: PaperNode): string {
  if (node.nodeType === "frame") return node.frameLabel || "Frame";
  if (node.nodeType === "text") return node.textContent?.slice(0, 30) || "Text";
  return "Card";
}

export function PaperLayersPanel({
  nodes,
  selectedNodeIds,
  onSelectNode,
  onUpdateNodeZIndex,
}: PaperLayersPanelProps) {
  // Build tree: top-level nodes (no parent) + children grouped by parent
  const { topLevel, childrenMap } = useMemo(() => {
    const childrenMap = new Map<string, PaperNode[]>();
    const topLevel: PaperNode[] = [];

    for (const node of nodes) {
      if (node.parentNodeId) {
        const siblings = childrenMap.get(node.parentNodeId) || [];
        siblings.push(node);
        childrenMap.set(node.parentNodeId, siblings);
      } else {
        topLevel.push(node);
      }
    }

    // Sort top-level by zIndex descending (highest on top = visual stacking)
    topLevel.sort((a, b) => b.zIndex - a.zIndex);
    // Sort children by zIndex descending
    for (const [, children] of childrenMap) {
      children.sort((a, b) => b.zIndex - a.zIndex);
    }

    return { topLevel, childrenMap };
  }, [nodes]);

  const handleMoveUp = useCallback(
    (nodeId: string, siblings: PaperNode[]) => {
      const idx = siblings.findIndex((n) => n.id === nodeId);
      if (idx <= 0) return;
      // Swap zIndex with the one above (which has higher zIndex since sorted desc)
      const current = siblings[idx];
      const above = siblings[idx - 1];
      onUpdateNodeZIndex(current.id, above.zIndex);
      onUpdateNodeZIndex(above.id, current.zIndex);
    },
    [onUpdateNodeZIndex],
  );

  const handleMoveDown = useCallback(
    (nodeId: string, siblings: PaperNode[]) => {
      const idx = siblings.findIndex((n) => n.id === nodeId);
      if (idx < 0 || idx >= siblings.length - 1) return;
      const current = siblings[idx];
      const below = siblings[idx + 1];
      onUpdateNodeZIndex(current.id, below.zIndex);
      onUpdateNodeZIndex(below.id, current.zIndex);
    },
    [onUpdateNodeZIndex],
  );

  const renderNode = (
    node: PaperNode,
    siblings: PaperNode[],
    depth: number,
  ) => {
    const Icon = getNodeIcon(node.nodeType);
    const label = getNodeLabel(node);
    const isSelected = selectedNodeIds.includes(node.id);
    const children = childrenMap.get(node.id);
    const idx = siblings.findIndex((n) => n.id === node.id);

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer rounded transition-colors ${
            isSelected
              ? "bg-notion-accent/10 text-notion-accent"
              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => onSelectNode(node.id)}
        >
          {children && children.length > 0 ? (
            <ChevronDownFold size={10} className="shrink-0 opacity-50" />
          ) : depth > 0 ? (
            <span className="w-2.5" />
          ) : null}
          <Icon size={12} className="shrink-0" />
          <span className="truncate flex-1">{label}</span>
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMoveUp(node.id, siblings);
              }}
              disabled={idx === 0}
              className="p-0.5 rounded hover:bg-notion-hover disabled:opacity-20"
              title="Move up"
            >
              <ChevronUp size={10} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMoveDown(node.id, siblings);
              }}
              disabled={idx === siblings.length - 1}
              className="p-0.5 rounded hover:bg-notion-hover disabled:opacity-20"
              title="Move down"
            >
              <ChevronDown size={10} />
            </button>
          </div>
        </div>
        {children &&
          children.map((child) => renderNode(child, children, depth + 1))}
      </div>
    );
  };

  if (nodes.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-notion-text-secondary">
        No elements
      </div>
    );
  }

  return (
    <div className="py-1">
      {topLevel.map((node) => renderNode(node, topLevel, 0))}
    </div>
  );
}
