import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type {
  DayItem,
  DayItemKind,
} from "../components/Mobile/schedule/dayItem";
import { computeShiftedTimes, hhmmToMinutes } from "../utils/mobileSnapTime";

export interface LongPressDragState {
  draggingId: string | null;
  previewTop: number;
  previewHeight: number;
  snappedStart: string;
  snappedEnd: string;
}

export interface LongPressDragEnd {
  id: string;
  kind: DayItemKind;
  newStart: string;
  newEnd: string;
  item: DayItem;
}

export interface UseMobileLongPressDragOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  hourPx: number;
  dayStartHour: number;
  snapMinutes?: number;
  longPressMs?: number;
  moveTolerancePx?: number;
  onDragEnd: (payload: LongPressDragEnd) => void;
}

interface PendingInfo {
  item: DayItem;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  blockTop: number;
  blockHeight: number;
  // distance from block top to pointer at press start
  grabOffsetY: number;
  durationMinutes: number;
  timer: number | null;
}

const INITIAL_STATE: LongPressDragState = {
  draggingId: null,
  previewTop: 0,
  previewHeight: 0,
  snappedStart: "",
  snappedEnd: "",
};

function vibrate(ms: number): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate === "function") navigator.vibrate(ms);
}

export function useMobileLongPressDrag(opts: UseMobileLongPressDragOptions): {
  dragState: LongPressDragState;
  getBlockPointerDown: (
    item: DayItem,
    blockTop: number,
    blockHeight: number,
  ) => (e: ReactPointerEvent<HTMLElement>) => void;
} {
  const {
    containerRef,
    hourPx,
    dayStartHour,
    onDragEnd,
    snapMinutes = 5,
    longPressMs = 450,
    moveTolerancePx = 8,
  } = opts;

  const [dragState, setDragState] = useState<LongPressDragState>(INITIAL_STATE);
  const dragStateRef = useRef<LongPressDragState>(INITIAL_STATE);
  const pendingRef = useRef<PendingInfo | null>(null);
  const activeRef = useRef<boolean>(false);
  const lastSnappedMinRef = useRef<number>(-1);
  const prevTouchActionRef = useRef<string>("");

  const updateDragState = useCallback((next: LongPressDragState) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const clearPending = useCallback(() => {
    const p = pendingRef.current;
    if (p?.timer != null) window.clearTimeout(p.timer);
    pendingRef.current = null;
  }, []);

  const restoreContainerScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.touchAction = prevTouchActionRef.current;
  }, [containerRef]);

  const endDrag = useCallback(
    (commit: boolean) => {
      const p = pendingRef.current;
      if (p && activeRef.current && commit) {
        const durationMinutes = p.durationMinutes;
        const { start, end } = computeShiftedTimes({
          newTopPx: dragStateRef.current.previewTop,
          durationMinutes,
          hourPx,
          dayStartHour,
          snap: snapMinutes,
        });
        if (start !== p.item.start || end !== p.item.end) {
          onDragEnd({
            id: p.item.id,
            kind: p.item.kind,
            newStart: start,
            newEnd: end,
            item: p.item,
          });
        }
      }
      activeRef.current = false;
      lastSnappedMinRef.current = -1;
      restoreContainerScroll();
      updateDragState(INITIAL_STATE);
      clearPending();
    },
    [
      clearPending,
      dayStartHour,
      hourPx,
      onDragEnd,
      restoreContainerScroll,
      snapMinutes,
      updateDragState,
    ],
  );

  // Window-level listeners for move/up/cancel. We attach them once the press
  // begins (on each onPointerDown) and tear down when it ends. Active mode is
  // gated by activeRef; during the pre-drag window we only check move tolerance
  // and cancel if exceeded (letting the browser handle the tap/scroll).
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const p = pendingRef.current;
      if (!p || e.pointerId !== p.pointerId) return;

      if (!activeRef.current) {
        const dx = Math.abs(e.clientX - p.startClientX);
        const dy = Math.abs(e.clientY - p.startClientY);
        if (dx > moveTolerancePx || dy > moveTolerancePx) {
          // Cancel long-press — let the normal tap/scroll flow win.
          clearPending();
        }
        return;
      }

      // Active drag: compute preview based on pointer position relative to
      // the container's top edge, accounting for the initial grab offset.
      const container = containerRef.current;
      if (!container) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const pointerYInContainer = e.clientY - rect.top;
      const candidateTop = pointerYInContainer - p.grabOffsetY;

      const { start, end, snappedStartMin } = computeShiftedTimes({
        newTopPx: candidateTop,
        durationMinutes: p.durationMinutes,
        hourPx,
        dayStartHour,
        snap: snapMinutes,
      });

      const snappedTopPx =
        ((snappedStartMin - dayStartHour * 60) / 60) * hourPx;

      if (snappedStartMin !== lastSnappedMinRef.current) {
        if (lastSnappedMinRef.current !== -1) vibrate(10);
        lastSnappedMinRef.current = snappedStartMin;
      }

      updateDragState({
        draggingId: p.item.id,
        previewTop: snappedTopPx,
        previewHeight: p.blockHeight,
        snappedStart: start,
        snappedEnd: end,
      });
    }

    function onPointerUp(e: PointerEvent) {
      const p = pendingRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      endDrag(true);
    }

    function onPointerCancel(e: PointerEvent) {
      const p = pendingRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      endDrag(false);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [
    clearPending,
    containerRef,
    dayStartHour,
    endDrag,
    hourPx,
    moveTolerancePx,
    snapMinutes,
    updateDragState,
  ]);

  const getBlockPointerDown = useCallback(
    (item: DayItem, blockTop: number, blockHeight: number) =>
      (e: ReactPointerEvent<HTMLElement>) => {
        // Only left-button / touch / pen. Ignore right-click etc.
        if (e.button !== 0 && e.button !== undefined) return;
        // Compute grab offset relative to block top at press time
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const pointerYInContainer = e.clientY - rect.top;
        const grabOffsetY = pointerYInContainer - blockTop;

        const durationMinutes = Math.max(
          1,
          hhmmToMinutes(item.end) - hhmmToMinutes(item.start),
        );

        const timer = window.setTimeout(() => {
          const p = pendingRef.current;
          if (!p) return;
          activeRef.current = true;
          vibrate(50);
          // Disable scroll on the grid while dragging
          prevTouchActionRef.current = container.style.touchAction;
          container.style.touchAction = "none";
          const startMin = hhmmToMinutes(p.item.start);
          lastSnappedMinRef.current = startMin;
          updateDragState({
            draggingId: p.item.id,
            previewTop: p.blockTop,
            previewHeight: p.blockHeight,
            snappedStart: p.item.start,
            snappedEnd: p.item.end,
          });
        }, longPressMs);

        pendingRef.current = {
          item,
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          blockTop,
          blockHeight,
          grabOffsetY,
          durationMinutes,
          timer,
        };
      },
    [containerRef, longPressMs, updateDragState],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearPending();
      restoreContainerScroll();
    };
  }, [clearPending, restoreContainerScroll]);

  return { dragState, getBlockPointerDown };
}
