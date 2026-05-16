import { useEffect, useMemo, useRef, useState } from "react";
import type { Simulation } from "d3-force";
import type { Quadtree } from "d3-quadtree";
import type { GraphLink, GraphNode, GraphSnapshot } from "../lib/graph-types";
import {
  buildAdjacency,
  type RenderState,
  type Transform,
} from "../lib/graph-render";
import {
  resolvePalette,
  subscribeThemeChange,
  type GraphPalette,
} from "../lib/graph-theme";
import { loadViewport } from "../lib/pointGraphStorage";
import {
  usePointGraphSimulation,
  type ForceParams,
} from "../hooks/usePointGraphSimulation";
import { usePointGraphInteraction } from "../hooks/usePointGraphInteraction";

interface GraphCanvasProps {
  snapshot: GraphSnapshot;
  forces: ForceParams;
  showLabels: boolean;
  searchMatchSet: Set<string> | null;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  /** double-click a node ("open" intent) */
  onActivate?: (id: string) => void;
  /** exposes imperative actions (reheat) once the canvas is ready */
  onApiReady?: (api: { reheat: () => void }) => void;
  onAlpha?: (a: number) => void;
  onFps?: (fps: number) => void;
}

export function GraphCanvas({
  snapshot,
  forces,
  showLabels,
  searchMatchSet,
  selectedId,
  onSelectedIdChange,
  onActivate,
  onApiReady,
  onAlpha,
  onFps,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const transformRef = useRef<Transform>(
    loadViewport() ?? { x: 0, y: 0, k: 1 },
  );
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const quadtreeRef = useRef<Quadtree<GraphNode> | null>(null);
  const graphRef = useRef<GraphSnapshot>({ nodes: [], links: [] });
  const positionCacheRef = useRef<Record<string, { x: number; y: number }>>({});
  const drawRef = useRef<(() => void) | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [palette, setPalette] = useState<GraphPalette>(() => resolvePalette());

  // Re-resolve theme colors on light/dark or manual theme switch
  useEffect(() => {
    return subscribeThemeChange(() => {
      setPalette(resolvePalette());
      drawRef.current?.();
    });
  }, []);

  // Track container size
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const adjacency = useMemo(
    () => buildAdjacency(snapshot.nodes, snapshot.links),
    [snapshot],
  );

  // Working graph: clone so d3 can mutate. Cached-position restore happens
  // inside the simulation effect (refs must not be read during render).
  const workingGraph = useMemo<GraphSnapshot>(
    () => ({
      nodes: snapshot.nodes.map((n) => ({ ...n })),
      links: snapshot.links.map((l) => ({ ...l })),
    }),
    [snapshot],
  );

  const renderStateRef = useRef<
    Omit<RenderState, "nodes" | "links" | "transform" | "size">
  >({
    palette,
    hoveredId,
    selectedId,
    adjacency,
    searchMatchSet,
    showLabels,
  });
  useEffect(() => {
    renderStateRef.current = {
      palette,
      hoveredId,
      selectedId,
      adjacency,
      searchMatchSet,
      showLabels,
    };
  }, [palette, hoveredId, selectedId, adjacency, searchMatchSet, showLabels]);

  const { reheat } = usePointGraphSimulation({
    graph: workingGraph,
    size,
    forces,
    canvasRef,
    transformRef,
    simRef,
    quadtreeRef,
    graphRef,
    positionCacheRef,
    drawRef,
    renderStateRef,
    onAlpha,
    onFps,
  });

  // Redraw immediately when render-only state changes and the sim is settled
  useEffect(() => {
    if (drawRef.current && (simRef.current?.alpha() ?? 0) < 0.01) {
      drawRef.current();
    }
  }, [hoveredId, selectedId, showLabels, searchMatchSet, palette]);

  usePointGraphInteraction({
    canvasRef,
    transformRef,
    simRef,
    quadtreeRef,
    graphRef,
    drawRef,
    size,
    selectedId,
    onHover: setHoveredId,
    onSelect: (id) => onSelectedIdChange(id === selectedId ? null : id),
    onActivate,
  });

  useEffect(() => {
    onApiReady?.({ reheat });
  }, [onApiReady, reheat]);

  return (
    <div ref={wrapRef} className="relative h-full w-full bg-notion-bg">
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      />
      {snapshot.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-notion-text-secondary">
          No nodes
        </div>
      )}
    </div>
  );
}
