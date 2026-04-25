use rusqlite::Connection;
use serde_json::Value;

use super::types::SyncPayload;
use crate::db::helpers;
use crate::db::row_converter::row_to_json;

/// Versioned tables: have `version`, `updated_at` columns.
const VERSIONED_TABLES: &[(&str, &str)] = &[
    ("tasks", "id"),
    ("dailies", "id"),
    ("notes", "id"),
    ("schedule_items", "id"),
    ("routines", "id"),
    ("wiki_tags", "id"),
    ("time_memos", "id"),
    ("calendars", "id"),
    ("templates", "id"),
    ("routine_groups", "id"),
];

/// Relation tables that have `updated_at`.
const RELATION_TABLES_WITH_UPDATED_AT: &[&str] = &[
    "wiki_tag_assignments",
    "wiki_tag_connections",
    "note_connections",
];

// ---------------------------------------------------------------------------
// Collect local changes since a given timestamp
// ---------------------------------------------------------------------------

pub fn collect_local_changes(
    conn: &Connection,
    since: &str,
) -> Result<SyncPayload, rusqlite::Error> {
    let mut payload = SyncPayload::default();

    // Versioned tables
    payload.tasks = query_changed(conn, "tasks", since)?;
    payload.dailies = query_changed(conn, "dailies", since)?;
    payload.notes = query_changed(conn, "notes", since)?;
    payload.schedule_items = query_changed(conn, "schedule_items", since)?;
    payload.routines = query_changed(conn, "routines", since)?;
    payload.wiki_tags = query_changed(conn, "wiki_tags", since)?;
    payload.time_memos = query_changed(conn, "time_memos", since)?;
    payload.calendars = query_changed(conn, "calendars", since)?;
    payload.templates = query_changed(conn, "templates", since)?;
    payload.routine_groups = query_changed(conn, "routine_groups", since)?;

    // Relation tables with updated_at
    payload.wiki_tag_assignments = query_changed(conn, "wiki_tag_assignments", since)?;
    payload.wiki_tag_connections = query_changed(conn, "wiki_tag_connections", since)?;
    payload.note_connections = query_changed(conn, "note_connections", since)?;

    // Relation tables without updated_at: fetch via parent join.
    // datetime() wrap mirrors query_changed's normalization (ISO vs space formats).
    payload.calendar_tag_assignments = helpers::query_all_json_with_params(
        conn,
        "SELECT cta.* FROM calendar_tag_assignments cta \
         INNER JOIN schedule_items si ON cta.schedule_item_id = si.id \
         WHERE datetime(si.updated_at) > datetime(?1)",
        &[&since],
    )?;
    payload.routine_tag_assignments = helpers::query_all_json_with_params(
        conn,
        "SELECT rta.* FROM routine_tag_assignments rta \
         INNER JOIN routines r ON rta.routine_id = r.id \
         WHERE datetime(r.updated_at) > datetime(?1)",
        &[&since],
    )?;
    payload.routine_group_tag_assignments = helpers::query_all_json_with_params(
        conn,
        "SELECT rgta.* FROM routine_group_tag_assignments rgta \
         INNER JOIN routine_groups rg ON rgta.group_id = rg.id \
         WHERE datetime(rg.updated_at) > datetime(?1)",
        &[&since],
    )?;

    // Tag definitions: always include all (small tables)
    payload.routine_tag_definitions =
        helpers::query_all_json(conn, "SELECT * FROM routine_tag_definitions")?;
    payload.calendar_tag_definitions =
        helpers::query_all_json(conn, "SELECT * FROM calendar_tag_definitions")?;

    Ok(payload)
}

