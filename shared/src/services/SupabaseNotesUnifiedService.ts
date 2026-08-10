import type { SupabaseClient } from "@supabase/supabase-js";
import { noteNodeToRows, noteUpdatesToPatches } from "./notesUnifiedMapper";
import type { NoteNode } from "../types/note";
import { SupabaseNotesUnifiedReads } from "./SupabaseNotesUnifiedReads";
import { SupabaseNotesUnifiedSearch } from "./SupabaseNotesUnifiedSearch";
import { SupabaseNotesUnifiedLock } from "./SupabaseNotesUnifiedLock";
import { orderNotePurge } from "./notesUnifiedPurgeOrder";

/*
 * SupabaseNotesUnifiedService (DU-D Step 2).
 *
 * Lives apart from SupabaseDataService.ts (same policy as
 * SupabaseWikiTagsUnifiedService) to keep the monolith from growing.
 * Wired into the dispatch Proxy via PHASE2_NOTES_UNIFIED_METHODS in
 * SupabaseDataService.ts.
 *
 * Naming policy: every method here carries the `*Unified` suffix. The
 * legacy single-table Notes service + dispatch set were retired in DU-G
 * G4; this Unified service is now the only Supabase Notes write path.
 *
 * Write ordering: items_meta first, then notes_payload (FK enforces this).
 * If the payload INSERT fails, hard-delete the orphan items_meta row to
 * avoid a soft-delete ghost on other devices (DU-B R2 parity).
 *
 * #587 split — this class keeps the write paths and delegates the rest to
 * collaborators (this file remains the dispatch surface; the collaborators
 * are not registered in the Proxy):
 * - SupabaseNotesUnifiedReads   list / Trash list / detail / count
 * - SupabaseNotesUnifiedSearch  title + content search
 * - SupabaseNotesUnifiedLock    password gate + edit lock (+ version bump)
 * - notesUnifiedPurgeOrder      pure leaf-first purge ordering
 */
export class SupabaseNotesUnifiedService {
  private readonly reads: SupabaseNotesUnifiedReads;
  private readonly search: SupabaseNotesUnifiedSearch;
  private readonly lock: SupabaseNotesUnifiedLock;

  constructor(private readonly client: SupabaseClient) {
    this.reads = new SupabaseNotesUnifiedReads(client);
    this.search = new SupabaseNotesUnifiedSearch(client, () =>
      this.reads.listNotesUnified(),
    );
    this.lock = new SupabaseNotesUnifiedLock(client, (id) =>
      this.reads.getNoteUnified(id),
    );
  }

  // -------------------------------------------------------------------------
  // Read (SupabaseNotesUnifiedReads)
  // -------------------------------------------------------------------------

  listNotesUnified(): Promise<NoteNode[]> {
    return this.reads.listNotesUnified();
  }

  countLiveNotes(): Promise<number> {
    return this.reads.countLiveNotes();
  }

  getNoteUnified(id: string): Promise<NoteNode | null> {
    return this.reads.getNoteUnified(id);
  }

