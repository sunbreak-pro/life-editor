import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { NoteNode } from "../types/note";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";

/** Trash surface of useNotesUnifiedAPI (#587 split): load / restore / purge. */

export interface UseNotesUnifiedTrashParams {
  ds: DataService;
  deletedNotes: NoteNode[];
  setDeletedNotes: Dispatch<SetStateAction<NoteNode[]>>;
  setNotes: Dispatch<SetStateAction<NoteNode[]>>;
}

export function useNotesUnifiedTrash(params: UseNotesUnifiedTrashParams) {
  const { ds, deletedNotes, setDeletedNotes, setNotes } = params;

  const loadDeletedNotes = useCallback(async () => {
    try {
      const deleted = await ds.fetchDeletedNotesUnified();
      setDeletedNotes(deleted);
    } catch (e) {
      logServiceError("Notes", "fetchDeleted", e);
    }
  }, [ds, setDeletedNotes]);

  // PR1 known constraint: restore is single-node only. softDeleteNote
  // cascades a note's whole subtree into Trash, but restoring that note
  // here brings back only its own row — descendants stay in Trash until
  // restored individually (mirrors the legacy single-id
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
    [ds, deletedNotes, setDeletedNotes, setNotes],
  );

  const permanentDeleteNote = useCallback(
    (id: string) => {
      setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
      ds.permanentDeleteNoteUnified(id).catch((e) =>
        logServiceError("Notes", "permanentDelete", e),
      );
    },
    [ds, setDeletedNotes],
  );

  return { loadDeletedNotes, restoreNote, permanentDeleteNote };
}
