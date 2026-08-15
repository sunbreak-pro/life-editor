import type { NoteNode, NoteSortMode } from "../types/note";
import { sortNotesForList } from "../utils/noteSort";

/**
 * Pure helpers for useNotesUnifiedAPI (#587 split): localStorage persistence,
 * the fresh-node factory, and the tree derivations. Nothing here touches React
 * state — everything is a plain function of its inputs, so the orchestrator
 * hook just memoizes calls into this module.
 */

export type NoteSortDirection = "asc" | "desc";

// All three keys share the `life-editor:` per-surface prefix so "reset
// settings" sweeps them (it matches by prefix — utils/resetPreferences.ts).
// #718: LS_EXPANDED and LS_SORT_DIRECTION used to be bare (`note-tree-expanded`
// / `note-sort-direction`) to avoid orphaning already-saved values, which meant
// a reset cleared the sort MODE below but not its DIRECTION. Renaming is now
// safe because `migrateLegacyPreferenceKeys` (utils/) copies the old values
// across at startup — do not reintroduce an un-prefixed key here.
const LS_EXPANDED = "life-editor:note-tree-expanded";
const LS_SORT_DIRECTION = "life-editor:note-sort-direction";
// #283: sort MODE persistence.
const LS_SORT_MODE = "life-editor:note-sort-mode";

export function loadExpandedIds(): Set<string> {
  try {
    const saved = localStorage.getItem(LS_EXPANDED);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // ignore malformed / unavailable storage
  }
  return new Set();
}

export function saveExpandedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_EXPANDED, JSON.stringify([...ids]));
  } catch {
    // ignore storage write failures (private mode / quota)
  }
}

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

// `buildChildrenByParent` is built once per `notes` change (O(n) group +
// sort) so `getChildren` is an O(1) Map lookup instead of an O(n)
// filter+sort per call. NotesView's flatten previously called getChildren
// twice per node (children + grandchildren probe) → O(n²); the Map
// collapses that to O(n). Behaviour is identical: same null-vs-string
// parent key (root uses the `null` key), same order sort, and it includes
// is_deleted rows just like the old filter did (the NotesView walk applies
// its own `!isDeleted` filter, and `flattenVisibleNotes` also sees the
// full set).
export function buildChildrenByParent(
  notes: NoteNode[],
): Map<string | null, NoteNode[]> {
  const map = new Map<string | null, NoteNode[]>();
  for (const n of notes) {
    const list = map.get(n.parentId);
    if (list) list.push(n);
    else map.set(n.parentId, [n]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  return map;
}

// Flatten tree for DnD (only visible nodes). #375: the recursion used to be
// gated on `type === "folder"`; with folders retired it descends into any
// expanded node. NOTE (#418): the nesting UI is retired — the movement hook
// can no longer re-parent, so no drag can deepen the tree. Data-level
// hierarchy is still writable though (`createNote({ parentId })`, and
// MCP `create_todo(parent_id)` on the todo side), so this walk sees legacy
// rows plus anything a non-UI caller creates.
export function flattenVisibleNotes(
  notes: NoteNode[],
  expandedIds: Set<string>,
): NoteNode[] {
  const result: NoteNode[] = [];
  // Defensive, not load-bearing: a walk rooted at `null` cannot actually
  // reach a parentId cycle (no cycle member has a null parent) and ids are
  // a PK, so this only fires on genuinely corrupt data. Kept because it is
  // one Set lookup per node.
  const seen = new Set<string>();
  const walk = (parentId: string | null) => {
    const children = notes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.order - b.order);
    for (const child of children) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      result.push(child);
      if (expandedIds.has(child.id)) {
        walk(child.id);
      }
    }
  };
  walk(null);
  return result;
}

export function filterAndSortNotes(
  notes: NoteNode[],
  searchQuery: string,
  sortMode: NoteSortMode,
  sortDirection: NoteSortDirection,
): NoteNode[] {
  let result = notes;

  // Search filter (client-side).
  // M1 caveat: since the list is body-free, `n.content` is only populated
  // for notes whose body has been hydrated (opened at least once). Title
  // always matches; body matching is best-effort on hydrated notes. Full
  // body search is the server-side ds.searchNotesUnified path — wire that
  // in if/when the search UI is built (currently no live consumer uses
  // this client filter).
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
    );
  }

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
