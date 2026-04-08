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
  type OnEdgesChange,
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
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout>>();
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
    const parentIds = new Set(
      paperNodes.filter((pn) => pn.parentNodeId).map((pn) => pn.parentNodeId),
    );
    // Sort: parent nodes first, then children
    const sorted = [...paperNodes].sort((a, b) => {
      const aIsParent = parentIds.has(a.id) ? 0 : 1;
      const bIsParent = parentIds.has(b.id) ? 0 : 1;
      if (aIsParent !== bIsParent) return aIsParent - bIsParent;
      return 0;
    });
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
    return paperEdges.map((pe) => ({
      id: pe.id,
      source: pe.sourceNodeId,
      target: pe.targetNodeId,
      sourceHandle: pe.sourceHandle || undefined,
      targetHandle: pe.targetHandle || undefined,
      type: "paperEdge",
      data: { onDelete: handleEdgeDelete },
    }));
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

  // Handle node drag stop → persist positions
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, nodes: Node[]) => {
      // Pre-compute frame escape/grouping for the primary node
      // so we can include the correct position in the bulk update
      let overrideForNode: {
        positionX: number;
        positionY: number;
        parentNodeId: string | null;
      } | null = null;

      // Frame escape: check if child node was dragged outside its parent frame
      if (node.type !== "paperFrame" && node.parentId) {
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

      // Frame grouping: check if non-frame node was dropped onto a frame
      if (node.type !== "paperFrame" && !node.parentId && !overrideForNode) {
        const frameNodes = flowNodes.filter((n) => n.type === "paperFrame");
        for (const frame of frameNodes) {
          const fw = (frame.style?.width as number) || 200;
          const fh = (frame.style?.height as number) || 150;
          if (
            node.position.x >= frame.position.x &&
            node.position.y >= frame.position.y &&
            node.position.x <= frame.position.x + fw &&
            node.position.y <= frame.position.y + fh
          ) {
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
    [onBulkUpdatePositions, flowNodes],
  );

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
      onCreateEdge({
        boardId: board.id,
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
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
