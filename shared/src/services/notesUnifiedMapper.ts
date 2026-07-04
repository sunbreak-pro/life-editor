import type { NoteNode, NoteNodeType } from "../types/note";

/*
 * Pure NoteNode <-> 2-row (items_meta + notes_payload) mappers (DU-D Step 1).
 *
 * Historical context: DU-A migrated the legacy `public.notes` single-table
 * shape (0005) into the unified items_meta (role discriminator) +
 * notes_payload (per-role business columns) split (0008). DU-D Step 5
 * (0014_notes_payload_parent_fk.sql) further hardens parent_item_id with a
 * composite FK that blocks cross-role parenting at the DB layer — same
 * pattern as DU-B Step 1 (0009) for tasks.
 *
 * Replaced the legacy single-table Notes mapper, which was retired in
 * DU-G G4; this 2-row mapper is now the only Notes mapper.
 *
 * PASSWORD CONTRACT (1:1 with the retired legacy Notes mapper): the raw
 * `password_hash` column is NEVER selected back to the client. The domain
 * `NoteNode` exposes only `hasPassword` — a boolean served by the
 * `has_password` Postgres GENERATED column on `notes_payload`
 * (`generated always as (password_hash is not null) stored`, see 0008).
 *
 * CONTENT CONTRACT: `notes_payload.content_json` is `jsonb`. NoteNode.content
 * is a TipTap-serialized JSON string. WRITE = JSON.parse to object, READ =
 * JSON.stringify to string. Empty/null content_json materializes as the
 * empty string (legacy parity — `content` is NOT NULL on NoteNode).
 *
 * What this module owns:
 *   - The 2-row READ shape (`ItemsMetaNoteRow` / `NotesPayloadRow`).
 *   - The 2-row WRITE shape (no `parent_item_role` — generated stored).
 *   - SELECT column lists for items_meta (role=note) + notes_payload.
 *   - `rowsToNoteNode` / `noteNodeToRows` (INSERT) / `noteUpdatesToPatches`
 *     (UPDATE). All pure: zero `new Date()`, zero Supabase, zero I/O.
 *
 * What this module does NOT own:
 *   - The orphan-cleanup `try/catch` after a failed payload INSERT
 *     (SupabaseNotesUnifiedService.createNoteUnified responsibility).
 *   - The descendants-first hard-delete order for permanentDelete (Tauri
 *     parity now that the composite FK is `ON DELETE NO ACTION`).
 *   - The `items_meta.updated_at = now()` bump call itself — but this
 *     module's `noteUpdatesToPatches` ALWAYS emits the bump into
 *     `metaPatch.updated_at`, so the service cannot accidentally forget it.
 *
 * Carries NO `@supabase/supabase-js` dependency: tests run under plain
 * Node ESM. The 0008 + 0014 migrations are the SSOT for column types
 * and nullability — keep this file in lockstep with them.
 */

// ---------------------------------------------------------------------------
// 1. Row shapes (matches 0008 + 0014 schema verbatim)
// ---------------------------------------------------------------------------

/**
 * Row shape of `public.items_meta` for role='note'. `role` is a CHECK
 * column with 5 allowed values; this mapper is the Notes-only view, so
 * `role` is narrowed to the `'note'` literal. `user_id` is server-derived
 * (RLS default `auth.uid()`) and clients never write it.
 */
