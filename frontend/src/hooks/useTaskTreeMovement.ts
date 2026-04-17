import { useCallback } from "react";
import type { TaskNode } from "../types/taskTree";
import type { MoveResult } from "../types/moveResult";
import { isDescendantOf } from "../utils/getDescendantTasks";

export function useTaskTreeMovement(
  nodes: TaskNode[],
  persistWithHistory: (currentNodes: TaskNode[], updated: TaskNode[]) => void,
) {
  const moveNodeInto = useCallback(
    (activeId: string, targetFolderId: string): MoveResult => {
      const active = nodes.find((n) => n.id === activeId);
      const target = nodes.find((n) => n.id === targetFolderId);
      if (!active || !target)
        return { success: false, reason: "node_not_found" };

      if (active.isDeleted || target.isDeleted)
        return { success: false, reason: "deleted_node" };

      if (target.type === "task")
        return { success: false, reason: "target_is_task" };

      if (isDescendantOf(activeId, targetFolderId, nodes))
        return { success: false, reason: "circular_reference" };

      if (active.parentId === targetFolderId)
        return { success: false, reason: "already_in_target" };

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
      return { success: true };
    },
    [nodes, persistWithHistory],
  );

  const moveToRoot = useCallback(
    (activeId: string): MoveResult => {
      const active = nodes.find((n) => n.id === activeId);
      if (!active) return { success: false, reason: "node_not_found" };
      if (active.isDeleted) return { success: false, reason: "deleted_node" };
      if (active.parentId === null)
        return { success: false, reason: "already_in_target" };

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
      return { success: true };
    },
    [nodes, persistWithHistory],
  );

  const moveNode = useCallback(
    (
      activeId: string,
      overId: string,
      position: "above" | "below" = "above",
    ): MoveResult => {
      const active = nodes.find((n) => n.id === activeId);
      const over = nodes.find((n) => n.id === overId);
      if (!active || !over) return { success: false, reason: "node_not_found" };

      if (active.isDeleted || over.isDeleted)
        return { success: false, reason: "deleted_node" };

      if (isDescendantOf(activeId, overId, nodes))
        return { success: false, reason: "circular_reference" };

      if (active.parentId === over.parentId) {
        const siblings = nodes
          .filter((n) => !n.isDeleted && n.parentId === active.parentId)
          .sort((a, b) => a.order - b.order);
        const oldIndex = siblings.findIndex((n) => n.id === activeId);
        const overIdx = siblings.findIndex((n) => n.id === overId);
        if (oldIndex === -1 || overIdx === -1)
          return { success: false, reason: "node_not_found" };

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
        return { success: true };
      } else {
        const newParentId = over.parentId;

        if (newParentId !== null) {
          const parent = nodes.find((n) => n.id === newParentId);
          if (!parent || parent.type === "task")
            return { success: false, reason: "parent_is_task" };
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
        return { success: true };
      }
    },
    [nodes, persistWithHistory],
  );

  return { moveNode, moveNodeInto, moveToRoot };
}
