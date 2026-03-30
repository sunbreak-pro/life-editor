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
import type { PaperNode } from "../types/paperBoard";

export interface LayerOverInfo {
  overId: string;
  position: "above" | "below" | "inside";
}

export interface LayerDragOverStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => LayerOverInfo | null;
}

export const LayerDragOverStoreContext =
  createContext<LayerDragOverStore | null>(null);

interface UsePaperLayersDndParams {
  nodes: PaperNode[];
  topLevel: PaperNode[];
  childrenMap: Map<string, PaperNode[]>;
  bulkUpdateZIndices: (
    updates: Array<{
      id: string;
      zIndex: number;
      parentNodeId: string | null;
    }>,
  ) => Promise<void>;
}

const FRAME_ZONE_ABOVE = 0.25;
const FRAME_ZONE_BELOW = 0.75;

const getPointerY = (event: DragMoveEvent | DragEndEvent): number | null => {
  if (!(event.activatorEvent instanceof PointerEvent)) return null;
  return event.activatorEvent.clientY + event.delta.y;
};

function computeDropPosition(
  pointerY: number,
  rect: { top: number; height: number },
  isFrame: boolean,
): "above" | "below" | "inside" {
  const ratio = (pointerY - rect.top) / rect.height;
  if (isFrame) {
    if (ratio < FRAME_ZONE_ABOVE) return "above";
    if (ratio > FRAME_ZONE_BELOW) return "below";
    return "inside";
  }
  return ratio < 0.5 ? "above" : "below";
}

/**
 * Recalculate sequential zIndex values for a list of nodes in display order.
 * Display order: index 0 = top of list = highest zIndex.
 */
function recalcZIndices(
  orderedNodes: PaperNode[],
  parentNodeId: string | null,
): Array<{ id: string; zIndex: number; parentNodeId: string | null }> {
  const count = orderedNodes.length;
  return orderedNodes.map((node, i) => ({
    id: node.id,
    zIndex: count - 1 - i,
    parentNodeId,
  }));
}

export function usePaperLayersDnd({
  nodes,
  topLevel,
  childrenMap,
  bulkUpdateZIndices,
}: UsePaperLayersDndParams) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const overInfoRef = useRef<LayerOverInfo | null>(null);
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

  const dragOverStore = useMemo<LayerDragOverStore>(
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

      const pointerY = getPointerY(event);
      let newPosition: "above" | "below" | "inside";

      if (!pointerY || !over.rect) {
        newPosition = overNode.nodeType === "frame" ? "inside" : "below";
      } else {
        newPosition = computeDropPosition(
          pointerY,
          over.rect,
          overNode.nodeType === "frame",
        );
      }

      const prev = overInfoRef.current;
      if (prev?.overId === overId && prev?.position === newPosition) return;

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
      const overNode = nodes.find((n) => n.id === over.id);
      if (!activeNode || !overNode) return;

      const pointerY = getPointerY(event);
      const isFrame = overNode.nodeType === "frame";
      const position =
        pointerY && over.rect
          ? computeDropPosition(pointerY, over.rect, isFrame)
          : isFrame
            ? "inside"
            : "below";

      // Determine source and target groups
      const sourceParent = activeNode.parentNodeId;
      let targetParent: string | null;

      if (position === "inside" && isFrame) {
        targetParent = overNode.id;
      } else {
        targetParent = overNode.parentNodeId;
      }

      // Build new ordering for affected groups
      const updates: Array<{
        id: string;
        zIndex: number;
        parentNodeId: string | null;
      }> = [];

      // Get source group (without active node)
      const sourceGroup =
        sourceParent === null
          ? [...topLevel]
          : [...(childrenMap.get(sourceParent) || [])];
      const filteredSource = sourceGroup.filter((n) => n.id !== activeNode.id);

      // Get target group
      let targetGroup: PaperNode[];
      if (sourceParent === targetParent) {
        // Same group - use filtered source
        targetGroup = filteredSource;
      } else {
        targetGroup =
          targetParent === null
            ? [...topLevel].filter((n) => n.id !== activeNode.id)
            : [...(childrenMap.get(targetParent) || [])].filter(
                (n) => n.id !== activeNode.id,
              );
      }

      // Insert active node at correct position in target group
      if (position === "inside") {
        // Add to beginning of frame children (top z-index)
        targetGroup.unshift(activeNode);
      } else {
        const overIdx = targetGroup.findIndex((n) => n.id === overNode.id);
        if (overIdx === -1) {
          // Over node not in target group (e.g., dropping inside frame via above/below)
          targetGroup.push(activeNode);
        } else if (position === "above") {
          targetGroup.splice(overIdx, 0, activeNode);
        } else {
          targetGroup.splice(overIdx + 1, 0, activeNode);
        }
      }

      // Recalculate z-indices for target group
      updates.push(...recalcZIndices(targetGroup, targetParent));

      // If moving between groups, also recalculate source group
      if (sourceParent !== targetParent) {
        updates.push(...recalcZIndices(filteredSource, sourceParent));
      }

      if (updates.length > 0) {
        bulkUpdateZIndices(updates);
      }
    },
    [nodes, topLevel, childrenMap, bulkUpdateZIndices, notify],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    overInfoRef.current = null;
    notify();
  }, [notify]);

  const activeNode = activeId
    ? (nodes.find((n) => n.id === activeId) ?? null)
    : null;

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
