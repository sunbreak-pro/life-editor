import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { NoteNode, NoteSortMode } from "../types/note";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTaskTreeHistory";
import { useSyncContext } from "./useSyncContext";
import { useNoteTreeMovement } from "./useNoteTreeMovement";

/**
 * Behaviour-preserving port of frontend/src/hooks/useNotes.ts. Host
 * dependencies are injected, not imported (CLAUDE.md §6.4):
 * - `getDataService()` singleton  → `options.dataService`
 * - host UndoRedo Context         → `options.undoRedo` (no-op default;
 *   real UndoRedo lands in S6, same as tasks/daily)
 * - `useLocalStorage` / `STORAGE_KEYS` / `SortDropdown` host modules →
 *   inlined localStorage helpers + a local `SortDirection` type. The
 *   Tauri `useNotes` already reads raw `localStorage` for the expanded
 *   set; we keep that browser-native approach for `sortDirection` too so
 *   the shared hook stays host-agnostic.
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`) — CLAUDE.md
 * §6.2 places Note after Sync (and, by convention, after Daily).
 */

export type NoteSortDirection = "asc" | "desc";

const LS_EXPANDED = "note-tree-expanded";
const LS_SORT_DIRECTION = "note-sort-direction";

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

export interface UseNotesAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
}

