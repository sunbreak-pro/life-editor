import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { NoteNode, NoteSortMode } from "../types/note";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "../components/shared/UndoRedo";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_KEYS } from "../constants/storageKeys";
import type { SortDirection } from "../components/shared/SortDropdown";

function loadExpandedIds(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTE_TREE_EXPANDED);
    if (saved) return new Set(JSON.parse(saved));
  } catch {
    // ignore
  }
  return new Set();
}

function saveExpandedIds(ids: Set<string>): void {
  localStorage.setItem(
    STORAGE_KEYS.NOTE_TREE_EXPANDED,
    JSON.stringify([...ids]),
  );
}

export function useNotes() {
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<NoteNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<NoteSortMode>("updatedAt");
  const [sortDirection, setSortDirection] = useLocalStorage<SortDirection>(
    STORAGE_KEYS.NOTE_SORT_DIRECTION,
    "asc",
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(loadExpandedIds);
  const { push } = useUndoRedo();
  const notesRef = useRef(notes);
  const selectedNoteIdRef = useRef(selectedNoteId);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getDataService().fetchAllNotes();
        if (!cancelled) setNotes(loaded);
      } catch (e) {
        logServiceError("Notes", "fetch", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const syncToDb = useCallback((updatedNotes: NoteNode[]) => {
    const items = updatedNotes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      order: n.order,
    }));
    getDataService()
      .syncNoteTree(items)
      .catch((e) => logServiceError("Notes", "syncTree", e));
  }, []);

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

  const createNote = useCallback(
    (
      title?: string,
      options?: {
        skipUndo?: boolean;
        parentId?: string | null;
        initialContent?: string;
      },
    ) => {
      const id = generateId("note");
      const now = new Date().toISOString();
      const resolvedParentId = options?.parentId ?? null;
      const resolvedContent = options?.initialContent ?? "";
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
      getDataService()
        .createNote(id, newNote.title, resolvedParentId)
        .then(() => {
          if (resolvedContent) {
            return getDataService().updateNote(id, {
              content: resolvedContent,
            });
          }
        })
        .catch((e) => logServiceError("Notes", "create", e));

      if (!options?.skipUndo) {
        push("note", {
          label: "createNote",
          undo: () => {
            setNotes((p) => p.filter((n) => n.id !== id));
            if (selectedNoteIdRef.current === id) setSelectedNoteId(null);
            getDataService()
              .permanentDeleteNote(id)
              .catch((e) => logServiceError("Notes", "undoCreate", e));
          },
          redo: () => {
            setNotes((p) => [newNote, ...p]);
            setSelectedNoteId(id);
            getDataService()
              .createNote(id, newNote.title, resolvedParentId)
              .then(() => {
                if (resolvedContent) {
                  return getDataService().updateNote(id, {
                    content: resolvedContent,
                  });
                }
              })
              .catch((e) => logServiceError("Notes", "redoCreate", e));
          },
        });
      }

      return id;
    },
    [push],
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
      getDataService()
        .createNoteFolder(id, newFolder.title, resolvedParentId)
        .catch((e) => logServiceError("Notes", "createFolder", e));

      push("note", {
        label: "createFolder",
        undo: () => {
          setNotes((p) => p.filter((n) => n.id !== id));
          getDataService()
            .permanentDeleteNote(id)
            .catch((e) => logServiceError("Notes", "undoCreateFolder", e));
        },
        redo: () => {
          setNotes((p) => [newFolder, ...p]);
          getDataService()
            .createNoteFolder(id, newFolder.title, resolvedParentId)
            .catch((e) => logServiceError("Notes", "redoCreateFolder", e));
        },
      });

      return id;
    },
    [push],
  );

  const updateNote = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
      >,
    ) => {
      // Don't push undo for content-only updates (TipTap handles its own undo)
      const isContentOnly =
        Object.keys(updates).length === 1 && "content" in updates;

      if (!isContentOnly) {
        // Capture previous values for undo
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
              getDataService()
                .updateNote(id, prevValues)
                .catch((e) => logServiceError("Notes", "undoUpdate", e));
            },
            redo: () => {
              const now = new Date().toISOString();
              setNotes((p) =>
                p.map((n) =>
                  n.id === id ? { ...n, ...updates, updatedAt: now } : n,
                ),
              );
              getDataService()
                .updateNote(id, updates)
                .catch((e) => logServiceError("Notes", "redoUpdate", e));
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
      getDataService()
        .updateNote(id, updates)
        .catch((e) => logServiceError("Notes", "update", e));
    },
    [push],
  );

  const softDeleteNote = useCallback(
    (id: string, options?: { skipUndo?: boolean }) => {
      const target = notesRef.current.find((n) => n.id === id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteIdRef.current === id) setSelectedNoteId(null);
      getDataService()
        .softDeleteNote(id)
        .catch((e) => logServiceError("Notes", "delete", e));

      if (target && !options?.skipUndo) {
        push("note", {
          label: "softDeleteNote",
          undo: () => {
            setNotes((p) => [target, ...p]);
            getDataService()
              .restoreNote(id)
              .catch((e) => logServiceError("Notes", "undoDelete", e));
          },
          redo: () => {
            setNotes((p) => p.filter((n) => n.id !== id));
            getDataService()
              .softDeleteNote(id)
              .catch((e) => logServiceError("Notes", "redoDelete", e));
          },
        });
      }
    },
    [push],
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

      getDataService()
        .updateNote(id, { isPinned: newPinned })
        .catch((e) => logServiceError("Notes", "pin", e));

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
          getDataService()
            .updateNote(id, { isPinned: prevPinned })
            .catch((e) => logServiceError("Notes", "undoPin", e));
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
          getDataService()
            .updateNote(id, { isPinned: newPinned })
            .catch((e) => logServiceError("Notes", "redoPin", e));
        },
      });
    },
    [push],
  );

  const loadDeletedNotes = useCallback(async () => {
    try {
      const deleted = await getDataService().fetchDeletedNotes();
      setDeletedNotes(deleted);
    } catch (e) {
      logServiceError("Notes", "fetchDeleted", e);
    }
  }, []);

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
      getDataService()
        .restoreNote(id)
        .catch((e) => logServiceError("Notes", "restore", e));
    },
    [deletedNotes],
  );

  const permanentDeleteNote = useCallback((id: string) => {
    setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
    getDataService()
      .permanentDeleteNote(id)
      .catch((e) => logServiceError("Notes", "permanentDelete", e));
  }, []);

  const setNotePassword = useCallback(async (id: string, password: string) => {
    const updated = await getDataService().setNotePassword(id, password);
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, hasPassword: true } : n)),
    );
    return updated;
  }, []);

  const removeNotePassword = useCallback(
    async (id: string, currentPassword: string) => {
      const updated = await getDataService().removeNotePassword(
        id,
        currentPassword,
      );
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: false } : n)),
      );
      return updated;
    },
    [],
  );

  const verifyNotePassword = useCallback(
    (id: string, password: string): Promise<boolean> => {
      return getDataService().verifyNotePassword(id, password);
    },
    [],
  );

  const toggleEditLock = useCallback(async (id: string) => {
    const updated = await getDataService().toggleNoteEditLock(id);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, isEditLocked: updated.isEditLocked } : n,
      ),
    );
    return updated;
  }, []);

  const selectedNote = useMemo(() => {
    return notes.find((n) => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  return useMemo(
    () => ({
      notes,
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
      setNotePassword,
      removeNotePassword,
      verifyNotePassword,
      toggleEditLock,
    }),
    [
      notes,
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
      setNotePassword,
      removeNotePassword,
      verifyNotePassword,
      toggleEditLock,
    ],
  );
}
