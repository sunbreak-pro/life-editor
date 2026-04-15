use crate::db::calendar_tag_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_calendar_tags_fetch_all(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_tag_repository::fetch_all(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_calendar_tags_create(
    state: State<'_, DbState>,
    name: String,
    color: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_tag_repository::create(&conn, &name, &color)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_calendar_tags_update(
    state: State<'_, DbState>,
    id: i64,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_tag_repository::update(&conn, id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_calendar_tags_delete(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_tag_repository::delete(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_calendar_tags_fetch_all_assignments(
    state: State<'_, DbState>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_tag_repository::fetch_all_assignments(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_calendar_tags_set_tags_for_schedule_item(
    state: State<'_, DbState>,
    schedule_item_id: String,
    tag_ids: Vec<i64>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_tag_repository::set_tags_for_schedule_item(&conn, &schedule_item_id, &tag_ids)
        .map_err(|e| e.to_string())
}
