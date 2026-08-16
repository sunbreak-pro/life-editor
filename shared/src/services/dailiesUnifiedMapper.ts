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
}

/** Writable subset for INSERT/UPSERT on dailies_payload. `has_password`
 * is generated — keep it off the write type. */
export type DailiesPayloadWriteRow = Omit<DailiesPayloadRow, "has_password">;

/** UPDATE patch for dailies_payload. `item_id` / `user_id` /
 * `has_password` are never patched (date typically not either, but allowed
 * for completeness). */
export type DailiesPayloadUpdatePatch = Partial<
  Omit<DailiesPayloadRow, "item_id" | "user_id" | "has_password">
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists
// ---------------------------------------------------------------------------

/** Role-scoped alias of `ITEMS_META_COLUMNS` for Dailies call sites. */
export const ITEMS_META_DAILY_COLUMNS = ITEMS_META_COLUMNS;

export const DAILIES_PAYLOAD_COLUMNS =
  "item_id, user_id, date, content_json, is_pinned, is_edit_locked, " +
  "has_password";

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

  return node;
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

  return { metaPatch, payloadPatch };
}
