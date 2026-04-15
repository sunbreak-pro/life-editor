use crate::db::{app_settings_repository, DbState};
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn settings_get(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::get(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_set(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_get_all(state: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_remove(state: State<'_, DbState>, key: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::remove(&conn, &key).map_err(|e| e.to_string())
}
