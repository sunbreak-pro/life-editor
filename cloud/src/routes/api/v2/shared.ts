/**
 * Shared helpers for /api/v2/* (server-authoritative API).
 *
 * v2 differs from v1 (/sync/*) in three ways:
 *   1. Worker is the single writer — clients send payloads, Worker assigns
 *      `version` and `server_updated_at`. No bidirectional LWW.
 *   2. Per-row mutation API instead of batch push, so conflicts surface
 *      synchronously as 409 to the calling client.
 *   3. `next_cursor` is always returned (Known Issue #012 fix).
 *
 * SAFETY: every table identifier interpolated into raw SQL is validated against
 * the allowlist below. Never accept `<table>` from a request without validation.
 */

import {
  PRIMARY_KEYS,
  RELATION_PK_COLS,
  RELATION_TABLES_WITH_UPDATED_AT,
  VERSIONED_TABLES,
  type RelationTableWithUpdatedAt,
  type VersionedTable,
} from "../../../config/syncTables";

export type V2Table = VersionedTable | RelationTableWithUpdatedAt;

const VERSIONED_SET = new Set<string>(VERSIONED_TABLES);
const RELATION_SET = new Set<string>(RELATION_TABLES_WITH_UPDATED_AT);

/**
 * Validate that `<table>` from a request path is a known sync table.
 * Returns the strongly-typed table name on success, or null if unknown.
 */
export function validateTable(table: string): V2Table | null {
  if (VERSIONED_SET.has(table)) return table as VersionedTable;
  if (RELATION_SET.has(table)) return table as RelationTableWithUpdatedAt;
  return null;
}

/** Whether the given table uses `version` + `is_deleted` (versioned semantics). */
export function isVersioned(table: V2Table): table is VersionedTable {
  return VERSIONED_SET.has(table);
}

/** PK column(s) for the given table. */
export function getPkCols(table: V2Table): string[] {
  if (isVersioned(table)) return [PRIMARY_KEYS[table]];
  return RELATION_PK_COLS[table as RelationTableWithUpdatedAt];
}

/** Quote an identifier for raw SQL. Used only with whitelisted column names. */
export function quoteCol(c: string): string {
  return `"${c}"`;
}

/** ISO 8601 with milliseconds, matches Desktop `helpers::now()` format. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Convert snake_case to camelCase (matches v1 payload conventions). */
export function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
