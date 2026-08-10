import { useEffect, useMemo, useRef, useState } from "react";
import type { Simulation } from "d3-force";
import type { Quadtree } from "d3-quadtree";
import type { GraphLink, GraphNode, GraphSnapshot } from "./graph/graph-types";
import {
  buildAdjacency,
  type RenderState,
  type Transform,
} from "./graph/graph-render";
import {
  resolvePalette,
  subscribeThemeChange,
  type GraphPalette,
} from "./graph/graph-theme";
import {
  loadPositions,
  loadViewport,
  type PositionMap,
} from "./graph/graphStorage";
import {
  useGraphSimulation,
  type ForceParams,
} from "./graph/useGraphSimulation";
import { useGraphInteraction } from "./graph/useGraphInteraction";

interface GraphCanvasProps {
  snapshot: GraphSnapshot;
  forces: ForceParams;
  showLabels: boolean;
  searchMatchSet: Set<string> | null;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  /** double-click a node ("open" intent) */
  onActivate?: (id: string) => void;
  /** exposes imperative actions once the canvas is ready */
  onApiReady?: (api: { reheat: () => void; resetView: () => void }) => void;
  onZoomChange?: (k: number) => void;
  /** base node-radius multiplier (Mobile passes >1 for touch); default 1 */
  nodeSizeScale?: number;
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
  onZoomChange,
  nodeSizeScale,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const transformRef = useRef<Transform>(
    loadViewport() ?? { x: 0, y: 0, k: 1 },
  );
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const quadtreeRef = useRef<Quadtree<GraphNode> | null>(null);
  const graphRef = useRef<GraphSnapshot>({ nodes: [], links: [] });
  // Seeded from localStorage once per mount (#361) so the layout resumes where
  // it was left instead of re-scattering under an already-restored viewport.
  // useState's lazy initializer keeps the read off every later render — a bare
  // useRef(loadPositions()) would parse the JSON on each one and throw it away.
  const [storedPositions] = useState(loadPositions);
  const positionCacheRef = useRef<PositionMap>(storedPositions);
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

  const renderStateRef = useRef<
    Omit<RenderState, "nodes" | "links" | "transform" | "size">
  >({
    palette,
    hoveredId,
    selectedId,
    adjacency,
    searchMatchSet,
    showLabels,
    nodeSizeScale,
  });
  useEffect(() => {
    renderStateRef.current = {
      palette,
      hoveredId,
      selectedId,
      adjacency,
      searchMatchSet,
      showLabels,
      nodeSizeScale,
    };
  }, [
    palette,
    hoveredId,
    selectedId,
    adjacency,
    searchMatchSet,
    showLabels,
    nodeSizeScale,
  ]);

  // The snapshot is passed as-is: useGraphSimulation clones it internally
  // before d3 mutates anything (#586), so no working copy is needed here.
  const { reheat } = useGraphSimulation({
    graph: snapshot,
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
  });

  // Redraw immediately when render-only state changes and the sim is settled
  useEffect(() => {
    if (drawRef.current && (simRef.current?.alpha() ?? 0) < 0.01) {
      drawRef.current();
    }
  }, [
    hoveredId,
    selectedId,
    showLabels,
    searchMatchSet,
    palette,
    nodeSizeScale,
  ]);

  const { resetView } = useGraphInteraction({
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
    onZoom: onZoomChange,
  });

  useEffect(() => {
    onApiReady?.({ reheat, resetView });
  }, [onApiReady, reheat, resetView]);

  return (
    <div ref={wrapRef} className="relative h-full w-full bg-lumen-bg">
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      />
    </div>
  );
}
