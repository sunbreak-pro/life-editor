import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { NoteNode } from "../types/note";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import {
  reportNoteWriteError,
  type NoteWriteErrorHandler,
} from "./notesWriteError";
import { forgetNoteBody } from "../state/noteBodyStore";

/** Trash surface of useNotesUnifiedAPI (#587 split): load / restore / purge. */

export interface UseNotesUnifiedTrashParams {
  ds: DataService;
  deletedNotes: NoteNode[];
  setDeletedNotes: Dispatch<SetStateAction<NoteNode[]>>;
  setNotes: Dispatch<SetStateAction<NoteNode[]>>;
  /** #1761 — see useNotesUnifiedCRUD: a refused write has to reach the user. */
  onWriteError?: NoteWriteErrorHandler;
}

export function useNotesUnifiedTrash(params: UseNotesUnifiedTrashParams) {
  const { ds, deletedNotes, setDeletedNotes, setNotes, onWriteError } = params;

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
        reportNoteWriteError("restore", e, onWriteError),
      );
    },
    [ds, deletedNotes, setDeletedNotes, setNotes, onWriteError],
  );

  const permanentDeleteNote = useCallback(
    (id: string) => {
      setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
      // #1407: the cross-mount body cache is keyed by id and validated against
      // a later list row's `updatedAt`. A purged note never appears in another
      // list read, so nothing would ever invalidate its entry — it would just
      // sit there holding the text of a note the user asked to destroy until
      // the LRU happened to evict it. Soft delete is deliberately NOT this: a
      // restore from Trash brings the row back unchanged, and the entry is
      // then a legitimate hit again.
      forgetNoteBody(id);
      ds.permanentDeleteNoteUnified(id).catch((e) =>
        reportNoteWriteError("permanentDelete", e, onWriteError),
      );
    },
    [ds, setDeletedNotes, onWriteError],
  );

  return { loadDeletedNotes, restoreNote, permanentDeleteNote };
}
