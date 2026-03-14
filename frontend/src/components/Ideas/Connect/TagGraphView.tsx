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
import { ZoomIn, ZoomOut, Maximize2, Filter } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { ColorPicker } from "../../shared/ColorPicker";
import { CanvasFilter } from "./CanvasFilter";
import { GroupFrameNode } from "./GroupFrameNode";
import { NoteNodeComponent } from "./NoteNodeComponent";
import { MemoNodeComponent } from "./MemoNodeComponent";
import type { MemoNode } from "../../../types/memo";
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
  memoNode: MemoNodeComponent,
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
  memos: MemoNode[];
  filterMode: "all" | "grouped" | { groupId: string };
  onNavigateToNote?: (noteId: string) => void;
  onUpdateNoteColor?: (noteId: string, color: string) => void;
  focusedNoteId?: string | null;
  onFocusComplete?: () => void;
  selectedFilterTagIds: string[];
  selectedFilterGroupIds: string[];
  onToggleFilterTag: (tagId: string) => void;
  onToggleFilterGroup: (groupId: string) => void;
  onClearFilter: () => void;
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
  memos,
  filterMode,
  onNavigateToNote,
  onUpdateNoteColor,
  focusedNoteId,
  onFocusComplete,
  selectedFilterTagIds,
  selectedFilterGroupIds,
  onToggleFilterTag,
  onToggleFilterGroup,
  onClearFilter,
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
  const [showFilter, setShowFilter] = useState(false);

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

  // Build tag dots data for memos
  const memoTagDots = useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: string; name: string; color: string }>
    >();
    for (const a of assignments) {
      if (a.entityType !== "memo") continue;
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
    const hasTagFilter = selectedFilterTagIds.length > 0;
    const hasGroupFilter = selectedFilterGroupIds.length > 0;

    if (!hasTagFilter && !hasGroupFilter) {
      // All: show all non-deleted notes
      return new Set(notes.filter((n) => !n.isDeleted).map((n) => n.id));
    }

    const ids = new Set<string>();

    // Tag filter (OR)
    if (hasTagFilter) {
      for (const a of assignments) {
        if (a.entityType === "note" && selectedFilterTagIds.includes(a.tagId)) {
          ids.add(a.entityId);
        }
      }
    }

    // Group filter (OR)
    if (hasGroupFilter) {
      for (const m of groupMembers) {
        if (selectedFilterGroupIds.includes(m.groupId)) {
          ids.add(m.noteId);
        }
      }
    }

    return ids;
  }, [
    notes,
    assignments,
    groupMembers,
    selectedFilterTagIds,
    selectedFilterGroupIds,
  ]);

  // Determine visible memo IDs
  const visibleMemoIds = useMemo(() => {
    if (
      selectedFilterTagIds.length === 0 &&
      selectedFilterGroupIds.length === 0
    ) {
      return new Set(memos.filter((m) => !m.isDeleted).map((m) => m.id));
    }
    if (selectedFilterTagIds.length === 0) {
      // Only group filter active — memos don't belong to groups
      return new Set<string>();
    }
    return new Set(
      assignments
        .filter(
          (a) =>
            a.entityType === "memo" && selectedFilterTagIds.includes(a.tagId),
        )
        .map((a) => a.entityId),
    );
  }, [memos, assignments, selectedFilterTagIds, selectedFilterGroupIds]);

  const filteredNotes = useMemo(
    () => notes.filter((n) => !n.isDeleted && visibleNoteIds.has(n.id)),
    [notes, visibleNoteIds],
  );

  const filteredMemos = useMemo(
    () => memos.filter((m) => !m.isDeleted && visibleMemoIds.has(m.id)),
    [memos, visibleMemoIds],
  );

  const initialNodes = useMemo<Node[]>(() => {
    const saved = positionsRef.current;
    const totalItems = filteredNotes.length + filteredMemos.length;
    const cols = Math.max(Math.ceil(Math.sqrt(totalItems)), 1);

    // Note nodes
    const noteNodes: Node[] = filteredNotes.map((note, i) => {
      const pos = saved[note.id] ?? {
        x: (i % cols) * 120,
        y: Math.floor(i / cols) * 60,
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

        const width = maxX - minX + 80 + GROUP_FRAME_PADDING * 2;
        const height = maxY - minY + 40 + GROUP_FRAME_PADDING * 2;

        const pos = savedGroupPos[group.id] ?? {
          x: minX - GROUP_FRAME_PADDING,
          y: minY - GROUP_FRAME_PADDING - 10,
        };

        // Collect tags from member notes
        const groupTags = new Map<
          string,
          { id: string; name: string; color: string }
        >();
        for (const nid of memberNoteIds) {
          const noteTags = noteTagDots.get(nid);
          if (noteTags) {
            for (const t of noteTags) {
              if (!groupTags.has(t.id)) groupTags.set(t.id, t);
            }
          }
        }

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
            tags: Array.from(groupTags.values()),
          },
        };
      });

    // Memo nodes
    const memoNodes: Node[] = filteredMemos.map((memo, i) => {
      const idx = filteredNotes.length + i;
      const pos = saved[memo.id] ?? {
        x: (idx % cols) * 120,
        y: Math.floor(idx / cols) * 60,
      };
      const dots = memoTagDots.get(memo.id) || [];
      const highlighted =
        !!selectedTagId && dots.some((d) => d.id === selectedTagId);
      return {
        id: memo.id,
        type: "memoNode",
        position: pos,
        data: {
          date: memo.date,
          contentPreview: extractContentPreview(memo.content),
          memoId: memo.id,
          tagDots: dots,
          highlighted,
        },
      };
    });

    return [...groupFrameNodes, ...noteNodes, ...memoNodes];
  }, [
    filteredNotes,
    filteredMemos,
    noteTagDots,
    memoTagDots,
    groups,
    groupMembers,
    selectedTagId,
  ]);

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
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const { setCenter } = useReactFlow();

  // Sync nodes/edges when data changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Focus on a specific note node
  useEffect(() => {
    if (!focusedNoteId) return;
    const targetNode = nodesRef.current.find((n) => n.id === focusedNoteId);
    if (!targetNode) {
      onFocusComplete?.();
      return;
    }
    // Set focused flag on the node
    setNodes((nds) =>
      nds.map((n) =>
        n.id === focusedNoteId
          ? { ...n, data: { ...n.data, focused: true } }
          : n,
      ),
    );
    // Zoom to the node
    setCenter(targetNode.position.x + 40, targetNode.position.y + 20, {
      duration: 500,
      zoom: 1.5,
    });
    // Clear focused flag after 3 seconds
    const timer = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === focusedNoteId
            ? { ...n, data: { ...n.data, focused: false } }
            : n,
        ),
      );
      onFocusComplete?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [focusedNoteId, setNodes, setCenter, onFocusComplete]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Detect group frame drags and move member notes along
      const groupDrags = changes.filter(
        (c) => c.type === "position" && c.dragging && c.id.startsWith("group-"),
      );

      if (groupDrags.length > 0) {
        const additionalChanges: Array<{
          type: "position";
          id: string;
          position: { x: number; y: number };
          dragging: boolean;
        }> = [];
        for (const gd of groupDrags) {
          if (gd.type !== "position" || !gd.position) continue;
          const groupId = gd.id.replace("group-", "");
          const prevNode = nodesRef.current.find((n) => n.id === gd.id);
          if (!prevNode) continue;
          const dx = gd.position.x - prevNode.position.x;
          const dy = gd.position.y - prevNode.position.y;
          if (dx === 0 && dy === 0) continue;

          const memberNoteIds = groupMembers
            .filter((m) => m.groupId === groupId)
            .map((m) => m.noteId);

          for (const noteId of memberNoteIds) {
            // Skip if this node is already in the changes (being dragged independently)
            if (changes.some((c) => c.id === noteId)) continue;
            const noteNode = nodesRef.current.find((n) => n.id === noteId);
            if (!noteNode) continue;
            additionalChanges.push({
              type: "position",
              id: noteId,
              position: {
                x: noteNode.position.x + dx,
                y: noteNode.position.y + dy,
              },
              dragging: true,
            });
          }
        }
        onNodesChange([...changes, ...additionalChanges]);
      } else {
        onNodesChange(changes);
      }

      // Save positions on drag end
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
            // Also save member note final positions
            const memberNoteIds = groupMembers
              .filter((m) => m.groupId === groupId)
              .map((m) => m.noteId);
            for (const noteId of memberNoteIds) {
              const noteNode = nodesRef.current.find((n) => n.id === noteId);
              if (noteNode) {
                positionsRef.current[noteId] = noteNode.position;
              }
            }
            savePositions(positionsRef.current);
          } else {
            positionsRef.current[change.id] = change.position;
            savePositions(positionsRef.current);
          }
        }
      }
    },
    [onNodesChange, groupMembers],
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
  const activeFilterCount =
    selectedFilterTagIds.length + selectedFilterGroupIds.length;

  if (filteredNotes.length === 0 && filteredMemos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-notion-text-secondary">
        {activeFilterCount > 0
          ? t("ideas.noFilterResults")
          : t("ideas.graphEmpty")}
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
          <div className="flex flex-col gap-1 items-end">
            <CanvasControls />
            <div className="relative">
              <button
                onClick={() => setShowFilter((v) => !v)}
                className={`p-1.5 rounded border shadow-sm transition-colors ${
                  activeFilterCount > 0
                    ? "bg-notion-accent/10 border-notion-accent text-notion-accent"
                    : "bg-notion-bg border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                <Filter size={14} />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-notion-accent text-white text-[9px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {showFilter && (
                <div className="absolute right-0 top-full mt-1 z-10">
                  <CanvasFilter
                    tags={tags}
                    groups={groups}
                    selectedGroupIds={selectedFilterGroupIds}
                    selectedTagIds={selectedFilterTagIds}
                    onToggleGroup={onToggleFilterGroup}
                    onToggleTag={onToggleFilterTag}
                    onClose={() => setShowFilter(false)}
                    onClearAll={onClearFilter}
                  />
                </div>
              )}
            </div>
          </div>
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
