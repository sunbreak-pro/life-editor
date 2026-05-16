use crate::db::helpers;
use crate::db::routine_repository;
use crate::db::DbState;
use rusqlite::Connection;
use serde_json::Value;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

fn format_timestamp() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H-%M-%S")
        .to_string()
}

fn data_dir() -> Result<std::path::PathBuf, String> {
    dirs::data_dir()
        .ok_or_else(|| "failed to resolve data dir".to_string())
        .map(|d| d.join("life-editor"))
}

fn create_backup() -> Result<std::path::PathBuf, String> {
    let dir = data_dir()?;
    let db_path = dir.join("life-editor.db");
    let backup_path = dir.join(format!("life-editor-backup-{}.db", format_timestamp()));
    if db_path.exists() {
        std::fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;
    }
    Ok(backup_path)
}

// ─── Export ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn data_export(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<bool, String> {
    let default_name = format!("life-editor-export-{}.json", format_timestamp());
    let save_path = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name(&default_name)
        .blocking_save_file();

    let path = match save_path {
        Some(p) => p,
        None => return Ok(false),
    };

    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let data = serde_json::json!({
        "version": 1,
        "exportedAt": chrono::Utc::now().to_rfc3339(),
        "app": "Life Editor",
        "data": {
            "tasks": safe_query_all(&conn, "SELECT * FROM tasks"),
            "timerSettings": safe_query_one(&conn, "SELECT * FROM timer_settings WHERE id = 1"),
            "timerSessions": safe_query_all(&conn, "SELECT * FROM timer_sessions"),
            "soundSettings": safe_query_all(&conn, "SELECT * FROM sound_settings"),
            "soundPresets": safe_query_all(&conn, "SELECT * FROM sound_presets"),
            "dailies": safe_query_all(&conn, "SELECT * FROM dailies"),
            "notes": safe_query_all(&conn, "SELECT * FROM notes"),
            "soundTagDefinitions": safe_query_all(&conn, "SELECT * FROM sound_tag_definitions"),
            "soundTagAssignments": safe_query_all(&conn, "SELECT * FROM sound_tag_assignments"),
            "soundDisplayMeta": safe_query_all(&conn, "SELECT * FROM sound_display_meta"),
            "calendars": safe_query_all(&conn, "SELECT * FROM calendars"),
            "routines": safe_query_all(&conn, "SELECT * FROM routines"),
            "scheduleItems": safe_query_all(&conn, "SELECT * FROM schedule_items"),
        }
    });

    let json_str = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(path.as_path().ok_or("Invalid file path")?, json_str).map_err(|e| e.to_string())?;
    Ok(true)
}

fn safe_query_all(conn: &Connection, sql: &str) -> Value {
    helpers::query_all_json(conn, sql)
        .map(Value::Array)
        .unwrap_or(Value::Array(vec![]))
}

fn safe_query_one(conn: &Connection, sql: &str) -> Value {
    helpers::query_one_json(conn, sql)
        .unwrap_or(None)
        .unwrap_or(Value::Null)
}

