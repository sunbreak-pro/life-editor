import type { DailyNode } from "../types/daily";

/*
 * Pure DailyNode <-> `public.dailies` row mappers. Extracted from
 * SupabaseDataService (same rationale as taskMapper.ts) so they carry NO
 * `@supabase/supabase-js` / supabaseClient dependency: the round-trip
 * harness stays runnable under plain Node ESM and the field-by-field
 * contract is isolated for review/testing.
 *
 * PASSWORD CONTRACT (carried 1:1 from the Tauri backend,
 * src-tauri/src/db/daily_repository.rs): the raw `password_hash` column
 * is NEVER selected back to the client. The domain `DailyNode` exposes
 * only `hasPassword` — a boolean the SELECT derives server-side via the
 * computed projection `password_hash is not null as has_password`. So
 * `DailyRow` intentionally has NO `password_hash` field: it models the
 * SELECTED shape, not the physical table. (The plaintext-equality
 * weakness of the underlying column is pre-existing and out of S2 scope;
 * keeping the hash off the wire is the strongest mitigation available
 * without a crypto redesign.)
 */

/**
 * SELECTED row shape of `public.dailies` (0004_dailies_full_schema.sql).
 * snake_case, nullable where the column is nullable. `user_id` is
 * server-derived (RLS default `auth.uid()`) — clients never write it.
 * `has_password` is NOT a stored column: it is the computed projection
 * `password_hash is not null` (see DAILY_SELECT_COLUMNS) so the raw hash
 * never leaves Postgres.
 */
export interface DailyRow {
  id: string;
  user_id: string;
  date: string;
  content: string;
  is_pinned: boolean;
  is_edit_locked: boolean;
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
 *   - `has_password`— a computed projection, not a real column; the
 *                     password is mutated through the dedicated
 *                     set/remove paths writing `password_hash` directly.
 * Used for INSERT/UPSERT payloads.
 */
export type DailyWriteRow = Omit<DailyRow, "user_id" | "has_password">;

/**
 * Column list for SELECTs. `password_hash` is projected ONLY as the
 * boolean `has_password` so the raw value never crosses the wire. Any
 * read path must use this exact list.
 */
export const DAILY_SELECT_COLUMNS =
  "id, user_id, date, content, is_pinned, is_edit_locked, " +
  "password_hash is not null as has_password, " +
  "is_deleted, deleted_at, created_at, updated_at, version";

// --- Runtime validators (defence-in-depth; no `as` type lies) ---

/**
 * Narrow a DB id to the `daily-<YYYY-MM-DD>` shape (CLAUDE.md §4.3). The
 * column is a free-form text PK at the DB layer; this surfaces a corrupt
 * / legacy row as a clear error instead of a silent contract break.
 */
const DAILY_ID_RE = /^daily-\d{4}-\d{2}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertDailyId(value: string): string {
  if (DAILY_ID_RE.test(value)) return value;
  throw new Error(`dailies: invalid id "${value}" (expected daily-YYYY-MM-DD)`);
}

export function assertDailyDate(value: string): string {
  if (DATE_RE.test(value)) return value;
  throw new Error(`dailies: invalid date "${value}" (expected YYYY-MM-DD)`);
}

/**
 * DB row -> domain DailyNode. Optional DailyNode fields are only set when
 * the column is non-null/non-default so `dailyNodeToRow ∘ rowToDailyNode`
 * round-trips without manufacturing `undefined`-vs-absent differences.
 * NOT-NULL columns (is_*, version) are always materialised.
 */
export function rowToDailyNode(row: DailyRow): DailyNode {
  const node: DailyNode = {
    id: assertDailyId(row.id),
    date: assertDailyDate(row.date),
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  node.isPinned = row.is_pinned;
  node.hasPassword = row.has_password;
  node.isEditLocked = row.is_edit_locked;
  node.isDeleted = row.is_deleted;
  node.deletedAt = row.deleted_at;

  return node;
}

/**
 * Domain DailyNode -> full writable DB row (minus server-derived /
 * computed columns). Absent optional fields map to their column
 * null/default so an UPSERT fully specifies the row. `version` defaults
 * to 1; callers that bump it pass it explicitly.
 */
export function dailyNodeToRow(node: DailyNode): DailyWriteRow {
  return {
    id: assertDailyId(node.id),
    date: assertDailyDate(node.date),
    content: node.content,
    is_pinned: node.isPinned ?? false,
    is_edit_locked: node.isEditLocked ?? false,
    is_deleted: node.isDeleted ?? false,
    deleted_at: node.deletedAt ?? null,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    version: 1,
  };
}
