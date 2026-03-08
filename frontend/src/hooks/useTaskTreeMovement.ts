import { useCallback } from "react";
import type { TaskNode } from "../types/taskTree";
import { MAX_FOLDER_DEPTH } from "../types/taskTree";
import { isDescendantOf } from "../utils/getDescendantTasks";

function getSubtreeMaxDepth(nodes: TaskNode[], nodeId: string): number {
  const children = nodes.filter((n) => n.parentId === nodeId && !n.isDeleted);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((c) => getSubtreeMaxDepth(nodes, c.id)));
}

export function useTaskTreeMovement(
  nodes: TaskNode[],
  persistWithHistory: (currentNodes: TaskNode[], updated: TaskNode[]) => void,
  getNodeDepth: (nodeId: string) => number,
) {
  const canMoveToDepth = useCallback(
    (nodeId: string, targetDepth: number): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      if (node.type === "folder") {
        const subtreeDepth = getSubtreeMaxDepth(nodes, nodeId);
        return targetDepth + subtreeDepth < MAX_FOLDER_DEPTH;
      }
      return true;
    },
    [nodes],
  );

  const moveNodeInto = useCallback(
    (activeId: string, targetFolderId: string) => {
      const active = nodes.find((n) => n.id === activeId);
      const target = nodes.find((n) => n.id === targetFolderId);
      if (!active || !target) return;

      if (target.type === "task") return;

      if (isDescendantOf(activeId, targetFolderId, nodes)) return;

      const targetDepth = getNodeDepth(targetFolderId);
      if (!canMoveToDepth(activeId, targetDepth + 1)) return;

      if (active.parentId === targetFolderId) return;

      const targetChildren = nodes
        .filter((n) => !n.isDeleted && n.parentId === targetFolderId)
        .sort((a, b) => a.order - b.order);
      const newOrder = targetChildren.length;

      const oldSiblings = nodes
        .filter(
          (n) =>
            !n.isDeleted && n.parentId === active.parentId && n.id !== activeId,
        )
        .sort((a, b) => a.order - b.order);
      const orderMap = new Map(oldSiblings.map((n, i) => [n.id, i]));

      persistWithHistory(
        nodes,
        nodes.map((n) => {
          if (n.id === activeId) {
            return { ...n, parentId: targetFolderId, order: newOrder };
          }
          if (orderMap.has(n.id)) {
            return { ...n, order: orderMap.get(n.id)! };
          }
          return n;
        }),
      );
    },
    [nodes, persistWithHistory, getNodeDepth, canMoveToDepth],
  );

  const moveToRoot = useCallback(
    (activeId: string) => {
      const active = nodes.find((n) => n.id === activeId);
      if (!active || active.parentId === null) return;

      const rootChildren = nodes
        .filter((n) => !n.isDeleted && n.parentId === null)
        .sort((a, b) => a.order - b.order);
      const newOrder = rootChildren.length;

      const oldSiblings = nodes
        .filter(
          (n) =>
            !n.isDeleted && n.parentId === active.parentId && n.id !== activeId,
        )
        .sort((a, b) => a.order - b.order);
      const orderMap = new Map(oldSiblings.map((n, i) => [n.id, i]));

      persistWithHistory(
        nodes,
        nodes.map((n) => {
          if (n.id === activeId) {
            return { ...n, parentId: null, order: newOrder };
          }
          if (orderMap.has(n.id)) {
            return { ...n, order: orderMap.get(n.id)! };
          }
          return n;
        }),
      );
    },
    [nodes, persistWithHistory],
  );

  const moveNode = useCallback(
    (
      activeId: string,
      overId: string,
      position: "above" | "below" = "above",
    ) => {
      const active = nodes.find((n) => n.id === activeId);
      const over = nodes.find((n) => n.id === overId);
      if (!active || !over) return;

      if (isDescendantOf(activeId, overId, nodes)) return;

      if (active.parentId === over.parentId) {
        const siblings = nodes
          .filter((n) => !n.isDeleted && n.parentId === active.parentId)
          .sort((a, b) => a.order - b.order);
        const oldIndex = siblings.findIndex((n) => n.id === activeId);
        const overIdx = siblings.findIndex((n) => n.id === overId);
        if (oldIndex === -1 || overIdx === -1) return;

        const reordered = [...siblings];
        const [moved] = reordered.splice(oldIndex, 1);
        const newOverIdx = reordered.findIndex((n) => n.id === overId);
        const insertAt = position === "below" ? newOverIdx + 1 : newOverIdx;
        reordered.splice(insertAt, 0, moved);

        const orderMap = new Map(reordered.map((n, i) => [n.id, i]));
        persistWithHistory(
          nodes,
          nodes.map((n) =>
            orderMap.has(n.id) ? { ...n, order: orderMap.get(n.id)! } : n,
          ),
        );
      } else {
        const newParentId = over.parentId;

        if (newParentId !== null) {
          const parent = nodes.find((n) => n.id === newParentId);
          if (!parent || parent.type === "task") return;
          if (!canMoveToDepth(activeId, getNodeDepth(newParentId) + 1)) return;
        }

        const newSiblings = nodes
          .filter(
            (n) =>
              !n.isDeleted && n.parentId === newParentId && n.id !== activeId,
          )
          .sort((a, b) => a.order - b.order);
        const overIndex = newSiblings.findIndex((n) => n.id === overId);
        const insertIndex =
          overIndex === -1
            ? newSiblings.length
            : position === "below"
              ? overIndex + 1
              : overIndex;

        newSiblings.splice(insertIndex, 0, active);

        const orderMap = new Map(newSiblings.map((n, i) => [n.id, i]));

        const oldSiblings = nodes
          .filter(
            (n) =>
              !n.isDeleted &&
              n.parentId === active.parentId &&
              n.id !== activeId,
          )
          .sort((a, b) => a.order - b.order);
        oldSiblings.forEach((n, i) => orderMap.set(n.id, i));

        persistWithHistory(
          nodes,
          nodes.map((n) => {
            if (n.id === activeId) {
              return {
                ...n,
                parentId: newParentId,
                order: orderMap.get(n.id) ?? 0,
              };
            }
            if (orderMap.has(n.id)) {
              return { ...n, order: orderMap.get(n.id)! };
            }
            return n;
          }),
        );
      }
    },
    [nodes, persistWithHistory, getNodeDepth, canMoveToDepth],
  );

  return { moveNode, moveNodeInto, moveToRoot };
}