// ─── Import ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn data_import(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<bool, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .blocking_pick_file();

    let path = match picked {
        Some(p) => p,
        None => return Ok(false),
    };

    let raw = std::fs::read_to_string(path.as_path().ok_or("Invalid file path")?).map_err(|e| e.to_string())?;
    let imported: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    validate_import_data(&imported)?;

    let backup_path = create_backup()?;

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let data = &imported["data"];

    let result = conn.execute_batch("BEGIN");
    if let Err(e) = result {
        return Err(e.to_string());
    }

    let import_result = (|| -> Result<(), String> {
        // Clear existing data (FK-safe order)
        conn.execute_batch(
            "DELETE FROM schedule_items;
             DELETE FROM routines;
             DELETE FROM calendars;
             DELETE FROM notes;
             DELETE FROM sound_tag_assignments;
             DELETE FROM sound_tag_definitions;
             DELETE FROM sound_display_meta;
             DELETE FROM timer_sessions;
             DELETE FROM sound_settings;
             DELETE FROM sound_presets;
             DELETE FROM dailies;
             DELETE FROM tasks;",
        )
        .map_err(|e| e.to_string())?;

        // Import tasks
        import_array(&conn, &data["tasks"], "tasks", &[
            "id", "type", "title", "parent_id", "order", "status", "is_expanded",
            "is_deleted", "deleted_at", "created_at", "completed_at",
            "scheduled_at", "scheduled_end_at", "is_all_day", "content",
            "work_duration_minutes", "color", "due_date",
        ])?;

        // Import timer settings (UPDATE, not INSERT)
        if !data["timerSettings"].is_null() {
            let ts = &data["timerSettings"];
            let params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
                json_value_to_sql(&ts["work_duration"]),
                json_value_to_sql(&ts["break_duration"]),
                json_value_to_sql(&ts["long_break_duration"]),
                json_value_to_sql(&ts["sessions_before_long_break"]),
                json_value_to_sql(&ts["updated_at"]),
            ];
            let param_refs: Vec<&dyn rusqlite::types::ToSql> =
                params.iter().map(|p| p.as_ref()).collect();
            conn.execute(
                "UPDATE timer_settings SET work_duration=?1, break_duration=?2,
                 long_break_duration=?3, sessions_before_long_break=?4,
                 updated_at=?5 WHERE id=1",
                param_refs.as_slice(),
            )
            .map_err(|e| e.to_string())?;
        }

        // Import timer sessions
        import_array(&conn, &data["timerSessions"], "timer_sessions", &[
            "id", "task_id", "session_type", "started_at", "completed_at",
            "duration", "completed",
        ])?;

        // Import sound settings
        import_array(&conn, &data["soundSettings"], "sound_settings", &[
            "id", "sound_type", "volume", "enabled", "updated_at",
        ])?;

        // Import sound presets
        import_array(&conn, &data["soundPresets"], "sound_presets", &[
            "id", "name", "settings_json", "created_at",
        ])?;

        // Import dailies
        import_array(&conn, &data["dailies"], "dailies", &[
            "id", "date", "content", "created_at", "updated_at",
        ])?;

        // Import notes
        import_array(&conn, &data["notes"], "notes", &[
            "id", "title", "content", "is_pinned", "is_deleted", "deleted_at",
            "created_at", "updated_at",
        ])?;

        // Import calendars
        import_array(&conn, &data["calendars"], "calendars", &[
            "id", "title", "folder_id", "order", "created_at", "updated_at",
        ])?;

        // Import sound tag definitions
        import_array(&conn, &data["soundTagDefinitions"], "sound_tag_definitions", &[
            "id", "name", "color",
        ])?;

        // Import sound tag assignments
        import_array(&conn, &data["soundTagAssignments"], "sound_tag_assignments", &[
            "sound_id", "tag_id",
        ])?;

        // Import sound display meta
        import_array(&conn, &data["soundDisplayMeta"], "sound_display_meta", &[
            "sound_id", "display_name",
        ])?;

        // Import routines
        import_array(&conn, &data["routines"], "routines", &[
            "id", "title", "start_time", "end_time", "is_archived", "order",
            "created_at", "updated_at",
        ])?;

        // Import schedule items
        import_array(&conn, &data["scheduleItems"], "schedule_items", &[
            "id", "date", "title", "start_time", "end_time", "completed",
            "completed_at", "routine_id", "template_id", "created_at", "updated_at",
        ])?;

        Ok(())
    })();

    match import_result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(true)
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK").ok();
            // Attempt file-level restore as safety net
            if backup_path.exists() {
                // Cannot restore while conn is held; backup exists for manual recovery
                eprintln!("Import failed (backup at {:?}): {}", backup_path, e);
            }
            Err(format!("Import failed: {}", e))
        }
    }
}

