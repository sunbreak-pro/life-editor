import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { ColorPicker } from "../../shared/ColorPicker";
import { GroupFrameNode } from "./GroupFrameNode";
import { NoteNodeComponent } from "./NoteNodeComponent";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagGroup,
  WikiTagGroupMember,
  NoteConnection,
} from "../../../types/wikiTag";
import type { NoteNode } from "../../../types/note";
import type { NoteCooccurrenceEntry } from "../../../hooks/useNoteCooccurrence";
import { STORAGE_KEYS } from "../../../constants/storageKeys";

const nodeTypes = {
  groupFrame: GroupFrameNode,
  noteNode: NoteNodeComponent,
};

interface TagGraphViewProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  noteConnections: NoteConnection[];
  noteCooccurrences: NoteCooccurrenceEntry[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onCreateNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  onDeleteNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  groups: WikiTagGroup[];
  groupMembers: WikiTagGroupMember[];
  notes: NoteNode[];
  filterMode: "all" | "grouped" | { groupId: string };
  onNavigateToNote?: (noteId: string) => void;
  onUpdateNoteColor?: (noteId: string, color: string) => void;
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

function loadGroupPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAG_GRAPH_GROUP_POSITIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroupPositions(
  positions: Record<string, { x: number; y: number }>,
) {
  localStorage.setItem(
    STORAGE_KEYS.TAG_GRAPH_GROUP_POSITIONS,
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

function extractContentPreview(content: string): string {
  try {
    const doc = JSON.parse(content);
    const texts: string[] = [];
    const walk = (node: { text?: string; content?: unknown[] }) => {
      if (node.text) texts.push(node.text);
      if (node.content) (node.content as (typeof node)[]).forEach(walk);
    };
    walk(doc);
    return texts.join(" ").slice(0, 80);
  } catch {
    return "";
  }
}

const GROUP_FRAME_PADDING = 40;

function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => zoomIn()}
        className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
      >
        <ZoomIn size={14} />
      </button>
      <button
        onClick={() => zoomOut()}
        className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
      >
        <ZoomOut size={14} />
      </button>
      <button
        onClick={() => fitView({ padding: 0.3 })}
        className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}

export function TagGraphView({
  tags,
  assignments,
  noteConnections,
  noteCooccurrences,
  selectedTagId,
  onSelectTag,
  onCreateNoteConnection,
  onDeleteNoteConnection,
  groups,
  groupMembers,
  notes,
  filterMode,
  onNavigateToNote,
  onUpdateNoteColor,
}: TagGraphViewProps) {
  const { t } = useTranslation();
  const positionsRef = useRef(loadPositions());
  const groupPositionsRef = useRef(loadGroupPositions());
  const [noteContextMenu, setNoteContextMenu] = useState<{
    x: number;
    y: number;
    noteId: string;
    color?: string;
  } | null>(null);

  // Build tag dots data for notes
  const noteTagDots = useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: string; name: string; color: string }>
    >();
    for (const a of assignments) {
      if (a.entityType !== "note") continue;
      const tag = tags.find((t) => t.id === a.tagId);
      if (!tag) continue;
      const existing = map.get(a.entityId) || [];
      existing.push({ id: tag.id, name: tag.name, color: tag.color });
      map.set(a.entityId, existing);
    }
    return map;
  }, [assignments, tags]);

  // Determine visible note IDs
  const visibleNoteIds = useMemo(() => {
    if (filterMode === "all") {
      // Show all notes that have at least one tag assignment
      const noteIds = new Set(
        assignments
          .filter((a) => a.entityType === "note")
          .map((a) => a.entityId),
      );
      return noteIds;
    }
    if (filterMode === "grouped") {
      return new Set(groupMembers.map((m) => m.noteId));
    }
    return new Set(
      groupMembers
        .filter((m) => m.groupId === filterMode.groupId)
        .map((m) => m.noteId),
    );
  }, [assignments, groupMembers, filterMode]);

  const filteredNotes = useMemo(
    () => notes.filter((n) => !n.isDeleted && visibleNoteIds.has(n.id)),
    [notes, visibleNoteIds],
  );

  const initialNodes = useMemo<Node[]>(() => {
    const saved = positionsRef.current;
    const cols = Math.max(Math.ceil(Math.sqrt(filteredNotes.length)), 1);

    // Note nodes
    const noteNodes: Node[] = filteredNotes.map((note, i) => {
      const pos = saved[note.id] ?? {
        x: (i % cols) * 200,
        y: Math.floor(i / cols) * 100,
      };
      const dots = noteTagDots.get(note.id) || [];
      const highlighted =
        !!selectedTagId && dots.some((d) => d.id === selectedTagId);
      return {
        id: note.id,
        type: "noteNode",
        position: pos,
        data: {
          title: note.title || "Untitled",
          contentPreview: extractContentPreview(note.content),
          noteId: note.id,
          color: note.color,
          tagDots: dots,
          highlighted,
        },
      };
    });

    // Group frame nodes (note-based)
    const noteNodeMap = new Map<string, { x: number; y: number }>();
    for (const nn of noteNodes) {
      noteNodeMap.set(nn.id, nn.position);
    }

    const savedGroupPos = groupPositionsRef.current;
    const groupFrameNodes: Node[] = groups
      .filter((g) => {
        const memberNoteIds = groupMembers
          .filter((m) => m.groupId === g.id)
          .map((m) => m.noteId);
        return memberNoteIds.some((nid) => noteNodeMap.has(nid));
      })
      .map((group) => {
        const memberNoteIds = groupMembers
          .filter((m) => m.groupId === group.id)
          .map((m) => m.noteId);
        const memberPositions = memberNoteIds
          .map((nid) => noteNodeMap.get(nid))
          .filter(Boolean) as { x: number; y: number }[];

        const minX = Math.min(...memberPositions.map((p) => p.x));
        const maxX = Math.max(...memberPositions.map((p) => p.x));
        const minY = Math.min(...memberPositions.map((p) => p.y));
        const maxY = Math.max(...memberPositions.map((p) => p.y));

        const width = maxX - minX + 180 + GROUP_FRAME_PADDING * 2;
        const height = maxY - minY + 80 + GROUP_FRAME_PADDING * 2;

        const pos = savedGroupPos[group.id] ?? {
          x: minX - GROUP_FRAME_PADDING,
          y: minY - GROUP_FRAME_PADDING - 10,
        };

        return {
          id: `group-${group.id}`,
          type: "groupFrame",
          position: pos,
          zIndex: -1,
          draggable: true,
          selectable: false,
          connectable: false,
          data: {
            name: group.name,
            width,
            height,
          },
        };
      });

    return [...groupFrameNodes, ...noteNodes];
  }, [filteredNotes, noteTagDots, groups, groupMembers, selectedTagId]);

  const initialEdges = useMemo<Edge[]>(() => {
    // Manual note-to-note connections
    const filteredManual = noteConnections.filter(
      (c) =>
        visibleNoteIds.has(c.sourceNoteId) &&
        visibleNoteIds.has(c.targetNoteId),
    );

    const manualEdges: Edge[] = filteredManual.map((conn) => ({
      id: `manual-${conn.id}`,
      source: conn.sourceNoteId,
      target: conn.targetNoteId,
      type: "default",
      style: { stroke: "#6366f1", strokeWidth: 2 },
      data: { connectionType: "manual", connectionId: conn.id },
    }));

    const manualPairs = new Set(
      filteredManual.map((c) => {
        const [a, b] =
          c.sourceNoteId < c.targetNoteId
            ? [c.sourceNoteId, c.targetNoteId]
            : [c.targetNoteId, c.sourceNoteId];
        return `${a}---${b}`;
      }),
    );

    // Auto note-to-note connections (shared tag co-occurrence)
    const filteredCooccurrences = noteCooccurrences.filter(
      (co) => visibleNoteIds.has(co.noteId1) && visibleNoteIds.has(co.noteId2),
    );

    const coEdges: Edge[] = filteredCooccurrences
      .filter((co) => !manualPairs.has(co.key))
      .map((co) => ({
        id: `co-${co.key}`,
        source: co.noteId1,
        target: co.noteId2,
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
  }, [noteConnections, noteCooccurrences, visibleNoteIds]);

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
      for (const change of changes) {
        if (
          change.type === "position" &&
          change.dragging === false &&
          change.position
        ) {
          if (change.id.startsWith("group-")) {
            const groupId = change.id.replace("group-", "");
            groupPositionsRef.current[groupId] = change.position;
            saveGroupPositions(groupPositionsRef.current);
          } else {
            positionsRef.current[change.id] = change.position;
            savePositions(positionsRef.current);
          }
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
        // Only connect note nodes
        const sourceIsNote = !connection.source.startsWith("group-");
        const targetIsNote = !connection.target.startsWith("group-");
        if (sourceIsNote && targetIsNote) {
          onCreateNoteConnection(connection.source, connection.target);
        }
      }
    },
    [onCreateNoteConnection],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.connectionType === "manual") {
        onDeleteNoteConnection(edge.source, edge.target);
      }
    },
    [onDeleteNoteConnection],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "noteNode" && onNavigateToNote) {
        onNavigateToNote(node.data.noteId as string);
        return;
      }
    },
    [onNavigateToNote],
  );

  const handlePaneClick = useCallback(() => {
    onSelectTag(null);
    setNoteContextMenu(null);
  }, [onSelectTag]);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type === "noteNode") {
        event.preventDefault();
        setNoteContextMenu({
          x: event.clientX,
          y: event.clientY,
          noteId: node.data.noteId as string,
          color: node.data.color as string | undefined,
        });
      }
    },
    [],
  );

  const savedViewport = useMemo(() => loadViewport(), []);

  if (filteredNotes.length === 0) {
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
        onNodeContextMenu={handleNodeContextMenu}
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
        <Panel position="top-right">
          <CanvasControls />
        </Panel>
      </ReactFlow>
      {noteContextMenu &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setNoteContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setNoteContextMenu(null);
            }}
          >
            <div
              className="absolute bg-notion-bg border border-notion-border rounded-lg shadow-lg p-2 w-48"
              style={{ left: noteContextMenu.x, top: noteContextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-notion-hover text-notion-text"
                onClick={() => {
                  onNavigateToNote?.(noteContextMenu.noteId);
                  setNoteContextMenu(null);
                }}
              >
                {t("ideas.openNote")}
              </button>
              <div className="border-t border-notion-border my-1" />
              <div className="px-2 py-1">
                <p className="text-[10px] text-notion-text-secondary mb-1.5">
                  {t("ideas.noteColor")}
                </p>
                <ColorPicker
                  currentColor={noteContextMenu.color}
                  onSelect={(color) => {
                    onUpdateNoteColor?.(noteContextMenu.noteId, color);
                    setNoteContextMenu(null);
                  }}
                  onClose={() => setNoteContextMenu(null)}
                  inline
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
