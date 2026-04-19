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
  Hexagon,
  AlignHorizontalSpaceBetween,
  GitBranch,
  StickyNote,
  BookOpen,
  Link2,
} from "lucide-react";
import { applyPolygonLayout, applyLineLayout } from "./layoutTemplates";
import { useReactFlow, ConnectionMode } from "@xyflow/react";
import { UnifiedColorPicker } from "../../shared/UnifiedColorPicker";
import { CanvasControls } from "./CanvasControls";
import { ConnectPanel } from "./ConnectPanel";
import { getContentPreview } from "../../../utils/tiptapText";
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
import type { NoteLink } from "../../../types/noteLink";
import type { FilterItem } from "../../../types/filterItem";
import {
  ENTITY_FILTER_NOTE_ID,
  ENTITY_FILTER_MEMO_ID,
  VIRTUAL_UNTAGGED_ID,
} from "../../../types/filterItem";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { TagFilterOverlay } from "../../shared/TagFilterOverlay";
import { computeForceLayout } from "./forceLayout";

const nodeTypes = {
  noteNode: NoteNodeComponent,
  memoNode: MemoNodeComponent,
};

const edgeTypes = {
  curved: CurvedEdge,
};

interface ConnectRequest {
  tagId: string | null;
  newTagName: string | null;
  newTagColor: string;
  sourceEntityType: "note" | "memo";
  sourceEntityId: string;
  targetEntityType: "note" | "memo";
  targetEntityId: string;
  sourceTagIds: string[];
  targetTagIds: string[];
}

interface TagGraphViewProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  noteConnections: NoteConnection[];
  noteLinks: NoteLink[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onCreateNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  onDeleteNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  onConnectViaTag: (req: ConnectRequest) => Promise<void>;
  onDeleteNoteEntity: (noteId: string) => void;
  onDeleteMemoEntity: (memoDate: string) => void;
  notes: NoteNode[];
  memos: MemoNode[];
  onNavigateToNote?: (noteId: string) => void;
  onNavigateToMemo?: (date: string) => void;
  onUpdateNoteColor?: (noteId: string, color: string) => void;
  focusedNoteId?: string | null;
  onFocusComplete?: () => void;
  sidebarSelectedItemId: string | null;
}

const VIRTUAL_LINK_EDGES_HIDDEN_ID = "__virtual:link-edges-hidden";

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

function isSpecialFilterId(id: string): boolean {
  return id.startsWith("__");
}

