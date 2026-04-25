/**
 * Sync route shared helpers.
 *
 * Pure utilities used by `/sync/full`, `/sync/changes`, `/sync/push`.
 * No side effects, no D1 access apart from statement building.
 */

/** Convert snake_case to camelCase (used as JSON keys in sync payloads). */
export function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Quote an identifier for raw SQL. Used only with whitelisted column names. */
export function quoteCol(c: string): string {
  return `"${c}"`;
}

/**
 * Build a `UPDATE <table> SET server_updated_at = ?1 WHERE <pk1> = ?2 [AND <pk2> = ?3 ...]`
 * statement.
 *
 * SAFETY: `table` and `pkCols` MUST come from `config/syncTables.ts` — never
 * from user input. They are interpolated directly into SQL because D1 does
 * not support binding identifiers.
 *
 * Stamping `server_updated_at` even when the LWW UPDATE above is a no-op is
 * the Known Issue #014 fix: delta cursor advances so the next /sync/changes
 * pulls the newest row back to the device whose push was rejected.
 */
export function buildStampStatement(
  db: D1Database,
  table: string,
  pkCols: string[],
  pkValues: unknown[],
  serverNow: string,
): D1PreparedStatement {
  const whereClause = pkCols
    .map((c, i) => `${quoteCol(c)} = ?${i + 2}`)
    .join(" AND ");
  return db
    .prepare(`UPDATE ${table} SET server_updated_at = ?1 WHERE ${whereClause}`)
    .bind(serverNow, ...pkValues);
}

/**
 * Topologically sort rows so that any row referenced by another row's
 * `parentCol` appears earlier in the returned array. Rows whose parent is
 * not in the input (orphans) or is null fall into the first group.
 *
 * Used for `tasks` push: a child row must be inserted after its parent,
 * otherwise SQLite's FK check fires on that statement.
 */
export function topoSortByParent(
  rows: Record<string, unknown>[],
  parentCol: string,
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const id = r.id as string | undefined;
    if (id) byId.set(id, r);
  }

  const visited = new Set<string>();
  const result: Record<string, unknown>[] = [];

  const visit = (row: Record<string, unknown>) => {
    const id = row.id as string | undefined;
    if (!id || visited.has(id)) return;
    visited.add(id);
    const parentId = row[parentCol] as string | null | undefined;
    if (parentId && byId.has(parentId) && !visited.has(parentId)) {
      visit(byId.get(parentId)!);
    }
    result.push(row);
  };

  for (const r of rows) visit(r);
  return result;
}
