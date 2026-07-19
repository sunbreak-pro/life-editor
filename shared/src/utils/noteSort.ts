import type { NoteNode, NoteSortMode } from "../types/note";

/**
 * Sort direction for the notes list. Defined here (not pulled from a UI
 * component) so the ordering logic stays framework-free and host-portable —
 * mirrors `NoteSortDirection` on useNotesUnifiedAPI.
 */
export type NoteSortDirection = "asc" | "desc";

/**
 * Compare two notes for the sidebar list. Verbatim port of the
 * `sortedFilteredNotes` memo's inline comparator (useNotesUnifiedAPI.ts): for
 * the date modes the natural order is newest-first (`b.localeCompare(a)`), and
 * `direction === "desc"` flips it; `title` is A→Z by default. The returned sign
 * is identical to the memo so the list order is preserved exactly.
 */
export function compareNotes(
  a: NoteNode,
  b: NoteNode,
  mode: NoteSortMode,
  direction: NoteSortDirection,
): number {
  const dir = direction === "desc" ? -1 : 1;
  switch (mode) {
    case "updatedAt":
      return b.updatedAt.localeCompare(a.updatedAt) * dir;
    case "createdAt":
      return b.createdAt.localeCompare(a.createdAt) * dir;
    case "title":
      return a.title.localeCompare(b.title) * dir;
    default:
      return 0;
  }
}

/**
 * Order notes for the sidebar list: pinned first, then unpinned, each group
 * sorted by `compareNotes`. Matches the `sortedFilteredNotes` memo output for
 * the same inputs (Array.prototype.sort is stable, so ties keep input order).
 * Filtering is the caller's concern — pass an already-filtered array.
 */
export function sortNotesForList(
  notes: NoteNode[],
  mode: NoteSortMode,
  direction: NoteSortDirection,
): NoteNode[] {
  const cmp = (a: NoteNode, b: NoteNode): number =>
    compareNotes(a, b, mode, direction);
  const pinned = notes.filter((n) => n.isPinned).sort(cmp);
  const unpinned = notes.filter((n) => !n.isPinned).sort(cmp);
  return [...pinned, ...unpinned];
}
