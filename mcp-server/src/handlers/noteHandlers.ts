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
  isLegacyFolder,
  requireMeta,
  softDeleteItem,
  updatePayload,
  type ItemsMetaRow,
} from "../utils/items.js";
import {
  fetchAllPages,
  fetchByIdChunks,
  resolveListLimit,
} from "../utils/pagination.js";
import {
  LOCKED_BODY_NOTICE,
  assertUnlocked,
  fetchUnlockedBodies,
  lockedBodyError,
} from "../utils/lockedBody.js";

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
 *   - a note with a password hands back NO body, and no tool here will
 *     change it (#1763). The gate is the SELECT shape, not the formatter —
 *     utils/lockedBody.ts has the reasoning and the limits.
 */

export interface NotesPayloadRow {
  item_id: string;
  note_type: "folder" | "note" | null;
  /**
   * The body — absent whenever it was never fetched, which is what a locked
   * note always is since #1763. Check `has_password` before reading it, so
   * "locked" is never mistaken for "empty".
   */
  content_json?: unknown;
  is_pinned: boolean;
  color: string | null;
  has_password: boolean;
}

/** A live note: its items_meta row paired with its payload row. */
export interface NoteRecord {
  meta: ItemsMetaRow;
  payload: NotesPayloadRow;
}

/**
 * Everything but the body. Every note read starts here and asks for
 * `content_json` separately, for the unlocked ids only (#1763 — see
 * utils/lockedBody.ts for why the gate is the SELECT and not the formatter).
 */
const PAYLOAD_COLUMNS_BODYLESS =
  "item_id, note_type, is_pinned, color, has_password";

const PAYLOAD_COLUMNS = `${PAYLOAD_COLUMNS_BODYLESS}, content_json`;

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
    hasPassword: payload.has_password,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };
}

/**
 * The half of every note result that says what happened to the body: the
 * locked note reports WHY it has none, so a caller cannot read the absence
 * as an empty note and overwrite it.
 */
const LOCKED_BODY_FIELDS = { locked: true, lockedReason: LOCKED_BODY_NOTICE };

/**
 * Single-note result: the stored body plus its plain text (#702 ①).
 *
 * `content` is TipTap JSON while `update_note` writes Markdown, so the JSON
 * a caller reads cannot be written back as-is. `contentText` is the half of
 * that round trip that was missing.
 */
export function formatNote(meta: ItemsMetaRow, payload: NotesPayloadRow) {
  const base = formatNoteBase(meta, payload);
  if (payload.has_password) return { ...base, ...LOCKED_BODY_FIELDS };
  return {
    ...base,
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
  // `include_content: true` is not a key: the body of a locked note was
  // never read, so there is nothing to opt into (#1763).
  if (payload.has_password) {
    return { ...formatNoteBase(meta, payload), ...LOCKED_BODY_FIELDS };
  }
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
        .select(PAYLOAD_COLUMNS_BODYLESS)
        .in("item_id", chunk);
      if (error) throw new Error(`list notes_payload: ${error.message}`);
      return (data ?? []) as unknown as NotesPayloadRow[];
    },
  );
  const payloadById = new Map<string, NotesPayloadRow>();
  for (const p of payloadRows) payloadById.set(p.item_id, p);

  // Second pass for the bodies, naming the unlocked ids only (#1763). The
  // locked ones never appear in a query, so their text never reaches here.
  const bodies = await fetchUnlockedBodies("notes_payload", payloadRows);

  const out: NoteRecord[] = [];
  for (const meta of metaRows) {
    const payload = payloadById.get(meta.id);
    if (!payload) continue; // meta without payload = orphan
    if (isLegacyFolder(payload.note_type)) continue; // #375: retired folder row
    out.push({
      meta,
      payload: { ...payload, content_json: bodies.get(meta.id) ?? null },
    });
  }
  return out;
}

/**
 * Fetch one live note (meta + payload) or throw a not-found error. Exported
 * for get_note_context (#782 ③), which starts from the same two reads.
 */
export async function getNoteRows(id: string): Promise<NoteRecord> {
  const meta = await requireMeta(id, "note", "Note");
  const { client } = await getSupabase();

  /*
   * Unlocked first, body and all: `has_password = false` is part of the
   * filter, so an ordinary note still costs ONE round trip and a locked
   * note's `content_json` is never requested (#1763).
   */
  const { data: unlocked, error } = await client
    .from("notes_payload")
    .select(PAYLOAD_COLUMNS)
    .eq("item_id", id)
    .eq("has_password", false)
    .maybeSingle();
  if (error) throw new Error(`get notes_payload: ${error.message}`);
  if (unlocked) {
    return { meta, payload: unlocked as unknown as NotesPayloadRow };
  }

  // No unlocked row: the note is either locked or has no payload at all.
  // The bodyless read tells the two apart — meta liveness is already known.
  const { data: bodyless, error: bErr } = await client
    .from("notes_payload")
    .select(PAYLOAD_COLUMNS_BODYLESS)
    .eq("item_id", id)
    .maybeSingle();
  if (bErr) throw new Error(`get notes_payload: ${bErr.message}`);
  if (!bodyless) throw new Error(`Note not found: ${id}`);
  return { meta, payload: bodyless as unknown as NotesPayloadRow };
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
      // A locked note matches on its TITLE alone — there is no body here to
      // match against, and a body-derived hit would leak its text one
      // substring probe at a time (#1763).
      const body = record.payload.has_password
        ? ""
        : contentPlainText(record.payload.content_json);
      const haystack = `${record.meta.title}\n${body}`.toLowerCase();
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
  is_pinned?: boolean;
}) {
  const before = await getNoteRows(args.id); // not-found guard
  // Every field of a locked note is refused, not just `content`: a rename or
  // a re-pin still needs the app, and a partial write is harder to reason
  // about than a flat no (#1763).
  if (before.payload.has_password) throw lockedBodyError("Note", args.id);

  const metaPatch: Record<string, unknown> = {};
  if (args.title !== undefined) metaPatch.title = args.title;

  const payloadPatch: Record<string, unknown> = {};
  if (args.content !== undefined)
    payloadPatch.content_json = markdownToTiptap(args.content);
  if (args.color !== undefined) payloadPatch.color = args.color;
  if (args.is_pinned !== undefined) payloadPatch.is_pinned = args.is_pinned;

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

export async function deleteNote(args: { id: string }) {
  await requireMeta(args.id, "note", "Note");
  // Trashing a locked note is not reading it, but it is still a change the
  // password was put there to require the app for (#1763).
  await assertUnlocked("notes_payload", args.id, "Note");
  await softDeleteItem(args.id, "note");
  return { success: true, id: args.id, softDeleted: true };
}
