use crate::db::routine_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_routines_fetch_all(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::fetch_all(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routines_create(
    state: State<'_, DbState>,
    id: String,
    title: String,
    start_time: Option<String>,
    end_time: Option<String>,
    frequency_type: Option<String>,
    frequency_days: Option<Value>,
    frequency_interval: Option<i64>,
    frequency_start_date: Option<String>,
    reminder_enabled: Option<bool>,
    reminder_offset: Option<i64>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::create(
        &conn,
        &id,
        &title,
        start_time.as_deref(),
        end_time.as_deref(),
        frequency_type.as_deref(),
        frequency_days.as_ref(),
        frequency_interval,
        frequency_start_date.as_deref(),
        reminder_enabled.unwrap_or(false),
        reminder_offset,
    )
    .map_err(|e| e.to_string())
    .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routines_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::update(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routines_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_routines_fetch_deleted(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::fetch_deleted(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routines_soft_delete(
    state: State<'_, DbState>,
    id: String,
) -> Result<Vec<String>, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::soft_delete(&mut conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_routines_restore(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::restore(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_routines_permanent_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_repository::permanent_delete(&conn, &id).map_err(|e| e.to_string())
}
