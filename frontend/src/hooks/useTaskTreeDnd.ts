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
import type { MoveResult, MoveRejectionReason } from "../types/moveResult";

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
  ) => MoveResult;
  moveNodeInto: (activeId: string, overId: string) => MoveResult;
  moveToRoot: (id: string) => MoveResult;
  onMoveRejected?: (reason: MoveRejectionReason) => void;
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

function handleResult(
  result: MoveResult,
  onMoveRejected?: (reason: MoveRejectionReason) => void,
): void {
  if (!result.success && onMoveRejected) {
    onMoveRejected(result.reason);
  }
}

export function useTaskTreeDnd({
  nodes,
  moveNode,
  moveNodeInto,
  moveToRoot,
  onMoveRejected,
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
        if (activeNode.parentId !== null) {
          handleResult(moveToRoot(active.id as string), onMoveRejected);
        }
        return;
      }

      const overNode = nodes.find((n) => n.id === overId);
      if (!overNode) return;

      // Prevent dropping into Complete system folders
      if (overNode.folderType === "complete") return;

      if (overNode.type === "folder") {
        const pointerY = getPointerY(event);
        if (!pointerY || !over.rect) {
          // Fallback: drop inside
          if (activeNode.parentId !== overNode.id) {
            handleResult(
              moveNodeInto(active.id as string, over.id as string),
              onMoveRejected,
            );
          }
          return;
        }

        const position = computeFolderPosition(pointerY, over.rect);

        if (position === "above") {
          handleResult(
            moveNode(active.id as string, over.id as string, "above"),
            onMoveRejected,
          );
        } else if (position === "below") {
          handleResult(
            moveNode(active.id as string, over.id as string, "below"),
            onMoveRejected,
          );
        } else {
          if (activeNode.parentId !== overNode.id) {
            handleResult(
              moveNodeInto(active.id as string, over.id as string),
              onMoveRejected,
            );
          }
        }
      } else {
        const pointerY = getPointerY(event);
        if (!pointerY || !over.rect) {
          handleResult(
            moveNode(active.id as string, over.id as string, "below"),
            onMoveRejected,
          );
          return;
        }
        const { top, height } = over.rect;
        const position = pointerY - top < height / 2 ? "above" : "below";
        handleResult(
          moveNode(active.id as string, over.id as string, position),
          onMoveRejected,
        );
      }
    },
    [nodes, moveNode, moveNodeInto, moveToRoot, notify, onMoveRejected],
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
