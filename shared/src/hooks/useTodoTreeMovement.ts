import { useCallback } from "react";
import type { TodoNode } from "../types/todoTree";
import type { MoveResult } from "../types/moveResult";
import { isDescendantOf } from "../utils/getDescendantTodos";

/*
 * Pure todo-tree move logic (no @dnd-kit / host coupling).
 *
 * #418: todo nesting is retired by user decision (2026-07-27). `moveNodeInto`
 * and `moveNode`'s re-parent branch are gone. What made them dead was that
 * their only caller — web's `useTodoTreeDnd` — was never wired into a screen;
 * the folder-era guard is a separate story and was NOT uniformly always-true:
 *
 *   - `moveNodeInto`: guard `target.type === "task"` sat on every path, so it
 *     really did reject everything once #225 made TodoNodeType single-valued.
 *   - `moveNode`'s re-parent branch: the guard lived inside
 *     `if (newParentId !== null)`, so dropping next to a ROOT node skipped it
 *     and SUCCEEDED — it pulled a legacy child row out to a chosen slot in the
 *     root list. That capability is intentionally dropped here; `moveToRoot`
 *     is the successor but appends to the tail instead of taking a position.
 *
 * What remains: `moveNode` (reorder inside one sibling list) and `moveToRoot`.
 * Neither creates hierarchy — but note that neither has a caller either, so
 * this whole hook is currently unconsumed (see #418 for the open question of
 * whether to retire the rest of the chain). `parentId` itself is NOT retired:
 * `useTodoTreeCRUD.addNode(type, parentId, …)` and MCP `create_todo(parent_id)`
 * can still write a parent/child pair.
 */

export function useTodoTreeMovement(
  nodes: TodoNode[],
  persistWithHistory: (currentNodes: TodoNode[], updated: TodoNode[]) => void,
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
      // under a new parent. No rejection reason is surfaced anywhere today —
      // if one ever gets wired to a Toast, split this case out (the node WAS
      // found, it just is not a sibling) rather than showing "not found".
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
