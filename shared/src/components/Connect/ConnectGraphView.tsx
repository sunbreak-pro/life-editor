import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Network, Maximize2, SlidersHorizontal } from "lucide-react";
import type { NoteNode } from "../../types/note";
import type { DailyNode } from "../../types/daily";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../../types/wikiTagUnified";
import { useRightSidebarOptional } from "../../hooks/useRightSidebarContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { RightSidebarPortal } from "../RightSidebarPortal";
import { GraphCanvas } from "./GraphCanvas";
import { ConnectHeader } from "./ConnectHeader";
import { GraphLegend } from "./GraphLegend";
import { GraphStates } from "./GraphStates";
import { GraphControlPanel } from "./GraphControlPanel";
import { SelectedNodeCard } from "./SelectedNodeCard";
import { BacklinkView, type BacklinkEntry } from "./BacklinkView";
import { NodeDetailSheet } from "./mobile/NodeDetailSheet";
import { GraphSettingsSheet } from "./mobile/GraphSettingsSheet";
import {
  ConnectSidebarPanel,
  type ConnectSidebarTab,
} from "./ConnectSidebarPanel";
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
  /**
   * True until the host's first fetch resolves. Drives the loading overlay so
   * the empty state can't flash before any data has arrived.
   */
  isLoading?: boolean;
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
 *
 * Layout (target IA / App Shell Turn 2): a section header row on top, the
 * canvas area below (legend top-left, zoom pill bottom-right, selected-node
 * card bottom-left, state overlays), and a "Graph settings / Backlinks" 2-tab
 * body portalled into the shell's push-in rightSidebar. Open/close of that
 * panel is owned by the shell (RightSidebarProvider) — this view only calls
 * open() and picks the tab.
 */
