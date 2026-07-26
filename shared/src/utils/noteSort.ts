import type { NoteNode, NoteSortMode } from "../types/note";

/**
 * Sort direction for the notes list. Defined here (not pulled from a UI
 * component) so the ordering logic stays framework-free and host-portable —
 * mirrors `NoteSortDirection` on useNotesUnifiedAPI.
 */
export type NoteSortDirection = "asc" | "desc";

/**
 * The only fields the comparator reads. Structural on purpose: a whole
 * `NoteNode` satisfies it, and so does the frozen snapshot below (#366).
 */
export type NoteSortKey = Pick<NoteNode, "title" | "createdAt" | "updatedAt">;

/**
 * A snapshot of one note's sort key, taken when it was selected (#366).
 *
 * Typing into a note bumps its `updatedAt` on every debounced save, which
 * under the default newest-first mode yanks the row to the top of its tag
 * group mid-sentence. Holding the key it had at selection time keeps the row
 * where the user last saw it; the live note object is still what gets
 * rendered, so the title updates in place without moving.
 */
export interface FrozenNoteSortKey extends NoteSortKey {
  id: string;
}

/**
 * Compare two notes for the sidebar list. Verbatim port of the
 * `sortedFilteredNotes` memo's inline comparator (useNotesUnifiedAPI.ts): for
 * the date modes the natural order is newest-first (`b.localeCompare(a)`), and
 * `direction === "desc"` flips it; `title` is A→Z by default. The returned sign
 * is identical to the memo so the list order is preserved exactly.
 */
export function compareNotes(
  a: NoteSortKey,
  b: NoteSortKey,
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
 *
 * `frozen` (optional, #366) overrides the SORT KEY of the note whose id it
 * carries — the array still yields the live objects, so the held row renders
 * its current title while staying put. `isPinned` is deliberately read from
 * the live note: pinning is an explicit user action and should move the row
 * immediately, unlike the incidental `updatedAt` bump that typing causes.
 */
export function sortNotesForList(
  notes: NoteNode[],
  mode: NoteSortMode,
  direction: NoteSortDirection,
  frozen?: FrozenNoteSortKey | null,
): NoteNode[] {
  const keyOf = (n: NoteNode): NoteSortKey =>
    frozen && n.id === frozen.id ? frozen : n;
  const cmp = (a: NoteNode, b: NoteNode): number =>
    compareNotes(keyOf(a), keyOf(b), mode, direction);
  const pinned = notes.filter((n) => n.isPinned).sort(cmp);
  const unpinned = notes.filter((n) => !n.isPinned).sort(cmp);
  return [...pinned, ...unpinned];
}
