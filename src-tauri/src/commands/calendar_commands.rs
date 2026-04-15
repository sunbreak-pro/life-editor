use crate::db::calendar_repository::{self, CalendarNode};
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_calendars_fetch_all(state: State<'_, DbState>) -> Result<Vec<CalendarNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_calendars_create(
    state: State<'_, DbState>,
    id: String,
    title: String,
    folder_id: String,
) -> Result<CalendarNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_repository::create(&conn, &id, &title, &folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_calendars_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<CalendarNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_repository::update(&conn, &id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_calendars_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    calendar_repository::delete(&conn, &id).map_err(|e| e.to_string())
}
