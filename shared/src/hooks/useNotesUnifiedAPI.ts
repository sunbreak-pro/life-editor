import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { NoteNode, NoteSortMode } from "../types/note";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { sortNotesForList } from "../utils/noteSort";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTaskTreeHistory";
import { useSyncContext } from "./useSyncContext";
import { useNoteTreeMovement } from "./useNoteTreeMovement";
import {
  getNotesSelection,
  setNotesSelection,
  clearNotesSelection,
} from "../state/materialsSelectionStore";

/**
 * DU-G G4: behaviour-preserving port of the former legacy Notes hook, with the
 * DataService call sites rewritten to the Unified (items_meta +
 * notes_payload) method names. The legacy Notes Bridge class
 * that used to map legacy → Unified names has been retired; this hook now
 * calls `*Unified` DataService methods directly.
 *
 * Host dependencies are injected, not imported (CLAUDE.md §6.4):
 * - `getDataService()` singleton  → `options.dataService`
 * - host UndoRedo Context         → `options.undoRedo` (no-op default;
 *   real UndoRedo lands in S6, same as tasks/daily)
 * - `useLocalStorage` / `STORAGE_KEYS` / `SortDropdown` host modules →
 *   inlined localStorage helpers + a local `SortDirection` type.
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`) — CLAUDE.md
 * §6.2 places Note after Sync (and, by convention, after Daily).
 */

export type NoteSortDirection = "asc" | "desc";

const LS_EXPANDED = "note-tree-expanded";
const LS_SORT_DIRECTION = "note-sort-direction";
// #283: sort MODE persistence. Namespaced (`life-editor:` prefix) — the newer
// convention. The sibling LS_SORT_DIRECTION stays un-namespaced on purpose:
// renaming it would silently discard the user's already-saved direction.
const LS_SORT_MODE = "life-editor:note-sort-mode";

function loadExpandedIds(): Set<string> {
  try {
    const saved = localStorage.getItem(LS_EXPANDED);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // ignore malformed / unavailable storage
  }
  return new Set();
}

function saveExpandedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_EXPANDED, JSON.stringify([...ids]));
  } catch {
    // ignore storage write failures (private mode / quota)
  }
}

function loadSortDirection(): NoteSortDirection {
  try {
    const saved = localStorage.getItem(LS_SORT_DIRECTION);
    if (saved === "asc" || saved === "desc") return saved;
  } catch {
    // ignore
  }
  return "asc";
}

