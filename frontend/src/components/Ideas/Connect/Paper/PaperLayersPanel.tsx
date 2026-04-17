import { useCallback, useMemo, useState, useRef, useEffect, memo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
  Frame,
  Type,
  StickyNote,
  GripVertical,
  Trash2,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import type { PaperNode } from "../../../../types/paperBoard";
import {
  usePaperLayersDnd,
  LayerDragOverStoreContext,
} from "../../../../hooks/usePaperLayersDnd";
import { usePaperLayerDragIndicator } from "../../../../hooks/usePaperLayerDragIndicator";

interface PaperLayersPanelProps {
  nodes: PaperNode[];
  selectedNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
  onBulkUpdateLayerOrder: (
    zIndexUpdates: Array<{
      id: string;
      zIndex: number;
      parentNodeId: string | null;
    }>,
    positionUpdates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ) => Promise<void>;
  onDeleteNode?: (id: string) => Promise<void>;
  onUpdateNode?: (
    id: string,
    updates: Partial<Pick<PaperNode, "label">>,
  ) => Promise<PaperNode>;
  onDuplicateNode?: (nodeId: string) => Promise<PaperNode | undefined>;
  onToggleHidden?: (nodeId: string) => Promise<void>;
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
  if (node.label) return node.label;
  if (node.nodeType === "frame") return node.frameLabel || "Frame";
  if (node.nodeType === "text") return node.textContent?.slice(0, 30) || "Text";
  return "Card";
}

// --- Draggable Layer Row ---

interface LayerRowProps {
  node: PaperNode;
  depth: number;
  isSelected: boolean;
  onSelectNode: (nodeId: string) => void;
  onDeleteNode?: (id: string) => Promise<void>;
  onUpdateNode?: (
    id: string,
    updates: Partial<Pick<PaperNode, "label">>,
  ) => Promise<PaperNode>;
  onDuplicateNode?: (nodeId: string) => Promise<PaperNode | undefined>;
  onToggleHidden?: (nodeId: string) => Promise<void>;
  renamingNodeId: string | null;
  onStartRename: (nodeId: string) => void;
  onFinishRename: (nodeId: string, value: string) => void;
  onCancelRename: () => void;
}

const LayerRow = memo(function LayerRow({
  node,
  depth,
  isSelected,
  onSelectNode,
  onDeleteNode,
  onDuplicateNode,
  onToggleHidden,
  renamingNodeId,
  onStartRename,
  onFinishRename,
  onCancelRename,
}: LayerRowProps) {
  const indicator = usePaperLayerDragIndicator(node.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [renameValue, setRenameValue] = useState("");
  const isRenaming = renamingNodeId === node.id;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: node.id });

  const { setNodeRef: setDropRef } = useDroppable({ id: node.id });

  // Combine drag + drop refs
  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef],
  );

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      setRenameValue(node.label || getNodeLabel(node));
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming, node]);

  const Icon = getNodeIcon(node.nodeType);
  const label = getNodeLabel(node);

  return (
    <div ref={combinedRef} className="relative">
      {/* Drop indicators */}
      {indicator === "above" && (
        <div className="absolute top-0 left-2 right-2 h-0.5 bg-notion-accent rounded z-10" />
      )}
      {indicator === "below" && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-notion-accent rounded z-10" />
      )}
      <div
        className={`group flex items-center gap-1 px-1 py-1 text-xs cursor-pointer rounded transition-colors ${
          isDragging
            ? "opacity-30"
            : indicator === "inside"
              ? "bg-notion-accent/20"
              : isSelected
                ? "bg-notion-accent/10 text-notion-accent"
                : node.hidden
                  ? "text-notion-text-secondary/50 hover:bg-notion-hover"
                  : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
        }`}
        style={{ paddingLeft: `${4 + depth * 16}px` }}
        onClick={() => onSelectNode(node.id)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartRename(node.id);
        }}
      >
        {/* Drag handle */}
        <button
          className="p-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 hover:!opacity-100 shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={10} />
        </button>

        <Icon size={12} className="shrink-0" />

        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onFinishRename(node.id, renameValue);
              } else if (e.key === "Escape") {
                onCancelRename();
              }
            }}
            onBlur={() => onFinishRename(node.id, renameValue)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent outline-none text-xs text-notion-text border-b border-notion-accent"
          />
        ) : (
          <span
            className={`truncate flex-1 ${node.hidden ? "line-through opacity-50" : ""}`}
          >
            {label}
          </span>
        )}

        {/* Action buttons */}
        {!isRenaming && (
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            {onToggleHidden && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(node.id);
                }}
                className="p-0.5 rounded hover:bg-notion-hover"
                title={node.hidden ? "Show" : "Hide"}
              >
                {node.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
            )}
            {onDuplicateNode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateNode(node.id);
                }}
                className="p-0.5 rounded hover:bg-notion-hover"
                title="Duplicate"
              >
                <Copy size={10} />
              </button>
            )}
            {onDeleteNode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNode(node.id);
                }}
                className="p-0.5 rounded hover:bg-notion-hover hover:text-red-500"
                title="Delete"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// --- Ghost node for DragOverlay ---