  fetchDeletedNotesUnified(): Promise<NoteNode[]> {
    return this.reads.fetchDeletedNotesUnified();
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async createNoteUnified(node: NoteNode): Promise<NoteNode> {
    // user_id omitted on insert — DB default `auth.uid()` fills it. Saves
    // the frontend from threading a userId through every call site (parity
    // with SupabaseWikiTagsUnifiedService).
    const userPlaceholder = "00000000-0000-0000-0000-000000000000";
    const { meta, payload } = noteNodeToRows(node, userPlaceholder);

    // Strip the placeholder user_id so RLS default applies.
    const metaInsert: Record<string, unknown> = { ...meta };
    delete metaInsert.user_id;
    const payloadInsert: Record<string, unknown> = { ...payload };
    delete payloadInsert.user_id;

    const { error: metaErr } = await this.client
      .from("items_meta")
      .insert(metaInsert);
    if (metaErr)
      throw new Error(`createNoteUnified meta failed: ${metaErr.message}`);

    const { error: payErr } = await this.client
      .from("notes_payload")
      .insert(payloadInsert);
    if (payErr) {
      // Orphan cleanup: hard-delete the items_meta row so the failed
      // create does not leak a row that other devices would render in
      // their TrashView (DU-B R2 parity, NOT soft-delete).
      await this.client.from("items_meta").delete().eq("id", node.id);
      throw new Error(`createNoteUnified payload failed: ${payErr.message}`);
    }

    const created = await this.getNoteUnified(node.id);
    if (!created)
      throw new Error(
        `createNoteUnified: row vanished after insert (id="${node.id}")`,
      );
    return created;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  async updateNoteUnified(
    id: string,
    updates: Partial<NoteNode>,
  ): Promise<NoteNode> {
    const now = new Date().toISOString();
    const userPlaceholder = "00000000-0000-0000-0000-000000000000";
    const { metaPatch, payloadPatch } = noteUpdatesToPatches(
      updates,
      userPlaceholder,
      now,
    );

    // Meta side always has updated_at — always issue the UPDATE.
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(`updateNoteUnified meta failed: ${metaErr.message}`);

    // Payload UPDATE only when the patch is non-empty (avoid a no-op UPDATE
    // that would still bump nothing but cost a round-trip).
    if (Object.keys(payloadPatch).length > 0) {
      const { error: payErr } = await this.client
        .from("notes_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (payErr)
        throw new Error(`updateNoteUnified payload failed: ${payErr.message}`);
    }

    const updated = await this.getNoteUnified(id);
    if (!updated)
      throw new Error(
        `updateNoteUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  // -------------------------------------------------------------------------
  // Delete (soft)
  // -------------------------------------------------------------------------

  async softDeleteNoteUnified(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("role", "note");
    if (error)
      throw new Error(`softDeleteNoteUnified failed: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // Hierarchy (DnD)
  // -------------------------------------------------------------------------

  async moveNoteUnified(
    id: string,
    parentId: string | null,
    order: number,
  ): Promise<void> {
    // Single-row PATCH on notes_payload + LWW bump on items_meta. parentId
    // null = move to root. Composite FK (0014) enforces parent role='note'.
    const now = new Date().toISOString();
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(`moveNoteUnified meta failed: ${metaErr.message}`);

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ parent_item_id: parentId, sort_order: order })
      .eq("item_id", id);
    if (payErr)
      throw new Error(`moveNoteUnified payload failed: ${payErr.message}`);
  }

  // -------------------------------------------------------------------------
  // Trash (DU-G PR1)
  // -------------------------------------------------------------------------

  /**
   * Reverse a soft-delete. Clears items_meta.is_deleted / deleted_at and
   * bumps updated_at so Sync LWW propagates the restore. Mirrors the
   * legacy `restoreNote` (single-row) — PR1 known constraint: restoring a
   * folder does NOT restore its descendants; the caller must restore each
   * id individually (legacy parity, tracked as Backlog ⑧ in the Notes
   * web-parity plan).
   */
  async restoreNoteUnified(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id)
      .eq("role", "note");
    if (error) throw new Error(`restoreNoteUnified failed: ${error.message}`);
  }

  /**
   * Hard-delete from items_meta. notes_payload is cleaned up automatically
   * by the 0008 `ON DELETE CASCADE` FK (`notes_payload.item_id ->
   * items_meta(id)`). The composite parent FK introduced by 0014 is
   * `ON DELETE NO ACTION`, so the subtree is purged descendants-first
   * (leaf-first ordering = notesUnifiedPurgeOrder.ts). The pool is built
   * from live + trashed (a trashed root with trashed children must purge
   * in one call).
   *
   * KNOWN LIMIT (#375, same as the Tasks side): the pool inherits the legacy
   * folder exclusion, so a legacy `note_type='folder'` row is invisible here
   * — it can be neither restored nor purged from the UI, and a subtree that
   * still hangs off one cannot be walked through it (the FK would reject the
   * parent's delete with 23503). Accepted: migration 0020 converted the two
   * production folders and left zero notes directly under them, and the
   * rollback SSOT is `life_tags_migration_log`.
   */
  async permanentDeleteNoteUnified(id: string): Promise<void> {
    const [live, trashed] = await Promise.all([
      this.listNotesUnified(),
      this.fetchDeletedNotesUnified(),
    ]);
    const ordered = orderNotePurge([...live, ...trashed], id);

    for (const did of ordered) {
      const { error } = await this.client
        .from("items_meta")
        .delete()
        .eq("id", did)
        .eq("role", "note");
      if (error)
        throw new Error(`permanentDeleteNoteUnified ${did}: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Search (SupabaseNotesUnifiedSearch)
  // -------------------------------------------------------------------------

  searchNotesUnified(query: string): Promise<NoteNode[]> {
    return this.search.searchNotesUnified(query);
  }

  // -------------------------------------------------------------------------
  // Password gate + edit lock (SupabaseNotesUnifiedLock)
  // -------------------------------------------------------------------------

  setNotePasswordUnified(id: string, password: string): Promise<NoteNode> {
    return this.lock.setNotePasswordUnified(id, password);
  }

  removeNotePasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<NoteNode> {
    return this.lock.removeNotePasswordUnified(id, currentPassword);
  }

  verifyNotePasswordUnified(id: string, password: string): Promise<boolean> {
    return this.lock.verifyNotePasswordUnified(id, password);
  }

  toggleNoteEditLockUnified(id: string): Promise<NoteNode> {
    return this.lock.toggleNoteEditLockUnified(id);
  }
}

export const PHASE2_NOTES_UNIFIED_METHODS: ReadonlySet<string> = new Set([
  "listNotesUnified",
  "countLiveNotes",
  "getNoteUnified",
  "createNoteUnified",
  "updateNoteUnified",
  "softDeleteNoteUnified",
  "moveNoteUnified",
  // DU-G PR1
  "fetchDeletedNotesUnified",
  "restoreNoteUnified",
  "permanentDeleteNoteUnified",
  "searchNotesUnified",
  "setNotePasswordUnified",
  "removeNotePasswordUnified",
  "verifyNotePasswordUnified",
  "toggleNoteEditLockUnified",
]);