export interface ItemsMetaNoteRow {
  id: string;
  user_id: string;
  role: "note";
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Row shape of `public.notes_payload`. After 0014, `parent_item_role` is
 * a generated STORED column (`generated always as ('note')`); readable
 * via SELECT but PG rejects it from INSERT/UPDATE (SQLSTATE 42601). The
 * WRITE type below strips it.
 *
 * `content_json` is `jsonb` in the DB — represented here as `unknown`
 * (the mapper handles string↔object conversion at the NoteNode boundary).
 * `has_password` is a generated stored boolean; readable, never writable.
 * `password_hash` is intentionally absent from the SELECT shape — the
 * mapper does not select it (the raw hash never crosses the wire).
 */
export interface NotesPayloadRow {
  item_id: string;
  user_id: string;
  parent_item_id: string | null;
  /** Generated stored column (after 0014) — SELECT-only. */
  parent_item_role: "note";
  note_type: NoteNodeType | null;
  content_json: unknown;
  sort_order: number;
  is_pinned: boolean;
  is_edit_locked: boolean;
  color: string | null;
  icon: string | null;
  has_password: boolean;
}

/**
 * LIST-shape payload row (M1 perf): `NotesPayloadRow` without the heavy
 * `content_json` body. Materialised by the light list query
 * (`NOTES_PAYLOAD_LIST_COLUMNS`) and fed to `rowsToNoteNodeLite`.
 */
export type NotesPayloadListRow = Omit<NotesPayloadRow, "content_json">;

/**
 * Writable subset for INSERT on items_meta. `user_id` is the only
 * items_meta column the client supplies (RLS default would fill it, but
 * explicit is safer for cross-device parity); `created_at` / `updated_at`
 * are left to column DEFAULT `now()` on first INSERT.
 */
export type ItemsMetaNoteInsertRow = Omit<
  ItemsMetaNoteRow,
  "created_at" | "updated_at"
>;

/**
 * Writable subset for INSERT/UPDATE on notes_payload. After 0014,
 * `parent_item_role` is a generated stored column — keep it OFF the
 * write type by construction (type-level guard, not runtime check).
 * `has_password` is also generated — keep it off too. `password_hash` is
 * never set on this path (dedicated set/remove paths only — see the
 * legacy Notes mapper password contract).
 */
export type NotesPayloadWriteRow = Omit<
  NotesPayloadRow,
  "parent_item_role" | "has_password"
>;

/** UPDATE patch for items_meta. `id` / `user_id` / `role` / `created_at`
 * are never patched. `updated_at` is ALWAYS present (bump responsibility,
 * see `noteUpdatesToPatches`). */
export type ItemsMetaNoteUpdatePatch = Partial<
  Omit<ItemsMetaNoteRow, "id" | "user_id" | "role" | "created_at">
>;

/** UPDATE patch for notes_payload. `item_id` / `user_id` /
 * `parent_item_role` / `has_password` are never patched. */
export type NotesPayloadUpdatePatch = Partial<
  Omit<
    NotesPayloadRow,
    "item_id" | "user_id" | "parent_item_role" | "has_password"
  >
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists
// ---------------------------------------------------------------------------

/**
 * SELECT column list for `items_meta` rows of role='note'. The role filter
 * is the caller's responsibility (e.g. `.eq('role', 'note')`).
 */
export const ITEMS_META_NOTE_COLUMNS =
  "id, user_id, role, title, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

/**
 * SELECT column list for `notes_payload`. Includes `parent_item_role`
 * (generated column) so callers can verify the FK invariant; INSERT/UPDATE
 * paths must not include it (use `NotesPayloadWriteRow`). Includes
 * `has_password` (generated) but NEVER `password_hash` — the raw hash
 * stays in Postgres.
 */
export const NOTES_PAYLOAD_COLUMNS =
  "item_id, user_id, parent_item_id, parent_item_role, note_type, " +
  "content_json, sort_order, is_pinned, is_edit_locked, color, icon, " +
  "has_password";

/**
 * SELECT column list for `notes_payload` in LIST contexts (M1 perf). Same
 * columns as NOTES_PAYLOAD_COLUMNS MINUS the heavy `content_json` jsonb
 * body. The note LIST (listNotesUnified / fetchDeletedNotesUnified) never
 * renders the body — it is loaded on demand via getNoteUnified (which uses
 * the full NOTES_PAYLOAD_COLUMNS). Dropping content_json from the list
 * query keeps the initial per-user notes payload small no matter how large
 * individual TipTap documents grow. Callers pairing this column list with
 * `rowsToNoteNodeLite` materialise a NoteNode whose `content` is the empty
 * string (a "body not yet loaded" sentinel — NOT "the note is empty").
 */
export const NOTES_PAYLOAD_LIST_COLUMNS =
  "item_id, user_id, parent_item_id, parent_item_role, note_type, " +
  "sort_order, is_pinned, is_edit_locked, color, icon, has_password";

// ---------------------------------------------------------------------------
// 3. Runtime validators (defence-in-depth; CHECK constraints already enforce
//    these at the DB layer, but a corrupt/legacy row should fail loud).
// ---------------------------------------------------------------------------

const NOTE_TYPES: ReadonlySet<string> = new Set(["folder", "note"]);

/** Narrow a DB `note_type` value to the `NoteNodeType` union. A NULL
 * note_type defaults to "note" (legacy parity — same as the
 * retired legacy Notes mapper's toNoteNodeType). */
export function toNoteNodeType(value: string | null): NoteNodeType {
  if (value === null) return "note";
  if (NOTE_TYPES.has(value)) return value as NoteNodeType;
  throw new Error(
    `notes_payload: invalid note_type "${value}" (expected folder|note)`,
  );
}

// ---------------------------------------------------------------------------
// 4. Content (jsonb) <-> TipTap string conversion
// ---------------------------------------------------------------------------

/**
 * Materialize NoteNode.content (string) from notes_payload.content_json
 * (jsonb). NULL content_json -> empty string. Already-string jsonb values
 * (e.g. a primitive string stored at the top level) come back as-is to
 * preserve legacy data shapes; otherwise JSON.stringify the object.
 */
export function contentJsonToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * Project NoteNode.content (string) into notes_payload.content_json
 * (jsonb). Empty string -> null (so a fresh note doesn't store the JSON
 * literal `""`). Otherwise attempt JSON.parse; if parse fails, store the
 * raw string as a jsonb string literal (legacy safety — TipTap is the
 * normal producer, but ad-hoc free-text MUST not throw on write).
 */
export function contentStringToJson(value: string): unknown {
  if (value === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    // Fall back to a jsonb string literal so the column always accepts the
    // value. Round-trip via JSON.stringify+JSON.parse re-materialises the
    // same string on read.
    return value;
  }
}

// ---------------------------------------------------------------------------
// 5. SELECT: 2 rows -> NoteNode
// ---------------------------------------------------------------------------

/**
 * Materialise a domain NoteNode from one items_meta row (role='note') +
 * its matching notes_payload row. Optional NoteNode fields (deletedAt /
 * color / icon) are only set when the column is non-null/projected so
 * `noteNodeToRows ∘ rowsToNoteNode` round-trips without manufacturing
 * `undefined`-vs-absent differences.
 *
 * Naming mapping (TS camelCase <-> DB snake_case + 2-table split):
 *   meta.title           <- title
 *   meta.is_deleted      <- isDeleted
 *   meta.deleted_at      <- deletedAt
 *   meta.created_at      <- createdAt
 *   meta.updated_at      <- updatedAt
 *   payload.note_type    <- type
 *   payload.parent_item_id <- parentId
 *   payload.sort_order   <- order
 *   payload.content_json <- content (via JSON.stringify)
 *   payload.is_pinned    <- isPinned
 *   payload.is_edit_locked <- isEditLocked
 *   payload.has_password <- hasPassword
 *   payload.{color,icon} pass-through
 */
export function rowsToNoteNode(
  meta: ItemsMetaNoteRow,
  payload: NotesPayloadRow,
): NoteNode {
  if (meta.id !== payload.item_id) {
    throw new Error(
      `notesUnifiedMapper: row mismatch — meta.id="${meta.id}" but payload.item_id="${payload.item_id}"`,
    );
  }
  if (meta.role !== "note") {
    throw new Error(
      `notesUnifiedMapper: items_meta.role expected "note" but got "${meta.role}"`,
    );
  }

  const node: NoteNode = {
    id: meta.id,
    type: toNoteNodeType(payload.note_type),
    title: meta.title,
    content: contentJsonToString(payload.content_json),
    parentId: payload.parent_item_id,
    order: payload.sort_order,
    isPinned: payload.is_pinned,
    isDeleted: meta.is_deleted,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };

  node.hasPassword = payload.has_password;
  node.isEditLocked = payload.is_edit_locked;
  if (meta.deleted_at !== null) node.deletedAt = meta.deleted_at;
  if (payload.color !== null) node.color = payload.color;
  if (payload.icon !== null) node.icon = payload.icon;

  return node;
}

/**
 * LIST variant of `rowsToNoteNode` (M1 perf): materialise a NoteNode from a
 * light payload row that omits `content_json`. Every field maps identically
 * to `rowsToNoteNode`; the only difference is `content`, which is forced to
 * the empty string because the body was intentionally NOT selected by the
 * list query. Consumers MUST treat this `content` as "not yet loaded" and
 * hydrate via `getNoteUnified` before opening/editing the note — otherwise
 * an editor initialised from the empty body would overwrite the real one.
 */
export function rowsToNoteNodeLite(
  meta: ItemsMetaNoteRow,
  payload: NotesPayloadListRow,
): NoteNode {
  // Reuse the full mapper (id/role guard + all field mapping) by supplying a
  // null body, which `contentJsonToString` renders as the empty string.
  return rowsToNoteNode(meta, { ...payload, content_json: null });
}

// ---------------------------------------------------------------------------
// 6. INSERT: NoteNode -> { meta, payload }
// ---------------------------------------------------------------------------

/**
 * Project a NoteNode into the 2 INSERT rows. `created_at` / `updated_at`
 * are deliberately NOT included on the meta row — let the column DEFAULT
 * `now()` handle the first write. The payload row excludes
 * `parent_item_role` and `has_password` by type construction (generated
 * stored columns).
 *
 * Callers must INSERT items_meta first, then notes_payload (FK
 * `notes_payload.item_id -> items_meta.id` enforces this order). If the
 * payload INSERT fails, the caller must hard-delete the orphan
 * items_meta row (DU-B parity — R2 Recovery Playbook).
 */
export function noteNodeToRows(
  node: NoteNode,
  userId: string,
): { meta: ItemsMetaNoteInsertRow; payload: NotesPayloadWriteRow } {
  const meta: ItemsMetaNoteInsertRow = {
    id: node.id,
    user_id: userId,
    role: "note",
    title: node.title,
    is_deleted: node.isDeleted ?? false,
    deleted_at: node.deletedAt ?? null,
    version: 1,
  };

  const payload: NotesPayloadWriteRow = {
    item_id: node.id,
    user_id: userId,
    parent_item_id: node.parentId,
    note_type: node.type,
    content_json: contentStringToJson(node.content),
    sort_order: node.order,
    is_pinned: node.isPinned ?? false,
    is_edit_locked: node.isEditLocked ?? false,
    color: node.color ?? null,
    icon: node.icon ?? null,
  };

  return { meta, payload };
}

// ---------------------------------------------------------------------------
// 7. UPDATE: Partial<NoteNode> -> { metaPatch, payloadPatch }
// ---------------------------------------------------------------------------

/**
 * Build snake_case PATCH objects for items_meta + notes_payload from a
 * partial NoteNode update. Only keys explicitly present on `updates` are
 * emitted so a partial UPDATE never clobbers untouched columns. The legacy
 * `noteUpdatesToPatch` whitelist (title/content/isPinned/color/icon) is
 * widened here to also cover parentId / order / note_type / isEditLocked /
 * isDeleted — DU-D needs hierarchy operations that the legacy single-table
 * mapper did not.
 *
 * DB-Q2 contract — `metaPatch.updated_at = now` is ALWAYS set, regardless
 * of which payload columns the caller changed. Reason: Sync uses
 * `items_meta.updated_at` as its LWW cursor, and notes_payload has no own
 * `updated_at` column (single-owner via the 1:1 FK). Centralising the bump
 * here makes "forgot to bump" structurally impossible.
 *
 * `now` is injected (not `new Date().toISOString()`) so the mapper stays
 * pure / side-effect-free (testability + batch-consistent timestamps).
 */
export function noteUpdatesToPatches(
  updates: Partial<NoteNode>,
  userId: string,
  now: string,
): {
  metaPatch: ItemsMetaNoteUpdatePatch;
  payloadPatch: NotesPayloadUpdatePatch;
} {
  // -- meta side --
  const metaPatch: ItemsMetaNoteUpdatePatch = { updated_at: now };
  if ("title" in updates && updates.title !== undefined)
    metaPatch.title = updates.title;
  if ("isDeleted" in updates) metaPatch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) metaPatch.deleted_at = updates.deletedAt ?? null;

  // -- payload side --
  const payloadPatch: NotesPayloadUpdatePatch = {};
  void userId; // reserved for future identity bumps (parity with taskMapper)

  if ("type" in updates && updates.type !== undefined)
    payloadPatch.note_type = updates.type;
  if ("parentId" in updates)
    payloadPatch.parent_item_id = updates.parentId ?? null;
  if ("order" in updates && updates.order !== undefined)
    payloadPatch.sort_order = updates.order;
  if ("content" in updates && updates.content !== undefined)
    payloadPatch.content_json = contentStringToJson(updates.content);
  if ("isPinned" in updates && updates.isPinned !== undefined)
    payloadPatch.is_pinned = updates.isPinned;
  if ("isEditLocked" in updates && updates.isEditLocked !== undefined)
    payloadPatch.is_edit_locked = updates.isEditLocked;
  if ("color" in updates) payloadPatch.color = updates.color ?? null;
  if ("icon" in updates) payloadPatch.icon = updates.icon ?? null;

  return { metaPatch, payloadPatch };
}
