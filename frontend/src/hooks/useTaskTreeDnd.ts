import { useState, useCallback, useRef, createContext, useMemo } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import type { TaskNode } from "../types/taskTree";

export interface OverInfo {
  overId: string;
  position: "above" | "below" | "inside";
}

export interface DragOverStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => OverInfo | null;
}

export const DragOverStoreContext = createContext<DragOverStore | null>(null);

interface UseTaskTreeDndParams {
  nodes: TaskNode[];
  moveNode: (
    activeId: string,
    overId: string,
    position?: "above" | "below",
  ) => void;
  moveNodeInto: (activeId: string, overId: string) => void;
  moveToRoot: (id: string) => void;
}

const FOLDER_ZONE_ABOVE = 0.25;
const FOLDER_ZONE_BELOW = 0.75;

const getPointerY = (event: DragMoveEvent | DragEndEvent): number | null => {
  if (!(event.activatorEvent instanceof PointerEvent)) return null;
  return event.activatorEvent.clientY + event.delta.y;
};

function computeFolderPosition(
  pointerY: number,
  rect: { top: number; height: number },
): "above" | "below" | "inside" {
  const ratio = (pointerY - rect.top) / rect.height;
  if (ratio < FOLDER_ZONE_ABOVE) return "above";
  if (ratio > FOLDER_ZONE_BELOW) return "below";
  return "inside";
}

export function useTaskTreeDnd({
  nodes,
  moveNode,
  moveNodeInto,
  moveToRoot,
}: UseTaskTreeDndParams) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // overInfo: useRef + subscriber pattern (instead of useState)
  // Only nodes whose drop indicator changes will re-render
  const overInfoRef = useRef<OverInfo | null>(null);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => overInfoRef.current, []);

  const notify = useCallback(() => {
    listenersRef.current.forEach((l) => l());
  }, []);

  const dragOverStore = useMemo<DragOverStore>(
    () => ({ subscribe, getSnapshot }),
    [subscribe, getSnapshot],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { over } = event;
      if (!over) {
        if (overInfoRef.current !== null) {
          overInfoRef.current = null;
          notify();
        }
        return;
      }

      const overId = over.id as string;
      const overNode = nodes.find((n) => n.id === overId);

      if (!overNode) {
        if (overInfoRef.current !== null) {
          overInfoRef.current = null;
          notify();
        }
        return;
      }

      let newPosition: "above" | "below" | "inside";
      const pointerY = getPointerY(event);

      if (!pointerY || !over.rect) {
        newPosition = overNode.type === "folder" ? "inside" : "below";
      } else if (overNode.type === "folder") {
        newPosition = computeFolderPosition(pointerY, over.rect);
      } else {
        const { top, height } = over.rect;
        const relY = pointerY - top;
        newPosition = relY < height / 2 ? "above" : "below";
      }

      // Skip notification if nothing changed
      const prev = overInfoRef.current;
      if (prev?.overId === overId && prev?.position === newPosition) {
        return;
      }

      overInfoRef.current = { overId, position: newPosition };
      notify();
    },
    [nodes, notify],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      overInfoRef.current = null;
      notify();
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeNode = nodes.find((n) => n.id === active.id);
      if (!activeNode) return;
      const overId = over.id as string;

      if (overId === "droppable-root-section") {
        if (activeNode.parentId !== null) moveToRoot(active.id as string);
        return;
      }

      const overNode = nodes.find((n) => n.id === overId);
      if (!overNode) return;

      if (overNode.type === "folder") {
        const pointerY = getPointerY(event);
        if (!pointerY || !over.rect) {
          // Fallback: drop inside
          if (activeNode.parentId !== overNode.id) {
            moveNodeInto(active.id as string, over.id as string);
          }
          return;
        }

        const position = computeFolderPosition(pointerY, over.rect);

        if (position === "above") {
          moveNode(active.id as string, over.id as string, "above");
        } else if (position === "below") {
          moveNode(active.id as string, over.id as string, "below");
        } else {
          if (activeNode.parentId !== overNode.id) {
            moveNodeInto(active.id as string, over.id as string);
          }
        }
      } else {
        const pointerY = getPointerY(event);
        if (!pointerY || !over.rect) {
          moveNode(active.id as string, over.id as string, "below");
          return;
        }
        const { top, height } = over.rect;
        const position = pointerY - top < height / 2 ? "above" : "below";
        moveNode(active.id as string, over.id as string, position);
      }
    },
    [nodes, moveNode, moveNodeInto, moveToRoot, notify],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    overInfoRef.current = null;
    notify();
  }, [notify]);

  const activeNode = activeId ? nodes.find((n) => n.id === activeId) : null;

  return {
    sensors,
    activeId,
    activeNode,
    dragOverStore,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
}