export function useNotesAPI(options: UseNotesAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const { syncVersion } = useSyncContext();

  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletedNotes, setDeletedNotes] = useState<NoteNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<NoteSortMode>("updatedAt");
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

  const setSortDirection = useCallback((dir: NoteSortDirection) => {
    setSortDirectionState(dir);
    try {
      localStorage.setItem(LS_SORT_DIRECTION, dir);
    } catch {
      // ignore storage write failures
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await ds.fetchAllNotes();
        if (!cancelled) setNotes(loaded);
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
        const deleted = await ds.fetchDeletedNotes();
        if (!cancelled) setDeletedNotes(deleted);
      } catch (e) {
        logServiceError("Notes", "fetchDeleted", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // Tree helpers
  const getChildren = useCallback(
    (parentId: string | null): NoteNode[] => {
      return notes
        .filter((n) => n.parentId === parentId)
        .sort((a, b) => a.order - b.order);
    },
    [notes],
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

    // Search filter (client-side)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }

    // Sort: pinned first, then by sort mode within each group
    const dir = sortDirection === "desc" ? -1 : 1;
    const compare = (a: NoteNode, b: NoteNode): number => {
      switch (sortMode) {
        case "updatedAt":
          return b.updatedAt.localeCompare(a.updatedAt) * dir;
        case "createdAt":
          return b.createdAt.localeCompare(a.createdAt) * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir;
        default:
          return 0;
      }
    };
    const pinned = result.filter((n) => n.isPinned).sort(compare);
    const unpinned = result.filter((n) => !n.isPinned).sort(compare);
    return [...pinned, ...unpinned];
  }, [notes, searchQuery, sortMode, sortDirection]);

  // Persist tree to DB
  const syncToDb = useCallback(
    (updatedNotes: NoteNode[]) => {
      const items = updatedNotes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        order: n.order,
      }));
      ds.syncNoteTree(items).catch((e) =>
        logServiceError("Notes", "syncTree", e),
      );
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
      },
    ) => {
      const id = generateId("note");
      const now = new Date().toISOString();
      const resolvedParentId = opts?.parentId ?? null;
      const resolvedContent = opts?.initialContent ?? "";
      const newNote: NoteNode = {
        id,
        type: "note",
        title: title || "Untitled",
        content: resolvedContent,
        parentId: resolvedParentId,
        order: 0,
        isPinned: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [newNote, ...prev]);
      setSelectedNoteId(id);
      ds.createNote(id, newNote.title, resolvedParentId)
        .then(() => {
          if (resolvedContent) {
            return ds.updateNote(id, { content: resolvedContent });
          }
        })
        .catch((e) => logServiceError("Notes", "create", e));

      if (!opts?.skipUndo) {
        push("note", {
          label: "createNote",
          undo: () => {
            setNotes((p) => p.filter((n) => n.id !== id));
            if (selectedNoteIdRef.current === id) setSelectedNoteId(null);
            ds.permanentDeleteNote(id).catch((e) =>
              logServiceError("Notes", "undoCreate", e),
            );
          },
          redo: () => {
            setNotes((p) => [newNote, ...p]);
            setSelectedNoteId(id);
            ds.createNote(id, newNote.title, resolvedParentId)
              .then(() => {
                if (resolvedContent) {
                  return ds.updateNote(id, { content: resolvedContent });
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
      const newFolder: NoteNode = {
        id,
        type: "folder",
        title: title || "New Folder",
        content: "",
        parentId: resolvedParentId,
        order: 0,
        isPinned: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [newFolder, ...prev]);
      ds.createNoteFolder(id, newFolder.title, resolvedParentId).catch((e) =>
        logServiceError("Notes", "createFolder", e),
      );

      push("note", {
        label: "createFolder",
        undo: () => {
          setNotes((p) => p.filter((n) => n.id !== id));
          ds.permanentDeleteNote(id).catch((e) =>
            logServiceError("Notes", "undoCreateFolder", e),
          );
        },
        redo: () => {
          setNotes((p) => [newFolder, ...p]);
          ds.createNoteFolder(id, newFolder.title, resolvedParentId).catch(
            (e) => logServiceError("Notes", "redoCreateFolder", e),
          );
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
              ds.updateNote(id, prevValues).catch((e) =>
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
              ds.updateNote(id, updates).catch((e) =>
                logServiceError("Notes", "redoUpdate", e),
              );
            },
          });
        }
      }

      const now = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: now } : n,
        ),
      );
      ds.updateNote(id, updates).catch((e) =>
        logServiceError("Notes", "update", e),
      );
    },
    [ds, push],
  );

  const softDeleteNote = useCallback(
    (id: string, opts?: { skipUndo?: boolean }) => {
      // `ds.softDeleteNote` only flips is_deleted on the single row (true
      // for both the Supabase and the legacy Tauri repo — verified). For
      // a folder that would orphan every descendant note/folder, so we
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
        ds.softDeleteNote(n.id).catch((e) =>
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
              ds.restoreNote(n.id).catch((e) =>
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
              ds.softDeleteNote(n.id).catch((e) =>
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

      ds.updateNote(id, { isPinned: newPinned }).catch((e) =>
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
          ds.updateNote(id, { isPinned: prevPinned }).catch((e) =>
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
          ds.updateNote(id, { isPinned: newPinned }).catch((e) =>
            logServiceError("Notes", "redoPin", e),
          );
        },
      });
    },
    [ds, push],
  );

  const loadDeletedNotes = useCallback(async () => {
    try {
      const deleted = await ds.fetchDeletedNotes();
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
      ds.restoreNote(id).catch((e) => logServiceError("Notes", "restore", e));
    },
    [ds, deletedNotes],
  );

  const permanentDeleteNote = useCallback(
    (id: string) => {
      setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
      ds.permanentDeleteNote(id).catch((e) =>
        logServiceError("Notes", "permanentDelete", e),
      );
    },
    [ds],
  );

  const setNotePassword = useCallback(
    async (id: string, password: string) => {
      const updated = await ds.setNotePassword(id, password);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: true } : n)),
      );
      return updated;
    },
    [ds],
  );

  const removeNotePassword = useCallback(
    async (id: string, currentPassword: string) => {
      const updated = await ds.removeNotePassword(id, currentPassword);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: false } : n)),
      );
      return updated;
    },
    [ds],
  );

  const verifyNotePassword = useCallback(
    (id: string, password: string): Promise<boolean> => {
      return ds.verifyNotePassword(id, password);
    },
    [ds],
  );

  const toggleEditLock = useCallback(
    async (id: string) => {
      const updated = await ds.toggleNoteEditLock(id);
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
      setSelectedNoteId,
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
      selectedNote,
      searchQuery,
      sortMode,
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
