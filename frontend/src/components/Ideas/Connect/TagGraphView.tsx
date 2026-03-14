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
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Hexagon,
  AlignHorizontalSpaceBetween,
} from "lucide-react";
import { applyPolygonLayout, applyLineLayout } from "./layoutTemplates";
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

function loadGroupSizes(): Record<string, { width: number; height: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAG_GRAPH_GROUP_SIZES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroupSizes(
  sizes: Record<string, { width: number; height: number }>,
) {
  localStorage.setItem(
    STORAGE_KEYS.TAG_GRAPH_GROUP_SIZES,
    JSON.stringify(sizes),
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

/** Select optimal source/target handles based on relative position of two nodes */
function getOptimalHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  handleIndex = 0,
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  // Determine primary direction
  const directions: Array<{ source: string; target: string }> = [];
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      directions.push(
        { source: "s-Right", target: "t-Left" },
        { source: "s-Bottom", target: "t-Top" },
        { source: "s-Top", target: "t-Bottom" },
      );
    } else {
      directions.push(
        { source: "s-Left", target: "t-Right" },
        { source: "s-Bottom", target: "t-Top" },
        { source: "s-Top", target: "t-Bottom" },
      );
    }
  } else {
    if (dy > 0) {
      directions.push(
        { source: "s-Bottom", target: "t-Top" },
        { source: "s-Right", target: "t-Left" },
        { source: "s-Left", target: "t-Right" },
      );
    } else {
      directions.push(
        { source: "s-Top", target: "t-Bottom" },
        { source: "s-Right", target: "t-Left" },
        { source: "s-Left", target: "t-Right" },
      );
    }
  }
  const idx = handleIndex % directions.length;
  return {
    sourceHandle: directions[idx].source,
    targetHandle: directions[idx].target,
  };
}

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
  const groupSizesRef = useRef(loadGroupSizes());
  const [noteContextMenu, setNoteContextMenu] = useState<{
    x: number;
    y: number;
    noteId: string;
    color?: string;
  } | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  // Compute related node IDs for selection-based dimming
  const relatedNodeIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const selectedTags =
      noteTagDots.get(selectedNodeId) || memoTagDots.get(selectedNodeId) || [];
    if (selectedTags.length === 0) return new Set([selectedNodeId]);
    const selectedTagIds = new Set(selectedTags.map((t) => t.id));
    const related = new Set<string>([selectedNodeId]);
    for (const a of assignments) {
      if (selectedTagIds.has(a.tagId)) {
        related.add(a.entityId);
      }
    }
    return related;
  }, [selectedNodeId, noteTagDots, memoTagDots, assignments]);

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
      const dimmed = relatedNodeIds ? !relatedNodeIds.has(note.id) : false;
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
          dimmed,
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

        const calcWidth = maxX - minX + 80 + GROUP_FRAME_PADDING * 2;
        const calcHeight = maxY - minY + 40 + GROUP_FRAME_PADDING * 2;
        const savedSize = groupSizesRef.current[group.id];
        const width = savedSize
          ? Math.max(savedSize.width, calcWidth)
          : calcWidth;
        const height = savedSize
          ? Math.max(savedSize.height, calcHeight)
          : calcHeight;

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
          selectable: true,
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
      const dimmed = relatedNodeIds ? !relatedNodeIds.has(memo.id) : false;
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
          dimmed,
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
    relatedNodeIds,
  ]);

  // Build a position lookup from initialNodes for edge handle calculation
  const nodePositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of initialNodes) {
      map.set(node.id, node.position);
    }
    return map;
  }, [initialNodes]);

  const initialEdges = useMemo<Edge[]>(() => {
    // Manual note-to-note connections
    const filteredManual = noteConnections.filter(
      (c) =>
        visibleNoteIds.has(c.sourceNoteId) &&
        visibleNoteIds.has(c.targetNoteId),
    );

    const manualEdges: Edge[] = filteredManual.map((conn) => {
      const sPos = nodePositionMap.get(conn.sourceNoteId);
      const tPos = nodePositionMap.get(conn.targetNoteId);
      const handles =
        sPos && tPos
          ? getOptimalHandles(sPos, tPos)
          : { sourceHandle: undefined, targetHandle: undefined };
      return {
        id: `manual-${conn.id}`,
        source: conn.sourceNoteId,
        target: conn.targetNoteId,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: "straight",
        style: { stroke: "#6366f1", strokeWidth: 2 },
        data: { connectionType: "manual", connectionId: conn.id },
      };
    });

    // Tag-based colored straight edges
    const tagEdges: Edge[] = [];
    // Track per-pair handle index to distribute multiple tag edges
    const pairHandleIndex = new Map<string, number>();
    const seenPairs = new Set<string>();
    for (const tag of tags) {
      const noteIdsForTag = assignments
        .filter((a) => a.tagId === tag.id && a.entityType === "note")
        .map((a) => a.entityId)
        .filter((id) => visibleNoteIds.has(id));

      for (let i = 0; i < noteIdsForTag.length; i++) {
        for (let j = i + 1; j < noteIdsForTag.length; j++) {
          const n1 = noteIdsForTag[i];
          const n2 = noteIdsForTag[j];
          const pairKey = `tag-${tag.id}-${n1 < n2 ? n1 : n2}---${n1 < n2 ? n2 : n1}`;
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          const basePairKey = `${n1 < n2 ? n1 : n2}---${n1 < n2 ? n2 : n1}`;
          const hIdx = pairHandleIndex.get(basePairKey) ?? 0;
          pairHandleIndex.set(basePairKey, hIdx + 1);

          const sPos = nodePositionMap.get(n1);
          const tPos = nodePositionMap.get(n2);
          const handles =
            sPos && tPos
              ? getOptimalHandles(sPos, tPos, hIdx)
              : { sourceHandle: undefined, targetHandle: undefined };

          tagEdges.push({
            id: pairKey,
            source: n1,
            target: n2,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
            type: "straight",
            style: { stroke: tag.color, strokeWidth: 1.5, opacity: 0.6 },
            data: { connectionType: "tag", tagId: tag.id },
          });
        }
      }
    }

    return [...manualEdges, ...tagEdges];
  }, [noteConnections, tags, assignments, visibleNoteIds, nodePositionMap]);

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

        // Save group sizes on resize
        if (
          change.type === "dimensions" &&
          change.id.startsWith("group-") &&
          change.dimensions
        ) {
          const groupId = change.id.replace("group-", "");
          groupSizesRef.current[groupId] = {
            width: change.dimensions.width,
            height: change.dimensions.height,
          };
          saveGroupSizes(groupSizesRef.current);
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
      if (node.type === "groupFrame") return;
      const nodeId = node.id;
      setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
    },
    [],
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "noteNode" && onNavigateToNote) {
        onNavigateToNote(node.data.noteId as string);
      }
    },
    [onNavigateToNote],
  );

  const handlePaneClick = useCallback(() => {
    onSelectTag(null);
    setNoteContextMenu(null);
    setSelectedNodeId(null);
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

  const { fitView } = useReactFlow();

  const applyLayout = useCallback(
    (type: "polygon" | "line") => {
      const visibleNodes = nodesRef.current.filter(
        (n) => n.type === "noteNode" || n.type === "memoNode",
      );
      if (visibleNodes.length === 0) return;
      const ids = visibleNodes.map((n) => n.id);
      // Compute center from current positions
      const avgX =
        visibleNodes.reduce((s, n) => s + n.position.x, 0) /
        visibleNodes.length;
      const avgY =
        visibleNodes.reduce((s, n) => s + n.position.y, 0) /
        visibleNodes.length;
      const center = { x: avgX, y: avgY };

      let newPositions: Record<string, { x: number; y: number }>;
      if (type === "polygon") {
        const radius = Math.max(100, ids.length * 30);
        newPositions = applyPolygonLayout(ids, center, radius);
      } else {
        newPositions = applyLineLayout(
          ids,
          { x: center.x - ((ids.length - 1) * 120) / 2, y: center.y },
          120,
        );
      }

      setNodes((nds) =>
        nds.map((n) =>
          newPositions[n.id] ? { ...n, position: newPositions[n.id] } : n,
        ),
      );
      // Persist
      for (const [id, pos] of Object.entries(newPositions)) {
        positionsRef.current[id] = pos;
      }
      savePositions(positionsRef.current);
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    },
    [setNodes, fitView],
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
        onNodeDoubleClick={handleNodeDoubleClick}
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
        <Panel position="top-left">
          <div className="flex gap-1">
            <button
              onClick={() => applyLayout("polygon")}
              className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
              title={t("ideas.layoutPolygon")}
            >
              <Hexagon size={14} />
            </button>
            <button
              onClick={() => applyLayout("line")}
              className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
              title={t("ideas.layoutLine")}
            >
              <AlignHorizontalSpaceBetween size={14} />
            </button>
          </div>
        </Panel>
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
