/*
 * Pure drop-intent classifier for the tree DnD (Notes + Tasks share it).
 * Given where the pointer sits inside a row (a 0..1 ratio) and whether that
 * row is a folder, decide whether the drop means "reorder above", "reorder
 * below", or "go inside the folder".
 *
 * This stays UI/dnd-free on purpose (no @dnd-kit / React imports) so the
 * shared package keeps the same UI-free boundary as the rest of S1/S2. A web
 * host feeds it a ratio derived from the @dnd-kit rect + pointer.
 *
 * STATUS (#418): no host consumes this today. Both tree-DnD hooks that used
 * it are gone — Notes DnD only assigns tags since S1 (`useNoteTagDnd`), and
 * `web/src/tasks/useTaskTreeDnd.ts` was retired with the nesting chain. Kept
 * as the drop-geometry primitive a future tree view would reorder with; the
 * `isFolder: true` ("inside") half is only meaningful if nesting ever
 * returns, which is currently a No.
 *
 * "below" on a folder means "become the folder's sibling, right after it".
 * There is deliberately NO expanded-folder special case: dropping on a
 * folder's lower strip always reads as "after this folder", which is what
 * lets an item land below a folder that itself sits at the tail of another
 * folder.
 *
 * Zone split: folder inside zone is the middle 60% (0.2–0.8); the top/bottom
 * 20% strips reorder above/below. Non-folders split 50/50 (no "inside").
 */

export type NoteDropPosition = "above" | "below" | "inside";

const FOLDER_ABOVE = 0.2;
const FOLDER_BELOW = 0.8;

export function computeNoteDropIntent(params: {
  /** (pointerY - rect.top) / rect.height. Clamped to 0..1 internally. */
  pointerRatio: number;
  isFolder: boolean;
}): NoteDropPosition {
  const r = Math.min(1, Math.max(0, params.pointerRatio));
  // Non-folders have no "inside": top half reorders above, bottom below.
  if (!params.isFolder) return r < 0.5 ? "above" : "below";
  if (r < FOLDER_ABOVE) return "above";
  if (r > FOLDER_BELOW) return "below";
  return "inside";
}
