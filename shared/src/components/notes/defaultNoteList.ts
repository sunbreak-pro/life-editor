import type { NoteNode, NoteSortMode } from "../../types/note";
import {
  sortNotesForList,
  type FrozenNoteSortKey,
  type NoteSortDirection,
} from "../../utils/noteSort";

/*
 * The Notes sidebar's DEFAULT list (#2061) — pure, UI-free.
 *
 * Until #2061 the sidebar opened on the tag-grouped list (buildTagGroups). The
 * default is now one flat list: pinned notes first, then the rest, each half in
 * the user's current sort (`NoteSortMode` + direction — the same settings the
 * sort control writes), and only the first `limit` of it. Everything past the
 * limit is handed back separately, because the sidebar does not drop it: it
 * offers it behind an "Other items" entry under the last row.
 *
 * DECISIONS PINNED HERE
 *   - The limit counts the pinned notes. Pinning is a way of putting a note
 *     into those first slots, not a second list on top of them, so a vault
 *     with more pinned notes than the limit spills its last pinned ones into
 *     `others` like anything else — still ahead of the unpinned ones there.
 *   - `limit: null` means no cap. The host passes it while a search query is
 *     on: a query already narrows the list, and hiding part of what it matched
 *     behind a second click would answer a narrower question than the one
 *     asked.
 *   - Deleted notes never take a slot.
 *
 * Ordering is `sortNotesForList` itself — the same comparator, frozen-key hold
 * (#366) and pinned-first split the tag groups use — so the two views cannot
 * disagree about what "sorted by updated, newest first" means.
 */

/** How many notes the default sidebar list shows before "Other items" (#2061). */
export const DEFAULT_NOTE_LIST_LIMIT = 15;

export interface BuildDefaultNoteListInput {
  /** Notes to list — already narrowed by the search query, if any. */
  notes: NoteNode[];
  sortMode: NoteSortMode;
  sortDirection: NoteSortDirection;
  /** The selected note's held sort key (#366), or null. */
  frozen?: FrozenNoteSortKey | null;
  /** Rows to show before the rest go to `others`; null = no cap. */
  limit: number | null;
}

export interface DefaultNoteList {
  /** The rows the sidebar draws, in order. */
  shown: NoteNode[];
  /** What did not fit under the limit, in the same order. Empty without a cap. */
  others: NoteNode[];
}

export function buildDefaultNoteList({
  notes,
  sortMode,
  sortDirection,
  frozen = null,
  limit,
}: BuildDefaultNoteListInput): DefaultNoteList {
  const ordered = sortNotesForList(
    notes.filter((n) => !n.isDeleted),
    sortMode,
    sortDirection,
    frozen,
  );
  if (limit === null || ordered.length <= limit) {
    return { shown: ordered, others: [] };
  }
  const cut = Math.max(0, limit);
  return { shown: ordered.slice(0, cut), others: ordered.slice(cut) };
}
