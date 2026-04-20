import { useCallback, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Panel,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type NodeTypes,
  type EdgeTypes,
  type Viewport,
  BackgroundVariant,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { PaperCardNode, type PaperCardData } from "./PaperCardNode";
import { PaperTextNode, type PaperTextData } from "./PaperTextNode";
import { PaperFrameNode, type PaperFrameData } from "./PaperFrameNode";
import { PaperCustomEdge } from "./PaperCustomEdge";
import { PaperToolbar } from "./PaperToolbar";
import { PaperAddItemDialog } from "./PaperAddItemDialog";
import type {
  PaperNode as PaperNodeDB,
  PaperEdge as PaperEdgeDB,
  PaperBoard,
} from "../../../../types/paperBoard";
import type { NoteNode } from "../../../../types/note";
import type { MemoNode } from "../../../../types/memo";
import { formatDisplayDate } from "../../../../utils/dateKey";
import { getContentPreview } from "../../../../utils/tiptapText";
import { CanvasControls } from "../CanvasControls";
import { useEffect } from "react";

const nodeTypes: NodeTypes = {
  paperCard: PaperCardNode as any,
  paperText: PaperTextNode as any,
  paperFrame: PaperFrameNode as any,
};

const edgeTypes: EdgeTypes = {
  paperEdge: PaperCustomEdge as any,
};

// In ConnectionMode.Loose, users can start a drag from a target-type handle
// (e.g. "top-target"), which React Flow stores as the edge's sourceHandle.
// React Flow's source handle lookup only searches source-type handles, so
// such edges trigger an "error008" warning at render time. Swap source/target
// when sourceHandle is a -target handle so the source side always points to a
// real source-type handle.
function normalizeEdgeHandles<
  T extends {
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle: string | null | undefined;
    targetHandle: string | null | undefined;
  },
>(edge: T): T {
  const sh = edge.sourceHandle;
  const th = edge.targetHandle;
  const sourceIsTarget = !!sh && sh.endsWith("-target");
  const targetIsSource = !!th && th.endsWith("-source");
  if (!sourceIsTarget && !targetIsSource) return edge;
  return {
    ...edge,
    sourceNodeId: edge.targetNodeId,
    targetNodeId: edge.sourceNodeId,
    sourceHandle: th,
    targetHandle: sh,
  };
}

interface PaperCanvasViewProps {
  board: PaperBoard | null;
  paperNodes: PaperNodeDB[];
  paperEdges: PaperEdgeDB[];
  notes: NoteNode[];
  memos: MemoNode[];
  onCreateNode: (params: {
    boardId: string;
    nodeType: "card" | "text" | "frame";
    positionX: number;
    positionY: number;
    width?: number;
    height?: number;
    zIndex?: number;
    parentNodeId?: string | null;
    refEntityId?: string | null;
    refEntityType?: string | null;
    textContent?: string | null;
    frameColor?: string | null;
    frameLabel?: string | null;
  }) => Promise<PaperNodeDB>;
  onUpdateNode: (
    id: string,
    updates: Partial<
      Pick<
        PaperNodeDB,
        | "positionX"
        | "positionY"
        | "width"
        | "height"
        | "zIndex"
        | "parentNodeId"
        | "textContent"
        | "frameColor"
        | "frameLabel"
      >
    >,
  ) => Promise<PaperNodeDB>;
  onBulkUpdatePositions: (
    updates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ) => Promise<void>;
  onDeleteNode: (id: string) => Promise<void>;
  onCreateEdge: (params: {
    boardId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => Promise<PaperEdgeDB>;
  onDeleteEdge: (id: string) => Promise<void>;
  onSaveViewport: (x: number, y: number, zoom: number) => void;
  onNavigateToNote?: (noteId: string) => void;
  onSelectionChanged?: (nodeIds: string[]) => void;
}

export function PaperCanvasView({
  board,
  paperNodes,
  paperEdges,
  notes,
  memos,
  onCreateNode,
  onUpdateNode,
  onBulkUpdatePositions,
  onDeleteNode,
  onCreateEdge,
  onDeleteEdge,
  onSaveViewport,
  onNavigateToNote,
  onSelectionChanged,
}: PaperCanvasViewProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const { screenToFlowPosition } = useReactFlow();

  // Build note/memo lookup
  const noteMap = useMemo(() => {
    const m = new Map<string, NoteNode>();
    for (const n of notes) m.set(n.id, n);
    return m;
  }, [notes]);

  const memoMap = useMemo(() => {
    const m = new Map<string, MemoNode>();
    for (const memo of memos) m.set(memo.id, memo);
    return m;
  }, [memos]);

  // Existing ref entity IDs
  const existingRefIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of paperNodes) {
      if (n.refEntityId) set.add(n.refEntityId);
    }
    return set;
  }, [paperNodes]);

  // Handlers for node data callbacks
  const handleTextChange = useCallback(
    (nodeId: string, text: string) => {
      onUpdateNode(nodeId, { textContent: text });
    },
    [onUpdateNode],
  );

  const handleFrameLabelChange = useCallback(
    (nodeId: string, label: string) => {
      onUpdateNode(nodeId, { frameLabel: label });
    },
    [onUpdateNode],
  );

  const handleNodeResize = useCallback(
    (nodeId: string, width: number, height: number) => {
      onUpdateNode(nodeId, { width, height });
    },
    [onUpdateNode],
  );

  const handleFrameColorChange = useCallback(
    (nodeId: string, color: string) => {
      onUpdateNode(nodeId, { frameColor: color });
    },
    [onUpdateNode],
  );

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      onDeleteEdge(edgeId);
    },
    [onDeleteEdge],
  );

  // Convert DB nodes → ReactFlow nodes
  // ReactFlow requires parent nodes to appear before children in the array
  const rfNodes: Node[] = useMemo(() => {
    // Topological sort: parents must appear before children at any depth
    const nodeMap = new Map(paperNodes.map((pn) => [pn.id, pn]));
    const visited = new Set<string>();
    const sorted: PaperNodeDB[] = [];
    const visit = (pn: PaperNodeDB) => {
      if (visited.has(pn.id)) return;
      if (pn.parentNodeId && nodeMap.has(pn.parentNodeId)) {
        visit(nodeMap.get(pn.parentNodeId)!);
      }
      visited.add(pn.id);
      sorted.push(pn);
    };
    for (const pn of paperNodes) visit(pn);
    return sorted.map((pn) => {
      let data: Record<string, unknown> = {};
      let type = "paperCard";

      if (pn.nodeType === "card") {
        type = "paperCard";
        const note = pn.refEntityId ? noteMap.get(pn.refEntityId) : null;
        const memo = pn.refEntityId ? memoMap.get(pn.refEntityId) : null;
        const entity = note || memo;
        const isDeleted = pn.refEntityId ? !entity : false;
        data = {
          label: note
            ? note.title
            : memo
              ? formatDisplayDate(memo.date, lang)
              : "Unknown",
          contentPreview: note
            ? getContentPreview(note.content, 100)
            : memo
              ? getContentPreview(memo.content, 100)
              : "",
          refEntityId: pn.refEntityId,
          refEntityType: pn.refEntityType,
          deleted: isDeleted,
        } satisfies PaperCardData;
      } else if (pn.nodeType === "text") {
        type = "paperText";
        data = {
          textContent: pn.textContent || "",
          onTextChange: handleTextChange,
          onResize: handleNodeResize,
        } satisfies PaperTextData;
      } else if (pn.nodeType === "frame") {
        type = "paperFrame";
        data = {
          frameColor: pn.frameColor || "#e2e8f0",
          frameLabel: pn.frameLabel || "",
          onLabelChange: handleFrameLabelChange,
          onColorChange: handleFrameColorChange,
        } satisfies PaperFrameData;
      }

      const node: Node = {
        id: pn.id,
        type,
        position: { x: pn.positionX, y: pn.positionY },
        data,
        style: { width: pn.width, height: pn.height },
        zIndex: pn.zIndex,
        hidden: pn.hidden,
        dragHandle: undefined,
      };

      if (pn.parentNodeId) {
        node.parentId = pn.parentNodeId;
      }

      return node;
    });
  }, [
    paperNodes,
    noteMap,
    memoMap,
    handleTextChange,
    handleNodeResize,
    handleFrameLabelChange,
    handleFrameColorChange,
  ]);

  // Convert DB edges → ReactFlow edges
  const rfEdges: Edge[] = useMemo(() => {
    return paperEdges.map((pe) => {
      const normalized = normalizeEdgeHandles({
        sourceNodeId: pe.sourceNodeId,
        targetNodeId: pe.targetNodeId,
        sourceHandle: pe.sourceHandle,
        targetHandle: pe.targetHandle,
      });
      return {
        id: pe.id,
        source: normalized.sourceNodeId,
        target: normalized.targetNodeId,
        sourceHandle: normalized.sourceHandle || undefined,
        targetHandle: normalized.targetHandle || undefined,
        type: "paperEdge",
        data: { onDelete: handleEdgeDelete },
      };
    });
  }, [paperEdges, handleEdgeDelete]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(rfNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Keep flow state in sync with DB data
  useEffect(() => {
    setFlowNodes(rfNodes);
  }, [rfNodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(rfEdges);
  }, [rfEdges, setFlowEdges]);

  // --- Frame nesting helpers ---
  // Calculate the depth of a node by walking up the parent chain (root = 0)
  const getFrameDepth = useCallback(
    (nodeId: string | undefined, nodes: Node[]): number => {
      let depth = 0;
      let currentId = nodeId;
      while (currentId) {
        const parent = nodes.find((n) => n.id === currentId);
        if (!parent?.parentId) break;
        currentId = parent.parentId;
        depth++;
      }
      return depth;
    },
    [],
  );

  // Calculate the max subtree depth below a given node
  const getMaxSubtreeDepth = useCallback(
    (nodeId: string, nodes: Node[]): number => {
      const children = nodes.filter((n) => n.parentId === nodeId);
      if (children.length === 0) return 0;
      return (
        1 + Math.max(...children.map((c) => getMaxSubtreeDepth(c.id, nodes)))
      );
    },
    [],
  );

  // Check if targetId is a descendant of nodeId (to prevent circular nesting)
  const isDescendant = useCallback(
    (nodeId: string, targetId: string, nodes: Node[]): boolean => {
      const children = nodes.filter((n) => n.parentId === nodeId);
      for (const child of children) {
        if (child.id === targetId) return true;
        if (isDescendant(child.id, targetId, nodes)) return true;
      }
      return false;
    },
    [],
  );

  // Handle node drag stop → persist positions
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, nodes: Node[]) => {
      setIsDragging(false);

      // Pre-compute frame escape/grouping for the primary node
      // so we can include the correct position in the bulk update
      let overrideForNode: {
        positionX: number;
        positionY: number;
        parentNodeId: string | null;
      } | null = null;

      // Frame escape: check if child node was dragged outside its parent frame
      if (node.parentId) {
        const parentFrame = flowNodes.find((n) => n.id === node.parentId);
        if (parentFrame) {
          const fw = (parentFrame.style?.width as number) || 200;
          const fh = (parentFrame.style?.height as number) || 150;
          const escapeThreshold = 50;
          const outside =
            node.position.x < -escapeThreshold ||
            node.position.y < -escapeThreshold ||
            node.position.x > fw + escapeThreshold ||
            node.position.y > fh + escapeThreshold;
          if (outside) {
            overrideForNode = {
              positionX: parentFrame.position.x + node.position.x,
              positionY: parentFrame.position.y + node.position.y,
              parentNodeId: null,
            };
          }
        }
      }

      // Frame grouping: check if node was dropped onto a frame
      if (!node.parentId && !overrideForNode) {
        const frameNodes = flowNodes.filter((n) => n.type === "paperFrame");
        for (const frame of frameNodes) {
          // Skip self
          if (frame.id === node.id) continue;
          // Prevent circular nesting (can't drop into own descendant)
          if (
            node.type === "paperFrame" &&
            isDescendant(node.id, frame.id, flowNodes)
          )
            continue;

          const fw = (frame.style?.width as number) || 200;
          const fh = (frame.style?.height as number) || 150;
          if (
            node.position.x >= frame.position.x &&
            node.position.y >= frame.position.y &&
            node.position.x <= frame.position.x + fw &&
            node.position.y <= frame.position.y + fh
          ) {
            // Depth check for max 3 levels
            if (node.type === "paperFrame") {
              const targetDepth = getFrameDepth(frame.id, flowNodes) + 1;
              const subtreeDepth = getMaxSubtreeDepth(node.id, flowNodes);
              if (targetDepth + subtreeDepth > 2) continue; // 0-indexed: depth 2 = 3 levels
            }

            overrideForNode = {
              positionX: node.position.x - frame.position.x,
              positionY: node.position.y - frame.position.y,
              parentNodeId: frame.id,
            };
            break;
          }
        }
      }

      // Build bulk updates, applying override for the primary node
      const draggedNodes = nodes.length > 0 ? nodes : [node];
      const updates = draggedNodes.map((n) => {
        if (n.id === node.id && overrideForNode) {
          return { id: n.id, ...overrideForNode };
        }
        return {
          id: n.id,
          positionX: n.position.x,
          positionY: n.position.y,
          parentNodeId: (n.parentId as string) || null,
        };
      });
      onBulkUpdatePositions(updates);
    },
    [
      onBulkUpdatePositions,
      flowNodes,
      isDescendant,
      getFrameDepth,
      getMaxSubtreeDepth,
    ],
  );

  const handleNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Handle resize
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (
          change.type === "dimensions" &&
          change.dimensions &&
          change.resizing === false
        ) {
          onUpdateNode(change.id, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          });
        }
      }
    },
    [onNodesChange, onUpdateNode],
  );

  // Handle edge connection
  const handleConnect: OnConnect = useCallback(
    (connection) => {
      if (!board || !connection.source || !connection.target) return;
      const normalized = normalizeEdgeHandles({
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });
      onCreateEdge({
        boardId: board.id,
        sourceNodeId: normalized.sourceNodeId,
        targetNodeId: normalized.targetNodeId,
        sourceHandle: normalized.sourceHandle,
        targetHandle: normalized.targetHandle,
      });
    },
    [board, onCreateEdge],
  );

  // Handle viewport change → debounced save
  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      viewportTimerRef.current = setTimeout(() => {
        onSaveViewport(viewport.x, viewport.y, viewport.zoom);
      }, 500);
    },
    [onSaveViewport],
  );

  // Handle node delete
  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        onDeleteNode(node.id);
      }
    },
    [onDeleteNode],
  );

  // Handle double click on card → navigate to note
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "paperCard") {
        const cardData = node.data as PaperCardData;
        if (cardData.refEntityId && cardData.refEntityType === "note") {
          onNavigateToNote?.(cardData.refEntityId);
        }
      }
    },
    [onNavigateToNote],
  );

  // Get center position for new nodes
  const getNewNodePosition = useCallback(() => {
    try {
      return screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    } catch {
      return { x: 200, y: 200 };
    }
  }, [screenToFlowPosition]);

  // Add handlers
  const handleAddCard = useCallback(() => {
    setShowAddDialog(true);
  }, []);

  const handleAddText = useCallback(() => {
    if (!board) return;
    const pos = getNewNodePosition();
    onCreateNode({
      boardId: board.id,
      nodeType: "text",
      positionX: pos.x,
      positionY: pos.y,
      width: 120,
      height: 40,
      textContent: "",
    });
  }, [board, onCreateNode, getNewNodePosition]);

  const handleAddFrame = useCallback(() => {
    if (!board) return;
    const pos = getNewNodePosition();
    onCreateNode({
      boardId: board.id,
      nodeType: "frame",
      positionX: pos.x,
      positionY: pos.y,
      width: 400,
      height: 300,
      zIndex: -1,
      frameColor: "#e2e8f0",
      frameLabel: "Frame",
    });
  }, [board, onCreateNode, getNewNodePosition]);

  const handleItemSelect = useCallback(
    (entityId: string, entityType: "note" | "memo") => {
      if (!board) return;
      const pos = getNewNodePosition();
      onCreateNode({
        boardId: board.id,
        nodeType: "card",
        positionX: pos.x,
        positionY: pos.y,
        width: 200,
        height: 100,
        refEntityId: entityId,
        refEntityType: entityType,
      });
      setShowAddDialog(false);
    },
    [board, onCreateNode, getNewNodePosition],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      const ids = selected.map((n) => n.id);
      setSelectedNodeIds(ids);
      onSelectionChanged?.(ids);
    },
    [onSelectionChanged],
  );

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedNodeIds) {
      onDeleteNode(id);
    }
    setSelectedNodeIds([]);
  }, [selectedNodeIds, onDeleteNode]);

  if (!board) {
    return (
      <div className="h-full flex items-center justify-center text-notion-text-secondary text-sm">
        {t("ideas.boards")}
      </div>
    );
  }

  const defaultViewport: Viewport = {
    x: board.viewportX,
    y: board.viewportY,
    zoom: board.viewportZoom,
  };

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete}
        onNodeDoubleClick={handleNodeDoubleClick}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={defaultViewport}
        connectionMode={ConnectionMode.Loose}
        onSelectionChange={handleSelectionChange}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode="Shift"
        panOnDrag={false}
        selectionOnDrag
        selectNodesOnDrag={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
        fitView={
          !board.viewportX && !board.viewportY && board.viewportZoom === 1
        }
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Panel position="top-right">
          <CanvasControls showFilter />
        </Panel>
        <Panel position="top-center">
          <PaperToolbar
            onAddCard={handleAddCard}
            onAddText={handleAddText}
            onAddFrame={handleAddFrame}
            selectedNodeCount={selectedNodeIds.length}
            isDragging={isDragging}
            onDeleteSelected={handleDeleteSelected}
          />
        </Panel>
      </ReactFlow>

      {showAddDialog && (
        <PaperAddItemDialog
          notes={notes}
          memos={memos}
          existingRefIds={existingRefIds}
          onSelect={handleItemSelect}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}
