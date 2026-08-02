import { describe, it, expect, vi } from "vitest";
import { useRef, useState } from "react";
import { render, act } from "@testing-library/react";
import { quadtree, type Quadtree } from "d3-quadtree";
import type { Simulation } from "d3-force";
import { useGraphInteraction } from "../src/components/Connect/graph/useGraphInteraction";
import type {
  GraphLink,
  GraphNode,
  GraphSnapshot,
} from "../src/components/Connect/graph/graph-types";
import type { Transform } from "../src/components/Connect/graph/graph-render";

/*
 * useGraphInteraction (#524) — the canvas listeners must call the CURRENT
 * callbacks, not the ones that existed when they were attached.
 *
 * The listener effect re-runs only on a canvas resize, so a callback captured
 * in its closure is frozen for the life of that size. GraphCanvas builds
 * `onSelect` inline and closes over `selectedId` to decide select-vs-toggle,
 * so a frozen copy compares against the selection as it was at attach time —
 * `null` — and clicking the selected node again did nothing.
 *
 * WHY THIS IS TESTABLE AT ALL, given the Issue's note that the canvas path is
 * not: jsdom has no layout, so `getBoundingClientRect()` is all zeros — which
 * is a usable coordinate system rather than a broken one, as long as the node
 * sits at the origin too. Nothing here needs a 2D context (the hook only reads
 * the quadtree and calls `drawRef`, which the harness leaves null), so what
 * gets pinned is the wiring — clicks reach the latest callback — while the
 * hit-testing maths stays chat-main's real-browser check.
 */

const NODE: GraphNode = { id: "n1", label: "One", type: "note", x: 0, y: 0 };

function buildQuadtree(): Quadtree<GraphNode> {
  return quadtree<GraphNode>()
    .x((d) => d.x ?? 0)
    .y((d) => d.y ?? 0)
    .addAll([NODE]);
}

/** GraphCanvas in miniature: local selection + the same inline toggle closure. */
function ToggleHarness({
  onSelected,
  onZoom,
  onApi,
}: {
  onSelected: (id: string | null) => void;
  onZoom?: (k: number) => void;
  onApi?: (api: { resetView: () => void }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const quadtreeRef = useRef<Quadtree<GraphNode> | null>(buildQuadtree());
  const graphRef = useRef<GraphSnapshot>({ nodes: [NODE], links: [] });
  const drawRef = useRef<(() => void) | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { resetView } = useGraphInteraction({
    canvasRef,
    transformRef,
    simRef,
    quadtreeRef,
    graphRef,
    drawRef,
    size: { w: 800, h: 600 },
    selectedId,
    onHover: () => {},
    // Verbatim from GraphCanvas: the closure that has to be re-read per click.
    onSelect: (id) => {
      const next = id === selectedId ? null : id;
      setSelectedId(next);
      onSelected(next);
    },
    onZoom,
  });
  onApi?.({ resetView });

  return <canvas ref={canvasRef} data-testid="graph-canvas" />;
}

function clickCanvas(canvas: HTMLElement) {
  act(() => {
    canvas.dispatchEvent(
      new MouseEvent("click", {
        clientX: 0,
        clientY: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

describe("useGraphInteraction callbacks", () => {
  it("toggles the selection off when the selected node is clicked again", () => {
    const onSelected = vi.fn();
    const { getByTestId } = render(<ToggleHarness onSelected={onSelected} />);
    const canvas = getByTestId("graph-canvas");

    clickCanvas(canvas);
    expect(onSelected).toHaveBeenLastCalledWith("n1");

    // The regression: with the callback frozen at attach time this second
    // click reported "n1" again, so the node stayed selected forever.
    clickCanvas(canvas);
    expect(onSelected).toHaveBeenLastCalledWith(null);

    clickCanvas(canvas);
    expect(onSelected).toHaveBeenLastCalledWith("n1");
  });

  it("reports zoom to the latest onZoom, not the one present at attach time", () => {
    // `onSelect` is the one the bug was reported against, but every callback
    // in this hook was frozen the same way — pinning a second one keeps the
    // fix from being re-narrowed to the toggle.
    const first = vi.fn();
    const second = vi.fn();
    let api: { resetView: () => void } | null = null;
    const { rerender } = render(
      <ToggleHarness
        onSelected={() => {}}
        onZoom={first}
        onApi={(a) => (api = a)}
      />,
    );
    // The attach effect syncs d3-zoom with the restored viewport, which is
    // itself a zoom event — so `first` has already fired once here.
    first.mockClear();

    rerender(
      <ToggleHarness
        onSelected={() => {}}
        onZoom={second}
        onApi={(a) => (api = a)}
      />,
    );
    act(() => api!.resetView());

    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });
});
