import { useState, useCallback, useRef, useEffect } from "react";
import { TIME_GRID } from "../constants/timeGrid";

type DragMode = "move" | "resize-top" | "resize-bottom";
type ItemType = "schedule" | "task";

interface DragState {
  isDragging: boolean;
  itemId: string | null;
  itemType: ItemType | null;
  mode: DragMode | null;
  previewTop: number;
  previewHeight: number;
}

const INITIAL_STATE: DragState = {
  isDragging: false,
  itemId: null,
  itemType: null,
  mode: null,
  previewTop: 0,
  previewHeight: 0,
};

const LONG_PRESS_MS = 300;
const MOVE_THRESHOLD = 5;
const SNAP_MINUTES = 5;
const RESIZE_EDGE_PX = 8;
const MIN_HEIGHT_PX = 20;

function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function topToMinutes(top: number): number {
  return (top / TIME_GRID.SLOT_HEIGHT) * 60 + TIME_GRID.START_HOUR * 60;
}

interface DragEndPayload {
  itemId: string;
  itemType: ItemType;
  newStartTime: string;
  newEndTime: string;
}

interface UseTimeGridDragOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDragEnd: (payload: DragEndPayload) => void;
}

export function useTimeGridDrag({
  containerRef,
  onDragEnd,
}: UseTimeGridDragOptions) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_STATE);
  const stateRef = useRef(INITIAL_STATE);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const offsetInBlock = useRef(0);
  const originalTop = useRef(0);
  const originalHeight = useRef(0);
  const pendingItem = useRef<{
    id: string;
    type: ItemType;
    top: number;
    height: number;
  } | null>(null);
  const isLongPressing = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    isLongPressing.current = false;
  }, []);

  const getRelativeY = useCallback(
    (clientY: number): number => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      return clientY - rect.top + containerRef.current.scrollTop;
    },
    [containerRef],
  );

  const snapTop = useCallback((rawTop: number): number => {
    const minutes = topToMinutes(rawTop);
    const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
    return ((snapped - TIME_GRID.START_HOUR * 60) / 60) * TIME_GRID.SLOT_HEIGHT;
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

      // During long-press detection, check if moved too much
      if (!stateRef.current.isDragging && isLongPressing.current) {
        const dx = clientX - startPos.current.x;
        const dy = clientY - startPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
          cancelLongPress();
          pendingItem.current = null;
        }
        return;
      }

      if (!stateRef.current.isDragging) return;
      e.preventDefault();

      const relY = getRelativeY(clientY);
      const mode = stateRef.current.mode;

      let newTop = stateRef.current.previewTop;
      let newHeight = stateRef.current.previewHeight;

      if (mode === "move") {
        newTop = snapTop(relY - offsetInBlock.current);
      } else if (mode === "resize-top") {
        const snappedY = snapTop(relY);
        const bottom = originalTop.current + originalHeight.current;
        newTop = Math.min(snappedY, bottom - MIN_HEIGHT_PX);
        newHeight = bottom - newTop;
      } else if (mode === "resize-bottom") {
        const snappedY = snapTop(relY);
        newTop = originalTop.current;
        newHeight = Math.max(snappedY - newTop, MIN_HEIGHT_PX);
      }

      const next: DragState = {
        ...stateRef.current,
        previewTop: newTop,
        previewHeight: newHeight,
      };
      stateRef.current = next;
      setDragState(next);
    },
    [getRelativeY, snapTop, cancelLongPress],
  );

  const handleMouseUp = useCallback(() => {
    cancelLongPress();

    if (stateRef.current.isDragging && stateRef.current.itemId) {
      const { previewTop, previewHeight, itemId, itemType } = stateRef.current;
      const startMinutes = topToMinutes(previewTop);
      const endMinutes = topToMinutes(previewTop + previewHeight);
      onDragEnd({
        itemId,
        itemType: itemType!,
        newStartTime: minutesToTimeString(startMinutes),
        newEndTime: minutesToTimeString(endMinutes),
      });
    }

    stateRef.current = INITIAL_STATE;
    setDragState(INITIAL_STATE);
    pendingItem.current = null;
  }, [cancelLongPress, onDragEnd]);

  // Attach/detach global listeners
  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleMouseMove, { passive: false });
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => cancelLongPress();
  }, [cancelLongPress]);

  const getDragHandlers = useCallback(
    (
      itemId: string,
      itemType: ItemType,
      blockTop: number,
      blockHeight: number,
    ) => {
      const onStart = (clientX: number, clientY: number) => {
        startPos.current = { x: clientX, y: clientY };
        pendingItem.current = {
          id: itemId,
          type: itemType,
          top: blockTop,
          height: blockHeight,
        };
        isLongPressing.current = true;

        longPressTimer.current = setTimeout(() => {
          if (!pendingItem.current) return;
          isLongPressing.current = false;

          const relY = getRelativeY(clientY);
          const posInBlock = relY - blockTop;

          let mode: DragMode = "move";
          if (posInBlock <= RESIZE_EDGE_PX) {
            mode = "resize-top";
          } else if (posInBlock >= blockHeight - RESIZE_EDGE_PX) {
            mode = "resize-bottom";
          }

          offsetInBlock.current = posInBlock;
          originalTop.current = blockTop;
          originalHeight.current = blockHeight;

          const next: DragState = {
            isDragging: true,
            itemId,
            itemType,
            mode,
            previewTop: blockTop,
            previewHeight: blockHeight,
          };
          stateRef.current = next;
          setDragState(next);
        }, LONG_PRESS_MS);
      };

      return {
        onMouseDown: (e: React.MouseEvent) => {
          if (e.button !== 0) return;
          onStart(e.clientX, e.clientY);
        },
        onTouchStart: (e: React.TouchEvent) => {
          const touch = e.touches[0];
          onStart(touch.clientX, touch.clientY);
        },
      };
    },
    [getRelativeY],
  );

  return {
    dragState,
    getDragHandlers,
    isLongPressing: isLongPressing.current,
  };
}