fn validate_import_data(imported: &Value) -> Result<(), String> {
    let app_name = imported["app"]
        .as_str()
        .ok_or("Invalid export file: missing 'app' field")?;
    if app_name != "Sonic Flow" && app_name != "Life Editor" {
        return Err(format!(
            "Invalid export file: unrecognized app '{}'",
            app_name
        ));
    }

    let version = imported["version"]
        .as_i64()
        .ok_or("Invalid export file: missing 'version' field")?;
    if version != 1 {
        return Err(format!(
            "Unsupported export version: {}. Expected version 1.",
            version
        ));
    }

    let data = &imported["data"];
    if data.is_null() {
        return Err("Invalid export file: missing 'data' field".to_string());
    }

    // Validate array fields
    let array_fields = [
        "tasks",
        "timerSessions",
        "soundSettings",
        "soundPresets",
        "dailies",
        "notes",
        "soundTagDefinitions",
        "soundTagAssignments",
        "soundDisplayMeta",
        "calendars",
        "routines",
        "scheduleItems",
    ];
    for field in &array_fields {
        if !data[*field].is_null() && !data[*field].is_array() {
            return Err(format!(
                "Invalid import data: \"{}\" must be an array",
                field
            ));
        }
    }

    // Validate tasks schema
    if let Some(tasks) = data["tasks"].as_array() {
        for task in tasks {
            let id = task["id"]
                .as_str()
                .ok_or("Invalid import data: each task must have a string \"id\"")?;
            let task_type = task["type"].as_str().ok_or(format!(
                "Invalid import data: task \"{}\" has no type",
                id
            ))?;
            if task_type != "folder" && task_type != "task" {
                return Err(format!(
                    "Invalid import data: task \"{}\" has invalid type \"{}\"",
                    id, task_type
                ));
            }
            if task["created_at"].as_str().is_none() {
                return Err(format!(
                    "Invalid import data: task \"{}\" must have a string \"created_at\"",
                    id
                ));
            }
        }
    }

    Ok(())
}

/// Import a JSON array into a table with explicit columns
fn import_array(
    conn: &Connection,
    json_val: &Value,
    table: &str,
    columns: &[&str],
) -> Result<(), String> {
    do_import_array(conn, json_val, table, columns, false)
}

fn do_import_array(
    conn: &Connection,
    json_val: &Value,
    table: &str,
    columns: &[&str],
    or_ignore: bool,
) -> Result<(), String> {
    let rows = match json_val.as_array() {
        Some(arr) => arr,
        None => return Ok(()), // field missing or null — skip
    };
    if rows.is_empty() {
        return Ok(());
    }

    let col_list = columns
        .iter()
        .map(|c| format!("\"{}\"", c))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = columns
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect::<Vec<_>>()
        .join(", ");

    let insert_kw = if or_ignore {
        "INSERT OR IGNORE"
    } else {
        "INSERT"
    };
    let sql = format!(
        "{} INTO \"{}\" ({}) VALUES ({})",
        insert_kw, table, col_list, placeholders
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    for row in rows {
        let params: Vec<Box<dyn rusqlite::types::ToSql>> = columns
            .iter()
            .map(|col| json_value_to_sql(&row[*col]))
            .collect();
        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|p| p.as_ref()).collect();
        stmt.execute(param_refs.as_slice())
            .map_err(|e| format!("Failed to insert into {}: {}", table, e))?;
    }

    Ok(())
}

/// Convert a serde_json::Value to a boxed ToSql parameter
fn json_value_to_sql(val: &Value) -> Box<dyn rusqlite::types::ToSql> {
    match val {
        Value::Null => Box::new(rusqlite::types::Null),
        Value::Bool(b) => Box::new(*b as i64),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(rusqlite::types::Null)
            }
        }
        Value::String(s) => Box::new(s.clone()),
        _ => Box::new(val.to_string()),
    }
}

