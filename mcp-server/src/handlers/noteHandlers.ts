import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import { markdownToTiptap } from "../utils/markdownToTiptap.js";
import {
  contentJsonToString,
  contentPlainText,
  contentPreview,
} from "../utils/content.js";
import {
  META_COLUMNS,
  insertItem,
  requireMeta,
  updatePayload,
  type ItemsMetaRow,
} from "../utils/items.js";
import {
  fetchAllPages,
  fetchByIdChunks,
  resolveListLimit,
} from "../utils/pagination.js";

/*
 * Note handlers — Supabase edition (#360).
 *
 * Legacy `notes` (dropped by 0007) → items_meta (role='note') +
 * notes_payload. Deltas worth knowing:
 *   - `title` lives on items_meta; the payload owns the body as
 *     `content_json` (jsonb), not a TEXT column.
 *   - `note_type` no longer discriminates: #375 retired the folder note type
 *     on the Notes side too, so legacy `note_type = 'folder'` rows are
 *     excluded in-app (same rule as SupabaseNotesUnifiedService.
 *     listNotesUnified) and every surfaced note reports `type: "note"`.
 *     Filtering in-app rather than query-side is deliberate: a PostgREST
 *     `.neq` would also drop NULL note_type rows and hide plain legacy notes.
 *   - substring search over the body runs in-app: `content_json` is jsonb,
 *     which PostgREST cannot `ilike`, and matching the extracted plain text
 *     beats the legacy behaviour of LIKE-ing raw TipTap JSON (which also
 *     matched node-type names like "paragraph").
 */

export interface NotesPayloadRow {
  item_id: string;
  note_type: "folder" | "note" | null;
  content_json: unknown;
  is_pinned: boolean;
  color: string | null;
}

/** A live note: its items_meta row paired with its payload row. */
export interface NoteRecord {
  meta: ItemsMetaRow;
  payload: NotesPayloadRow;
}

const PAYLOAD_COLUMNS = "item_id, note_type, content_json, is_pinned, color";

/**
 * True for the retired folder note type (#375). NULL is a plain note — the
 * whole filter hinges on that, which is why it is exported for the unit test
 * (a `.neq('note_type','folder')` query-side filter would drop NULL rows and
 * silently hide legacy notes).
 */
export function isLegacyFolder(
  payload: Pick<NotesPayloadRow, "note_type">,
): boolean {
  return payload.note_type === "folder";
}

/** Every field but the body — how the body is carried differs per tool. */
function formatNoteBase(meta: ItemsMetaRow, payload: NotesPayloadRow) {
  return {
    id: meta.id,
    // Single-valued since #375: a legacy 'folder' row never reaches here
    // (fetchLiveNotes filters it out) and NULL means a plain note.
    type: "note",
    title: meta.title,
    isPinned: payload.is_pinned,
    color: payload.color ?? undefined,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };
}

/**
 * Single-note result: the stored body plus its plain text (#702 ①).
 *
 * `content` is TipTap JSON while `update_note` writes Markdown, so the JSON
 * a caller reads cannot be written back as-is. `contentText` is the half of
 * that round trip that was missing.
 */
export function formatNote(meta: ItemsMetaRow, payload: NotesPayloadRow) {
  return {
    ...formatNoteBase(meta, payload),
    content: contentJsonToString(payload.content_json),
    contentText: contentPlainText(payload.content_json),
  };
}

/**
 * List result: a preview by default (#702 ①). `list_notes` used to return
 * every note's whole TipTap JSON body, so reading one note cost the entire
 * collection.
 */
export function formatNoteListEntry(
  meta: ItemsMetaRow,
  payload: NotesPayloadRow,
  includeContent: boolean,
) {
  const base = {
    ...formatNoteBase(meta, payload),
    contentPreview: contentPreview(payload.content_json),
  };
  if (!includeContent) return base;
  return {
    ...base,
    content: contentJsonToString(payload.content_json),
    contentText: contentPlainText(payload.content_json),
  };
}

