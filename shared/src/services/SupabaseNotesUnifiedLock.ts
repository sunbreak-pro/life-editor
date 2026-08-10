import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteNode } from "../types/note";
import { hashPassword, verifyPassword } from "../utils/passwordHash";

/*
 * Password gate + edit lock side of SupabaseNotesUnifiedService (#587 split /
 * DU-G PR1, hardened for Issue #118). Not a dispatch target — the facade
 * delegates here. `getNote` is injected (every mutation round-trips through
 * getNoteUnified, which lives on the reads side).
 *
 * password_hash stores a PBKDF2-HMAC-SHA256 derivation (`pbkdf2$v1$...`, see
 * utils/passwordHash.ts), NOT plaintext. Legacy plaintext rows (pre-#118) are
 * still accepted by verify and lazily rehashed into PBKDF2 form on the next
 * successful unlock. RLS still scopes every read to auth.uid()'s rows, and
 * the DAILIES/NOTES payload SELECT list keeps password_hash off the public
 * read path — defence in depth on top of the hash. `has_password` is the
 * generated stored column projected back to the client (true for a hash
 * string just as for plaintext).
 */
export class SupabaseNotesUnifiedLock {
  constructor(
    private readonly client: SupabaseClient,
    private readonly getNote: (id: string) => Promise<NoteNode | null>,
  ) {}

  /**
   * Hash `password` (PBKDF2, Issue #118) and write it into notes_payload.
   * NoteNode round-trip done via getNoteUnified so the GENERATED
   * `has_password` column reflects on the returned domain object. Bump
   * items_meta.updated_at + version so Sync LWW propagates.
   */
  async setNotePasswordUnified(
    id: string,
    password: string,
  ): Promise<NoteNode> {
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "setNotePasswordUnified");

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(`setNotePasswordUnified meta failed: ${metaErr.message}`);

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ password_hash: passwordHash })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `setNotePasswordUnified payload failed: ${payErr.message}`,
      );

    const updated = await this.getNote(id);
    if (!updated)
      throw new Error(
        `setNotePasswordUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  /**
   * Verify-then-clear. Tauri parity: a wrong currentPassword must NOT
   * mutate the row, so verify is the first step and rejects on mismatch.
   */
  async removeNotePasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<NoteNode> {
    const valid = await this.verifyNotePasswordUnified(id, currentPassword);
    if (!valid) throw new Error("Invalid password");

    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "removeNotePasswordUnified");

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(
        `removeNotePasswordUnified meta failed: ${metaErr.message}`,
      );

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ password_hash: null })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `removeNotePasswordUnified payload failed: ${payErr.message}`,
      );

    const updated = await this.getNote(id);
    if (!updated)
      throw new Error(
        `removeNotePasswordUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  /**
   * Verify `password` against the stored PBKDF2 hash (Issue #118). SELECTs
   * password_hash from notes_payload (RLS scopes to auth.uid()'s rows).
   * Returns `false` when no hash is set. A legacy plaintext row that matches
   * is lazily rehashed into PBKDF2 form (best-effort — see below).
   *
   * DEBT status: the plaintext-at-rest debt (old known-issues 027) is
   * RESOLVED. The RPC debt REMAINS — ideally a `security invoker` RPC so the
   * hash never leaves Postgres; today the SELECT list only keeps it off the
   * public read path (defence in depth, not a substitute).
   */
  async verifyNotePasswordUnified(
    id: string,
    password: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("notes_payload")
      .select("password_hash")
      .eq("item_id", id)
      .maybeSingle();
    if (error)
      throw new Error(`verifyNotePasswordUnified failed: ${error.message}`);
    const stored = (data as { password_hash: string | null } | null)
      ?.password_hash;
    if (stored == null) return false;

    const { ok, needsRehash } = await verifyPassword(password, stored);
    if (ok && needsRehash) await this.lazyRehashNotePassword(id, password);
    return ok;
  }

  /**
   * Migrate a legacy plaintext password to PBKDF2 form (Issue #118) after a
   * successful verify.
   *
   * DELIBERATE DB-Q2 EXCEPTION — payload-only UPDATE, NO items_meta bump:
   * password_hash sits outside every `*_PAYLOAD_COLUMNS` SELECT shape, so it
   * is absent from the sync surface, and verify always re-reads the single
   * column straight from the cloud row (no client cache). LWW propagation is
   * therefore unnecessary. Bumping updated_at would instead be harmful — the
   * note list sorts by updated_at DESC, so a mere unlock/view would jump the
   * note to the top. A payload-only write is also atomic (one statement),
   * avoiding the non-atomic meta+payload pair. has_password stays true
   * throughout (plaintext -> hash is still non-null).
   *
   * Best-effort: a write failure is swallowed so it never changes the verify
   * result; the next successful unlock retries the migration.
   */
  private async lazyRehashNotePassword(
    id: string,
    password: string,
  ): Promise<void> {
    try {
      const passwordHash = await hashPassword(password);
      const { error: payErr } = await this.client
        .from("notes_payload")
        .update({ password_hash: passwordHash })
        .eq("item_id", id);
      if (payErr)
        throw new Error(
          `lazyRehashNotePassword payload failed: ${payErr.message}`,
        );
    } catch (err) {
      // Swallow (but log): rehash is opportunistic. The verify already
      // succeeded and the plaintext still verifies next time, so a failed
      // migration simply retries on the next unlock. The warn keeps a
      // chronically failing migration observable.
      console.warn(`lazyRehashNotePassword(${id}) failed:`, err);
    }
  }

  /**
   * Flip notes_payload.is_edit_locked. Read-modify-write because PostgREST
   * cannot express the SQLite `CASE WHEN ... END` in one statement. Bumps
   * items_meta.updated_at + version so Sync LWW propagates.
   */
  async toggleNoteEditLockUnified(id: string): Promise<NoteNode> {
    const { data: cur, error: readErr } = await this.client
      .from("notes_payload")
      .select("is_edit_locked")
      .eq("item_id", id)
      .single();
    if (readErr)
      throw new Error(
        `toggleNoteEditLockUnified read failed: ${readErr.message}`,
      );
    const next = !(cur as { is_edit_locked: boolean }).is_edit_locked;

    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "toggleNoteEditLockUnified");

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(
        `toggleNoteEditLockUnified meta failed: ${metaErr.message}`,
      );

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ is_edit_locked: next })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `toggleNoteEditLockUnified payload failed: ${payErr.message}`,
      );

    const updated = await this.getNote(id);
    if (!updated)
      throw new Error(
        `toggleNoteEditLockUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  /**
   * Read current items_meta.version and return version + 1. Mirrors the
   * legacy `nextVersion` helper. A missing row throws (caller invariant:
   * the row exists; this helper only runs from password/lock paths where
   * the UI has already loaded the note).
   */
  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("items_meta")
      .select("version")
      .eq("id", id)
      .eq("role", "note")
      .single();
    if (error) throw new Error(`${label} version read: ${error.message}`);
    const row = data as { version: number | null };
    return (row?.version ?? 0) + 1;
  }
}
