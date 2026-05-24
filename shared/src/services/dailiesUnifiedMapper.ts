import type { DailyNode } from "../types/daily";

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
 * Coexists with the legacy `dailyMapper.ts` (single-table). DU-F retires
 * the legacy mapper when frontend↔shared integration lands.
 *
 * PASSWORD CONTRACT (1:1 with legacy dailyMapper.ts): the raw
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
 * Row shape of `public.items_meta` for role='daily'. `role` narrowed to
 * the `'daily'` literal. `user_id` server-derived (RLS default).
 */
export interface ItemsMetaDailyRow {
  id: string;
  user_id: string;
  role: "daily";
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

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

/** Writable subset for INSERT on items_meta (role='daily'). */
export type ItemsMetaDailyInsertRow = Omit<
  ItemsMetaDailyRow,
  "created_at" | "updated_at"
>;

/** Writable subset for INSERT/UPSERT on dailies_payload. `has_password`
 * is generated — keep it off the write type. */
export type DailiesPayloadWriteRow = Omit<DailiesPayloadRow, "has_password">;

/** UPDATE patch for items_meta. `id` / `user_id` / `role` / `created_at`
 * are never patched. `updated_at` ALWAYS present. */
export type ItemsMetaDailyUpdatePatch = Partial<
  Omit<ItemsMetaDailyRow, "id" | "user_id" | "role" | "created_at">
>;

/** UPDATE patch for dailies_payload. `item_id` / `user_id` /
 * `has_password` are never patched (date typically not either, but allowed
 * for completeness). */
export type DailiesPayloadUpdatePatch = Partial<
  Omit<DailiesPayloadRow, "item_id" | "user_id" | "has_password">
>;

// ---------------------------------------------------------------------------
// 2. SELECT column lists
// ---------------------------------------------------------------------------

export const ITEMS_META_DAILY_COLUMNS =
  "id, user_id, role, title, is_deleted, deleted_at, " +
  "created_at, updated_at, version";

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
// 4. content_json <-> string (shared shape with notesUnifiedMapper)
// ---------------------------------------------------------------------------

export function contentJsonToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function contentStringToJson(value: string): unknown {
  if (value === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// 5. SELECT: 2 rows -> DailyNode
// ---------------------------------------------------------------------------

export function rowsToDailyNode(
  meta: ItemsMetaDailyRow,
  payload: DailiesPayloadRow,
): DailyNode {
  if (meta.id !== payload.item_id) {
    throw new Error(
      `dailiesUnifiedMapper: row mismatch — meta.id="${meta.id}" but payload.item_id="${payload.item_id}"`,
    );
  }
  if (meta.role !== "daily") {
    throw new Error(
      `dailiesUnifiedMapper: items_meta.role expected "daily" but got "${meta.role}"`,
    );
  }

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
  const meta: ItemsMetaDailyInsertRow = {
    id: assertDailyId(node.id),
    user_id: userId,
    role: "daily",
    // items_meta.title is NOT NULL; reuse the date string as the title
    // (legacy daily UI never displayed a separate title — the date IS the
    // identity). Avoids surfacing a synthetic empty string.
    title: node.date,
    is_deleted: node.isDeleted ?? false,
    deleted_at: node.deletedAt ?? null,
    version: 1,
  };

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
  const metaPatch: ItemsMetaDailyUpdatePatch = { updated_at: now };
  if ("date" in updates && updates.date !== undefined)
    metaPatch.title = updates.date;
  if ("isDeleted" in updates) metaPatch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) metaPatch.deleted_at = updates.deletedAt ?? null;

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
