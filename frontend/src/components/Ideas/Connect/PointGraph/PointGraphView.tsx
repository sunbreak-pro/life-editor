import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Filter } from "lucide-react";
import type {
  WikiTag,
  WikiTagAssignment,
  NoteConnection,
} from "../../../../types/wikiTag";
import type { NoteNode } from "../../../../types/note";
import type { DailyNode } from "../../../../types/daily";
import type { NoteLink } from "../../../../types/noteLink";
import { usePointGraphModel } from "./hooks/usePointGraphModel";
import { useGraphFilters } from "./hooks/useGraphFilters";
import { GraphCanvas } from "./components/GraphCanvas";
import { GraphTopBar } from "./components/GraphTopBar";
import { GraphControlPanel } from "./components/GraphControlPanel";
import { SelectedNodeCard } from "./components/SelectedNodeCard";
import { buildAdjacency } from "./lib/graph-render";
import { isTagNodeId, tagNodeId } from "./lib/graph-types";

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

/**
 * Point Graph — Canvas 2D + d3-force replacement for the React Flow Node tab.
 * Props mirror TagGraphView so ConnectView can swap with no call-site changes.
 */
export interface PointGraphViewProps {
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
  onDeleteDailyEntity: (dailyDate: string) => void;
  notes: NoteNode[];
  dailies: DailyNode[];
  onNavigateToNote?: (noteId: string) => void;
  onNavigateToMemo?: (date: string) => void;
  onUpdateNoteColor?: (noteId: string, color: string) => void;
  focusedNoteId?: string | null;
  onFocusComplete?: () => void;
  sidebarSelectedItemId: string | null;
}

