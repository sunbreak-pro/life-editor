use crate::db::routine_group_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_routine_groups_fetch_all(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_group_repository::fetch_all(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routine_groups_create(
    state: State<'_, DbState>,
    id: String,
    name: String,
    color: String,
    frequency_type: Option<String>,
    frequency_days: Option<Value>,
    frequency_interval: Option<i64>,
    frequency_start_date: Option<String>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_group_repository::create(
        &conn,
        &id,
        &name,
        &color,
        frequency_type.as_deref(),
        frequency_days.as_ref(),
        frequency_interval,
        frequency_start_date.as_deref(),
    )
    .map_err(|e| e.to_string())
    .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routine_groups_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_group_repository::update(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routine_groups_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_group_repository::delete(&conn, &id).map_err(|e| e.to_string())
}
