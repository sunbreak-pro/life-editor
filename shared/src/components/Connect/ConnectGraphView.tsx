import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";
import type { NoteNode } from "../../types/note";
import type { DailyNode } from "../../types/daily";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../../types/wikiTagUnified";
import { GraphCanvas } from "./GraphCanvas";
import { GraphTopBar } from "./GraphTopBar";
import { GraphControlPanel } from "./GraphControlPanel";
import { SelectedNodeCard } from "./SelectedNodeCard";
import { BacklinkView, type BacklinkEntry } from "./BacklinkView";
import { useGraphFilters } from "./graph/useGraphFilters";
import {
  buildGraphModel,
  backlinkSourceIds,
  resolveLinkId,
} from "./graph/buildGraphModel";
import { buildAdjacency } from "./graph/graph-render";
import { isTagNodeId } from "./graph/graph-types";
import type { ConnectGraphLabels } from "./labels";

export interface ConnectGraphViewProps {
  /** unified reads (host-fetched). Legacy note_links is NOT used. */
  notes: NoteNode[];
  dailies?: DailyNode[];
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  /** item↔item links — listAllTagConnections() */
  connections: WikiTagConnection[];
  /** all copy, resolved by the host (§6.4 — no useTranslation here) */
  labels: ConnectGraphLabels;
  /** open a note ("activate" / double-click intent) */
  onOpenNote?: (noteId: string) => void;
  /** open a daily by date */
  onOpenDaily?: (date: string) => void;
  /**
   * create a directed item↔item link (host wires the context mutator). May
   * return a promise; a rejection is reported through `onLinkError`.
   */
  onCreateLink?: (fromId: string, toId: string) => void | Promise<void>;
  /** delete the link identified by `linkId` (host wires the context mutator). Rejection → `onLinkError`. */
  onDeleteLink?: (linkId: string) => void | Promise<void>;
  /**
   * Report a link create/delete failure with already-translated copy. The host
   * (ConnectScreen) wires this to its toast; threaded down to SelectedNodeCard.
   */
  onLinkError?: (message: string) => void;
}

/**
 * Connect node graph (Canvas 2D + d3-force) + backlink panel — shared
 * presentational root. The graph model is built from the UNIFIED item-link
 * data (notes / dailies / tags / assignments / connections), NOT the legacy
 * note_links/note_connections (which are Supabase stubs returning []).
 */
export function ConnectGraphView({
  notes,
  dailies,
  tags,
  assignments,
  connections,
  labels,
  onOpenNote,
  onOpenDaily,
  onCreateLink,
  onDeleteLink,
  onLinkError,
}: ConnectGraphViewProps) {
  const snapshot = useMemo(
    () => buildGraphModel({ notes, dailies, tags, assignments, connections }),
    [notes, dailies, tags, assignments, connections],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomK, setZoomK] = useState(1);
  const apiRef = useRef<{ reheat: () => void; resetView: () => void } | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filters = useGraphFilters(snapshot, selectedId);

  // Adjacency over the full graph so the selected card / neighbor list shows
  // every neighbor even when filtered out of the canvas.
  const adjacency = useMemo(
    () => buildAdjacency(snapshot.nodes, snapshot.links),
    [snapshot],
  );
  const nodeById = useMemo(
    () => new Map(snapshot.nodes.map((n) => [n.id, n])),
    [snapshot],
  );

  const handleSelectedIdChange = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

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

  // Backlinks for the selected node: every item that links TO it. Computed
  // client-side from the already-fetched connections (no per-select fetch).
  const backlinks = useMemo<BacklinkEntry[]>(() => {
    if (!selectedId || isTagNodeId(selectedId)) return [];
    return backlinkSourceIds(selectedId, connections).map((id) => ({
      id,
      label: nodeById.get(id)?.label ?? "Untitled",
    }));
  }, [selectedId, connections, nodeById]);

  // Link-edit affordances for the selected node. `neighbors` is the full
  // (depth-filter-independent) adjacency, so `outgoingLinkIds` covers every
  // active outgoing link — used both to map a delete row to its link id and
  // to keep already-linked targets out of the add-candidate list.
  const outgoingLinkIds = useMemo(() => {
    const map = new Map<string, string>();
    if (!selectedId || isTagNodeId(selectedId)) return map;
    for (const n of neighbors) {
      if (isTagNodeId(n.id)) continue;
      const id = resolveLinkId(selectedId, n.id, connections);
      if (id) map.set(n.id, id);
    }
    return map;
  }, [selectedId, neighbors, connections]);

  // Candidates exclude self, tag nodes (links are item↔item; tag association
  // is an assignment, not a connection), and targets already linked outgoing.
  const linkableItems = useMemo(() => {
    if (!selectedId || isTagNodeId(selectedId)) return [];
    return snapshot.nodes
      .filter(
        (n) =>
          n.id !== selectedId &&
          !isTagNodeId(n.id) &&
          !outgoingLinkIds.has(n.id),
      )
      .map((n) => ({ id: n.id, label: n.label }));
  }, [snapshot.nodes, selectedId, outgoingLinkIds]);

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
      if (node.type === "daily") onOpenDaily?.(node.label);
      else onOpenNote?.(id);
    },
    [nodeById, onOpenNote, onOpenDaily],
  );

  // Keyboard shortcuts: Esc clears selection; Cmd/Ctrl+F opens search;
  // R reheats the simulation.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleSelectedIdChange(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        if (!filters.panelOpen) filters.togglePanel();
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }
      if (isTypingTarget(e.target)) return;
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        apiRef.current?.reheat();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSelectedIdChange, filters]);

  return (
    <div className="flex h-full w-full">
      <div className="relative flex-1 min-w-0">
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
        />

        <GraphTopBar
          labels={labels}
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
            <div className="text-center space-y-2 text-lumen-text-secondary">
              <Filter size={32} className="mx-auto opacity-50" />
              <div className="text-[13px]">{labels.noMatch}</div>
              <button
                type="button"
                onClick={filters.clearAll}
                className="mt-2 px-3 py-1 rounded text-[11px] pointer-events-auto bg-lumen-bg border border-lumen-border text-lumen-text hover:bg-lumen-hover"
              >
                {labels.clearFilters}
              </button>
            </div>
          </div>
        )}

        {snapshot.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-lumen-text-secondary">
            {labels.graphEmpty}
          </div>
        )}

        {selectedNode && (
          <SelectedNodeCard
            labels={labels}
            node={selectedNode}
            neighbors={neighbors}
            localDepth={filters.filter.localDepth}
            onLocalDepthChange={filters.setLocalDepth}
            onSelect={handleSelectedIdChange}
            onClose={() => handleSelectedIdChange(null)}
            onActivate={handleActivate}
            linkableItems={linkableItems}
            outgoingLinkIds={outgoingLinkIds}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
            onLinkError={onLinkError}
          />
        )}

        {filters.panelOpen && (
          <GraphControlPanel
            labels={labels}
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
            searchInputRef={searchInputRef}
            onClose={filters.closePanel}
          />
        )}
      </div>

      <BacklinkView
        targetLabel={selectedNode ? selectedNode.label : null}
        entries={backlinks}
        labels={{ title: labels.backlinksTitle, empty: labels.backlinksEmpty }}
        onSelect={handleSelectedIdChange}
      />
    </div>
  );
}
