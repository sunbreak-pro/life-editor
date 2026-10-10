import type { DailyNode } from "../types/daily";
import {
  ITEMS_META_COLUMNS,
  assertItemsMetaPair,
  toItemsMetaInsertRow,
  toItemsMetaPatch,
  type ItemsMetaRow,
  type ItemsMetaInsertRow,
  type ItemsMetaUpdatePatch,
  type ItemsMetaPatchInput,
} from "./itemsMeta";
import { contentJsonToString, contentStringToJson } from "./contentJson";

/*
 * Pure DailyNode <-> 2-row (items_meta + dailies_payload) mappers (DU-D Step 1).
 *
 * Historical context: DU-A migrated the legacy `public.dailies` single-table
 * shape (0004) into the unified items_meta (role discriminator) +
 * dailies_payload (per-role business columns) split (0008). Daily has no
 * parent/hierarchy concept (1 row per date), so DU-D Step 5
 * (0014_notes_payload_parent_fk.sql) does NOT touch dailies_payload — the
 * 0008 schema is still authoritative here.
 *
 * Replaced the legacy single-table Daily mapper, which was retired in
 * DU-G G4; this 2-row mapper is now the only Daily mapper.
 *
 * PASSWORD CONTRACT (1:1 with the retired legacy Daily mapper): the raw
 * `password_hash` column is NEVER selected back to the client. The domain
 * `DailyNode` exposes only `hasPassword` — a boolean served by the
 * `has_password` Postgres GENERATED column on `dailies_payload`
 * (`generated always as (password_hash is not null) stored`).
 *
 * CONTENT CONTRACT: `dailies_payload.content_json` is `jsonb`. DailyNode.
 * content is a TipTap-serialized JSON string. Same WRITE-parse / READ-
 * stringify policy as notesUnifiedMapper.ts.
 *
 * UNIQUE KEY: `dailies_payload.date` is UNIQUE (0008, DD-Q6). The domain
 * `id` follows the `daily-YYYY-MM-DD` shape (CLAUDE.md §4.3) but the DB
 * upsert key is `date`, not `id` — `upsertDailyByDateUnified` in the
 * service uses ON CONFLICT (date) DO UPDATE.
 */

// ---------------------------------------------------------------------------
// 1. Row shapes (matches 0008 schema verbatim)
// ---------------------------------------------------------------------------

/**
 * items_meta shapes for role='daily' — aliases of the canonical generics
 * in `itemsMeta` (the 5 role mappers carried byte-identical copies).
 */
export type ItemsMetaDailyRow = ItemsMetaRow<"daily">;
export type ItemsMetaDailyInsertRow = ItemsMetaInsertRow<"daily">;
export type ItemsMetaDailyUpdatePatch = ItemsMetaUpdatePatch;

/**
 * Row shape of `public.dailies_payload`. `has_password` is a generated
 * stored boolean — readable, never writable. `password_hash` intentionally
 * absent from the SELECT shape (mapper does not select it; raw hash never
 * crosses the wire).
 */
export interface DailiesPayloadRow {
  item_id: string;
  user_id: string;
  date: string;
  content_json: unknown;
  is_pinned: boolean;
  is_edit_locked: boolean;
  has_password: boolean;
  /** 0034 (#2107). Optional so row literals written before it still type. */
  evening_published_at?: string | null;
  /** 0034 (#2107): a jsonb object (CHECKed), or null. */
  evening_notes?: Record<string, string> | null;
  /**
   * 0035 (D-20261007-briefing-1): the morning comment. The DB only CHECKs
   * "null or an array", so the elements arrive unchecked — `unknown` until
   * `toMorningComment` has read it. READ-ONLY for the app: MCP
   * write_briefing is its only writer, so it is kept off both write types.
   */
  morning_comment?: unknown;
}

/** Writable subset for INSERT/UPSERT on dailies_payload. `has_password`
 * is generated and `morning_comment` belongs to MCP — keep both off the
 * write type. */
export type DailiesPayloadWriteRow = Omit<
  DailiesPayloadRow,
  "has_password" | "morning_comment"
>;

