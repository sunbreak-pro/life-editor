import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { NoteNode } from "../types/note";
import type { DataService } from "../services/DataService";

/**
 * Password gate + edit lock surface of useNotesUnifiedAPI (#587 split).
 * Service-first (no optimistic write): the row flag flips only after the
 * service call resolved, exactly as before the split.
 */

export interface UseNotesUnifiedLockParams {
  ds: DataService;
  setNotes: Dispatch<SetStateAction<NoteNode[]>>;
}

export function useNotesUnifiedLock(params: UseNotesUnifiedLockParams) {
  const { ds, setNotes } = params;

  const setNotePassword = useCallback(
    async (id: string, password: string) => {
      const updated = await ds.setNotePasswordUnified(id, password);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: true } : n)),
      );
      return updated;
    },
    [ds, setNotes],
  );

  const removeNotePassword = useCallback(
    async (id: string, currentPassword: string) => {
      const updated = await ds.removeNotePasswordUnified(id, currentPassword);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: false } : n)),
      );
      return updated;
    },
    [ds, setNotes],
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
    [ds, setNotes],
  );

  return {
    setNotePassword,
    removeNotePassword,
    verifyNotePassword,
    toggleEditLock,
  };
}
