import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEMS_META_NOTE_COLUMNS,
  NOTES_PAYLOAD_COLUMNS,
  isLegacyNoteFolderRow,
  isNoteTemplateRow,
  rowsToNoteNode,
  type ItemsMetaNoteRow,
  type NotesPayloadRow,
} from "./notesUnifiedMapper";
import type { NoteNode } from "../types/note";
import { fetchAllPages, fetchByIdChunks } from "./postgrestFetchAll";
import { pgrstQuoteValue } from "./supabaseServiceHelpers";

/**
 * Search side of SupabaseNotesUnifiedService (#587 split). Not a dispatch
 * target — the facade delegates here. `listAll` is injected (the empty-query
 * short-circuit answers with the plain list, which lives on the reads side).
 */
export class SupabaseNotesUnifiedSearch {
  constructor(
    private readonly client: SupabaseClient,
    private readonly listAll: () => Promise<NoteNode[]>,
  ) {}

  /**
   * Title + content search. The 2-row split forces a 2-step query: gather
   * payload.item_ids whose content_json matches, then UNION the meta.title
   * matches at the items_meta layer (ilike on title). All filtered to
   * is_deleted=false and role='note'. Empty query short-circuits to all
   * notes (parity with legacy hook which client-filtered).
   *
   * SECURITY: every interpolated value flows through `pgrstQuoteValue`
   * (see supabaseServiceHelpers.ts) so reserved chars cannot break
   * out of the PostgREST filter grammar. The `%` wildcards stay outside
   * the quotes so they still act as ILIKE wildcards while the user query
   * is treated literally.
   *
   * KNOWN LIMITATION: content_json is jsonb. PostgREST `ilike` on jsonb
   * does an implicit text cast — works on TipTap docs (jsonb text repr
   * contains the user-visible text) but is more expensive than the
   * legacy single-table `content` text column. Acceptable for N=1 with
   * bounded dataset; if the dataset ever grows we'd add a tsvector
   * generated column. For now we accept the cast cost.
   */
  async searchNotesUnified(query: string): Promise<NoteNode[]> {
    const trimmed = query.trim();
    if (trimmed === "") return this.listAll();

    // Step 1: items_meta ids whose title ilike matches (role+!is_deleted).
    // `safe` is forward-compat — Supabase `.ilike()` already parameter-binds
    // `trimmed`, so the quoted variant is only needed if a future revision
    // switches to `.or("title.ilike.<v>,content.ilike.<v>")` (DU-G Step 5
    // multi-column widening, see the pgrstQuoteValue JSDoc in
    // supabaseServiceHelpers.ts + QA-3 review note).
    const safe = pgrstQuoteValue(trimmed);
    const titleHits = await fetchAllPages<ItemsMetaNoteRow>(
      (from, to) =>
        this.client
          .from("items_meta")
          .select(ITEMS_META_NOTE_COLUMNS)
          .eq("role", "note")
          .eq("is_deleted", false)
          .ilike("title", `%${trimmed}%`)
          .order("id")
          .range(from, to),
      "searchNotesUnified title failed",
    );

    // Step 2: notes_payload rows whose content_json ilike matches. We
    // need the payload ids, then look up meta for those ids that are
    // still live (composite filter is_deleted=false applied via items_meta
    // step 3).
    const contentHits = await fetchAllPages<{ item_id: string }>(
      (from, to) =>
        this.client
          .from("notes_payload")
          .select("item_id")
          .ilike("content_json::text", `%${trimmed}%`)
          .order("item_id")
          .range(from, to),
      "searchNotesUnified content failed",
    );

    // Step 3: merge id sets — title hits already include meta rows; for
    // content-only hits we need to fetch their meta + filter is_deleted.
    const titleMetaById = new Map<string, ItemsMetaNoteRow>();
    for (const row of titleHits) {
      titleMetaById.set(row.id, row);
    }
    const contentOnlyIds = contentHits
      .map((c) => c.item_id)
      .filter((cid) => !titleMetaById.has(cid));

    let extraMetas: ItemsMetaNoteRow[] = [];
    if (contentOnlyIds.length > 0) {
      extraMetas = await fetchByIdChunks<ItemsMetaNoteRow>(
        contentOnlyIds,
        (chunk) =>
          fetchAllPages(
            (from, to) =>
              this.client
                .from("items_meta")
                .select(ITEMS_META_NOTE_COLUMNS)
                .eq("role", "note")
                .eq("is_deleted", false)
                .in("id", chunk)
                .order("id")
                .range(from, to),
            "searchNotesUnified meta failed",
          ),
      );
    }

    const allMetas = [...titleMetaById.values(), ...extraMetas];
    const allIds = allMetas.map((m) => m.id);
    if (allIds.length === 0) {
      // Discard the forward-compat escaped form (see the Step 1 JSDoc).
      // Activated by DU-G Step 5 if/when search widens to `.or()` multi-column.
      void safe;
      return [];
    }

    // Step 4: fetch payloads for the merged id set + join.
    const payloads = await fetchByIdChunks<NotesPayloadRow>(allIds, (chunk) =>
      fetchAllPages(
        (from, to) =>
          this.client
            .from("notes_payload")
            .select(NOTES_PAYLOAD_COLUMNS)
            .in("item_id", chunk)
            .order("item_id")
            .range(from, to),
        "searchNotesUnified payload failed",
      ),
    );

    const payloadById = new Map<string, NotesPayloadRow>();
    for (const row of payloads) {
      payloadById.set(row.item_id, row);
    }

    const out: NoteNode[] = [];
    for (const meta of allMetas) {
      const payload = payloadById.get(meta.id);
      if (!payload) continue;
      // A title hit can land on a retired folder row (note_type lives on the
      // payload, so the items_meta query cannot exclude it) — #375. Same for a
      // template (#1047): searching notes must not turn up the stamps, or
      // opening a hit would drop the user into a surface Notes cannot show.
      if (isLegacyNoteFolderRow(payload) || isNoteTemplateRow(payload))
        continue;
      out.push(rowsToNoteNode(meta, payload));
    }
    // Order by updated_at DESC (legacy parity).
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return out;
  }
}
