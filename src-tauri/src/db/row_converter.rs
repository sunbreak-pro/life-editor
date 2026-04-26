//! Row conversion utilities.
//!
//! Two distinct concerns live here:
//!
//! 1. `row_to_json` — column-agnostic conversion used by the dynamic SELECT
//!    paths (`helpers::query_all_json`, sync engine's `query_changed` /
//!    `collect_all`) where the schema isn't statically known.
//! 2. `FromRow` trait + `query_all` / `query_one` helpers — typed conversion
//!    used by repositories. Each model implements `FromRow` once; repositories
//!    call `T::from_row(row)` instead of duplicating per-table `row_to_X` free
//!    functions, and use the helpers to remove the `prepare → query_map →
//!    collect` boilerplate that recurs in every fetch.

use rusqlite::Row;
use rusqlite::types::ValueRef;
use rusqlite::{Connection, Params};
use serde_json::Value;

/// Convert a single typed SQLite row to a domain model.
///
/// Repositories implement this once per model; call sites use `T::from_row(row)`
/// directly or via the `query_all` / `query_one` helpers below.
pub trait FromRow: Sized {
    fn from_row(row: &Row) -> rusqlite::Result<Self>;
}

/// Run a parameterized query and collect every row into `Vec<T>`.
///
/// Replaces the recurring boilerplate:
/// ```ignore
/// let mut stmt = conn.prepare(sql)?;
/// let rows = stmt.query_map(params, |row| row_to_x(row))?;
/// rows.collect()
/// ```
pub fn query_all<T: FromRow, P: Params>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> rusqlite::Result<Vec<T>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params, |row| T::from_row(row))?;
    rows.collect()
}

/// Run a parameterized query expecting exactly one row.
///
/// Returns `Err(QueryReturnedNoRows)` if no row matches; callers that need
/// `Option<T>` should map that variant explicitly.
pub fn query_one<T: FromRow, P: Params>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> rusqlite::Result<T> {
    let mut stmt = conn.prepare(sql)?;
    stmt.query_row(params, |row| T::from_row(row))
}

/// Convert a single SQLite row to a JSON object keyed by `col_names`.
///
/// Behaviour:
/// - NULL → `Value::Null`
/// - INTEGER → `Value::Number`
/// - REAL → `Value::Number`
/// - TEXT → `Value::String` (lossy UTF-8 — invalid sequences become U+FFFD)
/// - BLOB → `Value::Null` (sync payloads are JSON; binary columns are not
///   currently transported, and silently dropping them is preferred over
///   double-base64ing or failing the row)
/// - Read errors → `Value::Null` (preserves row shape for downstream
///   serializers; a missing column shows up as null rather than aborting
///   the whole batch)
///
/// `col_names` length must match the row's column count; mismatches result
/// in either truncation or a panic on `row.get_ref(i)`. Callers should
/// derive `col_names` from `stmt.column_count()` / `stmt.column_name(i)`
/// on the same statement.
pub fn row_to_json(row: &Row, col_names: &[String]) -> Value {
    let mut map = serde_json::Map::with_capacity(col_names.len());
    for (i, name) in col_names.iter().enumerate() {
        let val = match row.get_ref(i) {
            Ok(ValueRef::Null) => Value::Null,
            Ok(ValueRef::Integer(n)) => Value::from(n),
            Ok(ValueRef::Real(f)) => Value::from(f),
            Ok(ValueRef::Text(s)) => Value::String(String::from_utf8_lossy(s).to_string()),
            Ok(ValueRef::Blob(_)) => Value::Null,
            Err(_) => Value::Null,
        };
        map.insert(name.clone(), val);
    }
    Value::Object(map)
}
