import { useCallback } from "react";
import type { NoteNode } from "../types/note";
import type { MoveResult } from "../types/moveResult";

function isDescendantOf(
  parentId: string,
  childId: string,
  nodes: NoteNode[],
): boolean {
  const childrenMap = new Map<string | null, string[]>();
  for (const node of nodes) {
    const pid = node.parentId;
    const list = childrenMap.get(pid);
    if (list) {
      list.push(node.id);
    } else {
      childrenMap.set(pid, [node.id]);
    }
  }

  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenMap.get(current);
    if (!children) continue;
    for (const id of children) {
      if (id === childId) return true;
      stack.push(id);
    }
  }
  return false;
}

export function useNoteTreeMovement(
  notes: NoteNode[],
  persistWithHistory: (currentNotes: NoteNode[], updated: NoteNode[]) => void,
) {
  const moveNodeInto = useCallback(
    (activeId: string, targetFolderId: string): MoveResult => {
      const active = notes.find((n) => n.id === activeId);
      const target = notes.find((n) => n.id === targetFolderId);
      if (!active || !target)
        return { success: false, reason: "node_not_found" };

      if (target.type === "note")
        return { success: false, reason: "target_is_task" };

      if (isDescendantOf(activeId, targetFolderId, notes))
        return { success: false, reason: "circular_reference" };

      if (active.parentId === targetFolderId)
        return { success: false, reason: "already_in_target" };

      const targetChildren = notes
        .filter((n) => !n.isDeleted && n.parentId === targetFolderId)
        .sort((a, b) => a.order - b.order);
      const newOrder = targetChildren.length;

      const oldSiblings = notes
        .filter(
          (n) =>
            !n.isDeleted && n.parentId === active.parentId && n.id !== activeId,
        )
        .sort((a, b) => a.order - b.order);
      const orderMap = new Map(oldSiblings.map((n, i) => [n.id, i]));

      persistWithHistory(
        notes,
        notes.map((n) => {
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
    [notes, persistWithHistory],
  );

  const moveToRoot = useCallback(
    (activeId: string): MoveResult => {
      const active = notes.find((n) => n.id === activeId);
      if (!active) return { success: false, reason: "node_not_found" };
      if (active.parentId === null)
        return { success: false, reason: "already_in_target" };

      const rootChildren = notes
        .filter((n) => !n.isDeleted && n.parentId === null)
        .sort((a, b) => a.order - b.order);
      const newOrder = rootChildren.length;

      const oldSiblings = notes
        .filter(
          (n) =>
            !n.isDeleted && n.parentId === active.parentId && n.id !== activeId,
        )
        .sort((a, b) => a.order - b.order);
      const orderMap = new Map(oldSiblings.map((n, i) => [n.id, i]));

      persistWithHistory(
        notes,
        notes.map((n) => {
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
    [notes, persistWithHistory],
  );

  const moveNode = useCallback(
    (
      activeId: string,
      overId: string,
      position: "above" | "below" = "above",
    ): MoveResult => {
      const active = notes.find((n) => n.id === activeId);
      const over = notes.find((n) => n.id === overId);
      if (!active || !over) return { success: false, reason: "node_not_found" };

      if (isDescendantOf(activeId, overId, notes))
        return { success: false, reason: "circular_reference" };

      if (active.parentId === over.parentId) {
        const siblings = notes
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
          notes,
          notes.map((n) =>
            orderMap.has(n.id) ? { ...n, order: orderMap.get(n.id)! } : n,
          ),
        );
        return { success: true };
      } else {
        const newParentId = over.parentId;

        if (newParentId !== null) {
          const parent = notes.find((n) => n.id === newParentId);
          if (!parent || parent.type === "note")
            return { success: false, reason: "parent_is_task" };
        }

        const newSiblings = notes
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

        const oldSiblings = notes
          .filter(
            (n) =>
              !n.isDeleted &&
              n.parentId === active.parentId &&
              n.id !== activeId,
          )
          .sort((a, b) => a.order - b.order);
        oldSiblings.forEach((n, i) => orderMap.set(n.id, i));

        persistWithHistory(
          notes,
          notes.map((n) => {
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
    [notes, persistWithHistory],
  );

  return { moveNode, moveNodeInto, moveToRoot };
}
