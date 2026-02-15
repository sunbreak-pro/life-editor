import { useCallback } from "react";
import type { TaskNode } from "../types/taskTree";
import { collectDescendantIds } from "../utils/getDescendantTasks";

export function useTaskTreeDeletion(
  nodes: TaskNode[],
  persistWithHistory: (currentNodes: TaskNode[], updated: TaskNode[]) => void,
  persistSilent: (updated: TaskNode[]) => void,
  clearHistory: () => void,
) {
  const softDelete = useCallback(
    (id: string) => {
      const descendantIds = collectDescendantIds(id, nodes);

      persistWithHistory(
        nodes,
        nodes.map((n) =>
          descendantIds.has(n.id)
            ? { ...n, isDeleted: true, deletedAt: new Date().toISOString() }
            : n,
        ),
      );
    },
    [nodes, persistWithHistory],
  );

  const restoreNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;

      const idsToRestore = collectDescendantIds(id, nodes);

      // Also restore ancestors if they're deleted
      let current = node;
      while (current.parentId) {
        const parent = nodes.find((n) => n.id === current.parentId);
        if (parent && parent.isDeleted) {
          idsToRestore.add(parent.id);
        }
        if (!parent) break;
        current = parent;
      }

      persistWithHistory(
        nodes,
        nodes.map((n) =>
          idsToRestore.has(n.id)
            ? { ...n, isDeleted: false, deletedAt: undefined }
            : n,
        ),
      );
    },
    [nodes, persistWithHistory],
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