/**
 * Every live note, newest-updated first. Shared with search_all — both need
 * the whole collection because body matching happens in-app (jsonb).
 */
export async function fetchLiveNotes(): Promise<NoteRecord[]> {
  const { client } = await getSupabase();

  const metaRows = await fetchAllPages<ItemsMetaRow>(
    (from, to) =>
      client
        .from("items_meta")
        .select(META_COLUMNS)
        .eq("role", "note")
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    "list note items_meta",
  );
  if (metaRows.length === 0) return [];

  const payloadRows = await fetchByIdChunks<NotesPayloadRow>(
    metaRows.map((m) => m.id),
    async (chunk) => {
      const { data, error } = await client
        .from("notes_payload")
        .select(PAYLOAD_COLUMNS)
        .in("item_id", chunk);
      if (error) throw new Error(`list notes_payload: ${error.message}`);
      return (data ?? []) as unknown as NotesPayloadRow[];
    },
  );
  const payloadById = new Map<string, NotesPayloadRow>();
  for (const p of payloadRows) payloadById.set(p.item_id, p);

  const out: NoteRecord[] = [];
  for (const meta of metaRows) {
    const payload = payloadById.get(meta.id);
    if (!payload) continue; // meta without payload = orphan
    if (isLegacyFolder(payload)) continue; // #375: retired folder row
    out.push({ meta, payload });
  }
  return out;
}

/** Fetch one live note (meta + payload) or throw a not-found error. */
async function getNoteRows(id: string): Promise<NoteRecord> {
  const meta = await requireMeta(id, "note", "Note");
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("notes_payload")
    .select(PAYLOAD_COLUMNS)
    .eq("item_id", id)
    .maybeSingle();
  if (error) throw new Error(`get notes_payload: ${error.message}`);
  if (!data) throw new Error(`Note not found: ${id}`);
  return { meta, payload: data as unknown as NotesPayloadRow };
}

export async function listNotes(args: {
  query?: string;
  include_content?: boolean;
  limit?: number;
}) {
  const limit = resolveListLimit(args.limit);
  const notes = await fetchLiveNotes();
  const needle = args.query?.toLowerCase();

  const matched: NoteRecord[] = [];
  for (const record of notes) {
    if (needle) {
      const haystack = `${record.meta.title}\n${contentPlainText(
        record.payload.content_json,
      )}`.toLowerCase();
      if (!haystack.includes(needle)) continue;
    }
    matched.push(record);
  }

  const out = matched
    .slice(0, limit)
    .map(({ meta, payload }) =>
      formatNoteListEntry(meta, payload, args.include_content === true),
    );
  return {
    notes: out,
    total: matched.length,
    hasMore: matched.length > out.length,
  };
}

export async function getNote(args: { id: string }) {
  const { meta, payload } = await getNoteRows(args.id);
  return formatNote(meta, payload);
}

export async function createNote(args: { title: string; content?: string }) {
  const id = `note-${randomUUID()}`;

  await insertItem({
    id,
    role: "note",
    title: args.title,
    payloadTable: "notes_payload",
    payload: {
      parent_item_id: null,
      note_type: "note",
      content_json: args.content ? markdownToTiptap(args.content) : null,
      sort_order: 0,
      is_pinned: false,
      is_edit_locked: false,
    },
  });

  const { meta, payload } = await getNoteRows(id);
  return formatNote(meta, payload);
}

export async function updateNote(args: {
  id: string;
  title?: string;
  content?: string;
  color?: string;
}) {
  await getNoteRows(args.id); // not-found guard

  const metaPatch: Record<string, unknown> = {};
  if (args.title !== undefined) metaPatch.title = args.title;

  const payloadPatch: Record<string, unknown> = {};
  if (args.content !== undefined)
    payloadPatch.content_json = markdownToTiptap(args.content);
  if (args.color !== undefined) payloadPatch.color = args.color;

  await updatePayload(
    "notes_payload",
    args.id,
    "note",
    payloadPatch,
    metaPatch,
  );

  const { meta, payload } = await getNoteRows(args.id);
  return formatNote(meta, payload);
}
