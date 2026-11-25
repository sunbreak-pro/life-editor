import type { NoteNode, NoteSortMode } from "../types/note";
import { sortNotesForList } from "../utils/noteSort";

/**
 * Pure helpers for useNotesUnifiedAPI (#587 split): localStorage persistence,
 * the fresh-node factory, and the tree derivations. Nothing here touches React
 * state — everything is a plain function of its inputs, so the orchestrator
 * hook just memoizes calls into this module.
 */

export type NoteSortDirection = "asc" | "desc";

// Both keys share the `life-editor:` per-surface prefix so "reset settings"
// sweeps them (it matches by prefix — utils/resetPreferences.ts).
// #718: LS_SORT_DIRECTION used to be bare (`note-sort-direction`) to avoid
// orphaning already-saved values, which meant a reset cleared the sort MODE
// below but not its DIRECTION. Renaming is now safe because
// `migrateLegacyPreferenceKeys` (utils/) copies the old value across at
// startup — do not reintroduce an un-prefixed key here.
const LS_SORT_DIRECTION = "life-editor:note-sort-direction";
// #283: sort MODE persistence.
const LS_SORT_MODE = "life-editor:note-sort-mode";

export function loadSortDirection(): NoteSortDirection {
  try {
    const saved = localStorage.getItem(LS_SORT_DIRECTION);
    if (saved === "asc" || saved === "desc") return saved;
  } catch {
    // ignore
  }
  return "asc";
}

export function saveSortDirection(dir: NoteSortDirection): void {
  try {
    localStorage.setItem(LS_SORT_DIRECTION, dir);
  } catch {
    // ignore storage write failures
  }
}

export function loadSortMode(): NoteSortMode {
  try {
    const saved = localStorage.getItem(LS_SORT_MODE);
    if (saved === "updatedAt" || saved === "createdAt" || saved === "title") {
      return saved;
    }
  } catch {
    // ignore
  }
  return "updatedAt";
}

export function saveSortMode(mode: NoteSortMode): void {
  try {
    localStorage.setItem(LS_SORT_MODE, mode);
  } catch {
    // ignore storage write failures
  }
}

/**
 * The notes the list keeps while offline (#2334): the pinned ones, whose bodies
 * are stored on the device, and the ones created offline (#2337).
 */
export function isNoteKeptOffline(note: NoteNode): boolean {
  return note.isPinned || note.createdOffline === true;
}

/**
 * Build a fresh NoteNode for `createNoteUnified`. This mirrors the node
 * the retired Notes Bridge createNote constructed (content always "",
 * order 0, unpinned, not deleted), so the Unified write path is
 * byte-for-byte identical to the legacy path. The caller is responsible for
 * the optimistic `setNotes` + any follow-up `updateNoteUnified(content)`.
 *
 * #375: the `type` parameter is gone — "note" is the only NoteNodeType left
 * (folders became life-tags).
 */
export function buildNoteNode(
  id: string,
  title: string,
  parentId: string | null,
  now: string,
): NoteNode {
  return {
    id,
    type: "note",
    title,
    content: "",
    parentId,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The notes a search query keeps (#1837).
 *
 * Two layers, and the split is the point. The TITLE is on every row in the
 * list, so it is matched here and the answer is instant. The BODY is not —
 * the list is body-free by design (M1), and `n.content` is filled in only for
 * notes that have been opened — so a body match arrives as a set of ids from
 * `ds.searchNotesUnified` (useNoteBodySearch) and is OR-ed in.
 *
 * `bodyMatchIds` is null while no query is running and while one is still in
 * flight, which is not the same as an empty set: null means "no answer from
 * the server yet", empty means "it looked and found none". Both read correctly
 * here, because the title layer stands on its own either way.
 *
 * `n.content` is still consulted, for the notes that happen to be hydrated: it
 * costs one string compare and it makes the open note match itself before the
 * debounce has even fired.
 */
export function filterNotesBySearch(
  notes: NoteNode[],
  searchQuery: string,
  bodyMatchIds?: ReadonlySet<string> | null,
): NoteNode[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      bodyMatchIds?.has(n.id) === true,
  );
}

export function filterAndSortNotes(
  notes: NoteNode[],
  searchQuery: string,
  sortMode: NoteSortMode,
  sortDirection: NoteSortDirection,
  bodyMatchIds?: ReadonlySet<string> | null,
): NoteNode[] {
  const result = filterNotesBySearch(notes, searchQuery, bodyMatchIds);

  // Sort: pinned first, then by sort mode within each group. Single sort
  // implementation shared with the host list (#283) — see noteSort.ts.
  return sortNotesForList(result, sortMode, sortDirection);
}

/**
 * Collect `id`'s whole subtree in post-order (descendants before ancestor).
 * `seen` guards against a corrupted parentId cycle (e.g. a bad sync
 * round-trip) causing unbounded recursion — same OOM class as the
 * todo-tree (known-issues 016). No DnD path creates hierarchy since #418,
 * but `createNote({ parentId })` still can and data may arrive cyclic from
 * the server.
 */
export function collectNoteSubtree(all: NoteNode[], id: string): NoteNode[] {
  const childrenOf = new Map<string | null, NoteNode[]>();
  for (const n of all) {
    const list = childrenOf.get(n.parentId);
    if (list) list.push(n);
    else childrenOf.set(n.parentId, [n]);
  }
  const subtree: NoteNode[] = [];
  const seen = new Set<string>();
  const collect = (nodeId: string) => {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const self = all.find((n) => n.id === nodeId);
    if (!self) return;
    for (const child of childrenOf.get(nodeId) ?? []) collect(child.id);
    subtree.push(self); // post-order: descendants before ancestor
  };
  collect(id);
  return subtree;
}