// ─── Reset ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn data_reset(state: State<'_, DbState>) -> Result<bool, String> {
    let backup_path = create_backup()?;

    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let result = conn.execute_batch("BEGIN");
    if let Err(e) = result {
        return Err(e.to_string());
    }

    let reset_result = (|| -> Result<(), String> {
        // Delete all data tables (FK-safe order: children before parents)
        conn.execute_batch(
            "DELETE FROM calendar_tag_assignments;
             DELETE FROM calendar_tag_definitions;
             DELETE FROM routine_group_assignments;
             DELETE FROM routine_groups;
             DELETE FROM playlist_items;
             DELETE FROM playlists;
             DELETE FROM schedule_items;
             DELETE FROM routines;
             DELETE FROM calendars;
             DELETE FROM wiki_tag_group_members;
             DELETE FROM wiki_tag_groups;
             DELETE FROM wiki_tag_connections;
             DELETE FROM wiki_tag_assignments;
             DELETE FROM wiki_tags;
             DELETE FROM note_aliases;
             DELETE FROM note_links;
             DELETE FROM note_connections;
             DELETE FROM notes;
             DELETE FROM sound_tag_assignments;
             DELETE FROM sound_tag_definitions;
             DELETE FROM sound_display_meta;
             DELETE FROM sound_workscreen_selections;
             DELETE FROM timer_sessions;
             DELETE FROM pomodoro_presets;
             DELETE FROM sound_settings;
             DELETE FROM sound_presets;
             DELETE FROM dailies;
             DELETE FROM time_memos;
             DELETE FROM paper_edges;
             DELETE FROM paper_nodes;
             DELETE FROM paper_boards;
             DELETE FROM database_cells;
             DELETE FROM database_rows;
             DELETE FROM database_properties;
             DELETE FROM databases;
             DELETE FROM templates;
             DELETE FROM task_templates;
             DELETE FROM sidebar_links;
             DELETE FROM timer_settings;
             DELETE FROM app_settings;
             DELETE FROM tasks;",
        )
        .map_err(|e| e.to_string())?;

        // Reset timer_settings to defaults
        conn.execute(
            "UPDATE timer_settings
             SET work_duration = 25, break_duration = 5,
                 long_break_duration = 15, sessions_before_long_break = 4,
                 auto_start_breaks = 0, target_sessions = 4,
                 updated_at = datetime('now')
             WHERE id = 1",
            [],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })();

    match reset_result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK").ok();
            if backup_path.exists() {
                eprintln!("Reset failed (backup at {:?}): {}", backup_path, e);
            }
            return Err(format!("Reset failed: {}", e));
        }
    }

    // Delete custom sound files (outside transaction — filesystem operation)
    let custom_sounds_dir = data_dir()?.join("custom-sounds");
    if custom_sounds_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&custom_sounds_dir) {
            for entry in entries.flatten() {
                std::fs::remove_file(entry.path()).ok();
            }
        }
    }

    Ok(true)
}

// ─── Bulk soft-delete Calendar data ────────────────────────────────────────────

