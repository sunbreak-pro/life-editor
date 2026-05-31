import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";

/*
 * Shared tree-DnD collision strategy (DU-G): pointer-first. `pointerWithin`
 * picks the row the cursor is literally over, which matches the pointer-Y
 * zone logic in `useNoteTreeDnd` / `useTaskTreeDnd` (so the over-target and
 * the above/inside/below decision agree on one coordinate). The list rows
 * are gapless, but if the pointer ever lands in a seam, `rectIntersection`
 * fills in the nearest overlapping droppable so `over` never flickers to
 * null mid-drag. A module-scope constant gives a stable identity across
 * renders. Notes + Tasks import this so the two trees collide identically.
 */
export const treeCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};
