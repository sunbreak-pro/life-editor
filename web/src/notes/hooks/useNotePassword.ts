import { useCallback, useState } from "react";
import type { NotePasswordMode } from "../NotePasswordDialog";

/*
 * The note password gate (extracted from NotesView.tsx — #588 split, zero
 * behavior change). Owns which dialog is open and which notes have been
 * unlocked THIS SESSION, so both surfaces ask the same object whether a body
 * is covered.
 *
 * `unlocked` is deliberately in-memory: a verified password should not outlive
 * the tab, and it is keyed by note id because the lock is per-note.
 */

export interface UseNotePasswordParams {
  setNotePassword: (noteId: string, password: string) => Promise<unknown>;
  removeNotePassword: (noteId: string, password: string) => Promise<unknown>;
  verifyNotePassword: (noteId: string, password: string) => Promise<boolean>;
}

export interface NotePasswordGate {
  /** The open dialog (set / remove / verify), or null. */
  dialog: { mode: NotePasswordMode; noteId: string } | null;
  closeDialog: () => void;
  /** Ask for the password that uncovers this note's body. */
  requestUnlock: (noteId: string) => void;
  /**
   * Run the open dialog's action. Throws "wrong-password" on a failed verify —
   * the dialog renders that as its error and stays open.
   */
  submit: (password: string) => Promise<void>;
  /** Is this note's body covered right now? */
  isGated: (note: { id: string; hasPassword?: boolean } | null) => boolean;
}

export function useNotePassword({
  setNotePassword,
  removeNotePassword,
  verifyNotePassword,
}: UseNotePasswordParams): NotePasswordGate {
  const [dialog, setDialog] = useState<{
    mode: NotePasswordMode;
    noteId: string;
  } | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  const submit = useCallback(
    async (password: string) => {
      if (!dialog) return;
      const { mode, noteId } = dialog;
      if (mode === "set") {
        await setNotePassword(noteId, password);
      } else if (mode === "remove") {
        await removeNotePassword(noteId, password);
      } else {
        const ok = await verifyNotePassword(noteId, password);
        if (!ok) throw new Error("wrong-password");
        setUnlocked((prev) => {
          const next = new Set(prev);
          next.add(noteId);
          return next;
        });
      }
    },
    [dialog, setNotePassword, removeNotePassword, verifyNotePassword],
  );

  return {
    dialog,
    closeDialog: () => setDialog(null),
    requestUnlock: (noteId: string) => setDialog({ mode: "verify", noteId }),
    submit,
    isGated: (note) => !!note?.hasPassword && !unlocked.has(note?.id ?? ""),
  };
}
