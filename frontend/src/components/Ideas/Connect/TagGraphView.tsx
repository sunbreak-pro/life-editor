import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { TagNode } from "./TagNode";
import type { WikiTag, WikiTagConnection } from "../../../types/wikiTag";
import type { WikiTagAssignment } from "../../../types/wikiTag";
import type { CooccurrenceEntry } from "../../../hooks/useTagCooccurrence";
import { STORAGE_KEYS } from "../../../constants/storageKeys";

const nodeTypes = { tagNode: TagNode };

interface TagGraphViewProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  connections: WikiTagConnection[];
  cooccurrences: CooccurrenceEntry[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onCreateConnection: (sourceTagId: string, targetTagId: string) => void;
  onDeleteConnection: (sourceTagId: string, targetTagId: string) => void;
}

function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAG_GRAPH_POSITIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, { x: number; y: number }>) {
  localStorage.setItem(
    STORAGE_KEYS.TAG_GRAPH_POSITIONS,
    JSON.stringify(positions),
  );
}

function loadViewport(): { x: number; y: number; zoom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAG_GRAPH_VIEWPORT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveViewport(viewport: { x: number; y: number; zoom: number }) {
  localStorage.setItem(
    STORAGE_KEYS.TAG_GRAPH_VIEWPORT,
    JSON.stringify(viewport),
  );
}

function getUsageCount(
  tagId: string,
  assignments: WikiTagAssignment[],
): number {
  return assignments.filter((a) => a.tagId === tagId).length;
}

export function TagGraphView({
  tags,
  assignments,
  connections,
  cooccurrences,
  selectedTagId,
  onSelectTag,
  onCreateConnection,
  onDeleteConnection,
}: TagGraphViewProps) {
  const { t } = useTranslation();
  const positionsRef = useRef(loadPositions());

  const initialNodes = useMemo<Node[]>(() => {
    const saved = positionsRef.current;
    const cols = Math.max(Math.ceil(Math.sqrt(tags.length)), 1);
    return tags.map((tag, i) => {
      const pos = saved[tag.id] ?? {
        x: (i % cols) * 180,
        y: Math.floor(i / cols) * 100,
      };
      return {
        id: tag.id,
        type: "tagNode",
        position: pos,
        data: {
          label: tag.name,
          color: tag.color,
          textColor: tag.textColor,
          usageCount: getUsageCount(tag.id, assignments),
          selected: tag.id === selectedTagId,
        },
      };
    });
  }, [tags, assignments, selectedTagId]);

  const initialEdges = useMemo<Edge[]>(() => {
    const manualEdges: Edge[] = connections.map((conn) => ({
      id: `manual-${conn.id}`,
      source: conn.sourceTagId,
      target: conn.targetTagId,
      type: "default",
      style: { stroke: "#6366f1", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
      data: { connectionType: "manual", connectionId: conn.id },
    }));

    // Build a set of manual connection pairs to avoid duplicate co-occurrence edges
    const manualPairs = new Set(
      connections.map((c) => {
        const [a, b] =
          c.sourceTagId < c.targetTagId
            ? [c.sourceTagId, c.targetTagId]
            : [c.targetTagId, c.sourceTagId];
        return `${a}---${b}`;
      }),
    );

    const coEdges: Edge[] = cooccurrences
      .filter((co) => !manualPairs.has(co.key))
      .map((co) => ({
        id: `co-${co.key}`,
        source: co.tagId1,
        target: co.tagId2,
        type: "default",
        style: {
          stroke: "#9ca3af",
          strokeWidth: 1,
          strokeDasharray: "5 5",
        },
        label: String(co.count),
        labelStyle: { fontSize: 10, fill: "#9ca3af" },
        data: { connectionType: "cooccurrence" },
      }));

    return [...manualEdges, ...coEdges];
  }, [connections, cooccurrences]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes/edges when data changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Save positions on drag end
      for (const change of changes) {
        if (
          change.type === "position" &&
          change.dragging === false &&
          change.position
        ) {
          positionsRef.current[change.id] = change.position;
          savePositions(positionsRef.current);
        }
      }
    },
    [onNodesChange],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (
        connection.source &&
        connection.target &&
        connection.source !== connection.target
      ) {
        onCreateConnection(connection.source, connection.target);
      }
    },
    [onCreateConnection],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.connectionType === "manual") {
        // Extract source/target from the edge
        onDeleteConnection(edge.source, edge.target);
      }
    },
    [onDeleteConnection],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectTag(node.id === selectedTagId ? null : node.id);
    },
    [onSelectTag, selectedTagId],
  );

  const handlePaneClick = useCallback(() => {
    onSelectTag(null);
  }, [onSelectTag]);

  const savedViewport = useMemo(() => loadViewport(), []);

  if (tags.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-notion-text-secondary">
        {t("ideas.graphEmpty")}
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onMoveEnd={(_event, viewport) => saveViewport(viewport)}
        nodeTypes={nodeTypes}
        defaultViewport={savedViewport ?? { x: 50, y: 50, zoom: 1 }}
        fitView={!savedViewport}
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        className="bg-notion-bg"
      >
        <Background gap={20} size={1} color="var(--notion-border)" />
        <Controls
          showInteractive={false}
          className="!bg-notion-bg !border-notion-border !shadow-sm [&>button]:!bg-notion-bg [&>button]:!border-notion-border [&>button]:!text-notion-text-secondary [&>button:hover]:!bg-notion-hover"
        />
      </ReactFlow>
    </div>
  );
}
