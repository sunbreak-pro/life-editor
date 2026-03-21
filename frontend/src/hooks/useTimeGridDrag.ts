import { useState, useCallback, useRef, useEffect } from "react";
import { TIME_GRID } from "../constants/timeGrid";
import { minutesToTimeString, topToMinutes } from "../utils/timeGridUtils";

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

const MOVE_THRESHOLD = 5;
const SNAP_MINUTES = 5;
const MIN_HEIGHT_PX = 20;

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
  const hasMovedRef = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const offsetInBlock = useRef(0);
  const originalTop = useRef(0);
  const originalHeight = useRef(0);
  const pendingItem = useRef<{
    id: string;
    type: ItemType;
    top: number;
    height: number;
    mode: DragMode;
  } | null>(null);

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

      // Before drag starts, check if moved past threshold
      if (!stateRef.current.isDragging && pendingItem.current) {
        e.preventDefault();
        const dx = clientX - startPos.current.x;
        const dy = clientY - startPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) <= MOVE_THRESHOLD) {
          return;
        }

        // Start dragging
        hasMovedRef.current = true;
        document.body.style.userSelect = "none";
        const item = pendingItem.current;
        const relY = getRelativeY(startPos.current.y);
        const posInBlock = relY - item.top;

        offsetInBlock.current = posInBlock;
        originalTop.current = item.top;
        originalHeight.current = item.height;

        const next: DragState = {
          isDragging: true,
          itemId: item.id,
          itemType: item.type,
          mode: item.mode,
          previewTop: item.top,
          previewHeight: item.height,
        };
        stateRef.current = next;
        setDragState(next);
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
    [getRelativeY, snapTop],
  );

  const handleMouseUp = useCallback(() => {
    if (pendingItem.current) hasMovedRef.current = true;

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

    document.body.style.userSelect = "";
    stateRef.current = INITIAL_STATE;
    setDragState(INITIAL_STATE);
    pendingItem.current = null;
    // Keep hasMovedRef value briefly so onClick handlers can check it, then reset
    setTimeout(() => {
      hasMovedRef.current = false;
    }, 0);
  }, [onDragEnd]);

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

  const getDragHandlers = useCallback(
    (
      itemId: string,
      itemType: ItemType,
      blockTop: number,
      blockHeight: number,
      mode: DragMode = "move",
    ) => {
      const onStart = (clientX: number, clientY: number) => {
        startPos.current = { x: clientX, y: clientY };
        hasMovedRef.current = false;
        pendingItem.current = {
          id: itemId,
          type: itemType,
          top: blockTop,
          height: blockHeight,
          mode,
        };
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
    [],
  );

  return {
    dragState,
    getDragHandlers,
    hasMovedRef,
  };
}
