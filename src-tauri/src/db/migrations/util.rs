//! Migration helpers shared across the version-range modules.

use rusqlite::Connection;

/// Execute a SQL statement, ignoring errors. Used for ALTER TABLE ADD COLUMN
/// which fails if the column already exists.
pub(super) fn exec_ignore(conn: &Connection, sql: &str) {
    let _ = conn.execute_batch(sql);
}

/// Check if a column exists in a table.
pub(super) fn has_column(conn: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&sql).unwrap();
    let rows = stmt.query_map([], |row| row.get::<_, String>(1)).unwrap();
    for name in rows {
        if let Ok(name) = name {
            if name == column {
                return true;
            }
        }
    }
    false
}

/// Check if a table exists in the database.
pub(super) fn has_table(conn: &Connection, table: &str) -> bool {
    let mut stmt = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?1 LIMIT 1")
        .unwrap();
    stmt.query_row([table], |_| Ok(())).is_ok()
}
