import { useCallback, useEffect, useRef } from "react";
import type { Simulation } from "d3-force";
import type { Quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import type { GraphLink, GraphNode, GraphSnapshot } from "./graph-types";
import { UNIFORM_NODE_SIZE, type Transform } from "./graph-render";
import { saveViewport } from "./graphStorage";

interface Args {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  transformRef: React.MutableRefObject<Transform>;
  simRef: React.MutableRefObject<Simulation<GraphNode, GraphLink> | null>;
  quadtreeRef: React.MutableRefObject<Quadtree<GraphNode> | null>;
  graphRef: React.MutableRefObject<GraphSnapshot>;
  drawRef: React.MutableRefObject<(() => void) | null>;
  size: { w: number; h: number };
  selectedId: string | null;
  onHover: (id: string | null) => void;
  /** click on node toggles selection; click on empty clears */
  onSelect: (id: string | null) => void;
  /** double-click / "open" intent on a node */
  onActivate?: (id: string) => void;
  /** reports the current zoom scale (k) on zoom gestures */
  onZoom?: (k: number) => void;
}

export function useGraphInteraction({
  canvasRef,
  transformRef,
  simRef,
  quadtreeRef,
  graphRef,
  drawRef,
  size,
  selectedId,
  onHover,
  onSelect,
  onActivate,
  onZoom,
}: Args): { resetView: () => void } {
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const draggedRef = useRef<GraphNode | null>(null);
  const hoveredRef = useRef<GraphNode | null>(null);
  const isDraggingRef = useRef(false);
  const didMoveRef = useRef(false);

  /*
   * The callbacks, read when an event FIRES rather than captured when the
   * listener is attached (#524).
   *
   * The attach effect below re-runs only on a canvas resize, so every closure
   * it captures is frozen from that moment on. `onSelect` is built inline in
   * GraphCanvas and closes over `selectedId` to decide whether a click is a
   * select or a toggle-off, so a frozen copy compares against the selection as
   * it was at attach time — normally `null` — and `id === selectedId` never
   * comes out true. Clicking the selected node again did nothing, against a
   * prop documented as a toggle. `onActivate` / `onZoom` / `onHover` freeze the
   * same way; they just happen to be stable today.
   *
   * Not fixed by adding them to the deps: that re-attaches on every render
   * that changes a callback identity, tearing out the window pointer listeners
   * mid-drag. Same reasoning as #523, which put the simulation on this footing
   * — and the same repair, because #523 is why this one stopped being
   * intermittent: the old `simRef.current` dep used to re-attach whenever the
   * graph was rebuilt, which refreshed these closures by accident.
   */
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const onActivateRef = useRef(onActivate);
  const onZoomRef = useRef(onZoom);

  // Mirrors written in an effect rather than during render: a render React
  // throws away must not leave its value behind (`react-hooks/refs`).
  useEffect(() => {
    onHoverRef.current = onHover;
    onSelectRef.current = onSelect;
    onActivateRef.current = onActivate;
    onZoomRef.current = onZoom;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;

    function findNodeAt(clientX: number, clientY: number): GraphNode | null {
      const rect = canvas!.getBoundingClientRect();
      const t = transformRef.current;
      const x = (clientX - rect.left - t.x) / t.k;
      const y = (clientY - rect.top - t.y) / t.k;
      const radius = 36 / t.k;
      const found = quadtreeRef.current?.find(x, y, radius);
      if (!found || found.x == null || found.y == null) return null;
      const dx = found.x - x;
      const dy = found.y - y;
      const r = UNIFORM_NODE_SIZE + 12 / t.k;
      return dx * dx + dy * dy < r * r ? found : null;
    }

    const zoomBehavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 6])
      .filter((event: Event) => {
        const pe = event as PointerEvent;
        if (
          event.type === "mousedown" ||
          event.type === "touchstart" ||
          event.type === "pointerdown"
        ) {
          const x = pe.clientX ?? 0;
          const y = pe.clientY ?? 0;
          if (findNodeAt(x, y)) return false;
        }
        return !(event as MouseEvent).ctrlKey && !(event as MouseEvent).button;
      })
      .on("zoom", (event) => {
        const tr = event.transform;
        transformRef.current = { x: tr.x, y: tr.y, k: tr.k };
        onZoomRef.current?.(tr.k);
        drawRef.current?.();
      })
      .on("end", () => {
        saveViewport(transformRef.current);
      });

    const sel = select(canvas);
    sel.call(zoomBehavior);
    // `call(zoomBehavior)` registers d3's own dblclick handler on this canvas,
    // and that handler fires stopImmediatePropagation() — which kills
    // `onCanvasDblClick` below, registered later on the same element. Drop the
    // default double-click zoom so the gesture can mean "open" instead
    // (#543 / D-20260801-sched-2 = A). Zooming stays on pinch / wheel / the
    // ± buttons.
    sel.on("dblclick.zoom", null);
    zoomRef.current = zoomBehavior;
    // Sync d3-zoom internal state with the restored viewport
    zoomBehavior.transform(
      sel,
      zoomIdentity
        .translate(transformRef.current.x, transformRef.current.y)
        .scale(transformRef.current.k),
    );

    function updateDraggedPosition(clientX: number, clientY: number) {
      if (!draggedRef.current) return;
      const rect = canvas!.getBoundingClientRect();
      const t = transformRef.current;
      draggedRef.current.fx = (clientX - rect.left - t.x) / t.k;
      draggedRef.current.fy = (clientY - rect.top - t.y) / t.k;
    }

    function onWindowPointerMove(e: PointerEvent) {
      if (!isDraggingRef.current) return;
      didMoveRef.current = true;
      if (e.cancelable) e.preventDefault();
      updateDraggedPosition(e.clientX, e.clientY);
    }

    function onWindowPointerUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (draggedRef.current) {
        simRef.current?.alphaTarget(0);
        draggedRef.current.fx = null;
        draggedRef.current.fy = null;
        draggedRef.current = null;
      }
      canvas!.style.cursor = "grab";
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    }

    function onCanvasPointerDown(e: PointerEvent) {
      const node = findNodeAt(e.clientX, e.clientY);
      if (!node) return;
      e.preventDefault();
      isDraggingRef.current = true;
      didMoveRef.current = false;
      draggedRef.current = node;
      node.fx = node.x;
      node.fy = node.y;
      simRef.current?.alphaTarget(0.3).restart();
      try {
        canvas!.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      canvas!.style.cursor = "grabbing";
      window.addEventListener("pointermove", onWindowPointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerUp);
    }

    function onCanvasHover(e: PointerEvent) {
      if (isDraggingRef.current) return;
      const node = findNodeAt(e.clientX, e.clientY);
      if (node !== hoveredRef.current) {
        hoveredRef.current = node;
        onHoverRef.current(node?.id ?? null);
        canvas!.style.cursor = node ? "pointer" : "grab";
        if ((simRef.current?.alpha() ?? 0) < 0.01) drawRef.current?.();
      }
    }

    function onCanvasClick(e: MouseEvent) {
      if (didMoveRef.current) {
        didMoveRef.current = false;
        return;
      }
      const node = findNodeAt(e.clientX, e.clientY);
      onSelectRef.current(node ? node.id : null);
    }

    function onCanvasDblClick(e: MouseEvent) {
      const node = findNodeAt(e.clientX, e.clientY);
      const activate = onActivateRef.current;
      if (node && activate) activate(node.id);
    }

    canvas.addEventListener("pointermove", onCanvasHover);
    canvas.addEventListener("pointerdown", onCanvasPointerDown);
    canvas.addEventListener("click", onCanvasClick);
    canvas.addEventListener("dblclick", onCanvasDblClick);
    canvas.style.cursor = "grab";

    return () => {
      canvas.removeEventListener("pointermove", onCanvasHover);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      canvas.removeEventListener("click", onCanvasClick);
      canvas.removeEventListener("dblclick", onCanvasDblClick);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
    // The listeners read `simRef.current` when they fire, so the simulation
    // being swapped needs no re-attach — which is why it is not a dep. The old
    // `simRef.current` dep could not do that job anyway: a ref read during
    // render holds whatever the previous commit left, so it only changed on the
    // render AFTER a swap, if one came at all. The callbacks are read the same
    // way and for the same reason (#524 — see the refs above), so they are not
    // deps either: this effect owns window-level pointer listeners, and
    // re-running it is not free.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  // Pan the view so the selected node lands at canvas center (zoom preserved).
  // Instant transform — no d3-transition dependency (lean port).
  useEffect(() => {
    if (!selectedId) return;
    const canvas = canvasRef.current;
    const zoomBehavior = zoomRef.current;
    if (!canvas || !zoomBehavior || size.w === 0) return;

    const raf = requestAnimationFrame(() => {
      const node = graphRef.current.nodes.find((n) => n.id === selectedId);
      if (!node || node.x == null || node.y == null) return;

      const sel = select(canvas);
      const targetK = transformRef.current.k;
      const rect = canvas.getBoundingClientRect();
      const tx = rect.width / 2 - node.x * targetK;
      const ty = rect.height / 2 - node.y * targetK;

      zoomBehavior.transform(
        sel,
        zoomIdentity.translate(tx, ty).scale(targetK),
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, size.w, size.h, canvasRef, graphRef]);

  const resetView = useCallback(() => {
    const canvas = canvasRef.current;
    const zoomBehavior = zoomRef.current;
    if (!canvas || !zoomBehavior) return;
    zoomBehavior.transform(select(canvas), zoomIdentity);
  }, [canvasRef]);

  return { resetView };
}