export function TagGraphView({
  tags,
  assignments,
  noteConnections,
  noteLinks,
  selectedTagId,
  onSelectTag,
  onCreateNoteConnection,
  onDeleteNoteConnection,
  onConnectViaTag,
  onDeleteNoteEntity,
  onDeleteMemoEntity,
  notes,
  memos,
  onNavigateToNote,
  onNavigateToMemo,
  onUpdateNoteColor,
  focusedNoteId,
  onFocusComplete,
  sidebarSelectedItemId,
}: TagGraphViewProps) {
  const { t } = useTranslation();
  const positionsRef = useRef(loadPositions());
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number;
    y: number;
    nodeType: "note" | "memo";
    entityId: string;
    color?: string;
  } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string;
    sourceType: "note" | "memo";
    sourceTitle: string;
    targetId: string;
    targetType: "note" | "memo";
    targetTitle: string;
  } | null>(null);

  const sidebarMode = sidebarSelectedItemId != null;

  const resolveNodeInfo = useCallback(
    (id: string): { type: "note" | "memo"; title: string } | null => {
      const note = notes.find((n) => n.id === id);
      if (note) return { type: "note", title: note.title || "Untitled" };
      const memo = memos.find((m) => m.id === id);
      if (memo) return { type: "memo", title: memo.date };
      return null;
    },
    [notes, memos],
  );

  // Filter state (normal mode only) — multi-select, supports tag/entity/virtual IDs
  const [activeFilterIds, setActiveFilterIds] = useState<Set<string>>(
    new Set(),
  );
  const [showCanvasFilter, setShowCanvasFilter] = useState(false);

  // R1: Combine canvas and sidebar selection
  const focusedItemId = sidebarSelectedItemId ?? selectedNodeId;

  const focusedItemTagIds = useMemo(() => {
    if (!focusedItemId) return null;
    const tagIds = new Set<string>();
    for (const a of assignments) {
      if (a.entityId === focusedItemId) tagIds.add(a.tagId);
    }
    return tagIds;
  }, [focusedItemId, assignments]);

  // Remove activeFilterIds that reference tags no longer in the displayed tag list
  // Keep special IDs (__ prefix) as-is
  useEffect(() => {
    const validTagIds = new Set(tags.map((t) => t.id));
    setActiveFilterIds((prev) => {
      const filtered = new Set(
        [...prev].filter((id) => isSpecialFilterId(id) || validTagIds.has(id)),
      );
      if (filtered.size === prev.size) return prev;
      return filtered;
    });
  }, [tags]);

  // R1: Reset activeFilterIds when focused item changes (only real tag IDs)
  useEffect(() => {
    if (!focusedItemTagIds) return;
    setActiveFilterIds((prev) => {
      const filtered = new Set(
        [...prev].filter(
          (id) => isSpecialFilterId(id) || focusedItemTagIds.has(id),
        ),
      );
      if (filtered.size === prev.size) return prev;
      return filtered;
    });
  }, [focusedItemTagIds]);

  // Decompose activeFilterIds into categories
  const activeFilterResult = useMemo(() => {
    const entityTypes = new Set<string>();
    const realTagIds = new Set<string>();
    let hasUntagged = false;

    for (const id of activeFilterIds) {
      if (id === ENTITY_FILTER_NOTE_ID || id === ENTITY_FILTER_MEMO_ID) {
        entityTypes.add(id);
      } else if (id === VIRTUAL_UNTAGGED_ID) {
        hasUntagged = true;
      } else if (id === VIRTUAL_LINK_EDGES_HIDDEN_ID) {
        // handled separately via linkEdgesHidden
      } else {
        realTagIds.add(id);
      }
    }

    return { entityTypes, realTagIds, hasUntagged };
  }, [activeFilterIds]);

  // IDs of entities that have at least one tag assignment
  const taggedEntityIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of assignments) {
      set.add(a.entityId);
    }
    return set;
  }, [assignments]);

  // Untagged entity IDs (notes and memos without any tag)
  const untaggedEntityIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      if (!n.isDeleted && !taggedEntityIds.has(n.id)) set.add(n.id);
    }
    for (const m of memos) {
      if (!m.isDeleted && !taggedEntityIds.has(m.id)) set.add(m.id);
    }
    return set;
  }, [notes, memos, taggedEntityIds]);

  const displayTags = useMemo(
    () =>
      focusedItemTagIds
        ? tags.filter((t) => focusedItemTagIds.has(t.id))
        : tags,
    [focusedItemTagIds, tags],
  );

  // Build displayFilterItems for the canvas filter overlay
  const displayFilterItems = useMemo<FilterItem[]>(() => {
    const items: FilterItem[] = [];

    // Entity-type filters
    items.push({
      id: ENTITY_FILTER_NOTE_ID,
      kind: "entity-type",
      name: t("ideas.notes"),
      icon: StickyNote,
      textColor: "var(--notion-text-secondary)",
    });
    items.push({
      id: ENTITY_FILTER_MEMO_ID,
      kind: "entity-type",
      name: t("ideas.daily"),
      icon: BookOpen,
      textColor: "var(--notion-text-secondary)",
    });

    // Real tags
    for (const tag of displayTags) {
      items.push({
        id: tag.id,
        kind: "tag",
        name: tag.name,
        color: tag.color,
      });
    }

    // Virtual untagged tag (only if untagged items exist)
    if (untaggedEntityIds.size > 0) {
      items.push({
        id: VIRTUAL_UNTAGGED_ID,
        kind: "virtual-tag",
        name: t("ideas.untaggedLabel"),
        color: "#d1d5db",
      });
    }

    // Virtual "hide link edges" toggle (selected = hidden)
    items.push({
      id: VIRTUAL_LINK_EDGES_HIDDEN_ID,
      kind: "virtual-tag",
      name: t("connect.linkEdges"),
      icon: Link2,
      textColor: "#10b981",
    });

    return items;
  }, [displayTags, untaggedEntityIds, t]);

  const linkEdgesHidden = activeFilterIds.has(VIRTUAL_LINK_EDGES_HIDDEN_ID);

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
    // Add virtual untagged dot for notes without tags
    for (const n of notes) {
      if (!n.isDeleted && !map.has(n.id)) {
        map.set(n.id, [
          {
            id: VIRTUAL_UNTAGGED_ID,
            name: t("ideas.untaggedLabel"),
            color: "#d1d5db",
          },
        ]);
      }
    }
    return map;
  }, [assignments, tags, notes, t]);

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
    // Add virtual untagged dot for memos without tags
    for (const m of memos) {
      if (!m.isDeleted && !map.has(m.id)) {
        map.set(m.id, [
          {
            id: VIRTUAL_UNTAGGED_ID,
            name: t("ideas.untaggedLabel"),
            color: "#d1d5db",
          },
        ]);
      }
    }
    return map;
  }, [assignments, tags, memos, t]);

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
    // Exclude virtual tags from relationship calculation
    const realTags = selectedTags.filter((t) => !isSpecialFilterId(t.id));
    if (realTags.length === 0) return new Set([selectedNodeId]);
    const selectedTagIds = new Set(realTags.map((t) => t.id));
    const related = new Set<string>([selectedNodeId]);
    for (const a of assignments) {
      if (selectedTagIds.has(a.tagId)) {
        related.add(a.entityId);
      }
    }
    return related;
  }, [selectedNodeId, sidebarMode, noteTagDots, memoTagDots, assignments]);

  function buildLinksFromTagsAndConnections(
    nodeIds: string[],
    allTags: WikiTag[],
    allAssignments: WikiTagAssignment[],
    allConnections: NoteConnection[],
  ): Array<{ source: string; target: string }> {
    const idSet = new Set(nodeIds);
    const links: Array<{ source: string; target: string }> = [];
    const seen = new Set<string>();

    // Tag-based links
    for (const tag of allTags) {
      const tagged = allAssignments
        .filter((a) => a.tagId === tag.id && idSet.has(a.entityId))
        .map((a) => a.entityId);
      for (let i = 0; i < tagged.length; i++) {
        for (let j = i + 1; j < tagged.length; j++) {
          const key = `${tagged[i]}---${tagged[j]}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push({ source: tagged[i], target: tagged[j] });
          }
        }
      }
    }

    // Manual connections
    for (const conn of allConnections) {
      if (idSet.has(conn.sourceNoteId) && idSet.has(conn.targetNoteId)) {
        const key = `${conn.sourceNoteId}---${conn.targetNoteId}`;
        if (!seen.has(key)) {
          seen.add(key);
          links.push({ source: conn.sourceNoteId, target: conn.targetNoteId });
        }
      }
    }

    return links;
  }

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
    activeFilterIds,
  ]);

  function buildNormalNodes(): Node[] {
    const saved = positionsRef.current;
    const { entityTypes, realTagIds, hasUntagged } = activeFilterResult;
    const hasAnyFilter =
      entityTypes.size > 0 || realTagIds.size > 0 || hasUntagged;

    // Apply OR filter across all filter types
    let visibleNotes = filteredNotes;
    let visibleMemosList = filteredMemos;

    if (hasAnyFilter) {
      // Compute entity IDs that match real tag filters
      const tagMatchIds =
        realTagIds.size > 0
          ? new Set(
              assignments
                .filter((a) => realTagIds.has(a.tagId))
                .map((a) => a.entityId),
            )
          : new Set<string>();

      visibleNotes = filteredNotes.filter((n) => {
        // Entity-type filter: if note entity type selected, include all notes
        if (entityTypes.has(ENTITY_FILTER_NOTE_ID)) return true;
        // Tag filter: if note matches any selected real tag
        if (realTagIds.size > 0 && tagMatchIds.has(n.id)) return true;
        // Untagged filter: if note has no tags
        if (hasUntagged && untaggedEntityIds.has(n.id)) return true;
        return false;
      });

      visibleMemosList = filteredMemos.filter((m) => {
        if (entityTypes.has(ENTITY_FILTER_MEMO_ID)) return true;
        if (realTagIds.size > 0 && tagMatchIds.has(m.id)) return true;
        if (hasUntagged && untaggedEntityIds.has(m.id)) return true;
        return false;
      });
    }

    // Compute force layout for nodes without saved positions
    const allVisibleItems = [
      ...visibleNotes.map((n) => n.id),
      ...visibleMemosList.map((m) => m.id),
    ];
    const unsavedIds = allVisibleItems.filter((id) => !saved[id]);
    let forcePositions: Record<string, { x: number; y: number }> = {};

    if (unsavedIds.length > 0) {
      const links = buildLinksFromTagsAndConnections(
        unsavedIds,
        tags,
        assignments,
        noteConnections,
      );
      forcePositions = computeForceLayout(unsavedIds, links);
      Object.assign(positionsRef.current, forcePositions);
      savePositions(positionsRef.current);
    }

    const noteNodes: Node[] = visibleNotes.map((note) => {
      const pos = saved[note.id] ?? forcePositions[note.id] ?? { x: 0, y: 0 };
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
          contentPreview: getContentPreview(note.content),
          noteId: note.id,
          color: note.color,
          tagDots: dots,
          highlighted,
          dimmed,
        },
      };
    });

    const memoNodes: Node[] = visibleMemosList.map((memo) => {
      const pos = saved[memo.id] ?? forcePositions[memo.id] ?? { x: 0, y: 0 };
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
          contentPreview: getContentPreview(memo.content),
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

    const allTags = selectedNote
      ? noteTagDots.get(selectedId) || []
      : memoTagDots.get(selectedId) || [];
    // Only use real tags for split view
    const realAllTags = allTags.filter((t) => !isSpecialFilterId(t.id));
    const realActiveTagIds = new Set(
      [...activeFilterIds].filter((id) => !isSpecialFilterId(id)),
    );
    const selectedTags =
      realActiveTagIds.size > 0
        ? realAllTags.filter((t) => realActiveTagIds.has(t.id))
        : realAllTags;

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
              contentPreview: getContentPreview(selectedNote.content),
              noteId: selectedNote.id,
              color: selectedNote.color,
              tagDots: allTags,
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
            contentPreview: getContentPreview(selectedMemo!.content),
            memoId: selectedMemo!.id,
            tagDots: allTags,
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
            contentPreview: getContentPreview(selectedNote.content),
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
          contentPreview: getContentPreview(selectedMemo!.content),
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
              contentPreview: getContentPreview(note.content),
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
              contentPreview: getContentPreview(memo.content),
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
    noteLinks,
    linkEdgesHidden,
    tags,
    assignments,
    visibleNoteIds,
    nodePositionMap,
    noteTagDots,
    memoTagDots,
    activeFilterIds,
    relatedNodeIds,
  ]);

  function buildNormalEdges(): Edge[] {
    // Manual note-to-note connections (only show if both ends are visible)
    const visibleNodeIds = new Set(initialNodes.map((n) => n.id));
    const filteredManual = noteConnections.filter(
      (c) =>
        visibleNodeIds.has(c.sourceNoteId) &&
        visibleNodeIds.has(c.targetNoteId),
    );

    const manualEdges: Edge[] = filteredManual.map((conn) => {
      const shouldDim =
        relatedNodeIds != null &&
        (!relatedNodeIds.has(conn.sourceNoteId) ||
          !relatedNodeIds.has(conn.targetNoteId));
      return {
        id: `manual-${conn.id}`,
        source: conn.sourceNoteId,
        target: conn.targetNoteId,
        sourceHandle: "center-source",
        targetHandle: "center-target",
        type: "curved",
        style: {
          stroke: "#6366f1",
          strokeWidth: 2,
          opacity: shouldDim ? 0.08 : undefined,
        },
        data: {
          connectionType: "manual",
          connectionId: conn.id,
          curveOffset: 0,
        },
      };
    });

    // Only use real tags for edge filtering (exclude __ prefix)
    const realActiveTagIds = new Set(
      [...activeFilterIds].filter((id) => !isSpecialFilterId(id)),
    );

    // Tag-based edges with curve offset for duplicate pairs
    const tagEdges: Edge[] = [];
    const pairEdgeCount = new Map<string, number>();
    const seenPairs = new Set<string>();
    for (const tag of tags) {
      if (realActiveTagIds.size > 0 && !realActiveTagIds.has(tag.id)) continue;
      const noteIdsForTag = assignments
        .filter((a) => a.tagId === tag.id && a.entityType === "note")
        .map((a) => a.entityId)
        .filter((id) => visibleNodeIds.has(id));

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

          const shouldDim =
            relatedNodeIds != null &&
            (!relatedNodeIds.has(n1) || !relatedNodeIds.has(n2));
          tagEdges.push({
            id: pairKey,
            source: n1,
            target: n2,
            sourceHandle: "center-source",
            targetHandle: "center-target",
            type: "curved",
            style: {
              stroke: tag.color,
              strokeWidth: 1.5,
              opacity: shouldDim ? 0.08 : 0.6,
            },
            data: { connectionType: "tag", tagId: tag.id, curveOffset },
          });
        }
      }
    }

    // Note Link-based edges (dashed, emerald). Hidden when linkEdgesHidden.
    const linkEdges: Edge[] = [];
    if (!linkEdgesHidden) {
      const seenLinkPairs = new Set<string>();
      for (const link of noteLinks) {
        const sourceId =
          link.sourceNoteId ??
          (link.sourceMemoDate ? `memo-${link.sourceMemoDate}` : null);
        const targetId = link.targetNoteId;
        if (!sourceId || !targetId) continue;
        if (sourceId === targetId) continue;
        if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) {
          continue;
        }

        const basePairKey = `${sourceId < targetId ? sourceId : targetId}---${sourceId < targetId ? targetId : sourceId}`;
        const dedupKey = `link-${basePairKey}`;
        if (seenLinkPairs.has(dedupKey)) continue;
        seenLinkPairs.add(dedupKey);

        const idx = pairEdgeCount.get(basePairKey) ?? 0;
        pairEdgeCount.set(basePairKey, idx + 1);
        const curveOffset =
          idx === 0 ? 0 : (idx % 2 === 1 ? 1 : -1) * Math.ceil(idx / 2) * 20;

        const shouldDim =
          relatedNodeIds != null &&
          (!relatedNodeIds.has(sourceId) || !relatedNodeIds.has(targetId));
        linkEdges.push({
          id: dedupKey,
          source: sourceId,
          target: targetId,
          sourceHandle: "center-source",
          targetHandle: "center-target",
          type: "curved",
          style: {
            stroke: "#10b981",
            strokeWidth: 1.5,
            strokeDasharray: "5 3",
            opacity: shouldDim ? 0.08 : 0.75,
          },
          data: {
            connectionType: "link",
            linkId: link.id,
            curveOffset,
          },
        });
      }
    }

    return [...manualEdges, ...tagEdges, ...linkEdges];
  }

  function buildSplitViewEdges(): Edge[] {
    const selectedId = sidebarSelectedItemId!;
    const allTags =
      noteTagDots.get(selectedId) || memoTagDots.get(selectedId) || [];
    // Only use real tags for split view edges
    const realAllTags = allTags.filter((t) => !isSpecialFilterId(t.id));
    const realActiveTagIds = new Set(
      [...activeFilterIds].filter((id) => !isSpecialFilterId(id)),
    );
    const selectedTags =
      realActiveTagIds.size > 0
        ? realAllTags.filter((t) => realActiveTagIds.has(t.id))
        : realAllTags;
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
    setCenter(targetNode.position.x + 5, targetNode.position.y + 5, {
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
        !connection.source ||
        !connection.target ||
        connection.source === connection.target
      ) {
        return;
      }
      if (connectMode) {
        const srcInfo = resolveNodeInfo(connection.source);
        const tgtInfo = resolveNodeInfo(connection.target);
        if (!srcInfo || !tgtInfo) return;
        setPendingConnection({
          sourceId: connection.source,
          sourceType: srcInfo.type,
          sourceTitle: srcInfo.title,
          targetId: connection.target,
          targetType: tgtInfo.type,
          targetTitle: tgtInfo.title,
        });
        return;
      }
      onCreateNoteConnection(connection.source, connection.target);
    },
    [connectMode, onCreateNoteConnection, resolveNodeInfo],
  );

  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      for (const node of deletedNodes) {
        if (node.type === "noteNode") {
          onDeleteNoteEntity(node.id);
        } else if (node.type === "memoNode") {
          const date = node.id.startsWith("memo-")
            ? node.id.slice("memo-".length)
            : node.id;
          onDeleteMemoEntity(date);
        }
      }
    },
    [onDeleteNoteEntity, onDeleteMemoEntity],
  );

  const handleConfirmConnect = useCallback(
    async (payload: {
      tagId: string | null;
      newTagName: string | null;
      sourceTagIds: string[];
      targetTagIds: string[];
      newTagColor: string;
    }) => {
      if (!pendingConnection) return;
      await onConnectViaTag({
        tagId: payload.tagId,
        newTagName: payload.newTagName,
        newTagColor: payload.newTagColor,
        sourceEntityType: pendingConnection.sourceType,
        sourceEntityId: pendingConnection.sourceId,
        targetEntityType: pendingConnection.targetType,
        targetEntityId: pendingConnection.targetId,
        sourceTagIds: payload.sourceTagIds,
        targetTagIds: payload.targetTagIds,
      });
      setPendingConnection(null);
    },
    [pendingConnection, onConnectViaTag],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.connectionType === "manual") {
        onDeleteNoteConnection(edge.source, edge.target);
      }
    },
    [onDeleteNoteConnection],
  );

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
    if (node.type === "noteNode") {
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeType: "note",
        entityId: node.data.noteId as string,
        color: node.data.color as string | undefined,
      });
    } else if (node.type === "memoNode") {
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeType: "memo",
        entityId: node.data.date as string,
      });
    }
  }, []);

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
    setNodeContextMenu(null);
    setSelectedNodeId(null);
    setShowCanvasFilter(false);
  }, [onSelectTag]);

  const applyLayout = useCallback(
    (type: "polygon" | "line" | "force") => {
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
      if (type === "force") {
        const links = buildLinksFromTagsAndConnections(
          ids,
          tags,
          assignments,
          noteConnections,
        );
        newPositions = computeForceLayout(ids, links);
        // Offset to center around current average
        for (const id of ids) {
          if (newPositions[id]) {
            newPositions[id].x += center.x;
            newPositions[id].y += center.y;
          }
        }
      } else if (type === "polygon") {
        const radius = Math.max(80, ids.length * 20);
        newPositions = applyPolygonLayout(ids, center, radius);
      } else {
        newPositions = applyLineLayout(
          ids,
          { x: center.x - ((ids.length - 1) * 80) / 2, y: center.y },
          80,
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
    [setNodes, fitView, tags, assignments, noteConnections],
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
    <div
      className={
        "h-full w-full" + (connectMode ? " tag-graph-connect-mode" : "")
      }
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        onMoveEnd={(_event, viewport) => saveViewport(viewport)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable={connectMode && !sidebarMode}
        nodesDraggable={!connectMode}
        panOnDrag={false}
        selectionOnDrag={!connectMode}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        selectNodesOnDrag={false}
        deleteKeyCode={connectMode ? null : ["Delete", "Backspace"]}
        multiSelectionKeyCode="Shift"
        onNodesDelete={handleNodesDelete}
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
            <button
              onClick={() => applyLayout("force")}
              className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
              title={t("ideas.layoutForce")}
            >
              <GitBranch size={14} />
            </button>
          </div>
        </Panel>
        <Panel position="top-right">
          <div className="flex flex-col gap-1 items-end">
            <CanvasControls
              showFilter
              filterCount={activeFilterIds.size}
              onFilterClick={() => setShowCanvasFilter((v) => !v)}
              showConnect={!sidebarMode}
              connectMode={connectMode}
              onToggleConnectMode={() => setConnectMode((v) => !v)}
              connectLabel={t("connect.toggleConnectMode")}
            />
            {showCanvasFilter && (
              <div className="relative">
                <div className="absolute right-0 top-0 z-20">
                  <TagFilterOverlay
                    tags={displayTags}
                    selectedTagIds={[...activeFilterIds]}
                    onToggle={(id) =>
                      setActiveFilterIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) {
                          next.delete(id);
                        } else {
                          next.add(id);
                        }
                        return next;
                      })
                    }
                    onClose={() => setShowCanvasFilter(false)}
                    items={displayFilterItems}
                  />
                </div>
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
      {nodeContextMenu &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setNodeContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setNodeContextMenu(null);
            }}
          >
            <div
              className="absolute bg-notion-bg border border-notion-border rounded-lg shadow-lg p-2 w-52"
              style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {nodeContextMenu.nodeType === "note" ? (
                <>
                  <button
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-notion-hover text-notion-text"
                    onClick={() => {
                      onNavigateToNote?.(nodeContextMenu.entityId);
                      setNodeContextMenu(null);
                    }}
                  >
                    {t("ideas.openNote")}
                  </button>
                  <div className="border-t border-notion-border my-1" />
                  <div className="px-2 py-1">
                    <p className="text-[10px] text-notion-text-secondary mb-1.5">
                      {t("ideas.noteColor")}
                    </p>
                    <UnifiedColorPicker
                      color={nodeContextMenu.color || "#D5E8F5"}
                      onChange={(color) => {
                        onUpdateNoteColor?.(nodeContextMenu.entityId, color);
                      }}
                      mode="preset-full"
                      inline
                    />
                  </div>
                </>
              ) : (
                <button
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-notion-hover text-notion-text"
                  onClick={() => {
                    onNavigateToMemo?.(nodeContextMenu.entityId);
                    setNodeContextMenu(null);
                  }}
                >
                  {t("ideas.openMemo")}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
      {pendingConnection && (
        <ConnectPanel
          sourceEntityType={pendingConnection.sourceType}
          sourceEntityId={pendingConnection.sourceId}
          sourceTitle={pendingConnection.sourceTitle}
          targetEntityType={pendingConnection.targetType}
          targetEntityId={pendingConnection.targetId}
          targetTitle={pendingConnection.targetTitle}
          tags={tags}
          assignments={assignments}
          onCancel={() => setPendingConnection(null)}
          onConnect={handleConfirmConnect}
        />
      )}
    </div>
  );
}
