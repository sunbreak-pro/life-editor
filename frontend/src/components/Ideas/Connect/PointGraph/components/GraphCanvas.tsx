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

interface GraphCanvasProps {
  snapshot: GraphSnapshot;
  forces: ForceParams;
  showLabels: boolean;
  searchMatchSet: Set<string> | null;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
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

  // Working graph: clone so d3 can mutate, restore cached positions so the
  // layout continues instead of scattering on every rebuild (plan §4.4).
  const workingGraph = useMemo<GraphSnapshot>(() => {
    const cache = positionCacheRef.current;
    return {
      nodes: snapshot.nodes.map((n) => {
        const c = cache[n.id];
        return c ? { ...n, x: c.x, y: c.y, vx: 0, vy: 0 } : { ...n };
      }),
      links: snapshot.links.map((l) => ({ ...l })),
    };
  }, [snapshot]);

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
  renderStateRef.current = {
    palette,
    hoveredId,
    selectedId,
    adjacency,
    searchMatchSet,
    showLabels,
  };

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

  // S5 will attach zoom/drag/hit-test here. Temporary click-to-clear so the
  // canvas is interactive enough to verify rendering in S4.
  void reheat;
  void setHoveredId;
  void onSelectedIdChange;

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
