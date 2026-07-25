import { useCallback } from "react";
import type { TaskNode } from "../types/taskTree";
import { collectDescendantIds } from "../utils/getDescendantTasks";
import { walkAncestors } from "../utils/walkAncestors";

export function useTaskTreeDeletion(
  nodes: TaskNode[],
  persistWithHistory: (currentNodes: TaskNode[], updated: TaskNode[]) => void,
  persistSilent: (updated: TaskNode[]) => void,
  clearHistory: () => void,
) {
  const softDelete = useCallback(
    (id: string, options?: { skipUndo?: boolean }) => {
      const descendantIds = collectDescendantIds(id, nodes);
      const updated = nodes.map((n) =>
        descendantIds.has(n.id)
          ? { ...n, isDeleted: true, deletedAt: new Date().toISOString() }
          : n,
      );

      if (options?.skipUndo) {
        persistSilent(updated);
      } else {
        persistWithHistory(nodes, updated);
      }
    },
    [nodes, persistWithHistory, persistSilent],
  );

  const restoreNode = useCallback(
    (id: string, options?: { skipUndo?: boolean }) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;

      const idsToRestore = collectDescendantIds(id, nodes);

      // Also restore ancestors if they're deleted. walkAncestors carries the
      // visited-Set guard (KI-016 class): the bare `while (current.parentId)`
      // climb this replaces looped forever on a cyclic parentId chain, hanging
      // the tab on restore. It also drops the O(n) find-per-level to O(1).
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const ancestor of walkAncestors(id, nodeMap)) {
        if (ancestor.isDeleted) idsToRestore.add(ancestor.id);
      }

      const updated = nodes.map((n) =>
        idsToRestore.has(n.id)
          ? { ...n, isDeleted: false, deletedAt: undefined }
          : n,
      );

      if (options?.skipUndo) {
        persistSilent(updated);
      } else {
        persistWithHistory(nodes, updated);
      }
    },
    [nodes, persistWithHistory, persistSilent],
  );

  const permanentDelete = useCallback(
    (id: string) => {
      const idsToDelete = collectDescendantIds(id, nodes);
      persistSilent(nodes.filter((n) => !idsToDelete.has(n.id)));
      clearHistory();
    },
    [nodes, persistSilent, clearHistory],
  );

  return { softDelete, restoreNode, permanentDelete };
}