/// Soft-delete the calendar-related data the user selects from the Settings
/// "Calendar データ一括削除" dialog.
///
/// Accepted `kinds`:
///   - "tasks":    scheduled tasks (tasks.type='task' AND scheduled_at IS NOT NULL)
///   - "events":   schedule_items with routine_id IS NULL (= manually created events)
///   - "routines": routines + their non-completed derived schedule_items (cascade)
///   - "dailies":  dailies rows
///   - "notes":    notes rows
///
/// All updates run inside a single transaction. The function bumps `version` and
/// updates `updated_at` so the Cloud Sync delta path picks them up.
///
/// Returns a JSON object whose keys mirror the requested kinds with the number
/// of rows soft-deleted, plus a "cascaded_schedule_items" count for routines.
#[tauri::command]
pub fn db_bulk_soft_delete_calendar_data(
    state: State<'_, DbState>,
    kinds: Vec<String>,
) -> Result<Value, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    let wants_tasks = kinds.iter().any(|k| k == "tasks");
    let wants_events = kinds.iter().any(|k| k == "events");
    let wants_routines = kinds.iter().any(|k| k == "routines");
    let wants_dailies = kinds.iter().any(|k| k == "dailies");
    let wants_notes = kinds.iter().any(|k| k == "notes");

    if !(wants_tasks || wants_events || wants_routines || wants_dailies || wants_notes) {
        return Ok(serde_json::json!({
            "tasks": 0,
            "events": 0,
            "routines": 0,
            "cascadedScheduleItems": 0,
            "dailies": 0,
            "notes": 0,
        }));
    }

    // Collect routine ids first (outside the cascade transaction) so we can
    // reuse the existing `routine_repository::soft_delete` which itself opens
    // its own transaction. We then perform the rest of the soft-deletes inside
    // one transaction for atomicity.
    let routine_ids: Vec<String> = if wants_routines {
        let mut stmt = conn
            .prepare("SELECT id FROM routines WHERE is_deleted = 0")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    // Phase 1: routines (each call is its own transaction; cascades schedule_items).
    let mut cascaded_schedule_items: usize = 0;
    let mut deleted_routines: usize = 0;
    for rid in &routine_ids {
        let cascaded =
            routine_repository::soft_delete(&mut conn, rid).map_err(|e| e.to_string())?;
        cascaded_schedule_items += cascaded.len();
        deleted_routines += 1;
    }

    // Phase 2: the remaining tables in a single transaction.
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut deleted_tasks: usize = 0;
    let mut deleted_events: usize = 0;
    let mut deleted_dailies: usize = 0;
    let mut deleted_notes: usize = 0;

    if wants_tasks {
        deleted_tasks = tx
            .execute(
                "UPDATE tasks \
                 SET is_deleted = 1, deleted_at = datetime('now'), \
                     version = version + 1, updated_at = datetime('now') \
                 WHERE type = 'task' AND scheduled_at IS NOT NULL AND is_deleted = 0",
                [],
            )
            .map_err(|e| e.to_string())?;
    }

    if wants_events {
        // "Events" = schedule_items that are not routine-derived. Routine-derived
        // items are handled by the routine cascade above.
        deleted_events = tx
            .execute(
                "UPDATE schedule_items \
                 SET is_deleted = 1, deleted_at = datetime('now'), \
                     version = version + 1, updated_at = datetime('now') \
                 WHERE routine_id IS NULL AND is_deleted = 0",
                [],
            )
            .map_err(|e| e.to_string())?;
    }

    if wants_dailies {
        deleted_dailies = tx
            .execute(
                "UPDATE dailies \
                 SET is_deleted = 1, deleted_at = datetime('now'), \
                     version = version + 1, updated_at = datetime('now') \
                 WHERE is_deleted = 0",
                [],
            )
            .map_err(|e| e.to_string())?;
    }

    if wants_notes {
        deleted_notes = tx
            .execute(
                "UPDATE notes \
                 SET is_deleted = 1, deleted_at = datetime('now'), \
                     version = version + 1, updated_at = datetime('now') \
                 WHERE is_deleted = 0",
                [],
            )
            .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "tasks": deleted_tasks,
        "events": deleted_events,
        "routines": deleted_routines,
        "cascadedScheduleItems": cascaded_schedule_items,
        "dailies": deleted_dailies,
        "notes": deleted_notes,
    }))
}

