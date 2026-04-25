//! Row → `serde_json::Value` conversion shared by the dynamic SELECT paths.
//!
//! Static-typed repository queries use `serde_rusqlite` or hand-rolled
//! `From<&Row>` impls. This converter is for the column-agnostic call sites
//! (the generic `helpers::query_all_json` family and the sync engine's
//! `query_changed` / `collect_all`) where the schema isn't statically known
//! and rows must round-trip through JSON for the IPC / sync payload.

use rusqlite::Row;
use rusqlite::types::ValueRef;
use serde_json::Value;

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
