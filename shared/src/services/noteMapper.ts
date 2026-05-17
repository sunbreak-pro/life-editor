import type { NoteNode, NoteNodeType } from "../types/note";

/*
 * Pure NoteNode <-> `public.notes` row mappers (Phase 2 S3-2). Extracted
 * from SupabaseDataService for the same reason as taskMapper.ts /
 * dailyMapper.ts: NO `@supabase/supabase-js` / supabaseClient dependency,
 * so the round-trip harness stays runnable under plain Node ESM and the
 * field-by-field contract is isolated for review/testing.
 *
 * PASSWORD CONTRACT (carried 1:1 from the Tauri backend,
 * src-tauri/src/db/note_repository.rs): the raw `password_hash` column is
 * NEVER selected back to the client. The domain `NoteNode` exposes only
 * `hasPassword` — a boolean served by the `has_password` Postgres
 * GENERATED column (`generated always as (password_hash is not null)
 * stored`, see 0005_notes_full_schema.sql). It is a real, read-only column
 * so PostgREST can project it by plain name; PostgREST does NOT evaluate
 * raw SQL expressions in `select=` (the S2 recurrence-prevention learning:
 * an inline `password_hash is not null` alias produced a 400). `NoteRow`
 * therefore models the SELECTED shape: it includes `has_password` but
 * NEVER `password_hash`. (The plaintext-equality weakness of the
 * underlying column is pre-existing and out of S3 scope — Tauri parity
 * mandate, not a crypto redesign; keeping the hash off the wire is the
 * strongest mitigation available here.)
 */

/**
 * SELECTED row shape of `public.notes` (0005_notes_full_schema.sql).
 * snake_case, nullable where the column is nullable. `user_id` is
 * server-derived (RLS default `auth.uid()`) — clients never write it.
 * `has_password` IS a real column, but a read-only Postgres GENERATED one
 * (`generated always as (password_hash is not null) stored`): the client
 * reads it like any column yet can never write it and never sees the raw
 * `password_hash`. `version` is bumped by the data layer on every
 * mutation (LWW input), mirroring the SQLite `version = version + 1`.
 */
export interface NoteRow {
  id: string;
  user_id: string;
  type: string | null;
  title: string;
  content: string;
  parent_id: string | null;
  order: number;
  is_pinned: boolean;
  is_edit_locked: boolean;
  color: string | null;
  icon: string | null;
  has_password: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Writable subset of a row. Excludes:
 *   - `user_id`     — RLS derives it from the JWT (server-derived).
 *   - `has_password`— a read-only Postgres GENERATED column; Postgres
 *                     rejects a non-DEFAULT INSERT/UPSERT into it. The
 *                     password is mutated through the dedicated
 *                     set/remove paths writing `password_hash` directly.
 * Used for INSERT/UPSERT payloads.
 */
export type NoteWriteRow = Omit<NoteRow, "user_id" | "has_password">;

/**
 * Column list for SELECTs. `has_password` is the read-only Postgres
 * GENERATED column (`generated always as (password_hash is not null)
 * stored`) — selected by PLAIN NAME, never an inline SQL expression
 * (PostgREST does not evaluate expressions in `select=`; that produced a
 * `column ... does not exist` 400 — the S2 recurrence-prevention rule).
 * `password_hash` itself is never listed, so the raw value never crosses
 * the wire. `"order"` is quoted because it is a SQL reserved word (same
 * as TASK_COLUMNS). Any notes read path MUST use this exact list.
 */
export const NOTE_SELECT_COLUMNS =
  'id, user_id, type, title, content, parent_id, "order", is_pinned, ' +
  "is_edit_locked, color, icon, has_password, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

// --- Runtime validators (defence-in-depth; no `as` type lies) ---

const NOTE_TYPES: ReadonlySet<string> = new Set(["folder", "note"]);

/**
 * Narrow a DB `type` value to the `NoteNodeType` union. The 0005 CHECK
 * constraint (`type in ('folder','note')`) enforces this at the DB layer;
 * this is defence-in-depth so a corrupt/legacy row surfaces a clear error
 * instead of a silent type lie (mirrors taskMapper.toNodeType — a NULL
 * type defaults to "note", matching the Tauri repo
 * `unwrap_or_else(|| "note")`).
 */
export function toNoteNodeType(value: string | null): NoteNodeType {
  if (value === null) return "note";
  if (NOTE_TYPES.has(value)) return value as NoteNodeType;
  throw new Error(`notes: invalid type "${value}" (expected folder|note)`);
}

/**
 * DB row -> domain NoteNode. Optional NoteNode fields (deletedAt / color /
 * icon / hasPassword / isEditLocked) are only set when the column is
 * non-null/projected so `noteNodeToRow ∘ rowToNoteNode` round-trips
 * without manufacturing `undefined`-vs-absent differences. NOT-NULL
 * columns (title/content/order/is_pinned/is_deleted/timestamps) are
 * always materialised.
 */
export function rowToNoteNode(row: NoteRow): NoteNode {
  const node: NoteNode = {
    id: row.id,
    type: toNoteNodeType(row.type),
    title: row.title,
    content: row.content,
    parentId: row.parent_id,
    order: row.order,
    isPinned: row.is_pinned,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  node.hasPassword = row.has_password;
  node.isEditLocked = row.is_edit_locked;
  if (row.deleted_at !== null) node.deletedAt = row.deleted_at;
  if (row.color !== null) node.color = row.color;
  if (row.icon !== null) node.icon = row.icon;

  return node;
}

/**
 * Domain NoteNode -> full writable DB row (minus server-derived /
 * computed columns). Absent optional fields map to their column
 * null/default so an UPSERT fully specifies the row. `version` defaults
 * to 1; callers that bump it pass it through `noteUpdatesToPatch` or an
 * explicit field.
 */
export function noteNodeToRow(node: NoteNode): NoteWriteRow {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    content: node.content,
    parent_id: node.parentId,
    order: node.order,
    is_pinned: node.isPinned ?? false,
    is_edit_locked: node.isEditLocked ?? false,
    color: node.color ?? null,
    icon: node.icon ?? null,
    is_deleted: node.isDeleted ?? false,
    deleted_at: node.deletedAt ?? null,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    version: 1,
  };
}

/**
 * Build a snake_case patch from a partial NoteNode update. Mirrors the
 * Tauri `note_repository::update` whitelist EXACTLY: only
 * title/content/isPinned/color/icon are mutable through this path (the
 * Rust `update` ignores every other key). Only keys present on `updates`
 * are emitted so a partial update never clobbers untouched columns —
 * notably it never touches `password_hash` (set/remove paths only) so a
 * content save cannot null a password (partial-payload safety).
 */
export function noteUpdatesToPatch(
  updates: Partial<
    Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
  >,
): Partial<NoteWriteRow> {
  const patch: Partial<NoteWriteRow> = {};
  if ("title" in updates && updates.title !== undefined)
    patch.title = updates.title;
  if ("content" in updates && updates.content !== undefined)
    patch.content = updates.content;
  if ("isPinned" in updates && updates.isPinned !== undefined)
    patch.is_pinned = updates.isPinned;
  if ("color" in updates) patch.color = updates.color ?? null;
  if ("icon" in updates) patch.icon = updates.icon ?? null;
  return patch;
}