/** UPDATE patch for dailies_payload. `item_id` / `user_id` /
 * `has_password` / `morning_comment` are never patched (date typically not
 * either, but allowed for completeness). */
export type DailiesPayloadUpdatePatch = Partial<
  Omit<
    DailiesPayloadRow,
    "item_id" | "user_id" | "has_password" | "morning_comment"
  >
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists
// ---------------------------------------------------------------------------

/** Role-scoped alias of `ITEMS_META_COLUMNS` for Dailies call sites. */
export const ITEMS_META_DAILY_COLUMNS = ITEMS_META_COLUMNS;

export const DAILIES_PAYLOAD_COLUMNS =
  "item_id, user_id, date, content_json, is_pinned, is_edit_locked, " +
  "has_password, evening_published_at, evening_notes, morning_comment";

// ---------------------------------------------------------------------------
// 3. Id / date validators (defence-in-depth)
// ---------------------------------------------------------------------------

const DAILY_ID_RE = /^daily-\d{4}-\d{2}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertDailyId(value: string): string {
  if (DAILY_ID_RE.test(value)) return value;
  throw new Error(
    `dailiesUnifiedMapper: invalid id "${value}" (expected daily-YYYY-MM-DD)`,
  );
}

export function assertDailyDate(value: string): string {
  if (DATE_RE.test(value)) return value;
  throw new Error(
    `dailiesUnifiedMapper: invalid date "${value}" (expected YYYY-MM-DD)`,
  );
}

// ---------------------------------------------------------------------------
// 4. content_json <-> string — see `contentJson.ts` (one implementation,
//    shared with notesUnifiedMapper since #670 C3 PR 2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. SELECT: 2 rows -> DailyNode
// ---------------------------------------------------------------------------

export function rowsToDailyNode(
  meta: ItemsMetaDailyRow,
  payload: DailiesPayloadRow,
): DailyNode {
  assertItemsMetaPair("dailiesUnifiedMapper", "daily", meta, payload);

  const node: DailyNode = {
    id: assertDailyId(meta.id),
    date: assertDailyDate(payload.date),
    content: contentJsonToString(payload.content_json),
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };

  node.isPinned = payload.is_pinned;
  node.hasPassword = payload.has_password;
  node.isEditLocked = payload.is_edit_locked;
  node.isDeleted = meta.is_deleted;
  node.deletedAt = meta.deleted_at;
  node.eveningPublishedAt = payload.evening_published_at ?? null;
  node.eveningNotes = toEveningNotes(payload.evening_notes);
  node.morningComment = toMorningComment(payload.morning_comment);

  return node;
}

/**
 * The column is CHECKed as "null or an array" and nothing more, so a hand
 * edit could leave a number or a blank string in it. Each element is
 * trimmed, and the non-string and blank ones are dropped; a value with
 * nothing left reads as null, which sends the readers back to the body's 朝刊
 * section exactly as on a day the column never had. The same rule as
 * `normalizeMorningComment` (components/briefing/extractBriefing.ts) and MCP's
 * `morningCommentOf`, so every reader sees the same paragraphs.
 */
function toMorningComment(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const paragraphs: string[] = [];
  for (const p of value) {
    if (typeof p !== "string") continue;
    const text = p.trim();
    if (text !== "") paragraphs.push(text);
  }
  return paragraphs.length === 0 ? null : paragraphs;
}

/**
 * The DB only CHECKs that `evening_notes` is an object, so a value written by
 * hand (or a future writer) could carry a non-string. Only that entry is
 * dropped, not the whole map: the note writer saves the map it read back with
 * one key changed, so reading one bad value as "no notes" would erase every
 * other note on the next save (#2107 review).
 */
function toEveningNotes(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  );
  return entries.length === 0 ? null : Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// 6. INSERT: DailyNode -> { meta, payload }
// ---------------------------------------------------------------------------

/**
 * Project a DailyNode into the 2 INSERT rows. `created_at` / `updated_at`
 * are deliberately NOT included on the meta row — column DEFAULT `now()`
 * handles the first write. Callers must INSERT items_meta first, then
 * dailies_payload (FK `dailies_payload.item_id -> items_meta.id` enforces
 * this order). Failed payload INSERT requires orphan-cleanup on items_meta.
 */
