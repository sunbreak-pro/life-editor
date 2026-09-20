import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { NoteNode } from "../types/note";
import type { DataService } from "../services/DataService";

/**
 * Password gate + edit lock surface of useNotesUnifiedAPI (#587 split).
 * Service-first (no optimistic write): the row flag flips only after the
 * service call resolved, exactly as before the split.
 *
 * #1763 made the three password methods move the BODY too. A locked note is
 * read without its `content_json` now (D-20260920-main-1 = A), so the gate is
 * also the thing that decides when the body is in `notes` at all — see the
 * ledger callbacks below.
 */

export interface UseNotesUnifiedLockParams {
  ds: DataService;
  setNotes: Dispatch<SetStateAction<NoteNode[]>>;
  /** Fetch the body after a correct password (#1763 — useNoteHydrationLedger). */
  unlockNoteBody: (id: string) => Promise<boolean>;
  /** Drop the body we may no longer show (#1763 — same ledger). */
  relockNote: (id: string) => void;
}

export function useNotesUnifiedLock(params: UseNotesUnifiedLockParams) {
  const { ds, setNotes, unlockNoteBody, relockNote } = params;

  const setNotePassword = useCallback(
    async (id: string, password: string) => {
      const updated = await ds.setNotePasswordUnified(id, password);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: true } : n)),
      );
      // #1763: the gate goes up on a note whose body we are still holding
      // from before it had one. Drop it here rather than waiting for a reload.
      relockNote(id);
      return updated;
    },
    [ds, setNotes, relockNote],
  );

  const removeNotePassword = useCallback(
    async (id: string, currentPassword: string) => {
      const updated = await ds.removeNotePasswordUnified(id, currentPassword);
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, hasPassword: false } : n)),
      );
      // The password was correct, and the note now has none — the body may be
      // read, and the caller is about to show an editor over it (#1763).
      await unlockNoteBody(id);
      return updated;
    },
    [ds, setNotes, unlockNoteBody],
  );

  /*
   * Verify, then FETCH THE BODY (#1763). Reporting success before the body is
   * in `notes` would let the host drop the gate over an editor initialised
   * from the light `""` — and the first keystroke saves that (#471).
   *
   * A body that fails to arrive is reported as a failed verify, which the
   * dialog renders as "wrong password". Misleading wording for a rare network
   * failure, and the safe direction: the gate stays up and nothing is lost.
   */
  const verifyNotePassword = useCallback(
    async (id: string, password: string): Promise<boolean> => {
      const ok = await ds.verifyNotePasswordUnified(id, password);
      if (!ok) return false;
      return unlockNoteBody(id);
    },
    [ds, unlockNoteBody],
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
