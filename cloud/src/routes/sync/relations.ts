/**
 * Relation table sync handlers.
 *
 * Two sub-categories:
 *  - With `updated_at`: INSERT OR REPLACE + explicit server_updated_at stamp.
 *  - Without `updated_at`: INSERT OR REPLACE only, pulled by joining the
 *    parent's server_updated_at.
 *
 * SAFETY: every table name interpolated into raw SQL here is sourced from
 * `config/syncTables.ts`. Never accept a table name from the request body.
 */

import {
  RELATION_PARENT_JOINS,
  RELATION_PK_COLS,
  RELATION_TABLES_NO_UPDATED_AT,
  RELATION_TABLES_WITH_UPDATED_AT,
  TAG_DEFINITION_TABLES,
} from "../../config/syncTables";
import { buildStampStatement, quoteCol, toCamelCase } from "./shared";

/** Fetch all relation rows for /sync/full. */
export async function pullRelationsFull(
  db: D1Database,
): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const table of [
    ...RELATION_TABLES_WITH_UPDATED_AT,
    ...RELATION_TABLES_NO_UPDATED_AT,
  ]) {
    // SAFETY: table is whitelisted via RELATION_TABLES_*.
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    result[toCamelCase(table)] = results;
  }
  return result;
}

/**
 * Fetch delta relation rows for /sync/changes.
 *
 * - Tables with updated_at: server_updated_at cursor.
 * - Tables without updated_at: pulled via JOIN against their parent's
 *   server_updated_at — a version-LWW rejection on the parent (which still
 *   re-stamps server_updated_at) still flushes its relation rows.
 * - Tag definitions: fetched in full (small, rarely change).
 */
export async function pullRelationsDelta(
  db: D1Database,
  since: string,
): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {};

  for (const table of RELATION_TABLES_WITH_UPDATED_AT) {
    // SAFETY: table is whitelisted via RELATION_TABLES_WITH_UPDATED_AT.
    const { results } = await db
      .prepare(
        `SELECT * FROM ${table}
         WHERE datetime(server_updated_at) > datetime(?1)
         ORDER BY datetime(server_updated_at) ASC`,
      )
      .bind(since)
      .all();
    data[toCamelCase(table)] = results;
  }

  for (const join of RELATION_PARENT_JOINS) {
    // SAFETY: every identifier (table, parent, fk, parentPk) comes from
    // RELATION_PARENT_JOINS — a const literal in syncTables.ts.
    const { results } = await db
      .prepare(
        `SELECT child.* FROM ${join.table} AS child
         INNER JOIN ${join.parent} AS parent
           ON child.${quoteCol(join.fk)} = parent.${quoteCol(join.parentPk)}
         WHERE datetime(parent.server_updated_at) > datetime(?1)`,
      )
      .bind(since)
      .all();
    data[toCamelCase(join.table)] = results;
  }

  for (const table of TAG_DEFINITION_TABLES) {
    // SAFETY: table is whitelisted via TAG_DEFINITION_TABLES.
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    data[toCamelCase(table)] = results;
  }

  return data;
}

/**
 * Build batch statements for pushing relation rows in /sync/push.
 *
 * For tables with updated_at: INSERT OR REPLACE + stamp server_updated_at.
 * For tables without updated_at: INSERT OR REPLACE only.
 */
export function buildRelationsPushStatements(
  db: D1Database,
  body: Record<string, unknown[]>,
  serverNow: string,
): { statements: D1PreparedStatement[]; pushCount: number } {
  const statements: D1PreparedStatement[] = [];
  let pushCount = 0;

  for (const table of RELATION_TABLES_WITH_UPDATED_AT) {
    const camelKey = toCamelCase(table);
    const rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const pkCols = RELATION_PK_COLS[table];

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      // SAFETY: table from RELATION_TABLES_WITH_UPDATED_AT, columns are
      // record keys (quoted).
      const sql = `INSERT OR REPLACE INTO ${table} (${columns.map(quoteCol).join(", ")}) VALUES (${placeholders})`;
      statements.push(db.prepare(sql).bind(...values));

      const pkValues = pkCols.map((col) => record[col]);
      statements.push(
        buildStampStatement(db, table, pkCols, pkValues, serverNow),
      );
      pushCount++;
    }
  }

  for (const table of RELATION_TABLES_NO_UPDATED_AT) {
    const camelKey = toCamelCase(table);
    const rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      // SAFETY: table from RELATION_TABLES_NO_UPDATED_AT.
      const sql = `INSERT OR REPLACE INTO ${table} (${columns.map(quoteCol).join(", ")}) VALUES (${placeholders})`;
      statements.push(db.prepare(sql).bind(...values));
      pushCount++;
    }
  }

  return { statements, pushCount };
}