#[cfg(test)]
mod bulk_soft_delete_tests {
    use crate::db::migrations::run_migrations;
    use crate::db::{routine_repository, schedule_item_repository};
    use rusqlite::Connection;

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    /// Replicates the SQL of `db_bulk_soft_delete_calendar_data` without
    /// requiring tauri's `State<DbState>` so we can unit-test the soft-delete
    /// behaviour directly against an in-memory database.
    fn bulk_soft_delete(
        conn: &mut Connection,
        kinds: &[&str],
    ) -> (usize, usize, usize, usize, usize, usize) {
        let wants = |k: &str| kinds.iter().any(|&x| x == k);

        let routine_ids: Vec<String> = if wants("routines") {
            let mut stmt = conn
                .prepare("SELECT id FROM routines WHERE is_deleted = 0")
                .unwrap();
            stmt.query_map([], |row| row.get::<_, String>(0))
                .unwrap()
                .map(|r| r.unwrap())
                .collect()
        } else {
            Vec::new()
        };

        let mut cascaded = 0usize;
        let mut deleted_routines = 0usize;
        for rid in &routine_ids {
            cascaded += routine_repository::soft_delete(conn, rid).unwrap().len();
            deleted_routines += 1;
        }

        let tx = conn.transaction().unwrap();
        let mut deleted_tasks = 0usize;
        let mut deleted_events = 0usize;
        let mut deleted_dailies = 0usize;
        let mut deleted_notes = 0usize;

        if wants("tasks") {
            deleted_tasks = tx
                .execute(
                    "UPDATE tasks \
                     SET is_deleted = 1, deleted_at = datetime('now'), \
                         version = version + 1, updated_at = datetime('now') \
                     WHERE type = 'task' AND scheduled_at IS NOT NULL AND is_deleted = 0",
                    [],
                )
                .unwrap();
        }
        if wants("events") {
            deleted_events = tx
                .execute(
                    "UPDATE schedule_items \
                     SET is_deleted = 1, deleted_at = datetime('now'), \
                         version = version + 1, updated_at = datetime('now') \
                     WHERE routine_id IS NULL AND is_deleted = 0",
                    [],
                )
                .unwrap();
        }
        if wants("dailies") {
            deleted_dailies = tx
                .execute(
                    "UPDATE dailies \
                     SET is_deleted = 1, deleted_at = datetime('now'), \
                         version = version + 1, updated_at = datetime('now') \
                     WHERE is_deleted = 0",
                    [],
                )
                .unwrap();
        }
        if wants("notes") {
            deleted_notes = tx
                .execute(
                    "UPDATE notes \
                     SET is_deleted = 1, deleted_at = datetime('now'), \
                         version = version + 1, updated_at = datetime('now') \
                     WHERE is_deleted = 0",
                    [],
                )
                .unwrap();
        }
        tx.commit().unwrap();

        (
            deleted_tasks,
            deleted_events,
            deleted_routines,
            cascaded,
            deleted_dailies,
            deleted_notes,
        )
    }

    fn seed_task_scheduled(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO tasks (id, type, title, parent_id, \"order\", status, \
             is_expanded, is_deleted, created_at, scheduled_at, version) \
             VALUES (?1, 'task', 'T', NULL, 0, 'NOT_STARTED', 0, 0, datetime('now'), datetime('now'), 1)",
            [id],
        )
        .unwrap();
    }

    fn seed_task_unscheduled(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO tasks (id, type, title, parent_id, \"order\", status, \
             is_expanded, is_deleted, created_at, version) \
             VALUES (?1, 'task', 'T', NULL, 0, 'NOT_STARTED', 0, 0, datetime('now'), 1)",
            [id],
        )
        .unwrap();
    }

    fn seed_routine(conn: &Connection, id: &str) {
        routine_repository::create(
            conn,
            id,
            "R",
            Some("09:00"),
            Some("09:30"),
            Some("daily"),
            None,
            None,
            None,
            false,
            None,
            None,
        )
        .unwrap();
    }

