import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEMS_META_NOTE_COLUMNS,
  NOTES_PAYLOAD_COLUMNS,
  NOTES_PAYLOAD_LIST_COLUMNS,
  isLegacyNoteFolderRow,
  rowsToNoteNode,
  rowsToNoteNodeLite,
  type ItemsMetaNoteRow,
  type NotesPayloadListRow,
  type NotesPayloadRow,
} from "./notesUnifiedMapper";
import type { NoteNode } from "../types/note";
import { fetchAllPages, fetchByIdChunks } from "./postgrestFetchAll";
import { livePayloadInnerJoin } from "./supabaseServiceHelpers";

/**
 * Read side of SupabaseNotesUnifiedService (#587 split): the list / detail /
 * Trash-list / count queries. Not a dispatch target — the facade class in
 * SupabaseNotesUnifiedService.ts delegates here (PHASE2_NOTES_UNIFIED_METHODS
 * stays over there).
 */
export class SupabaseNotesUnifiedReads {
  constructor(private readonly client: SupabaseClient) {}

  async listNotesUnified(): Promise<NoteNode[]> {
    // Fetch all role='note' items_meta + their matching payloads. Done as
    // two queries + an in-memory join (one network round-trip each); the
    // dataset is per-user so cardinality is bounded.
    //
    // M1 (perf): the payload query uses NOTES_PAYLOAD_LIST_COLUMNS, which
    // OMITS the heavy `content_json` body. List NoteNodes therefore carry
    // `content = ""` (a "not yet loaded" sentinel); the body is loaded on
    // demand by getNoteUnified when a note is opened. Consumers must not
    // treat the empty list `content` as authoritative (see
    // useNotesUnifiedAPI's hydrate-on-select).
    //
    // #375: legacy folder rows (note_type='folder') are excluded here
    // client-side (isLegacyNoteFolderRow). Filtering in-app rather than
    // query-side (`.neq`) is deliberate — a PostgREST inequality would also
    // drop NULL note_type rows (NULL comparison), silently hiding plain
    // legacy notes. A note whose parentId points at an excluded folder still
    // surfaces (orphan tolerance): its own note_type is 'note', so only the
    // folder row itself is dropped.
    const metas = await fetchAllPages<ItemsMetaNoteRow>(
      (from, to) =>
        this.client
          .from("items_meta")
          .select(ITEMS_META_NOTE_COLUMNS)
          .eq("role", "note")
          .eq("is_deleted", false)
          .order("id")
          .range(from, to),
      "listNotesUnified meta failed",
    );

    return this.joinLitePayloads(metas, "listNotesUnified payload failed");
  }

  /**
   * List soft-deleted notes (role='note' AND is_deleted=true). Same 2-query
   * meta+payload in-memory join as listNotesUnified — but with the deleted
   * filter flipped so the Trash view in NotesSection / WikiTagsView can
   * populate. Ordered by deleted_at DESC at the items_meta layer for
   * "most-recently trashed first" parity with the legacy `notes` query
   * (`ORDER BY deleted_at DESC`).
   *
   * #375: legacy folder rows are excluded here too — migration 0020 leaves
   * the converted folders soft-deleted, so without the filter they would all
   * pop up in Trash as restorable "notes".
   */
  async fetchDeletedNotesUnified(): Promise<NoteNode[]> {
    // Trailing .order("id") = unique tiebreaker for deterministic pages.
    const metas = await fetchAllPages<ItemsMetaNoteRow>(
      (from, to) =>
        this.client
          .from("items_meta")
          .select(ITEMS_META_NOTE_COLUMNS)
          .eq("role", "note")
          .eq("is_deleted", true)
          .order("deleted_at", { ascending: false })
          .order("id")
          .range(from, to),
      "fetchDeletedNotesUnified meta failed",
    );

    // M1 (perf): Trash likewise never renders the body (restore /
    // permanentDelete only need id/parentId), so it uses the light query.
    return this.joinLitePayloads(
      metas,
      "fetchDeletedNotesUnified payload failed",
    );
  }

  /**
   * Shared tail of the two list reads: fetch the light payload rows for
   * `metas` and join in memory, skipping orphan metas and legacy folder rows
   * (#375). Was duplicated verbatim between listNotesUnified and
   * fetchDeletedNotesUnified before the #587 split.
   */
  private async joinLitePayloads(
    metas: ItemsMetaNoteRow[],
    errorLabel: string,
  ): Promise<NoteNode[]> {
    const ids = metas.map((m) => m.id);
    if (ids.length === 0) return [];

    const payloads = await fetchByIdChunks<NotesPayloadListRow>(ids, (chunk) =>
      fetchAllPages(
        (from, to) =>
          this.client
            .from("notes_payload")
            .select(NOTES_PAYLOAD_LIST_COLUMNS)
            .in("item_id", chunk)
            .order("item_id")
            .range(from, to),
        errorLabel,
      ),
    );

    const payloadById = new Map<string, NotesPayloadListRow>();
    for (const row of payloads) {
      payloadById.set(row.item_id, row);
    }

    const out: NoteNode[] = [];
    for (const meta of metas) {
      const payload = payloadById.get(meta.id);
      if (!payload) continue; // orphan meta — skip rather than throw
      if (isLegacyNoteFolderRow(payload)) continue; // #375: legacy folder row
      out.push(rowsToNoteNodeLite(meta, payload));
    }
    return out;
  }

  /**
   * Count live notes without pulling a single row (#511). Same shape and
   * rationale as SupabaseTasksService.countUnfinishedTasks — see that
   * method for why `head: true` and the `!inner` join are used.
   *
   * Notes-specific clause: `note_type IS NULL OR <> 'folder'` mirrors
   * listNotesUnified's isLegacyNoteFolderRow skip (#375). The NULL leg is
   * mandatory — a bare `neq` would drop plain legacy notes whose
   * note_type was never set, undercounting the badge.
   */
  async countLiveNotes(): Promise<number> {
    const { count, error } = await this.client
      .from("items_meta")
      .select(
        `id, ${livePayloadInnerJoin(
          "notes_payload",
          "notes_payload_item_id_fkey",
        )}`,
        { count: "exact", head: true },
      )
      .eq("role", "note")
      .eq("is_deleted", false)
      .or("note_type.is.null,note_type.neq.folder", {
        referencedTable: "notes_payload",
      });
    if (error) throw new Error(`countLiveNotes failed: ${error.message}`);
    return count ?? 0;
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
}