export function PointGraphView({
  notes,
  dailies,
  tags,
  assignments,
  noteConnections,
  noteLinks,
  selectedTagId,
  onSelectTag,
  onNavigateToNote,
  onNavigateToMemo,
  focusedNoteId,
  onFocusComplete,
  sidebarSelectedItemId,
}: PointGraphViewProps) {
  const { t } = useTranslation();

  const snapshot = usePointGraphModel({
    notes,
    dailies,
    tags,
    assignments,
    noteConnections,
    noteLinks,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alpha, setAlpha] = useState(0);
  const [fps, setFps] = useState(0);
  const [zoomK, setZoomK] = useState(1);
  const apiRef = useRef<{ reheat: () => void; resetView: () => void } | null>(
    null,
  );

  const filters = useGraphFilters(snapshot, selectedId);

  // Adjacency over the full graph so the selected card lists every neighbor
  // even when filtered out of the canvas.
  const adjacency = useMemo(
    () => buildAdjacency(snapshot.nodes, snapshot.links),
    [snapshot],
  );
  const nodeById = useMemo(() => {
    const m = new Map(snapshot.nodes.map((n) => [n.id, n]));
    return m;
  }, [snapshot]);

  // Graph-driven selection: reconcile the ConnectSidebar tag selection.
  // Selecting a tag node sets selectedTagId; anything else clears it.
  const handleSelectedIdChange = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id && isTagNodeId(id)) {
        const node = nodeById.get(id);
        onSelectTag(node?.entityId ?? null);
      } else {
        onSelectTag(null);
      }
    },
    [nodeById, onSelectTag],
  );

  // Sync external selection drivers (ConnectSidebar focus / tag selection /
  // focusedNoteId) into selectedId using React's "adjust state when a prop
  // changes" pattern — guarded setState during render, no effect (avoids
  // cascading-render lint and is the officially recommended approach).
  const [prevSidebar, setPrevSidebar] = useState(sidebarSelectedItemId);
  if (sidebarSelectedItemId !== prevSidebar) {
    setPrevSidebar(sidebarSelectedItemId);
    if (sidebarSelectedItemId) setSelectedId(sidebarSelectedItemId);
  }

  const [prevTag, setPrevTag] = useState(selectedTagId);
  if (selectedTagId !== prevTag) {
    setPrevTag(selectedTagId);
    if (selectedTagId) setSelectedId(tagNodeId(selectedTagId));
  }

  const [prevFocus, setPrevFocus] = useState(focusedNoteId ?? null);
  if ((focusedNoteId ?? null) !== prevFocus) {
    setPrevFocus(focusedNoteId ?? null);
    if (focusedNoteId) setSelectedId(focusedNoteId);
  }

  // The only true side-effect: clear the focus highlight after a beat.
  useEffect(() => {
    if (!focusedNoteId) return;
    const timer = window.setTimeout(() => onFocusComplete?.(), 2500);
    return () => window.clearTimeout(timer);
  }, [focusedNoteId, onFocusComplete]);

  const selectedNode = selectedId ? (nodeById.get(selectedId) ?? null) : null;
  const neighbors = useMemo(() => {
    if (!selectedId) return [];
    const ids = adjacency.get(selectedId);
    if (!ids) return [];
    return [...ids]
      .filter((id) => id !== selectedId)
      .map((id) => nodeById.get(id))
      .filter((n): n is NonNullable<typeof n> => n != null);
  }, [selectedId, adjacency, nodeById]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of filters.filtered.nodes) c[n.type] = (c[n.type] || 0) + 1;
    return c;
  }, [filters.filtered]);
  const totalTypeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of snapshot.nodes) c[n.type] = (c[n.type] || 0) + 1;
    return c;
  }, [snapshot]);

  const handleActivate = useCallback(
    (id: string) => {
      if (isTagNodeId(id)) return;
      const node = nodeById.get(id);
      if (!node) return;
      if (node.type === "daily") {
        onNavigateToMemo?.(node.label);
      } else {
        onNavigateToNote?.(id);
      }
    },
    [nodeById, onNavigateToNote, onNavigateToMemo],
  );

  return (
    <div className="relative h-full w-full">
      <GraphCanvas
        snapshot={filters.filtered}
        forces={filters.forces}
        showLabels={filters.showLabels}
        searchMatchSet={filters.searchMatchSet}
        selectedId={selectedId}
        onSelectedIdChange={handleSelectedIdChange}
        onActivate={handleActivate}
        onApiReady={(api) => {
          apiRef.current = api;
        }}
        onZoomChange={setZoomK}
        onAlpha={setAlpha}
        onFps={setFps}
      />

      <GraphTopBar
        alpha={alpha}
        fps={fps}
        zoomPct={Math.round(zoomK * 100)}
        nodeCount={filters.filtered.nodes.length}
        totalCount={snapshot.nodes.length}
        edgeCount={filters.filtered.links.length}
        activeFilterCount={filters.activeFilterCount}
        panelOpen={filters.panelOpen}
        onClearFilters={filters.clearAll}
        onReheat={() => apiRef.current?.reheat()}
        onResetView={() => apiRef.current?.resetView()}
        onTogglePanel={filters.togglePanel}
      />

      {snapshot.nodes.length > 0 && filters.filtered.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2 text-notion-text-secondary">
            <Filter size={32} className="mx-auto opacity-50" />
            <div className="text-[13px]">{t("connect.graph.noMatch")}</div>
            <button
              type="button"
              onClick={filters.clearAll}
              className="mt-2 px-3 py-1 rounded text-[11px] pointer-events-auto bg-notion-bg border border-notion-border text-notion-text hover:bg-notion-hover"
            >
              {t("connect.graph.clearFilters")}
            </button>
          </div>
        </div>
      )}

      {snapshot.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-notion-text-secondary">
          {t("ideas.graphEmpty")}
        </div>
      )}

      {selectedNode && (
        <SelectedNodeCard
          node={selectedNode}
          neighbors={neighbors}
          localDepth={filters.filter.localDepth}
          onLocalDepthChange={filters.setLocalDepth}
          onSelect={handleSelectedIdChange}
          onClose={() => handleSelectedIdChange(null)}
          onActivate={handleActivate}
        />
      )}

      {filters.panelOpen && (
        <GraphControlPanel
          filter={filters.filter}
          onSearchChange={filters.setSearch}
          onToggleType={filters.toggleType}
          onToggleTag={filters.toggleTag}
          onClearTags={filters.clearTags}
          onLocalDepthChange={filters.setLocalDepth}
          showLabels={filters.showLabels}
          onShowLabelsChange={filters.setShowLabels}
          onShowOrphansChange={filters.setShowOrphans}
          forces={filters.forces}
          onForcesChange={filters.setForces}
          tags={tags}
          typeCounts={typeCounts}
          totalTypeCounts={totalTypeCounts}
          selectedLabel={selectedNode ? selectedNode.label : null}
        />
      )}
    </div>
  );
}