    #[test]
    fn tasks_only_soft_deletes_scheduled_tasks() {
        let mut conn = fresh_conn();
        seed_task_scheduled(&conn, "task-1");
        seed_task_unscheduled(&conn, "task-2");

        let (deleted_tasks, _, _, _, _, _) = bulk_soft_delete(&mut conn, &["tasks"]);
        assert_eq!(deleted_tasks, 1);

        let scheduled_state: i64 = conn
            .query_row(
                "SELECT is_deleted FROM tasks WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let unscheduled_state: i64 = conn
            .query_row(
                "SELECT is_deleted FROM tasks WHERE id = 'task-2'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(scheduled_state, 1, "scheduled task should be soft-deleted");
        assert_eq!(unscheduled_state, 0, "unscheduled task must remain");
    }

    #[test]
    fn events_only_soft_deletes_non_routine_schedule_items() {
        let mut conn = fresh_conn();
        seed_routine(&conn, "r-1");
        // event (no routine_id)
        schedule_item_repository::create(
            &conn, "ev-1", "2026-05-12", "Event", "10:00", "11:00", None, None, None, None, None,
            false, None, None,
        )
        .unwrap();
        // routine-derived item
        schedule_item_repository::create(
            &conn,
            "si-1",
            "2026-05-12",
            "Routine",
            "09:00",
            "09:30",
            Some("r-1"),
            None,
            None,
            None,
            None,
            false,
            None,
            None,
        )
        .unwrap();

        let (_, deleted_events, _, _, _, _) = bulk_soft_delete(&mut conn, &["events"]);
        assert_eq!(deleted_events, 1);

        let ev_state: i64 = conn
            .query_row(
                "SELECT is_deleted FROM schedule_items WHERE id = 'ev-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let si_state: i64 = conn
            .query_row(
                "SELECT is_deleted FROM schedule_items WHERE id = 'si-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(ev_state, 1);
        assert_eq!(si_state, 0, "routine-derived items must NOT be touched");
    }

    #[test]
    fn routines_only_cascades_to_derived_schedule_items() {
        let mut conn = fresh_conn();
        seed_routine(&conn, "r-1");
        schedule_item_repository::create(
            &conn,
            "si-1",
            "2026-05-12",
            "Routine",
            "09:00",
            "09:30",
            Some("r-1"),
            None,
            None,
            None,
            None,
            false,
            None,
            None,
        )
        .unwrap();
        schedule_item_repository::create(
            &conn, "ev-1", "2026-05-12", "Event", "10:00", "11:00", None, None, None, None, None,
            false, None, None,
        )
        .unwrap();

        let (_, _, deleted_routines, cascaded, _, _) =
            bulk_soft_delete(&mut conn, &["routines"]);
        assert_eq!(deleted_routines, 1);
        assert_eq!(cascaded, 1, "one routine-derived schedule_item should cascade");

        let routine_state: i64 = conn
            .query_row(
                "SELECT is_deleted FROM routines WHERE id = 'r-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let si_state: i64 = conn
            .query_row(
                "SELECT is_deleted FROM schedule_items WHERE id = 'si-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let ev_state: i64 = conn
            .query_row(
                "SELECT is_deleted FROM schedule_items WHERE id = 'ev-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(routine_state, 1);
        assert_eq!(si_state, 1, "derived schedule_item should cascade-delete");
        assert_eq!(ev_state, 0, "manual event must remain");
    }

    #[test]
    fn version_is_bumped_for_sync_delta() {
        let mut conn = fresh_conn();
        seed_task_scheduled(&conn, "task-1");
        let before: i64 = conn
            .query_row(
                "SELECT version FROM tasks WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        bulk_soft_delete(&mut conn, &["tasks"]);

        let after: i64 = conn
            .query_row(
                "SELECT version FROM tasks WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(after > before, "version must be bumped for Cloud Sync delta");
    }

    #[test]
    fn empty_kinds_returns_zero_counts() {
        let mut conn = fresh_conn();
        seed_task_scheduled(&conn, "task-1");
        let (tasks, events, routines, cascaded, dailies, notes) =
            bulk_soft_delete(&mut conn, &[]);
        assert_eq!(tasks, 0);
        assert_eq!(events, 0);
        assert_eq!(routines, 0);
        assert_eq!(cascaded, 0);
        assert_eq!(dailies, 0);
        assert_eq!(notes, 0);
    }
}