/// Collect ALL local data (for initial full push).
pub fn collect_all(conn: &Connection) -> Result<SyncPayload, rusqlite::Error> {
    let mut payload = SyncPayload::default();

    for &(table, _) in VERSIONED_TABLES {
        // SAFETY: `table` is iterated from the const VERSIONED_TABLES slice
        // (file-top), never from caller input. Identifier interpolation into
        // SQL is safe.
        let rows =
            helpers::query_all_json(conn, &format!("SELECT * FROM \"{table}\""))?;
        set_payload_field(&mut payload, table, rows);
    }

    for &table in RELATION_TABLES_WITH_UPDATED_AT {
        // SAFETY: `table` is iterated from the const RELATION_TABLES_WITH_UPDATED_AT
        // slice (file-top). Same justification as above.
        let rows =
            helpers::query_all_json(conn, &format!("SELECT * FROM \"{table}\""))?;
        set_payload_field(&mut payload, table, rows);
    }

    payload.calendar_tag_assignments =
        helpers::query_all_json(conn, "SELECT * FROM calendar_tag_assignments")?;
    payload.routine_tag_assignments =
        helpers::query_all_json(conn, "SELECT * FROM routine_tag_assignments")?;
    payload.routine_group_tag_assignments =
        helpers::query_all_json(conn, "SELECT * FROM routine_group_tag_assignments")?;
    payload.routine_tag_definitions =
        helpers::query_all_json(conn, "SELECT * FROM routine_tag_definitions")?;
    payload.calendar_tag_definitions =
        helpers::query_all_json(conn, "SELECT * FROM calendar_tag_definitions")?;

    Ok(payload)
}

// ---------------------------------------------------------------------------
// Apply remote changes to local database
// ---------------------------------------------------------------------------

