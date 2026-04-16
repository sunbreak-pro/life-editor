use rusqlite::Connection;
use rusqlite::types::ValueRef;
use serde_json::Value;

/// Execute a soft-delete: set is_deleted=1, deleted_at=NOW, bump version
pub fn soft_delete(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<()> {
    let sql = format!(
        "UPDATE \"{table}\" SET is_deleted = 1, deleted_at = datetime('now'), \
         version = version + 1, updated_at = datetime('now') WHERE id = ?1"
    );
    conn.execute(&sql, [id])?;
    Ok(())
}

/// Restore from soft-delete
pub fn restore(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<()> {
    let sql = format!(
        "UPDATE \"{table}\" SET is_deleted = 0, deleted_at = NULL, \
         version = version + 1, updated_at = datetime('now') WHERE id = ?1"
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
        "UPDATE \"{table}\" SET is_deleted = 1, deleted_at = datetime('now') \
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

/// Fetch all soft-deleted rows (returns raw JSON values)
pub fn fetch_deleted_json(conn: &Connection, table: &str) -> rusqlite::Result<Vec<Value>> {
    let sql = format!(
        "SELECT * FROM \"{table}\" WHERE is_deleted = 1 ORDER BY deleted_at DESC"
    );
    query_all_json(conn, &sql)
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

/// Convert a single database row to a JSON Value using column names
fn row_to_json(row: &rusqlite::Row, col_names: &[String]) -> Value {
    let mut map = serde_json::Map::new();
    for (i, name) in col_names.iter().enumerate() {
        let val = match row.get_ref(i) {
            Ok(ValueRef::Null) => Value::Null,
            Ok(ValueRef::Integer(n)) => Value::from(n),
            Ok(ValueRef::Real(f)) => Value::from(f),
            Ok(ValueRef::Text(s)) => {
                Value::String(String::from_utf8_lossy(s).to_string())
            }
            Ok(ValueRef::Blob(_)) => Value::Null,
            Err(_) => Value::Null,
        };
        map.insert(name.clone(), val);
    }
    Value::Object(map)
}

/// Get the next order value for a table
pub fn next_order(conn: &Connection, table: &str) -> rusqlite::Result<i64> {
    let sql = format!("SELECT COALESCE(MAX(\"order\"), -1) FROM \"{table}\"");
    let max: i64 = conn.query_row(&sql, [], |row| row.get(0))?;
    Ok(max + 1)
}

/// Get the next order_index value for a table
pub fn next_order_index(conn: &Connection, table: &str) -> rusqlite::Result<i64> {
    let sql = format!("SELECT COALESCE(MAX(order_index), -1) FROM \"{table}\"");
    let max: i64 = conn.query_row(&sql, [], |row| row.get(0))?;
    Ok(max + 1)
}

/// Get the next sort_order value for a table
pub fn next_sort_order(conn: &Connection, table: &str) -> rusqlite::Result<i64> {
    let sql = format!("SELECT COALESCE(MAX(sort_order), -1) FROM \"{table}\"");
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
