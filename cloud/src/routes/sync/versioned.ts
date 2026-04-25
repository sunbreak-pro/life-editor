/**
 * Versioned table sync handlers.
 *
 * Versioned tables carry `version` + `updated_at` + `server_updated_at` and
 * use the LWW upsert: INSERT ... ON CONFLICT(pk) ... WHERE excluded.version > current.version.
 *
 * SAFETY: every table name interpolated into raw SQL here is sourced from
 * `config/syncTables.ts::VERSIONED_TABLES`. Never accept a table name from
 * the request body.
 */

import {
  PRIMARY_KEYS,
  SYNC_PAGE_SIZE,
  VERSIONED_TABLES,
  type VersionedTable,
} from "../../config/syncTables";
import {
  buildStampStatement,
  quoteCol,
  toCamelCase,
  topoSortByParent,
} from "./shared";

/** Result of a single-table delta query. */
interface DeltaResult {
  rows: unknown[];
  hasMore: boolean;
}

/** Fetch all rows for /sync/full. */
export async function pullVersionedFull(
  db: D1Database,
): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const table of VERSIONED_TABLES) {
    // SAFETY: table is whitelisted via VERSIONED_TABLES.
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    result[toCamelCase(table)] = results;
  }
  return result;
}

/**
 * Fetch delta rows for /sync/changes since the cursor.
 *
 * Cursor is `server_updated_at` (Known Issue #014). datetime() wrap normalises
 * ISO 8601 ("2026-04-23T12:42:12.496Z") vs SQLite default ("2026-04-23 12:37:31")
 * formats — raw string comparison puts space (0x20) < T (0x54), so without
 * normalisation a since=ISO would never match space-formatted rows.
 *
 * Returns `hasMore: true` when any single table reaches SYNC_PAGE_SIZE so the
 * client can decide to drop into a paginated catch-up. Note: Known Issue #012
 * — the Rust client currently ignores `hasMore`; SYNC_PAGE_SIZE is sized to
 * cover all current data while pagination is unimplemented.
 */
export async function pullVersionedDelta(
  db: D1Database,
  since: string,
): Promise<{ data: Record<string, unknown[]>; hasMore: boolean }> {
  const data: Record<string, unknown[]> = {};
  let hasMore = false;

  for (const table of VERSIONED_TABLES) {
    // SAFETY: table is whitelisted via VERSIONED_TABLES.
    const { results } = await db
      .prepare(
        `SELECT * FROM ${table}
         WHERE datetime(server_updated_at) > datetime(?1)
         ORDER BY datetime(server_updated_at) ASC
         LIMIT ?2`,
      )
      .bind(since, SYNC_PAGE_SIZE + 1)
      .all();

    if (results.length > SYNC_PAGE_SIZE) {
      hasMore = true;
      data[toCamelCase(table)] = results.slice(0, SYNC_PAGE_SIZE);
    } else {
      data[toCamelCase(table)] = results;
    }
  }

  return { data, hasMore };
}

/**
 * Build batch statements for pushing versioned-table rows in /sync/push.
 *
 * For each row:
 *   1. INSERT ... ON CONFLICT(pk) DO UPDATE ... WHERE excluded.version > current.version
 *   2. UPDATE ... SET server_updated_at = serverNow WHERE pk = ?
 *      (Known Issue #014: stamp even when LWW UPDATE is a no-op so /sync/changes
 *       still surfaces the row to the device whose push was rejected.)
 *
 * Special-case rows are normalised before statement building:
 *  - tasks: topologically sorted so parents precede children within the batch
 *    (defer_foreign_keys handles cross-table refs but in-table self-reference
 *    is still validated per-statement on some D1 versions).
 *  - schedule_items: routine rows are deduplicated against existing canonical
 *    (routine_id, date) rows in D1 — see Known Issue #011.
 */
export async function buildVersionedPushStatements(
  db: D1Database,
  body: Record<string, unknown[]>,
  serverNow: string,
): Promise<{ statements: D1PreparedStatement[]; pushCount: number }> {
  const statements: D1PreparedStatement[] = [];
  let pushCount = 0;

  for (const table of VERSIONED_TABLES) {
    const camelKey = toCamelCase(table);
    let rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    if (table === "tasks") {
      rows = topoSortByParent(rows as Record<string, unknown>[], "parent_id");
    }

    if (table === "schedule_items") {
      rows = await dedupeScheduleItemRoutines(
        db,
        rows as Record<string, unknown>[],
      );
    }

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const pk = PRIMARY_KEYS[table];
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      const updateCols = columns.filter((col) => col !== pk);
      const setClauses = updateCols
        .map((col) => `${quoteCol(col)} = excluded.${quoteCol(col)}`)
        .join(", ");

      // SAFETY: table from VERSIONED_TABLES, pk from PRIMARY_KEYS, columns
      // from row keys (quoted).
      const sql = `INSERT INTO ${table} (${columns.map(quoteCol).join(", ")})
        VALUES (${placeholders})
        ON CONFLICT(${quoteCol(pk)}) DO UPDATE SET ${setClauses}
        WHERE excluded.version > ${table}.version OR ${table}.version IS NULL`;

      statements.push(db.prepare(sql).bind(...values));
      statements.push(
        buildStampStatement(db, table, [pk], [record[pk]], serverNow),
      );
      pushCount++;
    }
  }

  return { statements, pushCount };
}

/**
 * Drop schedule_items routine rows that conflict with an existing canonical
 * (routine_id, date) row in D1.
 *
 * Different devices may push rows with different ids for the same
 * (routine_id, date) pair; accepting all of them accumulates duplicates
 * (Known Issue #011). The existing D1 row wins; incoming rows whose id
 * differs from the canonical existing id are dropped.
 */
async function dedupeScheduleItemRoutines(
  db: D1Database,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const isRoutineRow = (r: Record<string, unknown>): boolean =>
    r.routine_id !== null &&
    r.routine_id !== undefined &&
    r.routine_id !== "" &&
    Number(r.is_deleted ?? 0) === 0;

  const routineRows = rows.filter(isRoutineRow);
  if (routineRows.length === 0) return rows;

  const keepIds = new Set<string>(
    rows.filter((r) => !isRoutineRow(r)).map((r) => String(r.id)),
  );

  const pairs = Array.from(
    new Set(routineRows.map((r) => `${r.routine_id}|${r.date}`)),
  );
  for (const pair of pairs) {
    const [rid, d] = pair.split("|");
    const existing = await db
      .prepare(
        `SELECT id FROM schedule_items
         WHERE routine_id = ?1 AND date = ?2 AND is_deleted = 0
         LIMIT 1`,
      )
      .bind(rid, d)
      .first<{ id: string }>();
    const incoming = routineRows.filter(
      (r) => r.routine_id === rid && r.date === d,
    );
    if (existing) {
      for (const r of incoming) {
        if (r.id === existing.id) keepIds.add(String(r.id));
      }
    } else {
      const first = incoming[0];
      if (first) keepIds.add(String(first.id));
    }
  }

  return rows.filter((r) => keepIds.has(String(r.id)));
}

// Re-export for downstream usage
export type { DeltaResult, VersionedTable };
