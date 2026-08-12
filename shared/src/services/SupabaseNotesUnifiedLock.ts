import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteNode } from "../types/note";
import { ItemLockGate } from "./itemLockGate";

/*
 * Password gate + edit lock side of SupabaseNotesUnifiedService (#587 split /
 * DU-G PR1, hardened for Issue #118). Not a dispatch target — the facade
 * delegates here. `getNote` is injected (every mutation round-trips through
 * getNoteUnified, which lives on the reads side).
 *
 * #674 / C7: the six methods were a line-for-line clone of the Dailies copy,
 * so the body now lives in the shared `ItemLockGate` and this class is the
 * Notes binding of it (role, payload table, error labels, re-read). The
 * rationale for the PBKDF2 storage format, the legacy-plaintext acceptance
 * and the DB-Q2 exception on the lazy rehash all moved to itemLockGate.ts
 * with them.
 */
export class SupabaseNotesUnifiedLock {
  private readonly gate: ItemLockGate<NoteNode>;

  constructor(
    client: SupabaseClient,
    getNote: (id: string) => Promise<NoteNode | null>,
  ) {
    this.gate = new ItemLockGate<NoteNode>({
      client,
      role: "note",
      payloadTable: "notes_payload",
      // Notes re-reads through getNoteUnified (the reads side owns the
      // items_meta + notes_payload stitch), so the gate only has to turn a
      // missing row into the error the callers already expect.
      readBack: async (id, label) => {
        const updated = await getNote(id);
        if (!updated)
          throw new Error(`${label}: row vanished after update (id="${id}")`);
        return updated;
      },
      labels: {
        setPassword: "setNotePasswordUnified",
        removePassword: "removeNotePasswordUnified",
        verifyPassword: "verifyNotePasswordUnified",
        lazyRehash: "lazyRehashNotePassword",
        toggleEditLock: "toggleNoteEditLockUnified",
      },
    });
  }

  /** Hash `password` (PBKDF2, Issue #118) and write it into notes_payload. */
  setNotePasswordUnified(id: string, password: string): Promise<NoteNode> {
    return this.gate.setPassword(id, password);
  }

  /** Verify-then-clear: a wrong currentPassword must NOT mutate the row. */
  removeNotePasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<NoteNode> {
    return this.gate.removePassword(id, currentPassword);
  }

  /** Verify `password` against the stored PBKDF2 hash (Issue #118). */
  verifyNotePasswordUnified(id: string, password: string): Promise<boolean> {
    return this.gate.verifyPassword(id, password);
  }

  /** Flip notes_payload.is_edit_locked (read-modify-write). */
  toggleNoteEditLockUnified(id: string): Promise<NoteNode> {
    return this.gate.toggleEditLock(id);
  }
}
