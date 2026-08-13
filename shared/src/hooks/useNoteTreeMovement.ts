import { useCallback } from "react";
import type { NoteNode } from "../types/note";
import type { MoveResult } from "../types/moveResult";
import { isDescendantOf } from "../utils/getDescendantTodos";

/**
 * Pure note-tree move logic. 1:1 port of
 * frontend/src/hooks/useNoteTreeMovement.ts — no host coupling (operates
 * on the in-memory `notes` array + a `persistWithHistory` callback the
 * Note hook supplies). The @dnd-kit glue that maps pointer gestures onto
 * these operations lives in the host UI (web), not here, so the shared
 * package stays UI/dnd-free (Option A: shared is UI-free like S1/S2).
 *
 * #418: kept symmetric with useTodoTreeMovement — note nesting is retired
 * along with task nesting, so `moveNodeInto` and `moveNode`'s re-parent
 * branch were removed. Notes DnD has only assigned tags since S1, so nothing
 * called either of them. See the task twin's header for the one nuance: the
 * re-parent branch's guard sat inside `if (newParentId !== null)`, so dropping
 * next to a ROOT note used to succeed (positioned lift-out to the root list).
 * `moveToRoot` is the successor and appends to the tail instead.
 *
 * `parentId` is not retired: `useNotesUnifiedAPI.createNote({ parentId })`
 * still accepts one, and the surviving `moveNode` / `moveToRoot` have no
 * callers today either.
 */

// Re-exported for the cycle-safety regression test (KI-016 anchor). The
// implementation is the generic twin in getDescendantTodos — the local
// byte-identical copy was removed (C3 dedup); behaviour unchanged.
export { isDescendantOf };

export function useNoteTreeMovement(
  notes: NoteNode[],
  persistWithHistory: (currentNotes: NoteNode[], updated: NoteNode[]) => void,
) {
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

      // Defensive (KI-016): siblings can never be descendants of each other,
      // so this only fires on corrupt parentId data. The visited-guarded
      // helper keeps a cyclic tree from hanging the main thread.
      if (isDescendantOf(activeId, overId, notes))
        return { success: false, reason: "circular_reference" };

      // #418: reorder only, never re-parent. The sibling list is always the
      // active note's own; a drop target outside it falls out of the
      // findIndex check below as `node_not_found` instead of moving the note
      // under a new parent. See the task twin for the "if this is ever shown
      // to the user, split the reason out" note.
      //
      // Deliberate asymmetry with Tasks: no `isDeleted` guard here, so a
      // soft-deleted note reports `node_not_found` (it is filtered out of the
      // sibling list) rather than `deleted_node`. Pinned by test.
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
    },
    [notes, persistWithHistory],
  );

  return { moveNode, moveToRoot };
}