export function ConnectGraphView({
  notes,
  dailies,
  tags,
  assignments,
  connections,
  labels,
  isLoading = false,
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
  const [sidebarTab, setSidebarTab] = useState<ConnectSidebarTab>("settings");
  // Mobile-only: the graph-settings modal bottom sheet (shell rightSidebar is
  // not used on Mobile — the peek sheet / settings sheet are Connect-local).
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  // Match the shell's wide↔narrow switch (MainScreen useMediaQuery). Fallback
  // true (wide) so jsdom tests keep the Desktop tree.
  const isWide = useMediaQuery("(min-width: 768px)", true);
  const apiRef = useRef<{ reheat: () => void; resetView: () => void } | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Shell rightSidebar (App Shell Turn 2). Optional so a standalone / test
  // render without the Provider degrades gracefully (open() becomes a no-op).
  const sidebar = useRightSidebarOptional();

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
    return backlinkSourceIds(selectedId, connections).map((id) => {
      const n = nodeById.get(id);
      return { id, label: n?.label ?? "Untitled", type: n?.type };
    });
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

  // Open the rightSidebar and jump to a tab (used by Cmd+F → settings and the
  // card's "Backlinks N" link → backlinks). open() is a no-op without a shell.
  const openSidebarTab = useCallback(
    (tab: ConnectSidebarTab) => {
      setSidebarTab(tab);
      sidebar?.open();
    },
    [sidebar],
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
        // Narrow: the search input lives in the Mobile settings sheet; wide:
        // in the shell rightSidebar's settings tab. Both host the SAME
        // GraphControlPanel (searchInputRef), so one focus call serves both.
        if (isWide) openSidebarTab("settings");
        else setMobileSettingsOpen(true);
        // The search input mounts once the panel/sheet opens; wait two frames
        // for the portal to attach before focusing it.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => searchInputRef.current?.focus()),
        );
        return;
      }
      if (isTypingTarget(e.target)) return;
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        apiRef.current?.reheat();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSelectedIdChange, openSidebarTab, isWide]);

  // Which "no graph" overlay (if any) to show over the canvas.
  const hasNodes = snapshot.nodes.length > 0;
  const graphState: "loading" | "empty" | "nomatch" | null = isLoading
    ? "loading"
    : !hasNodes
      ? "empty"
      : filters.filtered.nodes.length === 0
        ? "nomatch"
        : null;
  const showCanvasChrome = !isLoading && hasNodes && graphState !== "nomatch";

  const settingsContent = (
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
    />
  );

  const backlinksContent = (
    <BacklinkView
      node={selectedNode && !isTagNodeId(selectedNode.id) ? selectedNode : null}
      entries={backlinks}
      labels={{
        incomingLinks: labels.incomingLinks,
        empty: labels.backlinksEmpty,
        selectHint: labels.selectNodeHint,
      }}
      onSelect={handleSelectedIdChange}
    />
  );

  // ---- Mobile (touch) layout ----------------------------------------------
  // No shell rightSidebar portal / zoom pill / floating card: a compact header
  // row + horizontal legend strip + touch-sized canvas, with a non-modal peek
  // sheet for the selected node and a modal bottom sheet for graph settings.
  if (!isWide) {
    const showLegend = hasNodes && !isLoading && graphState !== "nomatch";
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex shrink-0 items-center gap-2 px-4 pt-1">
          <Network size={16} className="shrink-0 text-lumen-accent" />
          <span className="text-[16px] font-semibold text-lumen-text">
            {labels.title}
          </span>
          <span className="rounded-lumen-sm bg-lumen-surface-sunken px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-lumen-text-secondary">
            {filters.filtered.nodes.length}n · {filters.filtered.links.length}e
          </span>
          <button
            type="button"
            onClick={() => apiRef.current?.resetView()}
            aria-label={labels.fitView}
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lumen-md border border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setMobileSettingsOpen(true)}
            aria-label={labels.settingsTab}
            aria-pressed={mobileSettingsOpen}
            className={
              "grid h-9 w-9 shrink-0 place-items-center rounded-lumen-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent " +
              (mobileSettingsOpen
                ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
                : "border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover")
            }
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {showLegend && (
          <div className="shrink-0 overflow-x-auto px-4 pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <GraphLegend labels={labels} className="w-max" />
          </div>
        )}

        <div className="relative min-h-0 min-w-0 flex-1">
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
            nodeSizeScale={1.7}
          />

          {graphState && (
            <GraphStates
              state={graphState}
              labels={labels}
              query={filters.filter.search}
              onClear={filters.clearAll}
            />
          )}

          {selectedNode && (
            <NodeDetailSheet
              labels={labels}
              node={selectedNode}
              neighbors={neighbors}
              backlinks={backlinks}
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
        </div>

        <GraphSettingsSheet
          open={mobileSettingsOpen}
          onClose={() => setMobileSettingsOpen(false)}
          title={labels.mobileSettingsTitle}
        >
          {settingsContent}
        </GraphSettingsSheet>
      </div>
    );
  }

  // ---- Desktop layout ------------------------------------------------------
  return (
    <div className="flex h-full w-full flex-col">
      <ConnectHeader
        labels={labels}
        nodeCount={filters.filtered.nodes.length}
        totalCount={snapshot.nodes.length}
        edgeCount={filters.filtered.links.length}
        activeFilterCount={filters.activeFilterCount}
        onClearFilters={filters.clearAll}
        onReheat={() => apiRef.current?.reheat()}
        onResetView={() => apiRef.current?.resetView()}
      />

      <div className="relative min-h-0 flex-1 min-w-0">
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

        {hasNodes && !isLoading && (
          <GraphLegend labels={labels} className="absolute left-4 top-3" />
        )}

        {showCanvasChrome && (
          <div
            className="absolute bottom-3 right-3 flex items-center rounded-lumen-full bg-lumen-bg border border-lumen-border px-3 py-1 font-mono text-[10px] text-lumen-text-tertiary shadow-lumen-sm"
            aria-label={labels.zoom}
          >
            {Math.round(zoomK * 100)}%
          </div>
        )}

        {graphState && (
          <GraphStates
            state={graphState}
            labels={labels}
            query={filters.filter.search}
            onClear={filters.clearAll}
          />
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
            backlinkCount={backlinks.length}
            onViewBacklinks={
              isTagNodeId(selectedNode.id)
                ? undefined
                : () => openSidebarTab("backlinks")
            }
            linkableItems={linkableItems}
            outgoingLinkIds={outgoingLinkIds}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
            onLinkError={onLinkError}
          />
        )}
      </div>

      <RightSidebarPortal>
        <ConnectSidebarPanel
          labels={labels}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          backlinkCount={backlinks.length}
          settingsContent={settingsContent}
          backlinksContent={backlinksContent}
        />
      </RightSidebarPortal>
    </div>
  );
}
