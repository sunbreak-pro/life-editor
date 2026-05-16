import { useCallback, useEffect, useRef } from "react";
import type { Simulation } from "d3-force";
import type { Quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import {
  zoom as d3zoom,
  zoomIdentity,
  zoomTransform,
  type ZoomBehavior,
} from "d3-zoom";
import { easeCubicInOut } from "d3-ease";
import "d3-transition";
import {
  linkEndId,
  type GraphLink,
  type GraphNode,
  type GraphSnapshot,
} from "../lib/graph-types";
import { UNIFORM_NODE_SIZE, type Transform } from "../lib/graph-render";
import { saveViewport } from "../lib/pointGraphStorage";

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
  /** click on a manual edge requests its deletion (source/target ids) */
  onManualEdgeClick?: (sourceId: string, targetId: string) => void;
}

export function usePointGraphInteraction({
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
  onManualEdgeClick,
}: Args): { resetView: () => void } {
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const draggedRef = useRef<GraphNode | null>(null);
  const hoveredRef = useRef<GraphNode | null>(null);
  const isDraggingRef = useRef(false);
  const didMoveRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const sim = simRef.current;

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
        onZoom?.(tr.k);
        drawRef.current?.();
      })
      .on("end", () => {
        saveViewport(transformRef.current);
      });

    const sel = select(canvas);
    sel.call(zoomBehavior);
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
        sim?.alphaTarget(0);
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
      sim?.alphaTarget(0.3).restart();
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
        onHover(node?.id ?? null);
        canvas!.style.cursor = node ? "pointer" : "grab";
        if ((sim?.alpha() ?? 0) < 0.01) drawRef.current?.();
      }
    }

    function onCanvasClick(e: MouseEvent) {
      if (didMoveRef.current) {
        didMoveRef.current = false;
        return;
      }
      const node = findNodeAt(e.clientX, e.clientY);
      if (node) {
        onSelect(node.id);
        return;
      }
      // No node — check for a manual edge under the click (delete affordance).
      if (onManualEdgeClick) {
        const rect = canvas!.getBoundingClientRect();
        const t = transformRef.current;
        const px = (e.clientX - rect.left - t.x) / t.k;
        const py = (e.clientY - rect.top - t.y) / t.k;
        const tol = 6 / t.k;
        for (const l of graphRef.current.links) {
          if (l.kind !== "manual") continue;
          const s = l.source;
          const tg = l.target;
          if (typeof s !== "object" || typeof tg !== "object") continue;
          if (s.x == null || s.y == null || tg.x == null || tg.y == null)
            continue;
          if (distToSegment(px, py, s.x, s.y, tg.x, tg.y) <= tol) {
            onManualEdgeClick(linkEndId(l.source), linkEndId(l.target));
            return;
          }
        }
      }
      onSelect(null);
    }

    function onCanvasDblClick(e: MouseEvent) {
      const node = findNodeAt(e.clientX, e.clientY);
      if (node && onActivate) onActivate(node.id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, simRef.current]);

  // Smooth pan: slide the view so the selected node lands at canvas center.
  // Zoom is preserved. interrupt + authoritative zoomTransform + no offsets
  // (plan §4.6 — these three prevent the rightward drift).
  useEffect(() => {
    if (!selectedId) return;
    const canvas = canvasRef.current;
    const zoomBehavior = zoomRef.current;
    if (!canvas || !zoomBehavior || size.w === 0) return;

    const raf = requestAnimationFrame(() => {
      const node = graphRef.current.nodes.find((n) => n.id === selectedId);
      if (!node || node.x == null || node.y == null) return;

      const sel = select(canvas);
      sel.interrupt();
      const t = zoomTransform(canvas);
      const targetK = t.k;

      const hadFx = node.fx;
      const hadFy = node.fy;
      node.fx = node.x;
      node.fy = node.y;

      const rect = canvas.getBoundingClientRect();
      const tx = rect.width / 2 - node.x * targetK;
      const ty = rect.height / 2 - node.y * targetK;

      sel
        .transition()
        .duration(550)
        .ease(easeCubicInOut)
        .call(
          zoomBehavior.transform,
          zoomIdentity.translate(tx, ty).scale(targetK),
        )
        .on("end interrupt", () => {
          node.fx = hadFx ?? null;
          node.fy = hadFy ?? null;
        });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, size.w, size.h, canvasRef, graphRef]);

  const resetView = useCallback(() => {
    const canvas = canvasRef.current;
    const zoomBehavior = zoomRef.current;
    if (!canvas || !zoomBehavior) return;
    select(canvas)
      .transition()
      .duration(400)
      .call(zoomBehavior.transform, zoomIdentity);
  }, [canvasRef]);

  return { resetView };
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let tt = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  tt = Math.max(0, Math.min(1, tt));
  const cx = x1 + tt * dx;
  const cy = y1 + tt * dy;
  return Math.hypot(px - cx, py - cy);
}
