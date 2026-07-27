import { useCallback } from "react";
import type { TaskNode } from "../types/taskTree";
import type { MoveResult } from "../types/moveResult";
import { isDescendantOf } from "../utils/getDescendantTasks";

/*
 * Pure task-tree move logic (no @dnd-kit / host coupling).
 *
 * #418: task nesting is retired by user decision (2026-07-27). `moveNodeInto`
 * and `moveNode`'s re-parent branch are gone — both were unreachable dead code
 * whose folder-era guard (`type === "task"`) had turned always-true once #225
 * made NodeType single-valued, and their only caller (web's useTaskTreeDnd)
 * was never wired into a screen. What remains are the two operations that do
 * not create hierarchy: `moveNode` (reorder inside one sibling list) and
 * `moveToRoot` (lift a legacy child row back out to the root list).
 */

export function useTaskTreeMovement(
  nodes: TaskNode[],
  persistWithHistory: (currentNodes: TaskNode[], updated: TaskNode[]) => void,
) {
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

      // Defensive (KI-016): siblings can never be descendants of each other,
      // so this only fires on corrupt parentId data. The visited-guarded
      // helper keeps a cyclic tree from hanging the main thread.
      if (isDescendantOf(activeId, overId, nodes))
        return { success: false, reason: "circular_reference" };

      // #418: reorder only, never re-parent. The sibling list is always the
      // active node's own; a drop target outside it falls out of the
      // findIndex check below as `node_not_found` instead of moving the node
      // under a new parent.
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
    },
    [nodes, persistWithHistory],
  );

  return { moveNode, moveToRoot };
}