function LayerRowGhost({ node }: { node: PaperNode }) {
  const Icon = getNodeIcon(node.nodeType);
  const label = getNodeLabel(node);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-xs bg-notion-bg border border-notion-accent/30 rounded shadow-lg opacity-90">
      <GripVertical size={10} className="opacity-50" />
      <Icon size={12} />
      <span className="truncate">{label}</span>
    </div>
  );
}

// --- Main Panel ---
export function PaperLayersPanel({
  nodes,
  selectedNodeIds,
  onSelectNode,
  onBulkUpdateLayerOrder,
  onDeleteNode,
  onUpdateNode,
  onDuplicateNode,
  onToggleHidden,
}: PaperLayersPanelProps) {
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);

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

  const {
    sensors,
    activeNode,
    dragOverStore,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  } = usePaperLayersDnd({
    nodes,
    topLevel,
    childrenMap,
    bulkUpdateLayerOrder: onBulkUpdateLayerOrder,
  });

  const handleStartRename = useCallback((nodeId: string) => {
    setRenamingNodeId(nodeId);
  }, []);

  const handleFinishRename = useCallback(
    (nodeId: string, value: string) => {
      setRenamingNodeId(null);
      const trimmed = value.trim();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || !onUpdateNode) return;
      // Set label to null if it matches the default label (to revert to auto)
      const defaultLabel = getNodeLabel({ ...node, label: null });
      const newLabel =
        trimmed === "" || trimmed === defaultLabel ? null : trimmed;
      if (newLabel !== node.label) {
        onUpdateNode(nodeId, { label: newLabel });
      }
    },
    [nodes, onUpdateNode],
  );

  const handleCancelRename = useCallback(() => {
    setRenamingNodeId(null);
  }, []);

  const renderNode = (node: PaperNode, depth: number) => {
    const children = childrenMap.get(node.id);
    const isSelected = selectedNodeIds.includes(node.id);

    return (
      <div key={node.id}>
        <LayerRow
          node={node}
          depth={depth}
          isSelected={isSelected}
          onSelectNode={onSelectNode}
          onDeleteNode={onDeleteNode}
          onUpdateNode={onUpdateNode}
          onDuplicateNode={onDuplicateNode}
          onToggleHidden={onToggleHidden}
          renamingNodeId={renamingNodeId}
          onStartRename={handleStartRename}
          onFinishRename={handleFinishRename}
          onCancelRename={handleCancelRename}
        />
        {children && children.map((child) => renderNode(child, depth + 1))}
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd as (event: DragEndEvent) => void}
      onDragCancel={handleDragCancel}
    >
      <LayerDragOverStoreContext.Provider value={dragOverStore}>
        <div className="py-1">
          {topLevel.map((node) => renderNode(node, 0))}
        </div>
      </LayerDragOverStoreContext.Provider>

      <DragOverlay dropAnimation={null}>
        {activeNode ? <LayerRowGhost node={activeNode} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