pub fn apply_remote_changes(
    conn: &Connection,
    payload: &SyncPayload,
) -> Result<usize, rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch("PRAGMA defer_foreign_keys = ON")?;

    let mut applied = 0;

    // Versioned tables: UPSERT with version check
    for &(table, pk) in VERSIONED_TABLES {
        let rows = get_payload_field(payload, table);
        applied += upsert_versioned(&tx, table, pk, rows)?;
    }

    // Relation tables with updated_at: INSERT OR REPLACE
    for &table in RELATION_TABLES_WITH_UPDATED_AT {
        let rows = get_payload_field(payload, table);
        applied += insert_or_replace(&tx, table, rows)?;
    }

    // Relation tables without updated_at: INSERT OR REPLACE
    applied += insert_or_replace(&tx, "calendar_tag_assignments", &payload.calendar_tag_assignments)?;
    applied += insert_or_replace(&tx, "routine_tag_assignments", &payload.routine_tag_assignments)?;
    applied += insert_or_replace(&tx, "routine_group_tag_assignments", &payload.routine_group_tag_assignments)?;
    applied += insert_or_replace(&tx, "routine_tag_definitions", &payload.routine_tag_definitions)?;
    applied += insert_or_replace(&tx, "calendar_tag_definitions", &payload.calendar_tag_definitions)?;

    tx.commit()?;
    Ok(applied)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn query_changed(
    conn: &Connection,
    table: &str,
    since: &str,
) -> Result<Vec<Value>, rusqlite::Error> {
    // Use datetime() to normalize both ISO 8601 ("2026-04-23T12:42:12.496Z")
    // and SQLite default ("2026-04-23 12:37:31") formats. Without this wrap,
    // raw string comparison treats space (0x20) < T (0x54), so space-formatted
    // rows on the same date as an ISO-formatted `since` never satisfy `>`.
    let sql = format!(
        "SELECT * FROM \"{table}\" WHERE datetime(updated_at) > datetime(?1) \
         ORDER BY datetime(updated_at) ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap().to_string())
        .collect();

    let rows = stmt.query_map([since], |row| Ok(row_to_json(row, &col_names)))?;
    rows.collect()
}

/// Query the target table's actual column set (used to filter remote payload
/// keys that don't exist locally — prevents schema drift between devices from
/// breaking sync).
fn table_columns(conn: &Connection, table: &str) -> Result<Vec<String>, rusqlite::Error> {
    let sql = format!("PRAGMA table_info(\"{table}\")");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    rows.collect()
}

/// UPSERT versioned rows: only apply if remote version > local version.
fn upsert_versioned(
    conn: &Connection,
    table: &str,
    pk: &str,
    rows: &[Value],
) -> Result<usize, rusqlite::Error> {
    if rows.is_empty() {
        return Ok(0);
    }
    let local_cols: std::collections::HashSet<String> =
        table_columns(conn, table)?.into_iter().collect();

    let mut count = 0;
    for row in rows {
        let obj = match row.as_object() {
            Some(o) => o,
            None => continue,
        };

        // schedule_items routine rows have a compound UNIQUE(routine_id, date)
        // (partial, WHERE is_deleted=0) added in V63. Remote rows from an older
        // device may carry a different id for the same (routine_id, date) pair.
        // Skip those here to avoid constraint violations and to keep a single
        // canonical row per (routine_id, date).
        if table == "schedule_items" {
            let routine_id = obj
                .get("routine_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let date = obj
                .get("date")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let incoming_id = obj.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
            let is_deleted = obj
                .get("is_deleted")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            if let (Some(rid), Some(d), Some(iid)) = (routine_id, date, incoming_id) {
                if is_deleted == 0 {
                    let existing_id: Option<String> = conn
                        .query_row(
                            "SELECT id FROM schedule_items \
                             WHERE routine_id = ?1 AND date = ?2 AND is_deleted = 0 \
                             LIMIT 1",
                            rusqlite::params![&rid, &d],
                            |r| r.get(0),
                        )
                        .ok();
                    if let Some(existing) = existing_id {
                        if existing != iid {
                            // A different id already owns (routine_id, date).
                            // Prefer the existing local row; skip remote insert.
                            continue;
                        }
                    }
                }
            }
        }

        // Only keep columns the local schema actually has
        let columns: Vec<&String> = obj.keys().filter(|k| local_cols.contains(*k)).collect();
        if columns.is_empty() {
            continue;
        }

        let placeholders: Vec<String> =
            (1..=columns.len()).map(|i| format!("?{i}")).collect();

        let update_cols: Vec<&&String> =
            columns.iter().filter(|c| c.as_str() != pk).collect();
        let set_clauses: Vec<String> = update_cols
            .iter()
            .map(|c| format!("\"{c}\" = excluded.\"{c}\""))
            .collect();

        let col_list: Vec<String> = columns.iter().map(|c| format!("\"{c}\"")).collect();

        let sql = format!(
            "INSERT INTO \"{table}\" ({cols}) VALUES ({placeholders}) \
             ON CONFLICT(\"{pk}\") DO UPDATE SET {sets} \
             WHERE excluded.version > \"{table}\".version \
             OR \"{table}\".version IS NULL",
            cols = col_list.join(", "),
            placeholders = placeholders.join(", "),
            sets = set_clauses.join(", "),
        );

        let values: Vec<Box<dyn rusqlite::types::ToSql>> = columns
            .iter()
            .map(|col| json_to_sql(obj.get(col.as_str()).unwrap_or(&Value::Null)))
            .collect();
        let refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();

        conn.execute(&sql, refs.as_slice())?;
        count += 1;
    }
    Ok(count)
}

/// INSERT OR REPLACE for relation tables.
fn insert_or_replace(
    conn: &Connection,
    table: &str,
    rows: &[Value],
) -> Result<usize, rusqlite::Error> {
    if rows.is_empty() {
        return Ok(0);
    }
    let local_cols: std::collections::HashSet<String> =
        table_columns(conn, table)?.into_iter().collect();

    let mut count = 0;
    for row in rows {
        let obj = match row.as_object() {
            Some(o) => o,
            None => continue,
        };
        let columns: Vec<&String> = obj.keys().filter(|k| local_cols.contains(*k)).collect();
        if columns.is_empty() {
            continue;
        }

        let col_list: Vec<String> = columns.iter().map(|c| format!("\"{c}\"")).collect();
        let placeholders: Vec<String> =
            (1..=columns.len()).map(|i| format!("?{i}")).collect();

        let sql = format!(
            "INSERT OR REPLACE INTO \"{table}\" ({cols}) VALUES ({placeholders})",
            cols = col_list.join(", "),
            placeholders = placeholders.join(", "),
        );

        let values: Vec<Box<dyn rusqlite::types::ToSql>> = columns
            .iter()
            .map(|col| json_to_sql(obj.get(col.as_str()).unwrap_or(&Value::Null)))
            .collect();
        let refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();

        conn.execute(&sql, refs.as_slice())?;
        count += 1;
    }
    Ok(count)
}

/// Convert serde_json::Value to a ToSql boxed value.
fn json_to_sql(val: &Value) -> Box<dyn rusqlite::types::ToSql> {
    match val {
        Value::Null => Box::new(Option::<String>::None),
        Value::Bool(b) => Box::new(*b as i64),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(n.to_string())
            }
        }
        Value::String(s) => Box::new(s.clone()),
        Value::Array(_) | Value::Object(_) => Box::new(val.to_string()),
    }
}

