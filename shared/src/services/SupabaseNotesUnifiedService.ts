import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEMS_META_NOTE_COLUMNS,
  NOTES_PAYLOAD_COLUMNS,
  noteNodeToRows,
  noteUpdatesToPatches,
  rowsToNoteNode,
  type ItemsMetaNoteRow,
  type NotesPayloadRow,
} from "./notesUnifiedMapper";
import type { NoteNode } from "../types/note";

/*
 * SupabaseNotesUnifiedService (DU-D Step 2).
 *
 * Lives apart from SupabaseDataService.ts (same policy as
 * SupabaseWikiTagsUnifiedService) to keep the monolith from growing.
 * Wired into the dispatch Proxy via PHASE2_NOTES_UNIFIED_METHODS in
 * SupabaseDataService.ts.
 *
 * Naming policy: every method here carries the `*Unified` suffix. The
 * legacy single-table SupabaseNotesService (PHASE2_NOTES_METHODS) stays
 * untouched and coexists; DU-F retires it when the frontend↔shared
 * integration lands and Tauri callers stop arriving via tauriDataService.
 *
 * Write ordering: items_meta first, then notes_payload (FK enforces this).
 * If the payload INSERT fails, hard-delete the orphan items_meta row to
 * avoid a soft-delete ghost on other devices (DU-B R2 parity).
 */
export class SupabaseNotesUnifiedService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async listNotesUnified(): Promise<NoteNode[]> {
    // Fetch all role='note' items_meta + their matching payloads. Done as
    // two queries + an in-memory join (one network round-trip each); the
    // dataset is per-user so cardinality is bounded.
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_NOTE_COLUMNS)
      .eq("role", "note")
      .eq("is_deleted", false);
    if (metaErr)
      throw new Error(`listNotesUnified meta failed: ${metaErr.message}`);

    const ids = (metas ?? []).map((m) => (m as unknown as ItemsMetaNoteRow).id);
    if (ids.length === 0) return [];

    const { data: payloads, error: payErr } = await this.client
      .from("notes_payload")
      .select(NOTES_PAYLOAD_COLUMNS)
      .in("item_id", ids);
    if (payErr)
      throw new Error(`listNotesUnified payload failed: ${payErr.message}`);

    const payloadById = new Map<string, NotesPayloadRow>();
    for (const p of payloads ?? []) {
      const row = p as unknown as NotesPayloadRow;
      payloadById.set(row.item_id, row);
    }

    const out: NoteNode[] = [];
    for (const m of metas ?? []) {
      const meta = m as unknown as ItemsMetaNoteRow;
      const payload = payloadById.get(meta.id);
      if (!payload) continue; // orphan meta — skip rather than throw
      out.push(rowsToNoteNode(meta, payload));
    }
    return out;
  }

  async getNoteUnified(id: string): Promise<NoteNode | null> {
    const { data: meta, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_NOTE_COLUMNS)
      .eq("id", id)
      .eq("role", "note")
      .maybeSingle();
    if (metaErr)
      throw new Error(`getNoteUnified meta failed: ${metaErr.message}`);
    if (!meta) return null;

    const { data: payload, error: payErr } = await this.client
      .from("notes_payload")
      .select(NOTES_PAYLOAD_COLUMNS)
      .eq("item_id", id)
      .maybeSingle();
    if (payErr)
      throw new Error(`getNoteUnified payload failed: ${payErr.message}`);
    if (!payload) return null;

    return rowsToNoteNode(
      meta as unknown as ItemsMetaNoteRow,
      payload as unknown as NotesPayloadRow,
    );
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
}

export const PHASE2_NOTES_UNIFIED_METHODS: ReadonlySet<string> = new Set([
  "listNotesUnified",
  "getNoteUnified",
  "createNoteUnified",
  "updateNoteUnified",
  "softDeleteNoteUnified",
  "moveNoteUnified",
]);
