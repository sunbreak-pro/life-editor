import type Database from "better-sqlite3";

/**
 * Creates prepared statements for the standard soft-delete pattern.
 * Returns { softDelete, restore, permanentDelete, fetchDeleted } statements.
 */
export function prepareSoftDeleteStatements(
  db: Database.Database,
  table: string,
  opts?: { keyColumn?: string; safePermanentDelete?: boolean },
) {
  const key = opts?.keyColumn ?? "id";
  const safe = opts?.safePermanentDelete ?? false;

  return {
    softDelete: db.prepare(
      `UPDATE ${table} SET is_deleted = 1, deleted_at = datetime('now'), version = version + 1, updated_at = datetime('now') WHERE ${key} = ?`,
    ),
    restore: db.prepare(
      `UPDATE ${table} SET is_deleted = 0, deleted_at = NULL, version = version + 1, updated_at = datetime('now') WHERE ${key} = ?`,
    ),
    permanentDelete: db.prepare(
      safe
        ? `DELETE FROM ${table} WHERE ${key} = ? AND is_deleted = 1`
        : `DELETE FROM ${table} WHERE ${key} = ?`,
    ),
    fetchDeleted: db.prepare(
      `SELECT * FROM ${table} WHERE is_deleted = 1 ORDER BY deleted_at DESC`,
    ),
  };
}
