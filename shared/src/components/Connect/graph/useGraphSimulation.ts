import { useCallback, useEffect, useRef } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import { quadtree, type Quadtree } from "d3-quadtree";
import type { GraphLink, GraphNode, GraphSnapshot } from "./graph-types";
import {
  draw as drawGraph,
  UNIFORM_NODE_SIZE,
  type RenderState,
  type Transform,
} from "./graph-render";
import { savePositions, type PositionMap } from "./graphStorage";

export interface ForceParams {
  repel: number;
  linkDist: number;
  centerStr: number;
  collideStr: number;
}

export const DEFAULT_FORCES: ForceParams = {
  repel: -280,
  linkDist: 50,
  centerStr: 0.05,
  collideStr: 1,
};

interface Args {
  /** filtered snapshot; nodes may carry restored x/y from the cache */
  graph: GraphSnapshot;
  size: { w: number; h: number };
  forces: ForceParams;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  transformRef: React.MutableRefObject<Transform>;
  simRef: React.MutableRefObject<Simulation<GraphNode, GraphLink> | null>;
  quadtreeRef: React.MutableRefObject<Quadtree<GraphNode> | null>;
  graphRef: React.MutableRefObject<GraphSnapshot>;
  positionCacheRef: React.MutableRefObject<PositionMap>;
  drawRef: React.MutableRefObject<(() => void) | null>;
  renderStateRef: React.MutableRefObject<
    Omit<RenderState, "nodes" | "links" | "transform" | "size">
  >;
  onAlpha?: (a: number) => void;
  onFps?: (fps: number) => void;
}

export function useGraphSimulation({
  graph,
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
}: Args): { reheat: () => void } {
  useEffect(() => {
    graphRef.current = graph;
  }, [graph, graphRef]);

  // Recenter cached + live positions when the viewport size changes so the
  // cloud doesn't drift off-center when a panel opens/closes.
  const prevSizeRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    const prev = prevSizeRef.current;
    if (prev && (prev.w !== size.w || prev.h !== size.h)) {
      const dx = (size.w - prev.w) / 2;
      const dy = (size.h - prev.h) / 2;
      for (const n of graphRef.current.nodes) {
        if (n.x != null) n.x += dx;
        if (n.y != null) n.y += dy;
        if (n.fx != null) n.fx += dx;
        if (n.fy != null) n.fy += dy;
      }
      const cache = positionCacheRef.current;
      for (const id of Object.keys(cache)) {
        cache[id] = { x: cache[id].x + dx, y: cache[id].y + dy };
      }
    }
    prevSizeRef.current = { w: size.w, h: size.h };
  }, [size.w, size.h, graphRef, positionCacheRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const frameTimes: number[] = [];
    let lastFrame = performance.now();

    function draw() {
      const now = performance.now();
      frameTimes.push(now - lastFrame);
      lastFrame = now;
      if (frameTimes.length > 30) frameTimes.shift();

      drawGraph(ctx!, {
        ...renderStateRef.current,
        nodes: graphRef.current.nodes,
        links: graphRef.current.links,
        transform: transformRef.current,
        size,
      });

      if (frameTimes.length === 30 && Math.random() < 0.1 && onFps) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        onFps(Math.round(1000 / avg));
      }
    }
    drawRef.current = draw;

    // Restore cached positions so the layout continues from where it was
    // instead of scattering on every rebuild.
    const cache = positionCacheRef.current;
    for (const n of graph.nodes) {
      const c = cache[n.id];
      if (c) {
        n.x = c.x;
        n.y = c.y;
        n.vx = 0;
        n.vy = 0;
      }
    }

    const hasCachedPositions = graph.nodes.some((n) => n.x != null);

    const sim = forceSimulation<GraphNode, GraphLink>(graph.nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(graph.links)
          .id((d) => d.id)
          .distance((l) =>
            l.kind === "tag" ? forces.linkDist * 0.7 : forces.linkDist,
          )
          .strength(0.6),
      )
      .force(
        "charge",
        forceManyBody<GraphNode>().strength(forces.repel).distanceMax(500),
      )
      .force(
        "center",
        forceCenter<GraphNode>(size.w / 2, size.h / 2).strength(
          forces.centerStr,
        ),
      )
      .force("x", forceX<GraphNode>(size.w / 2).strength(0.06))
      .force("y", forceY<GraphNode>(size.h / 2).strength(0.06))
      .force(
        "collide",
        forceCollide<GraphNode>()
          .radius(UNIFORM_NODE_SIZE + 4)
          .strength(forces.collideStr)
          .iterations(1),
      )
      .alpha(hasCachedPositions ? 0.15 : 1)
      .alphaDecay(0.03)
      .velocityDecay(0.45)
      .on("tick", () => {
        for (const n of graph.nodes) {
          if (n.x != null && n.y != null) {
            cache[n.id] = { x: n.x, y: n.y };
          }
        }
        if (Math.random() < 0.5) {
          quadtreeRef.current = quadtree<GraphNode>()
            .x((d) => d.x as number)
            .y((d) => d.y as number)
            .addAll(graph.nodes);
        }
        if (onAlpha) onAlpha(sim.alpha());
        draw();
      });

    quadtreeRef.current = quadtree<GraphNode>()
      .x((d) => d.x as number)
      .y((d) => d.y as number)
      .addAll(graph.nodes);
    simRef.current = sim;

    // Initial paint before the first tick fires
    draw();

    const persist = window.setInterval(() => {
      savePositions(cache);
    }, 4000);

    return () => {
      sim.stop();
      window.clearInterval(persist);
      savePositions(cache);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, size.w, size.h]);

  // Live force tuning without rebuilding the simulation
  useEffect(() => {
    const s = simRef.current;
    if (!s) return;
    (s.force("charge") as ReturnType<typeof forceManyBody>)?.strength(
      forces.repel,
    );
    (s.force("link") as ReturnType<typeof forceLink>)?.distance((l) =>
      (l as GraphLink).kind === "tag" ? forces.linkDist * 0.7 : forces.linkDist,
    );
    (s.force("center") as ReturnType<typeof forceCenter>)?.strength(
      forces.centerStr,
    );
    (s.force("collide") as ReturnType<typeof forceCollide>)?.strength(
      forces.collideStr,
    );
    s.alpha(0.3).restart();
  }, [forces, simRef]);

  const reheat = useCallback(() => {
    simRef.current?.alpha(1).restart();
  }, [simRef]);

  return { reheat };
}
