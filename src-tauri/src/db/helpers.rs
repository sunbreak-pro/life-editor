use rusqlite::Connection;
use serde_json::Value;

use super::row_converter::row_to_json;

/// SQL expression for the current time in ISO 8601 with milliseconds.
/// Use this in raw SQL via `format!("... = {SQL_NOW_ISO} ...")` instead of
/// the legacy space-format `datetime('now')`. Mixing the two formats causes
/// the delta-sync cursor to freeze (Known Issue 013-A).
pub const SQL_NOW_ISO: &str = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/// Execute a soft-delete: set is_deleted=1, deleted_at=NOW, bump version
pub fn soft_delete(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<()> {
    let sql = format!(
        "UPDATE \"{table}\" SET is_deleted = 1, deleted_at = {SQL_NOW_ISO}, \
         version = version + 1, updated_at = {SQL_NOW_ISO} WHERE id = ?1"
    );
    conn.execute(&sql, [id])?;
    Ok(())
}

/// Restore from soft-delete
pub fn restore(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<()> {
    let sql = format!(
        "UPDATE \"{table}\" SET is_deleted = 0, deleted_at = NULL, \
         version = version + 1, updated_at = {SQL_NOW_ISO} WHERE id = ?1"
    );
    conn.execute(&sql, [id])?;
    Ok(())
}

/// Permanent delete (only if already soft-deleted)
pub fn permanent_delete(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<()> {
    let sql = format!(
        "DELETE FROM \"{table}\" WHERE id = ?1 AND is_deleted = 1"
    );
    conn.execute(&sql, [id])?;
    Ok(())
}

/// Permanent delete by arbitrary key column (e.g. "date" for memos)
pub fn permanent_delete_by_key(
    conn: &Connection,
    table: &str,
    key_col: &str,
    key_val: &str,
) -> rusqlite::Result<()> {
    let sql = format!(
        "DELETE FROM \"{table}\" WHERE \"{key_col}\" = ?1 AND is_deleted = 1"
    );
    conn.execute(&sql, [key_val])?;
    Ok(())
}

/// Soft-delete by arbitrary key column
pub fn soft_delete_by_key(
    conn: &Connection,
    table: &str,
    key_col: &str,
    key_val: &str,
) -> rusqlite::Result<()> {
    let sql = format!(
        "UPDATE \"{table}\" SET is_deleted = 1, deleted_at = {SQL_NOW_ISO} \
         WHERE \"{key_col}\" = ?1"
    );
    conn.execute(&sql, [key_val])?;
    Ok(())
}

/// Restore by arbitrary key column
pub fn restore_by_key(
    conn: &Connection,
    table: &str,
    key_col: &str,
    key_val: &str,
) -> rusqlite::Result<()> {
    let sql = format!(
        "UPDATE \"{table}\" SET is_deleted = 0, deleted_at = NULL \
         WHERE \"{key_col}\" = ?1"
    );
    conn.execute(&sql, [key_val])?;
    Ok(())
}

/// Execute an arbitrary SELECT and return all rows as JSON values
pub fn query_all_json(conn: &Connection, sql: &str) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(sql)?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap().to_string())
        .collect();

    let rows = stmt.query_map([], |row| {
        Ok(row_to_json(row, &col_names))
    })?;

    rows.collect()
}

/// Execute a parameterized SELECT and return all rows as JSON values
pub fn query_all_json_with_params(
    conn: &Connection,
    sql: &str,
    params: &[&dyn rusqlite::types::ToSql],
) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(sql)?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap().to_string())
        .collect();

    let rows = stmt.query_map(params, |row| Ok(row_to_json(row, &col_names)))?;

    rows.collect()
}

/// Execute an arbitrary SELECT and return the first row as JSON (or None)
pub fn query_one_json(conn: &Connection, sql: &str) -> rusqlite::Result<Option<Value>> {
    let mut stmt = conn.prepare(sql)?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap().to_string())
        .collect();

    let result = stmt.query_row([], |row| {
        Ok(row_to_json(row, &col_names))
    });

    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Get the next order value for a table.
///
/// SAFETY: `table` is interpolated into raw SQL. Callers MUST pass a static
/// table-name literal (or one sourced from a compile-time whitelist). All
/// existing call sites in `*_repository.rs` use static literals; never feed
/// this function an HTTP request body or any other untrusted string.
pub fn next_order(conn: &Connection, table: &str) -> rusqlite::Result<i64> {
    let sql = format!("SELECT COALESCE(MAX(\"order\"), -1) FROM \"{table}\"");
    let max: i64 = conn.query_row(&sql, [], |row| row.get(0))?;
    Ok(max + 1)
}

/// Current datetime as ISO string
pub fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// Generate UUID v4 string
pub fn new_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}