/// Map table name to payload field.
fn get_payload_field<'a>(payload: &'a SyncPayload, table: &str) -> &'a [Value] {
    match table {
        "tasks" => &payload.tasks,
        "dailies" => &payload.dailies,
        "notes" => &payload.notes,
        "schedule_items" => &payload.schedule_items,
        "routines" => &payload.routines,
        "wiki_tags" => &payload.wiki_tags,
        "time_memos" => &payload.time_memos,
        "calendars" => &payload.calendars,
        "templates" => &payload.templates,
        "routine_groups" => &payload.routine_groups,
        "wiki_tag_assignments" => &payload.wiki_tag_assignments,
        "wiki_tag_connections" => &payload.wiki_tag_connections,
        "note_connections" => &payload.note_connections,
        _ => &[],
    }
}

/// Set a payload field by table name.
fn set_payload_field(payload: &mut SyncPayload, table: &str, rows: Vec<Value>) {
    match table {
        "tasks" => payload.tasks = rows,
        "dailies" => payload.dailies = rows,
        "notes" => payload.notes = rows,
        "schedule_items" => payload.schedule_items = rows,
        "routines" => payload.routines = rows,
        "wiki_tags" => payload.wiki_tags = rows,
        "time_memos" => payload.time_memos = rows,
        "calendars" => payload.calendars = rows,
        "templates" => payload.templates = rows,
        "routine_groups" => payload.routine_groups = rows,
        "wiki_tag_assignments" => payload.wiki_tag_assignments = rows,
        "wiki_tag_connections" => payload.wiki_tag_connections = rows,
        "note_connections" => payload.note_connections = rows,
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    /// Regression test for Known Issue 013: timestamp format mismatch.
    ///
    /// Before fix: `WHERE updated_at > ?1` did raw string compare. Space (0x20)
    /// sorts before 'T' (0x54), so a note with `updated_at = '2026-04-23 12:37:31'`
    /// would NOT satisfy `> '2026-04-23T10:00:00.000Z'` despite being 2 hours
    /// later clock-wise. Delta push silently dropped same-day space-format rows.
    ///
    /// After fix: `datetime(updated_at) > datetime(?1)` normalizes both sides,
    /// so the row IS captured.
    #[test]
    fn collect_local_changes_catches_space_format_rows_with_iso_since() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        // Space-format updated_at (what SQL `datetime('now')` produces and what
        // many existing rows in the wild have).
        conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, version) \
             VALUES ('note-space', 'space-ts', '', ?1, ?2, 1)",
            rusqlite::params!["2026-04-23 10:00:00", "2026-04-23 12:37:31"],
        )
        .unwrap();

        // ISO 8601 updated_at (what `helpers::now()` and `new Date().toISOString()`
        // produce — the canonical form).
        conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, version) \
             VALUES ('note-iso', 'iso-ts', '', ?1, ?2, 1)",
            rusqlite::params![
                "2026-04-23T10:00:00.000Z",
                "2026-04-23T12:37:31.500Z"
            ],
        )
        .unwrap();

        // Since an ISO timestamp earlier in the same day. Raw string compare
        // would exclude the space-format row (space < T at position 10).
        let since = "2026-04-23T10:00:00.000Z";
        let payload = collect_local_changes(&conn, since).unwrap();

        let note_ids: Vec<String> = payload
            .notes
            .iter()
            .filter_map(|v| v.get("id").and_then(|i| i.as_str()).map(String::from))
            .collect();

        assert!(
            note_ids.contains(&"note-space".to_string()),
            "space-format row must be captured after datetime() normalization; \
             got ids: {note_ids:?}"
        );
        assert!(
            note_ids.contains(&"note-iso".to_string()),
            "iso-format row must also be captured; got ids: {note_ids:?}"
        );
    }

    /// A row with updated_at strictly earlier than `since` must NOT be returned.
    /// Guards against accidentally making datetime() always-true.
    #[test]
    fn collect_local_changes_excludes_older_rows() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, version) \
             VALUES ('note-old', 'old', '', ?1, ?2, 1)",
            rusqlite::params!["2026-04-22 10:00:00", "2026-04-22 10:00:00"],
        )
        .unwrap();

        let since = "2026-04-23T00:00:00.000Z";
        let payload = collect_local_changes(&conn, since).unwrap();

        assert!(
            payload.notes.is_empty(),
            "row from 2026-04-22 must not be returned when since is 2026-04-23; \
             got {:?}",
            payload.notes
        );
    }
}
