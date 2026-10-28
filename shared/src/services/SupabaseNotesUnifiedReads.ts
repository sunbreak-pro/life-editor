import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEMS_META_NOTE_COLUMNS,
  NOTES_PAYLOAD_COLUMNS,
  NOTES_PAYLOAD_LIST_COLUMNS,
  isLegacyNoteFolderRow,
  isNoteTemplateRow,
  rowsToNoteNode,
  rowsToNoteNodeLite,
  type ItemsMetaNoteRow,
  type NotesPayloadListRow,
  type NotesPayloadRow,
} from "./notesUnifiedMapper";
import type { NoteExcerpt, NoteNode } from "../types/note";
import { blocksExcerpt, type TipTapNode } from "../utils/contentExcerpt";
import { contentJsonToString } from "./contentJson";
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import { fetchAllPages, fetchByIdChunks } from "./postgrestFetchAll";
import { livePayloadInnerJoin } from "./supabaseServiceHelpers";
import { fetchMaybeSingleRow } from "./postgrestSingle";

/** Top-level blocks read per note for its excerpt (#2224). */
const EXCERPT_BLOCKS = 5;
/** A one-line excerpt is cut here; the row truncates it visually anyway. */
const EXCERPT_MAX_CHARS = 200;

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
   * List the note TEMPLATES (role='note' AND note_type='template') — #1047.
   *
   * The exact inverse of the `keep` clause the two note lists use, and the ONLY
   * read that returns template rows: everything else in the app treats them as
   * if they were not there. Light payload columns like the note lists, because
   * the panel shows names and fetches the body on select (getNoteUnified) for
   * the same reason notes do — the body is the heavy column and the list does
   * not render it.
   */
  async listNoteTemplatesUnified(): Promise<NoteNode[]> {
    // Payload first, filtered by the server (#2327). The meta-first join read
    // EVERY live note's meta and payload and then kept the templates here — a
    // second copy of the whole note list each time the library opened. Only
    // the payload knows `note_type`, so it goes first; the metas are read for
    // the template ids alone.
    const payloadRows = await fetchAllPages<NotesPayloadListRow>(
      (from, to) =>
        this.client
          .from("notes_payload")
          .select(NOTES_PAYLOAD_LIST_COLUMNS)
          .eq("note_type", "template")
          .order("item_id")
          .range(from, to),
      "listNoteTemplatesUnified payload failed",
    );
    if (payloadRows.length === 0) return [];

    const metaRows = await fetchByIdChunks<ItemsMetaNoteRow>(
      payloadRows.map((p) => p.item_id),
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
          "listNoteTemplatesUnified meta failed",
        ),
    );
    const payloadById = new Map(payloadRows.map((p) => [p.item_id, p]));
    const out: NoteNode[] = [];
    // Meta order (by id), as the meta-first join returned them.
    for (const meta of [...metaRows].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )) {
      const payload = payloadById.get(meta.id);
      if (!payload || !isNoteTemplateRow(payload)) continue;
      out.push(rowsToNoteNodeLite(meta, payload));
    }
    return out;
  }

  /**
   * Each unlocked note's one-line excerpt (#2224) — see the DataService note.
   *
   * The body is never fetched whole: PostgREST's JSON path in the select list
   * (`content_json->content->0`) returns one top-level block per alias, so a
   * note sends at most EXCERPT_BLOCKS blocks, never the rest of its body — the
   * same reason the note list leaves `content_json` out (M1). A block is
   * returned WHOLE, though: a note that opens with a long list, a table or a
   * code block still sends that block in full. Trimming inside the database
   * would need a function there (a migration), which this read does not add.
   * Several blocks rather than one because a body often opens with an empty
   * paragraph or an atom (a link, an image), and the excerpt is the first
   * block that has text. A legacy plain-string body has no `content` key and
   * reads back null: no excerpt, rather than a guess.
   *
   * `has_password = false` for the same reason getNoteUnified filters on it
   * (#1763): a locked note's body must never reach this client, and the head
   * of a body is still the body.
   */
  async listNoteExcerptsUnified(): Promise<NoteExcerpt[]> {
    const blockColumns = Array.from(
      { length: EXCERPT_BLOCKS },
      (_, i) => `b${i}:content_json->content->${i}`,
    ).join(", ");
    const rows = await fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        this.client
          .from("notes_payload")
          .select(`item_id, ${blockColumns}`)
          .eq("has_password", false)
          .order("item_id")
          .range(from, to),
      "listNoteExcerptsUnified failed",
    );
    const out: NoteExcerpt[] = [];
    for (const row of rows) {
      const blocks = Array.from(
        { length: EXCERPT_BLOCKS },
        (_, i) => row[`b${i}`] as TipTapNode | null | undefined,
      );
      const excerpt = blocksExcerpt(blocks);
      if (excerpt === undefined) continue;
      out.push({
        id: String(row.item_id),
        excerpt:
          // By code point, so a surrogate pair (an emoji) is never split.
          [...excerpt].length > EXCERPT_MAX_CHARS
            ? [...excerpt].slice(0, EXCERPT_MAX_CHARS).join("")
            : excerpt,
      });
    }
    return out;
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
   * the LIGHT payload column set, skipping orphan metas, legacy folder rows
   * (#375) and templates (#1047). `label` reproduces each caller's own error strings verbatim
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
      // #375 folders, #1047 templates — neither is a note the list may show.
      keep: (payload) =>
        !isLegacyNoteFolderRow(payload) && !isNoteTemplateRow(payload),
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
      // #1047 adds the template leg. Nested `and(...)` inside the `or(...)`
      // rather than a second `.or()` call: two ORs would be AND-ed as separate
      // groups, which happens to be right here but stops being obvious the
      // moment a third value shows up.
      .or(
        "note_type.is.null,and(note_type.neq.folder,note_type.neq.template)",
        { referencedTable: "notes_payload" },
      );
    if (error) throw new Error(`countLiveNotes failed: ${error.message}`);
    return count ?? 0;
  }

  /**
   * The note detail — WITHOUT the body when the note is password-locked
   * (#1763, D-20260920-main-1 = A).
   *
   * The body query carries `has_password = false`, so a locked note's
   * `content_json` is never SELECTed. "Never fetched" rather than "fetched and
   * dropped" is the whole point: a body this client never holds cannot reach
   * the DOM, a log line or the next refactor. RLS cannot do this job — the row
   * belongs to the signed-in owner, so every owner-only policy says yes.
   *
   * Cost: an ordinary (unlocked) note still costs ONE payload round trip,
   * because the filtered query returns it. Only a locked note pays a second —
   * the re-read on `NOTES_PAYLOAD_LIST_COLUMNS`, which is also what tells
   * "locked" apart from "the payload row is gone" (the meta read above already
   * proved the item exists). A locked note materialises through
   * `rowsToNoteNodeLite`, i.e. with the same `content = ""` "not loaded"
   * sentinel the list reads use — `hasPassword` on the node is what says which
   * of the two it is. The body arrives later through `getNoteBodyUnified`,
   * after the password checked out.
   */
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
        .eq("has_password", false)
        .maybeSingle(),
      "getNoteUnified payload failed",
    );
    if (payload) return rowsToNoteNode(meta, payload);

    const lite = await fetchMaybeSingleRow<NotesPayloadListRow>(
      this.client
        .from("notes_payload")
        .select(NOTES_PAYLOAD_LIST_COLUMNS)
        .eq("item_id", id)
        .maybeSingle(),
      "getNoteUnified payload failed",
    );
    if (!lite) return null;

    return rowsToNoteNodeLite(meta, lite);
  }

  /**
   * The body of ONE note, for the caller that has just verified its password
   * (#1763). The unlock path, and the only read in this class that returns a
   * locked note's `content_json`.
   *
   * Unfiltered on purpose: `has_password` is still true after a correct
   * password (the hash stays), so filtering here would make unlocking
   * impossible. The gate this read sits behind is
   * `verifyNotePasswordUnified` — a call site that skipped it would be
   * skipping the password, which is the one thing the DB cannot check for us
   * (the row is the owner's either way).
   *
   * `null` = no payload row (the note is gone). An empty body comes back as
   * `""`, which is what `contentJsonToString` makes of a NULL `content_json`.
   */
  async getNoteBodyUnified(id: string): Promise<string | null> {
    const row = await fetchMaybeSingleRow<{ content_json: unknown }>(
      this.client
        .from("notes_payload")
        .select("content_json")
        .eq("item_id", id)
        .maybeSingle(),
      "getNoteBodyUnified failed",
    );
    if (!row) return null;
    return contentJsonToString(row.content_json);
  }
}
