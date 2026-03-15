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
  Hexagon,
  AlignHorizontalSpaceBetween,
} from "lucide-react";
import { applyPolygonLayout, applyLineLayout } from "./layoutTemplates";
import { useReactFlow } from "@xyflow/react";
import { ColorPicker } from "../../shared/ColorPicker";
import { NoteNodeComponent } from "./NoteNodeComponent";
import { MemoNodeComponent } from "./MemoNodeComponent";
import { CurvedEdge } from "./CurvedEdge";
import type { MemoNode } from "../../../types/memo";
import type {
  WikiTag,
  WikiTagAssignment,
  NoteConnection,
} from "../../../types/wikiTag";
import type { NoteNode } from "../../../types/note";
import { STORAGE_KEYS } from "../../../constants/storageKeys";

const nodeTypes = {
  noteNode: NoteNodeComponent,
  memoNode: MemoNodeComponent,
};

const edgeTypes = {
  curved: CurvedEdge,
};

interface TagGraphViewProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  noteConnections: NoteConnection[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onCreateNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  onDeleteNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  notes: NoteNode[];
  memos: MemoNode[];
  onNavigateToNote?: (noteId: string) => void;
  onUpdateNoteColor?: (noteId: string, color: string) => void;
  focusedNoteId?: string | null;
  onFocusComplete?: () => void;
  sidebarSelectedItemId: string | null;
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
  notes,
  memos,
  onNavigateToNote,
  onUpdateNoteColor,
  focusedNoteId,
  onFocusComplete,
  sidebarSelectedItemId,
}: TagGraphViewProps) {
  const { t } = useTranslation();
  const positionsRef = useRef(loadPositions());
  const [noteContextMenu, setNoteContextMenu] = useState<{
    x: number;
    y: number;
    noteId: string;
    color?: string;
  } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const sidebarMode = sidebarSelectedItemId != null;

  // Edge tag filter (normal mode only)
  const [activeEdgeTagId, setActiveEdgeTagId] = useState<string | null>(null);

  useEffect(() => {
    if (tags.length > 0) {
      if (!activeEdgeTagId || !tags.some((t) => t.id === activeEdgeTagId)) {
        setActiveEdgeTagId(tags[0].id);
      }
    } else {
      setActiveEdgeTagId(null);
    }
  }, [tags]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTagEntityIds = useMemo(() => {
    if (!activeEdgeTagId) return null;
    return new Set(
      assignments
        .filter((a) => a.tagId === activeEdgeTagId)
        .map((a) => a.entityId),
    );
  }, [activeEdgeTagId, assignments]);

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

  // Visible IDs: all non-deleted entities (no filter)
  const visibleNoteIds = useMemo(
    () => new Set(notes.filter((n) => !n.isDeleted).map((n) => n.id)),
    [notes],
  );

  const visibleMemoIds = useMemo(
    () => new Set(memos.filter((m) => !m.isDeleted).map((m) => m.id)),
    [memos],
  );

  const filteredNotes = useMemo(
    () => notes.filter((n) => !n.isDeleted && visibleNoteIds.has(n.id)),
    [notes, visibleNoteIds],
  );

  const filteredMemos = useMemo(
    () => memos.filter((m) => !m.isDeleted && visibleMemoIds.has(m.id)),
    [memos, visibleMemoIds],
  );

  // Compute related node IDs for selection-based dimming (normal mode only)
  const relatedNodeIds = useMemo(() => {
    if (sidebarMode || !selectedNodeId) return null;
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
  }, [selectedNodeId, sidebarMode, noteTagDots, memoTagDots, assignments]);

  const initialNodes = useMemo<Node[]>(() => {
    if (sidebarMode) {
      return buildSplitViewNodes();
    }
    return buildNormalNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sidebarMode,
    sidebarSelectedItemId,
    filteredNotes,
    filteredMemos,
    noteTagDots,
    memoTagDots,
    notes,
    memos,
    assignments,
    selectedTagId,
    relatedNodeIds,
    activeTagEntityIds,
  ]);

  function buildNormalNodes(): Node[] {
    const saved = positionsRef.current;
    const visibleNotes = activeTagEntityIds
      ? filteredNotes.filter((n) => activeTagEntityIds.has(n.id))
      : filteredNotes;
    const visibleMemosList = activeTagEntityIds
      ? filteredMemos.filter((m) => activeTagEntityIds.has(m.id))
      : filteredMemos;
    const totalItems = visibleNotes.length + visibleMemosList.length;
    const cols = Math.max(Math.ceil(Math.sqrt(totalItems)), 1);

    const noteNodes: Node[] = visibleNotes.map((note, i) => {
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

    const memoNodes: Node[] = visibleMemosList.map((memo, i) => {
      const idx = visibleNotes.length + i;
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

    return [...noteNodes, ...memoNodes];
  }

  function buildSplitViewNodes(): Node[] {
    const selectedId = sidebarSelectedItemId!;
    const selectedNote = notes.find((n) => n.id === selectedId && !n.isDeleted);
    const selectedMemo = memos.find((m) => m.id === selectedId && !m.isDeleted);
    if (!selectedNote && !selectedMemo) return [];

    const selectedTags = selectedNote
      ? noteTagDots.get(selectedId) || []
      : memoTagDots.get(selectedId) || [];

    // No tags → single node only
    if (selectedTags.length === 0) {
      if (selectedNote) {
        return [
          {
            id: selectedNote.id,
            type: "noteNode",
            position: { x: 0, y: 0 },
            data: {
              title: selectedNote.title || "Untitled",
              contentPreview: extractContentPreview(selectedNote.content),
              noteId: selectedNote.id,
              color: selectedNote.color,
              tagDots: [],
              highlighted: false,
              dimmed: false,
            },
          },
        ];
      }
      return [
        {
          id: selectedMemo!.id,
          type: "memoNode",
          position: { x: 0, y: 0 },
          data: {
            date: selectedMemo!.date,
            contentPreview: extractContentPreview(selectedMemo!.content),
            memoId: selectedMemo!.id,
            tagDots: [],
            highlighted: false,
            dimmed: false,
          },
        },
      ];
    }

    // Generate split nodes
    const center = { x: 0, y: 0 };
    const splitRadius = Math.max(120, selectedTags.length * 50);
    const splitIds = selectedTags.map((tag) => `${selectedId}__${tag.id}`);
    const splitPositions = applyPolygonLayout(splitIds, center, splitRadius);

    const splitNodes: Node[] = selectedTags.map((tag) => {
      const splitId = `${selectedId}__${tag.id}`;
      if (selectedNote) {
        return {
          id: splitId,
          type: "noteNode",
          position: splitPositions[splitId],
          data: {
            title: selectedNote.title || "Untitled",
            contentPreview: extractContentPreview(selectedNote.content),
            noteId: selectedNote.id,
            color: selectedNote.color,
            tagDots: [tag],
            highlighted: false,
            dimmed: false,
            splitTag: tag,
          },
        };
      }
      return {
        id: splitId,
        type: "memoNode",
        position: splitPositions[splitId],
        data: {
          date: selectedMemo!.date,
          contentPreview: extractContentPreview(selectedMemo!.content),
          memoId: selectedMemo!.id,
          tagDots: [tag],
          highlighted: false,
          dimmed: false,
          splitTag: tag,
        },
      };
    });

    // Collect related nodes per tag
    const tagRelatedMap = new Map<string, string[]>();
    for (const tag of selectedTags) {
      const related: string[] = [];
      for (const a of assignments) {
        if (a.tagId === tag.id && a.entityId !== selectedId) {
          const noteExists = notes.some(
            (n) => n.id === a.entityId && !n.isDeleted,
          );
          const memoExists = memos.some(
            (m) => m.id === a.entityId && !m.isDeleted,
          );
          if (noteExists || memoExists) {
            related.push(a.entityId);
          }
        }
      }
      tagRelatedMap.set(tag.id, related);
    }

    // Build related nodes (de-duplicated, placed near first claiming split node)
    const relatedNodes: Node[] = [];
    const placedNodes = new Set<string>();

    for (const tag of selectedTags) {
      const splitId = `${selectedId}__${tag.id}`;
      const splitPos = splitPositions[splitId];
      const allRelated = tagRelatedMap.get(tag.id) || [];
      const unplacedRelated = allRelated.filter((id) => !placedNodes.has(id));

      if (unplacedRelated.length === 0) continue;

      // Position related nodes outward from split node
      const dx = splitPos.x - center.x;
      const dy = splitPos.y - center.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const relatedCenter = {
        x: splitPos.x + (dx / len) * 120,
        y: splitPos.y + (dy / len) * 120,
      };
      const relatedRadius = Math.max(80, unplacedRelated.length * 30);
      const relatedPositions = applyPolygonLayout(
        unplacedRelated,
        relatedCenter,
        relatedRadius,
      );

      for (const entityId of unplacedRelated) {
        placedNodes.add(entityId);
        const note = notes.find((n) => n.id === entityId && !n.isDeleted);
        const memo = memos.find((m) => m.id === entityId && !m.isDeleted);

        if (note) {
          relatedNodes.push({
            id: note.id,
            type: "noteNode",
            position: relatedPositions[note.id],
            data: {
              title: note.title || "Untitled",
              contentPreview: extractContentPreview(note.content),
              noteId: note.id,
              color: note.color,
              tagDots: noteTagDots.get(note.id) || [],
              highlighted: false,
              dimmed: false,
            },
          });
        } else if (memo) {
          relatedNodes.push({
            id: memo.id,
            type: "memoNode",
            position: relatedPositions[memo.id],
            data: {
              date: memo.date,
              contentPreview: extractContentPreview(memo.content),
              memoId: memo.id,
              tagDots: memoTagDots.get(memo.id) || [],
              highlighted: false,
              dimmed: false,
            },
          });
        }
      }
    }

    return [...splitNodes, ...relatedNodes];
  }

  // Build a position lookup from initialNodes for edge handle calculation
  const nodePositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of initialNodes) {
      map.set(node.id, node.position);
    }
    return map;
  }, [initialNodes]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (sidebarMode) {
      return buildSplitViewEdges();
    }
    return buildNormalEdges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sidebarMode,
    sidebarSelectedItemId,
    noteConnections,
    tags,
    assignments,
    visibleNoteIds,
    nodePositionMap,
    noteTagDots,
    memoTagDots,
    activeEdgeTagId,
  ]);

  function buildNormalEdges(): Edge[] {
    // Manual note-to-note connections (only show if both ends are visible)
    const visibleNodeIds = new Set(initialNodes.map((n) => n.id));
    const filteredManual = noteConnections.filter(
      (c) =>
        visibleNodeIds.has(c.sourceNoteId) &&
        visibleNodeIds.has(c.targetNoteId),
    );

    const manualEdges: Edge[] = filteredManual.map((conn) => ({
      id: `manual-${conn.id}`,
      source: conn.sourceNoteId,
      target: conn.targetNoteId,
      sourceHandle: "center-source",
      targetHandle: "center-target",
      type: "curved",
      style: { stroke: "#6366f1", strokeWidth: 2 },
      data: { connectionType: "manual", connectionId: conn.id, curveOffset: 0 },
    }));

    // Tag-based edges with curve offset for duplicate pairs
    const tagEdges: Edge[] = [];
    const pairEdgeCount = new Map<string, number>();
    const seenPairs = new Set<string>();
    for (const tag of tags) {
      if (activeEdgeTagId && tag.id !== activeEdgeTagId) continue;
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
          const idx = pairEdgeCount.get(basePairKey) ?? 0;
          pairEdgeCount.set(basePairKey, idx + 1);

          // idx 0 → 0, idx 1 → +20, idx 2 → -20, idx 3 → +40, ...
          const curveOffset =
            idx === 0 ? 0 : (idx % 2 === 1 ? 1 : -1) * Math.ceil(idx / 2) * 20;

          tagEdges.push({
            id: pairKey,
            source: n1,
            target: n2,
            sourceHandle: "center-source",
            targetHandle: "center-target",
            type: "curved",
            style: { stroke: tag.color, strokeWidth: 1.5, opacity: 0.6 },
            data: { connectionType: "tag", tagId: tag.id, curveOffset },
          });
        }
      }
    }

    return [...manualEdges, ...tagEdges];
  }

  function buildSplitViewEdges(): Edge[] {
    const selectedId = sidebarSelectedItemId!;
    const selectedTags =
      noteTagDots.get(selectedId) || memoTagDots.get(selectedId) || [];
    const edges: Edge[] = [];
    const seenEdges = new Set<string>();

    for (const tag of selectedTags) {
      const splitId = `${selectedId}__${tag.id}`;
      for (const a of assignments) {
        if (a.tagId === tag.id && a.entityId !== selectedId) {
          if (!nodePositionMap.has(a.entityId)) continue;
          const edgeKey = `split-${tag.id}-${a.entityId}`;
          if (seenEdges.has(edgeKey)) continue;
          seenEdges.add(edgeKey);

          edges.push({
            id: edgeKey,
            source: splitId,
            target: a.entityId,
            sourceHandle: "center-source",
            targetHandle: "center-target",
            type: "curved",
            style: { stroke: tag.color, strokeWidth: 1.5, opacity: 0.7 },
            data: { connectionType: "split", tagId: tag.id, curveOffset: 0 },
          });
        }
      }
    }

    return edges;
  }

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
    setNodes((nds) =>
      nds.map((n) =>
        n.id === focusedNoteId
          ? { ...n, data: { ...n.data, focused: true } }
          : n,
      ),
    );
    setCenter(targetNode.position.x + 40, targetNode.position.y + 20, {
      duration: 500,
      zoom: 1.5,
    });
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

  // fitView when entering sidebar mode or switching selected item
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (sidebarSelectedItemId != null) {
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    }
  }, [sidebarSelectedItemId, fitView]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Save positions on drag end (skip split nodes)
      for (const change of changes) {
        if (
          change.type === "position" &&
          change.dragging === false &&
          change.position
        ) {
          if (!change.id.includes("__")) {
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
        onCreateNoteConnection(connection.source, connection.target);
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
      setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
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

  const applyLayout = useCallback(
    (type: "polygon" | "line") => {
      const visibleNodes = nodesRef.current.filter(
        (n) => n.type === "noteNode" || n.type === "memoNode",
      );
      if (visibleNodes.length === 0) return;
      const ids = visibleNodes.map((n) => n.id);
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
      // Only persist positions for non-split nodes
      for (const [id, pos] of Object.entries(newPositions)) {
        if (!id.includes("__")) {
          positionsRef.current[id] = pos;
        }
      }
      savePositions(positionsRef.current);
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    },
    [setNodes, fitView],
  );

  const savedViewport = useMemo(() => loadViewport(), []);

  if (
    filteredNotes.length === 0 &&
    filteredMemos.length === 0 &&
    initialNodes.length === 0
  ) {
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
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        onMoveEnd={(_event, viewport) => saveViewport(viewport)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode="loose"
        elevateNodesOnSelect
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
            <div className="flex flex-wrap gap-1 max-w-[200px] justify-end">
              {tags.length === 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] border border-notion-border bg-notion-hover text-notion-text-secondary">
                  {t("ideas.untagged")}
                </span>
              ) : (
                tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setActiveEdgeTagId(tag.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      activeEdgeTagId === tag.id
                        ? "text-white border-transparent"
                        : "text-notion-text-secondary border-notion-border bg-notion-bg"
                    }`}
                    style={
                      activeEdgeTagId === tag.id
                        ? { backgroundColor: tag.color }
                        : undefined
                    }
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))
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