function loadSortMode(): NoteSortMode {
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

/**
 * Build a fresh NoteNode for `createNoteUnified`. This mirrors the node
 * the retired Notes Bridge createNote / createNoteFolder
 * constructed (content always "", order 0, unpinned, not deleted), so the
 * Unified write path is byte-for-byte identical to the legacy path. The
 * caller is responsible for the optimistic `setNotes` + any follow-up
 * `updateNoteUnified(content)`.
 */
function buildNoteNode(
  id: string,
  type: NoteNode["type"],
  title: string,
  parentId: string | null,
  now: string,
): NoteNode {
  return {
    id,
    type,
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

export interface UseNotesUnifiedAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
}

export function useNotesUnifiedAPI(options: UseNotesUnifiedAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const { syncVersion } = useSyncContext();

  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletedNotes, setDeletedNotes] = useState<NoteNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortModeState] = useState<NoteSortMode>(loadSortMode);
  const [sortDirection, setSortDirectionState] =
    useState<NoteSortDirection>(loadSortDirection);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(loadExpandedIds);
  const notesRef = useRef(notes);
  const selectedNoteIdRef = useRef(selectedNoteId);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  // M1 (perf): the note LIST is fetched WITHOUT the body (content_json) —
  // list NoteNodes carry `content = ""`. The body is loaded on demand when
  // a note is opened. `contentLoadedIds` tracks which notes have had their
  // real body hydrated into the `notes` array (via getNoteUnified), so a
  // re-select doesn't re-fetch. It is CLEARED on every list (re)load
  // because a fresh light list has no bodies again — see the load effect.
  const contentLoadedIdsRef = useRef<Set<string>>(new Set());
  // "Latest select wins": if two selects race (fast clicks), only the most
  // recent one is allowed to commit its `setSelectedNoteId`, so a slow
  // earlier fetch can't clobber a newer selection.
  const selectTokenRef = useRef(0);

  // Hydrate a note's real body into the `notes` array. No-op if already
  // hydrated. Returns true when the note's body is present afterwards.
  const hydrateContent = useCallback(
    async (id: string): Promise<boolean> => {
      if (contentLoadedIdsRef.current.has(id)) return true;
      try {
        const full = await ds.getNoteUnified(id);
        if (!full) return false;
        contentLoadedIdsRef.current.add(id);
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, content: full.content } : n)),
        );
        return true;
      } catch (e) {
        logServiceError("Notes", "hydrateContent", e);
        return false;
      }
    },
    [ds],
  );

  // Select a note, loading its body FIRST (M1). The web editor initialises
  // its content once at mount from `selectedNote.content` and never
  // re-syncs while its note id is unchanged (useEditor dep `[noteId]`), so
  // the body MUST be present in the `notes` array before selection flips —
  // otherwise the editor would open empty and a subsequent edit would
  // overwrite the real body. Folders carry no editable body, so they skip
  // the round-trip and select immediately. On a hydrate failure the
  // selection is left unchanged (safer than opening an empty editor over a
  // note that has content).
  const selectNote = useCallback(
    (id: string | null): void => {
      const token = ++selectTokenRef.current;
      if (id === null) {
        setSelectedNoteId(null);
        clearNotesSelection(); // #282: persist deselection across remounts
        return;
      }
      const node = notesRef.current.find((n) => n.id === id);
      if (node?.type === "folder" || contentLoadedIdsRef.current.has(id)) {
        if (node?.type === "folder") contentLoadedIdsRef.current.add(id);
        setSelectedNoteId(id);
        setNotesSelection(id); // #282
        return;
      }
      void (async () => {
        const ok = await hydrateContent(id);
        if (selectTokenRef.current !== token) return; // superseded
        if (ok) {
          setSelectedNoteId(id);
          setNotesSelection(id); // #282
        }
      })();
    },
    [hydrateContent],
  );

  const setSortDirection = useCallback((dir: NoteSortDirection) => {
    setSortDirectionState(dir);
    try {
      localStorage.setItem(LS_SORT_DIRECTION, dir);
    } catch {
      // ignore storage write failures
    }
  }, []);

  const setSortMode = useCallback((mode: NoteSortMode) => {
    setSortModeState(mode);
    try {
      localStorage.setItem(LS_SORT_MODE, mode);
    } catch {
      // ignore storage write failures
    }
  }, []);

  // #282: flips only when a list fetch actually succeeded — the load effect's
  // `finally` clears isLoading even on error, so isLoading alone cannot tell
  // "loaded, id absent" apart from "load failed".
  const listLoadedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await ds.listNotesUnified();
        if (!cancelled) {
          // M1: the fresh list is body-free again, so any previously
          // hydrated bodies are stale/absent — invalidate the cache.
          contentLoadedIdsRef.current = new Set();
          setNotes(loaded);
          listLoadedRef.current = true; // #282: restore gates on a SUCCESSFUL load
          // Keep the currently-open note's body correct after a
          // sync-triggered reload (the editor is keyed by note id so it
          // won't remount; this just refills `notes[id].content` so a later
          // read of `selectedNote.content` is accurate).
          const openId = selectedNoteIdRef.current;
          if (openId) void hydrateContent(openId);
        }
      } catch (e) {
        logServiceError("Notes", "fetch", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load notes");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    // Trash list is loaded alongside the active tree (same trigger:
    // initial mount + every syncVersion bump) so the Trash section is
    // populated without the host having to call loadDeletedNotes() —
    // independent try/catch so a Trash failure never blocks the tree.
    (async () => {
      try {
        const deleted = await ds.fetchDeletedNotesUnified();
        if (!cancelled) setDeletedNotes(deleted);
      } catch (e) {
        logServiceError("Notes", "fetchDeleted", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion, hydrateContent]);

  // One-shot RESTORE (#282): re-open the note the user had selected before the
  // provider unmounted (Materials tab/section switch). The id lives in the
  // module-level materialsSelectionStore, which outlives this React tree. Runs
  // at most once per mount (restoredRef) and never fights a user action already
  // in flight (bail if something is already selected). Restore MUST take the
  // same hydrate-first path as selectNote — the web editor initialises its
  // content once per noteId and never re-syncs, so flipping selectedNoteId onto
  // an un-hydrated id would open a blank editor over a note that has a body
  // (DATA LOSS). A stored id absent from the loaded list, or a hydrate failure,
  // clears the store entry (no retry loops).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (isLoading) return; // wait until the list has loaded
    // A failed list fetch must NOT consume the one-shot nor clear the store —
    // a transient error (offline blip) would otherwise permanently erase the
    // remembered selection. `notes` in the deps retries after a successful
    // reload (syncVersion) repopulates the list.
    if (!listLoadedRef.current) return;
    restoredRef.current = true;
    const storedId = getNotesSelection();
    if (storedId === null) return;
    if (selectedNoteIdRef.current !== null) return; // user already selected
    const node = notes.find((n) => n.id === storedId);
    if (!node) {
      clearNotesSelection(); // stale id — item gone since last session tab
      return;
    }
    const token = ++selectTokenRef.current;
    if (node.type === "folder" || contentLoadedIdsRef.current.has(storedId)) {
      if (node.type === "folder") contentLoadedIdsRef.current.add(storedId);
      setSelectedNoteId(storedId);
      return;
    }
    void (async () => {
      const ok = await hydrateContent(storedId);
      if (selectTokenRef.current !== token) return; // superseded by user select
      if (ok) {
        setSelectedNoteId(storedId);
      } else {
        clearNotesSelection(); // hydrate failed — drop the id, don't retry
      }
    })();
  }, [isLoading, notes, hydrateContent]);

  // Tree helpers. `childrenByParent` is built once per `notes` change (O(n)
  // group + sort) so `getChildren` is an O(1) Map lookup instead of an
  // O(n) filter+sort per call. NotesView's flatten previously called
  // getChildren twice per node (children + grandchildren probe) → O(n²);
  // the Map collapses that to O(n). Behaviour is identical: same null-vs
  // -string parent key (root uses the `null` key), same order sort, and
  // it includes is_deleted rows just like the old filter did (the
  // NotesView walk applies its own `!isDeleted` filter, and
  // `flattenedNotes` also sees the full set).
  const childrenByParent = useMemo(() => {
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
  }, [notes]);

  const getChildren = useCallback(
    (parentId: string | null): NoteNode[] => {
      return childrenByParent.get(parentId) ?? [];
    },
    [childrenByParent],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveExpandedIds(next);
      return next;
    });
  }, []);

  // Flatten tree for DnD (only visible nodes)
  const flattenedNotes = useMemo(() => {
    const result: NoteNode[] = [];
    const walk = (parentId: string | null) => {
      const children = notes
        .filter((n) => n.parentId === parentId)
        .sort((a, b) => a.order - b.order);
      for (const child of children) {
        result.push(child);
        if (child.type === "folder" && expandedIds.has(child.id)) {
          walk(child.id);
        }
      }
    };
    walk(null);
    return result;
  }, [notes, expandedIds]);

  const sortedFilteredNotes = useMemo(() => {
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
  }, [notes, searchQuery, sortMode, sortDirection]);

  // Persist tree to DB. Unified has no bulk sync — apply moves
  // sequentially (verbatim port of the retired Bridge `syncNoteTree`).
  const syncToDb = useCallback(
    (updatedNotes: NoteNode[]) => {
      const items = updatedNotes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        order: n.order,
      }));
      (async () => {
        for (const i of items) {
          await ds.moveNoteUnified(i.id, i.parentId, i.order);
        }
      })().catch((e) => logServiceError("Notes", "syncTree", e));
    },
    [ds],
  );

  const persistWithHistory = useCallback(
    (currentNotes: NoteNode[], updated: NoteNode[]) => {
      setNotes(updated);
      syncToDb(updated);
      push("note", {
        label: "moveNote",
        undo: () => {
          setNotes(currentNotes);
          syncToDb(currentNotes);
        },
        redo: () => {
          setNotes(updated);
          syncToDb(updated);
        },
      });
    },
    [push, syncToDb],
  );

  const { moveNode, moveNodeInto, moveToRoot } = useNoteTreeMovement(
    notes,
    persistWithHistory,
  );

  const createNote = useCallback(
    (
      title?: string,
      opts?: {
        skipUndo?: boolean;
        parentId?: string | null;
        initialContent?: string;
        /**
         * Whether to select the new note (default true). The "[[" link-create
         * flow passes false so creating a note to link to does NOT switch the
         * editor away from the note the user is currently writing in.
         */
        select?: boolean;
      },
    ) => {
      const id = generateId("note");
      const now = new Date().toISOString();
      const resolvedParentId = opts?.parentId ?? null;
      const resolvedContent = opts?.initialContent ?? "";
      const newNote: NoteNode = {
        ...buildNoteNode(
          id,
          "note",
          title || "Untitled",
          resolvedParentId,
          now,
        ),
        content: resolvedContent,
      };
      setNotes((prev) => [newNote, ...prev]);
      // M1: the body is known locally; mark loaded so a re-select does NOT
      // re-fetch (which could race the still-in-flight content write and
      // clobber the local body with an empty server row).
      contentLoadedIdsRef.current.add(id);
      // #285 background create (select:false) must not switch the editor —
      // and must not retarget the #282 restore either, so the store write
      // stays inside the same guard.
      if (opts?.select !== false) {
        setSelectedNoteId(id);
        setNotesSelection(id); // #282: restore the just-created note after a tab switch
      }
      ds.createNoteUnified(
        buildNoteNode(id, "note", newNote.title, resolvedParentId, now),
      )
        .then(() => {
          if (resolvedContent) {
            return ds.updateNoteUnified(id, { content: resolvedContent });
          }
        })
        .catch((e) => logServiceError("Notes", "create", e));

      if (!opts?.skipUndo) {
        push("note", {
          label: "createNote",
          undo: () => {
            setNotes((p) => p.filter((n) => n.id !== id));
            if (selectedNoteIdRef.current === id) {
              setSelectedNoteId(null);
              clearNotesSelection(); // #282: don't restore a removed note
            }
            ds.permanentDeleteNoteUnified(id).catch((e) =>
              logServiceError("Notes", "undoCreate", e),
            );
          },
          redo: () => {
            setNotes((p) => [newNote, ...p]);
            contentLoadedIdsRef.current.add(id);
            setSelectedNoteId(id);
            setNotesSelection(id); // #282
            ds.createNoteUnified(
              buildNoteNode(id, "note", newNote.title, resolvedParentId, now),
            )
              .then(() => {
                if (resolvedContent) {
                  return ds.updateNoteUnified(id, { content: resolvedContent });
                }
              })
              .catch((e) => logServiceError("Notes", "redoCreate", e));
          },
        });
      }

      return id;
    },
    [ds, push],
  );

  const createFolder = useCallback(
    (title?: string, parentId?: string | null) => {
      const id = generateId("notefolder");
      const now = new Date().toISOString();
      const resolvedParentId = parentId ?? null;
      const newFolder: NoteNode = buildNoteNode(
        id,
        "folder",
        title || "New Folder",
        resolvedParentId,
        now,
      );
      setNotes((prev) => [newFolder, ...prev]);
      ds.createNoteUnified(
        buildNoteNode(id, "folder", newFolder.title, resolvedParentId, now),
      ).catch((e) => logServiceError("Notes", "createFolder", e));

      push("note", {
        label: "createFolder",
        undo: () => {
          setNotes((p) => p.filter((n) => n.id !== id));
          ds.permanentDeleteNoteUnified(id).catch((e) =>
            logServiceError("Notes", "undoCreateFolder", e),
          );
        },
        redo: () => {
          setNotes((p) => [newFolder, ...p]);
          ds.createNoteUnified(
            buildNoteNode(id, "folder", newFolder.title, resolvedParentId, now),
          ).catch((e) => logServiceError("Notes", "redoCreateFolder", e));
        },
      });

      return id;
    },
    [ds, push],
  );

  const updateNote = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
      >,
    ) => {
      // Don't push undo for content-only updates (TipTap handles its own
      // undo internally).
      const isContentOnly =
        Object.keys(updates).length === 1 && "content" in updates;

      if (!isContentOnly) {
        const prev = notesRef.current.find((n) => n.id === id);
        if (prev) {
          const prevValues: Partial<
            Pick<NoteNode, "title" | "isPinned" | "color" | "icon">
          > = {};
          if ("title" in updates) prevValues.title = prev.title;
          if ("isPinned" in updates) prevValues.isPinned = prev.isPinned;
          if ("color" in updates) prevValues.color = prev.color;
          if ("icon" in updates) prevValues.icon = prev.icon;

          push("note", {
            label: "updateNote",
            undo: () => {
              const now = new Date().toISOString();
              setNotes((p) =>
                p.map((n) =>
                  n.id === id ? { ...n, ...prevValues, updatedAt: now } : n,
                ),
              );
              ds.updateNoteUnified(id, prevValues).catch((e) =>
                logServiceError("Notes", "undoUpdate", e),
              );
            },
            redo: () => {
              const now = new Date().toISOString();
              setNotes((p) =>
                p.map((n) =>
                  n.id === id ? { ...n, ...updates, updatedAt: now } : n,
                ),
              );
              ds.updateNoteUnified(id, updates).catch((e) =>
                logServiceError("Notes", "redoUpdate", e),
              );
            },
          });
        }
      }

      const now = new Date().toISOString();
      // M1: an edited body is authoritative locally — keep it marked loaded
      // so a later reselect/reload doesn't drop back to the light "".
      if ("content" in updates) contentLoadedIdsRef.current.add(id);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: now } : n,
        ),
      );
      ds.updateNoteUnified(id, updates).catch((e) =>
        logServiceError("Notes", "update", e),
      );
    },
    [ds, push],
  );

  const softDeleteNote = useCallback(
    (id: string, opts?: { skipUndo?: boolean }) => {
      // `ds.softDeleteNoteUnified` only flips is_deleted on the single row.
      // For a folder that would orphan every descendant note/folder, so we
      // collect the whole subtree here and soft-delete it as a unit
      // (deepest-first → DataService can stay single-row). For a leaf
      // note `subtree` is just `[target]`, so leaf behaviour is unchanged.
      const all = notesRef.current;
      const target = all.find((n) => n.id === id);
      if (!target) return;

      const childrenOf = new Map<string | null, NoteNode[]>();
      for (const n of all) {
        const list = childrenOf.get(n.parentId);
        if (list) list.push(n);
        else childrenOf.set(n.parentId, [n]);
      }
      const subtree: NoteNode[] = [];
      // `seen` guards against a corrupted parentId cycle (e.g. a bad sync
      // round-trip) causing unbounded recursion — same OOM class as the
      // task-tree (known-issues 016). DnD (moveNodeInto) prevents cycles
      // at write time, but data may still arrive cyclic from the server.
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
      const subtreeIds = new Set(subtree.map((n) => n.id));

      setNotes((prev) => prev.filter((n) => !subtreeIds.has(n.id)));
      if (
        selectedNoteIdRef.current !== null &&
        subtreeIds.has(selectedNoteIdRef.current)
      ) {
        setSelectedNoteId(null);
        clearNotesSelection(); // #282: don't restore a soft-deleted note
      }
      // Surface the removed nodes in Trash immediately (the deepest-first
      // order keeps ancestors above descendants once prepended). restore /
      // permanentDelete already keep deletedNotes locally consistent.
      setDeletedNotes((prev) => {
        const known = new Set(prev.map((n) => n.id));
        const added = subtree
          .filter((n) => !known.has(n.id))
          .map((n) => ({ ...n, isDeleted: true }));
        return [...added, ...prev];
      });
      for (const n of subtree) {
        ds.softDeleteNoteUnified(n.id).catch((e) =>
          logServiceError("Notes", "delete", e),
        );
      }

      if (!opts?.skipUndo) {
        push("note", {
          label: "softDeleteNote",
          undo: () => {
            setNotes((p) => [...subtree, ...p]);
            setDeletedNotes((p) => p.filter((n) => !subtreeIds.has(n.id)));
            for (const n of subtree) {
              ds.restoreNoteUnified(n.id).catch((e) =>
                logServiceError("Notes", "undoDelete", e),
              );
            }
          },
          redo: () => {
            setNotes((p) => p.filter((n) => !subtreeIds.has(n.id)));
            setDeletedNotes((p) => {
              const known = new Set(p.map((n) => n.id));
              const added = subtree
                .filter((n) => !known.has(n.id))
                .map((n) => ({ ...n, isDeleted: true }));
              return [...added, ...p];
            });
            for (const n of subtree) {
              ds.softDeleteNoteUnified(n.id).catch((e) =>
                logServiceError("Notes", "redoDelete", e),
              );
            }
          },
        });
      }
    },
    [ds, push],
  );

  const togglePin = useCallback(
    (id: string) => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      const newPinned = !note.isPinned;
      const prevPinned = note.isPinned;

      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isPinned: newPinned, updatedAt: new Date().toISOString() }
            : n,
        ),
      );

      ds.updateNoteUnified(id, { isPinned: newPinned }).catch((e) =>
        logServiceError("Notes", "pin", e),
      );

      push("note", {
        label: "togglePin",
        undo: () => {
          setNotes((p) =>
            p.map((n) =>
              n.id === id
                ? {
                    ...n,
                    isPinned: prevPinned,
                    updatedAt: new Date().toISOString(),
                  }
                : n,
            ),
          );
          ds.updateNoteUnified(id, { isPinned: prevPinned }).catch((e) =>
            logServiceError("Notes", "undoPin", e),
          );
        },
        redo: () => {
          setNotes((p) =>
            p.map((n) =>
              n.id === id
                ? {
                    ...n,
                    isPinned: newPinned,
                    updatedAt: new Date().toISOString(),
                  }
                : n,
            ),
          );
          ds.updateNoteUnified(id, { isPinned: newPinned }).catch((e) =>
            logServiceError("Notes", "redoPin", e),
          );
        },
      });
    },
    [ds, push],
  );

  const loadDeletedNotes = useCallback(async () => {
    try {
      const deleted = await ds.fetchDeletedNotesUnified();
      setDeletedNotes(deleted);
    } catch (e) {
      logServiceError("Notes", "fetchDeleted", e);
    }
  }, [ds]);

  // PR1 known constraint: restore is single-node only. softDeleteNote
  // cascades a folder's whole subtree into Trash, but restoring that
  // folder here brings back only the folder row — descendants stay in
  // Trash until restored individually (mirrors the legacy single-id
  // restoreNote). Subtree restore is tracked as Backlog ⑧ in
  // .claude/docs/vision/plans/2026-05-17-notes-web-parity.md.
  const restoreNote = useCallback(
    (id: string) => {
      const note = deletedNotes.find((n) => n.id === id);
      if (note) {
        setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
        setNotes((prev) => [
          { ...note, isDeleted: false, deletedAt: undefined },
          ...prev,
        ]);
      }
      ds.restoreNoteUnified(id).catch((e) =>
        logServiceError("Notes", "restore", e),
      );
    },
    [ds, deletedNotes],
  );

  const permanentDeleteNote = useCallback(
    (id: string) => {
      setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
      ds.permanentDeleteNoteUnified(id).catch((e) =>
        logServiceError("Notes", "permanentDelete", e),
      );
    },
    [ds],
  );

  const setNotePassword = useCallback(
    async (id: string, password: string) => {
      const updated = await ds.setNotePasswordUnified(id, password);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: true } : n)),
      );
      return updated;
    },
    [ds],
  );

  const removeNotePassword = useCallback(
    async (id: string, currentPassword: string) => {
      const updated = await ds.removeNotePasswordUnified(id, currentPassword);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: false } : n)),
      );
      return updated;
    },
    [ds],
  );

  const verifyNotePassword = useCallback(
    (id: string, password: string): Promise<boolean> => {
      return ds.verifyNotePasswordUnified(id, password);
    },
    [ds],
  );

  const toggleEditLock = useCallback(
    async (id: string) => {
      const updated = await ds.toggleNoteEditLockUnified(id);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isEditLocked: updated.isEditLocked } : n,
        ),
      );
      return updated;
    },
    [ds],
  );

  const selectedNote = useMemo(() => {
    return notes.find((n) => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  return useMemo(
    () => ({
      notes,
      isLoading,
      error,
      deletedNotes,
      selectedNoteId,
      // M1: expose the hydrate-then-select wrapper under the same name so
      // consumers (e.g. web NotesView `onSelect`) load the body before the
      // editor mounts — the light list carries no body.
      setSelectedNoteId: selectNote,
      selectedNote,
      searchQuery,
      setSearchQuery,
      sortMode,
      setSortMode,
      sortDirection,
      setSortDirection,
      sortedFilteredNotes,
      flattenedNotes,
      expandedIds,
      toggleExpanded,
      getChildren,
      createNote,
      createFolder,
      updateNote,
      softDeleteNote,
      togglePin,
      loadDeletedNotes,
      restoreNote,
      permanentDeleteNote,
      persistWithHistory,
      moveNode,
      moveNodeInto,
      moveToRoot,
      setNotePassword,
      removeNotePassword,
      verifyNotePassword,
      toggleEditLock,
    }),
    [
      notes,
      isLoading,
      error,
      deletedNotes,
      selectedNoteId,
      selectNote,
      selectedNote,
      searchQuery,
      sortMode,
      setSortMode,
      sortDirection,
      setSortDirection,
      sortedFilteredNotes,
      flattenedNotes,
      expandedIds,
      toggleExpanded,
      getChildren,
      createNote,
      createFolder,
      updateNote,
      softDeleteNote,
      togglePin,
      loadDeletedNotes,
      restoreNote,
      permanentDeleteNote,
      persistWithHistory,
      moveNode,
      moveNodeInto,
      moveToRoot,
      setNotePassword,
      removeNotePassword,
      verifyNotePassword,
      toggleEditLock,
    ],
  );
}
