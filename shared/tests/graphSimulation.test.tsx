import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { Simulation } from "d3-force";
import type { Quadtree } from "d3-quadtree";
import {
  useGraphSimulation,
  DEFAULT_FORCES,
} from "../src/components/Connect/graph/useGraphSimulation";
import type {
  GraphLink,
  GraphNode,
  GraphSnapshot,
} from "../src/components/Connect/graph/graph-types";
import type {
  RenderState,
  Transform,
} from "../src/components/Connect/graph/graph-render";
import type { GraphPalette } from "../src/components/Connect/graph/graph-theme";
import type { PositionMap } from "../src/components/Connect/graph/graphStorage";

/*
 * useGraphSimulation (#586 pins). d3-force works by MUTATING node objects
 * (x/y/vx/vy), which is exactly what react-hooks/immutability polices; the
 * behavior pinned here is the seam the fix must preserve, observed through
 * graphRef (the working set the renderer and interaction layer read):
 *
 *   - cached nodes resume at their cached spot; nodes the cache has never
 *     seen are seeded near the canvas CENTER (not d3's 0,0 corner),
 *   - a viewport resize recenters live nodes AND the cache by the delta,
 *   - the sim and quadtree are exposed through their refs.
 *
 * jsdom has no 2d canvas, so getContext is stubbed with a recording no-op —
 * layout/physics need no pixels.
 */

const PALETTE: GraphPalette = {
  bg: "#fff",
  border: "#ccc",
  text: "#111",
  textSecondary: "#666",
  accent: "#00f",
  success: "#0a0",
  danger: "#a00",
  node: { note: "#1a1", daily: "#11a", tag: "#a1a" },
  link: {
    hierarchy: "#888",
    wikilink: "#888",
    tag: "#888",
    temporal: "#888",
    manual: "#888",
  },
};

/** Minimal 2d-context stand-in: every method is a no-op spy, property writes
 *  are swallowed, and the few value-returning APIs hand back usable stubs. */
function stubCanvasContext(canvas: HTMLCanvasElement) {
  const fns = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "measureText") return () => ({ width: 10 });
        if (prop === "createLinearGradient" || prop === "createRadialGradient")
          return () => ({ addColorStop: () => {} });
        if (prop === "canvas") return canvas;
        if (!fns.has(prop)) fns.set(prop, vi.fn());
        return fns.get(prop);
      },
      set() {
        return true;
      },
    },
  );
  vi.spyOn(canvas, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
}

function node(id: string): GraphNode {
  return { id, label: id, type: "note" };
}

function makeArgs(overrides?: {
  graph?: GraphSnapshot;
  size?: { w: number; h: number };
  cache?: PositionMap;
}) {
  const canvas = document.createElement("canvas");
  stubCanvasContext(canvas);
  const graph = overrides?.graph ?? {
    nodes: [node("a"), node("b")],
    links: [{ source: "a", target: "b", kind: "wikilink" }] as GraphLink[],
  };
  const args = {
    graph,
    size: overrides?.size ?? { w: 800, h: 600 },
    forces: DEFAULT_FORCES,
    canvasRef: { current: canvas },
    transformRef: { current: { x: 0, y: 0, k: 1 } as Transform },
    simRef: { current: null } as MutableRefObject<Simulation<
      GraphNode,
      GraphLink
    > | null>,
    quadtreeRef: {
      current: null,
    } as MutableRefObject<Quadtree<GraphNode> | null>,
    graphRef: { current: { nodes: [], links: [] } as GraphSnapshot },
    positionCacheRef: { current: overrides?.cache ?? {} },
    drawRef: { current: null } as MutableRefObject<(() => void) | null>,
    renderStateRef: {
      current: {
        palette: PALETTE,
        hoveredId: null,
        selectedId: null,
        adjacency: new Map<string, Set<string>>(),
        searchMatchSet: null,
        showLabels: false,
      } as Omit<RenderState, "nodes" | "links" | "transform" | "size">,
    },
  };
  return args;
}

const byId = (ref: { current: GraphSnapshot }, id: string) =>
  ref.current.nodes.find((n) => n.id === id)!;

beforeEach(() => {
  localStorage.clear();
});

describe("useGraphSimulation (#586 pins)", () => {
  it("resumes cached nodes at their cached spot and seeds new ones at the center", () => {
    const args = makeArgs({ cache: { a: { x: 100, y: 120 } } });
    const { unmount } = renderHook(() => useGraphSimulation(args));

    // Cached node: exactly where it was left, at rest.
    const a = byId(args.graphRef, "a");
    expect(a.x).toBe(100);
    expect(a.y).toBe(120);
    expect(a.vx).toBe(0);

    // Unknown node: near the canvas center (±half the jitter), never the
    // top-left corner d3 would spiral it around.
    const b = byId(args.graphRef, "b");
    expect(Math.abs((b.x ?? 0) - 400)).toBeLessThanOrEqual(20);
    expect(Math.abs((b.y ?? 0) - 300)).toBeLessThanOrEqual(20);

    // The live handles the interaction layer depends on are exposed.
    expect(args.simRef.current).not.toBeNull();
    expect(args.quadtreeRef.current).not.toBeNull();
    expect(args.drawRef.current).not.toBeNull();
    unmount();
  });

  it("recenters live nodes and the cache when the viewport size changes", () => {
    const args = makeArgs({ cache: { a: { x: 100, y: 120 } } });
    const { rerender, unmount } = renderHook(
      ({ size }) => useGraphSimulation({ ...args, size }),
      { initialProps: { size: { w: 800, h: 600 } } },
    );
    // Freeze physics so the only movement left is the recenter shift.
    args.simRef.current?.stop();

    rerender({ size: { w: 1000, h: 700 } });

    // dx = (1000-800)/2 = 100, dy = (700-600)/2 = 50 — applied to the cache,
    // and the rebuilt sim re-seeds the node from that shifted cache.
    const a = byId(args.graphRef, "a");
    expect(a.x).toBe(200);
    expect(a.y).toBe(170);
    expect(args.positionCacheRef.current["a"]).toEqual({ x: 200, y: 170 });
    unmount();
  });

  it("leaves the passed snapshot untouched (the sim works on private clones)", () => {
    const graph: GraphSnapshot = {
      nodes: [node("a"), node("b")],
      links: [{ source: "a", target: "b", kind: "wikilink" }],
    };
    const args = makeArgs({ graph, cache: { a: { x: 100, y: 120 } } });
    const { unmount } = renderHook(() => useGraphSimulation(args));
    args.simRef.current?.stop();

    // The prop snapshot never grows d3 position fields...
    expect(graph.nodes[0].x).toBeUndefined();
    expect(graph.nodes[1].x).toBeUndefined();
    expect(graph.links[0].source).toBe("a");
    // ...while the working set the renderer reads is a DIFFERENT object with
    // the live positions.
    expect(args.graphRef.current.nodes[0]).not.toBe(graph.nodes[0]);
    expect(byId(args.graphRef, "a").x).toBe(100);
    unmount();
  });

  it("persists the position cache to storage on unmount", () => {
    const args = makeArgs({ cache: { a: { x: 100, y: 120 } } });
    const { unmount } = renderHook(() => useGraphSimulation(args));
    args.simRef.current?.stop();

    unmount();
    // Unmount flushes the cache to storage (savePositions).
    const raw = localStorage.getItem(
      "life-editor.connect.pointGraph.positions",
    );
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toHaveProperty("a");
  });
});
