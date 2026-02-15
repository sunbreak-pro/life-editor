import { useState, useCallback, useEffect, useMemo } from "react";
import type { NoteNode, NoteSortMode } from "../types/note";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";

export function useNotes() {
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<NoteNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<NoteSortMode>("updatedAt");

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

  const createNote = useCallback((title?: string) => {
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
    return id;
  }, []);

  const updateNote = useCallback(
    (
      id: string,
      updates: Partial<Pick<NoteNode, "title" | "content" | "isPinned">>,
    ) => {
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
    [],
  );

  const softDeleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
      getDataService()
        .softDeleteNote(id)
        .catch((e) => logServiceError("Notes", "delete", e));
    },
    [selectedNoteId],
  );

  const togglePin = useCallback((id: string) => {
    setNotes((prev) => {
      const note = prev.find((n) => n.id === id);
      if (!note) return prev;
      const newPinned = !note.isPinned;
      getDataService()
        .updateNote(id, { isPinned: newPinned })
        .catch((e) => logServiceError("Notes", "pin", e));
      return prev.map((n) =>
        n.id === id
          ? { ...n, isPinned: newPinned, updatedAt: new Date().toISOString() }
          : n,
      );
    });
  }, []);

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