export function dailyNodeToRows(
  node: DailyNode,
  userId: string,
): { meta: ItemsMetaDailyInsertRow; payload: DailiesPayloadWriteRow } {
  const meta: ItemsMetaDailyInsertRow = toItemsMetaInsertRow({
    id: assertDailyId(node.id),
    userId,
    role: "daily",
    // items_meta.title is NOT NULL; reuse the date string as the title
    // (legacy daily UI never displayed a separate title — the date IS the
    // identity). Avoids surfacing a synthetic empty string.
    title: node.date,
    isDeleted: node.isDeleted,
    deletedAt: node.deletedAt,
  });

  const payload: DailiesPayloadWriteRow = {
    item_id: assertDailyId(node.id),
    user_id: userId,
    date: assertDailyDate(node.date),
    content_json: contentStringToJson(node.content),
    is_pinned: node.isPinned ?? false,
    is_edit_locked: node.isEditLocked ?? false,
  };
  // Only when the node carries them: the columns default to NULL, and leaving
  // them off keeps the insert row of every existing caller unchanged.
  if (node.eveningPublishedAt !== undefined)
    payload.evening_published_at = node.eveningPublishedAt;
  if (node.eveningNotes !== undefined)
    payload.evening_notes = node.eveningNotes;
  // `morningComment` is never written from here (0035 — see the update
  // mapper below).

  return { meta, payload };
}

// ---------------------------------------------------------------------------
// 7. UPDATE: Partial<DailyNode> -> { metaPatch, payloadPatch }
// ---------------------------------------------------------------------------

/**
 * Build snake_case PATCH objects for items_meta + dailies_payload from a
 * partial DailyNode update. Only keys explicitly present on `updates` are
 * emitted. `metaPatch.updated_at` is ALWAYS set (LWW cursor for Sync).
 */
export function dailyUpdatesToPatches(
  updates: Partial<DailyNode>,
  userId: string,
  now: string,
): {
  metaPatch: ItemsMetaDailyUpdatePatch;
  payloadPatch: DailiesPayloadUpdatePatch;
} {
  // -- meta side --
  // DB-Q2's `updated_at` bump lives in `toItemsMetaPatch` (#890). Daily has
  // no title of its own — the date IS the identity, and items_meta.title
  // mirrors it (see `dailyNodeToRows`).
  const metaFields: ItemsMetaPatchInput = {};
  if ("date" in updates) metaFields.title = updates.date;
  if ("isDeleted" in updates) metaFields.isDeleted = updates.isDeleted;
  if ("deletedAt" in updates) metaFields.deletedAt = updates.deletedAt;
  const metaPatch: ItemsMetaDailyUpdatePatch = toItemsMetaPatch(
    metaFields,
    now,
  );

  // -- payload side --
  const payloadPatch: DailiesPayloadUpdatePatch = {};
  void userId;

  if ("date" in updates && updates.date !== undefined)
    payloadPatch.date = assertDailyDate(updates.date);
  if ("content" in updates && updates.content !== undefined)
    payloadPatch.content_json = contentStringToJson(updates.content);
  if ("isPinned" in updates && updates.isPinned !== undefined)
    payloadPatch.is_pinned = updates.isPinned;
  if ("isEditLocked" in updates && updates.isEditLocked !== undefined)
    payloadPatch.is_edit_locked = updates.isEditLocked;
  // #2107: null passes through on purpose — it is how a cleared star
  // unpublishes and how the last note is removed.
  if (
    "eveningPublishedAt" in updates &&
    updates.eveningPublishedAt !== undefined
  )
    payloadPatch.evening_published_at = updates.eveningPublishedAt;
  if ("eveningNotes" in updates && updates.eveningNotes !== undefined)
    payloadPatch.evening_notes = updates.eveningNotes;
  // 0035: `morningComment` is deliberately not mapped. The app never writes
  // the comment — MCP write_briefing is its only writer — so a node passed
  // back whole (with the comment it was read with) cannot overwrite a newer
  // comment Claude wrote since.

  return { metaPatch, payloadPatch };
}
