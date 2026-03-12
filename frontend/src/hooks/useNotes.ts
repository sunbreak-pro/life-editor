import { useState, useCallback, useEffect, useMemo } from "react";
import type { NoteNode, NoteSortMode } from "../types/note";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useNotes() {
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<NoteNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<NoteSortMode>("updatedAt");
  const { push } = useUndoRedo();

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

    // Sort: pinned first, then by sort mode
    return [...result].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      switch (sortMode) {
        case "updatedAt":
          return b.updatedAt.localeCompare(a.updatedAt);
        case "createdAt":
          return b.createdAt.localeCompare(a.createdAt);
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [notes, searchQuery, sortMode]);

  const createNote = useCallback(
    (title?: string) => {
      const id = generateId("note");
      const now = new Date().toISOString();
      const newNote: NoteNode = {
        id,
        title: title || "Untitled",
        content: "",
        isPinned: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [newNote, ...prev]);
      setSelectedNoteId(id);
      getDataService()
        .createNote(id, newNote.title)
        .catch((e) => logServiceError("Notes", "create", e));

      push("note", {
        label: "createNote",
        undo: () => {
          setNotes((p) => p.filter((n) => n.id !== id));
          if (selectedNoteId === id) setSelectedNoteId(null);
          getDataService()
            .permanentDeleteNote(id)
            .catch((e) => logServiceError("Notes", "undoCreate", e));
        },
        redo: () => {
          setNotes((p) => [newNote, ...p]);
          setSelectedNoteId(id);
          getDataService()
            .createNote(id, newNote.title)
            .catch((e) => logServiceError("Notes", "redoCreate", e));
        },
      });

      return id;
    },
    [push, selectedNoteId],
  );

  const updateNote = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<NoteNode, "title" | "content" | "isPinned" | "color">
      >,
    ) => {
      // Don't push undo for content-only updates (TipTap handles its own undo)
      const isContentOnly =
        Object.keys(updates).length === 1 && "content" in updates;

      if (!isContentOnly) {
        // Capture previous values for undo
        const prev = notes.find((n) => n.id === id);
        if (prev) {
          const prevValues: Partial<
            Pick<NoteNode, "title" | "isPinned" | "color">
          > = {};
          if ("title" in updates) prevValues.title = prev.title;
          if ("isPinned" in updates) prevValues.isPinned = prev.isPinned;
          if ("color" in updates) prevValues.color = prev.color;

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
    [notes, push],
  );

  const softDeleteNote = useCallback(
    (id: string) => {
      const target = notes.find((n) => n.id === id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
      getDataService()
        .softDeleteNote(id)
        .catch((e) => logServiceError("Notes", "delete", e));

      if (target) {
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
    [selectedNoteId, notes, push],
  );

  const togglePin = useCallback(
    (id: string) => {
      setNotes((prev) => {
        const note = prev.find((n) => n.id === id);
        if (!note) return prev;
        const newPinned = !note.isPinned;
        const prevPinned = note.isPinned;
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

        return prev.map((n) =>
          n.id === id
            ? { ...n, isPinned: newPinned, updatedAt: new Date().toISOString() }
            : n,
        );
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
      sortedFilteredNotes,
      createNote,
      updateNote,
      softDeleteNote,
      togglePin,
      loadDeletedNotes,
      restoreNote,
      permanentDeleteNote,
    }),
    [
      notes,
      deletedNotes,
      selectedNoteId,
      selectedNote,
      searchQuery,
      sortMode,
      sortedFilteredNotes,
      createNote,
      updateNote,
      softDeleteNote,
      togglePin,
      loadDeletedNotes,
      restoreNote,
      permanentDeleteNote,
    ],
  );
}
