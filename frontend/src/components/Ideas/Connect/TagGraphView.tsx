import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { ColorPicker } from "../../shared/ColorPicker";
import { TagNode } from "./TagNode";
import { GroupFrameNode } from "./GroupFrameNode";
import { NoteNodeComponent } from "./NoteNodeComponent";
import type {
  WikiTag,
  WikiTagConnection,
  WikiTagAssignment,
  WikiTagGroup,
  WikiTagGroupMember,
} from "../../../types/wikiTag";
import type { NoteNode } from "../../../types/note";
import type { CooccurrenceEntry } from "../../../hooks/useTagCooccurrence";
import { STORAGE_KEYS } from "../../../constants/storageKeys";

const nodeTypes = {
  tagNode: TagNode,
  groupFrame: GroupFrameNode,
  noteNode: NoteNodeComponent,
};

interface TagGraphViewProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  connections: WikiTagConnection[];
  cooccurrences: CooccurrenceEntry[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onCreateConnection: (sourceTagId: string, targetTagId: string) => void;
  onDeleteConnection: (sourceTagId: string, targetTagId: string) => void;
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

function getUsageCount(
  tagId: string,
  assignments: WikiTagAssignment[],
): number {
  return assignments.filter((a) => a.tagId === tagId).length;
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

export function TagGraphView({
  tags,
  assignments,
  connections,
  cooccurrences,
  selectedTagId,
  onSelectTag,
  onCreateConnection,
  onDeleteConnection,
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

  // Determine which tag IDs are visible based on filterMode
  const visibleTagIds = useMemo(() => {
    if (filterMode === "all") return new Set(tags.map((t) => t.id));
    if (filterMode === "grouped") {
      return new Set(groupMembers.map((m) => m.tagId));
    }
    return new Set(
      groupMembers
        .filter((m) => m.groupId === filterMode.groupId)
        .map((m) => m.tagId),
    );
  }, [tags, groupMembers, filterMode]);

  // Determine which note IDs are visible (notes that have at least one visible tag)
  const visibleNoteIds = useMemo(() => {
    const noteAssignments = assignments.filter(
      (a) => a.entityType === "note" && visibleTagIds.has(a.tagId),
    );
    return new Set(noteAssignments.map((a) => a.entityId));
  }, [assignments, visibleTagIds]);

  const filteredTags = useMemo(
    () => tags.filter((t) => visibleTagIds.has(t.id)),
    [tags, visibleTagIds],
  );

  const filteredNotes = useMemo(
    () => notes.filter((n) => !n.isDeleted && visibleNoteIds.has(n.id)),
    [notes, visibleNoteIds],
  );

  const initialNodes = useMemo<Node[]>(() => {
    const saved = positionsRef.current;
    const cols = Math.max(Math.ceil(Math.sqrt(filteredTags.length)), 1);

    // Tag nodes
    const tagNodes: Node[] = filteredTags.map((tag, i) => {
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

    // Note nodes
    const noteNodes: Node[] = filteredNotes.map((note, i) => {
      const pos = saved[note.id] ?? {
        x: cols * 180 + 50,
        y: i * 80,
      };
      return {
        id: note.id,
        type: "noteNode",
        position: pos,
        data: {
          title: note.title || "Untitled",
          contentPreview: extractContentPreview(note.content),
          noteId: note.id,
          color: note.color,
        },
      };
    });

    // Group frame nodes
    const tagNodeMap = new Map<string, { x: number; y: number }>();
    for (const tn of tagNodes) {
      tagNodeMap.set(tn.id, tn.position);
    }

    const savedGroupPos = groupPositionsRef.current;
    const groupFrameNodes: Node[] = groups
      .filter((g) => {
        const memberTagIds = groupMembers
          .filter((m) => m.groupId === g.id)
          .map((m) => m.tagId);
        return memberTagIds.some((tid) => tagNodeMap.has(tid));
      })
      .map((group) => {
        const memberTagIds = groupMembers
          .filter((m) => m.groupId === group.id)
          .map((m) => m.tagId);
        const memberPositions = memberTagIds
          .map((tid) => tagNodeMap.get(tid))
          .filter(Boolean) as { x: number; y: number }[];

        const minX = Math.min(...memberPositions.map((p) => p.x));
        const maxX = Math.max(...memberPositions.map((p) => p.x));
        const minY = Math.min(...memberPositions.map((p) => p.y));
        const maxY = Math.max(...memberPositions.map((p) => p.y));

        const width = maxX - minX + 140 + GROUP_FRAME_PADDING * 2;
        const height = maxY - minY + 50 + GROUP_FRAME_PADDING * 2;

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

    return [...groupFrameNodes, ...tagNodes, ...noteNodes];
  }, [
    filteredTags,
    filteredNotes,
    assignments,
    selectedTagId,
    groups,
    groupMembers,
  ]);

  const initialEdges = useMemo<Edge[]>(() => {
    // Filter connections to only include visible tags
    const filteredConnections = connections.filter(
      (c) =>
        visibleTagIds.has(c.sourceTagId) && visibleTagIds.has(c.targetTagId),
    );

    const manualEdges: Edge[] = filteredConnections.map((conn) => ({
      id: `manual-${conn.id}`,
      source: conn.sourceTagId,
      target: conn.targetTagId,
      type: "default",
      style: { stroke: "#6366f1", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
      data: { connectionType: "manual", connectionId: conn.id },
    }));

    const manualPairs = new Set(
      filteredConnections.map((c) => {
        const [a, b] =
          c.sourceTagId < c.targetTagId
            ? [c.sourceTagId, c.targetTagId]
            : [c.targetTagId, c.sourceTagId];
        return `${a}---${b}`;
      }),
    );

    const filteredCooccurrences = cooccurrences.filter(
      (co) => visibleTagIds.has(co.tagId1) && visibleTagIds.has(co.tagId2),
    );

    const coEdges: Edge[] = filteredCooccurrences
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

    // Note-tag edges (dotted, tag-colored)
    const noteTagEdges: Edge[] = [];
    for (const note of filteredNotes) {
      const noteAssigns = assignments.filter(
        (a) =>
          a.entityId === note.id &&
          a.entityType === "note" &&
          visibleTagIds.has(a.tagId),
      );
      for (const a of noteAssigns) {
        const tag = tags.find((t) => t.id === a.tagId);
        noteTagEdges.push({
          id: `note-tag-${note.id}-${a.tagId}`,
          source: a.tagId,
          target: note.id,
          type: "default",
          style: {
            stroke: tag?.color ?? "#9ca3af",
            strokeWidth: 1,
            strokeDasharray: "4 4",
            opacity: 0.5,
          },
          data: { connectionType: "noteTag" },
        });
      }
    }

    return [...manualEdges, ...coEdges, ...noteTagEdges];
  }, [
    connections,
    cooccurrences,
    visibleTagIds,
    filteredNotes,
    assignments,
    tags,
  ]);

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
        onCreateConnection(connection.source, connection.target);
      }
    },
    [onCreateConnection],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.connectionType === "manual") {
        onDeleteConnection(edge.source, edge.target);
      }
    },
    [onDeleteConnection],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "noteNode" && onNavigateToNote) {
        onNavigateToNote(node.data.noteId as string);
        return;
      }
      if (node.type === "tagNode") {
        onSelectTag(node.id === selectedTagId ? null : node.id);
      }
    },
    [onSelectTag, selectedTagId, onNavigateToNote],
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
        <Controls
          showInteractive={false}
          className="!bg-notion-bg !border-notion-border !shadow-sm [&>button]:!bg-notion-bg [&>button]:!border-notion-border [&>button]:!text-notion-text-secondary [&>button:hover]:!bg-notion-hover"
        />
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
