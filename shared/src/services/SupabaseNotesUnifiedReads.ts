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
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import { livePayloadInnerJoin } from "./supabaseServiceHelpers";
import { fetchMaybeSingleRow } from "./postgrestSingle";

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
    return this.listLite(false, "listNotesUnified");
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
    // M1 (perf): Trash likewise never renders the body (restore /
    // permanentDelete only need id/parentId), so it uses the light query.
    // Trailing .order("id") (added by the shared join) = unique tiebreaker for
    // deterministic pages, after the deleted_at DESC ordering asked for here.
    return this.listLite(true, "fetchDeletedNotesUnified");
  }

  /**
   * Shared body of the two list reads: the items_meta + notes_payload join on
   * the LIGHT payload column set, skipping orphan metas and legacy folder
   * rows (#375). `label` reproduces each caller's own error strings verbatim
   * (`"<method> meta failed"` / `"<method> payload failed"`).
   */
  private listLite(isDeleted: boolean, label: string): Promise<NoteNode[]> {
    return fetchMetaFirstJoin<ItemsMetaNoteRow, NotesPayloadListRow, NoteNode>({
      client: this.client,
      role: "note",
      isDeleted,
      metaColumns: ITEMS_META_NOTE_COLUMNS,
      metaLabel: `${label} meta failed`,
      // Trash orders by deleted_at DESC ("most recently trashed first",
      // legacy parity); the live list has no extra ordering.
      metaOrderBy: isDeleted
        ? [{ column: "deleted_at", ascending: false }]
        : undefined,
      payloadTable: "notes_payload",
      payloadColumns: NOTES_PAYLOAD_LIST_COLUMNS,
      payloadLabel: `${label} payload failed`,
      keep: (payload) => !isLegacyNoteFolderRow(payload), // #375
      toDomain: rowsToNoteNodeLite,
    });
  }

  /**
   * Count live notes without pulling a single row (#511). Same shape and
   * rationale as SupabaseTodosService.countUnfinishedTodos — see that
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
    const meta = await fetchMaybeSingleRow<ItemsMetaNoteRow>(
      this.client
        .from("items_meta")
        .select(ITEMS_META_NOTE_COLUMNS)
        .eq("id", id)
        .eq("role", "note")
        .maybeSingle(),
      "getNoteUnified meta failed",
    );
    if (!meta) return null;

    const payload = await fetchMaybeSingleRow<NotesPayloadRow>(
      this.client
        .from("notes_payload")
        .select(NOTES_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .maybeSingle(),
      "getNoteUnified payload failed",
    );
    if (!payload) return null;

    return rowsToNoteNode(meta, payload);
  }
}
