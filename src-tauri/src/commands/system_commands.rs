use crate::db::{app_settings_repository, DbState};
use serde_json::Value;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn system_get_auto_launch(state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val = app_settings_repository::get(&conn, "autoLaunch").map_err(|e| e.to_string())?;
    Ok(val.as_deref() == Some("true"))
}

#[tauri::command]
pub fn system_set_auto_launch(state: State<'_, DbState>, enabled: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "autoLaunch", &enabled.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_get_start_minimized(state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val =
        app_settings_repository::get(&conn, "startMinimized").map_err(|e| e.to_string())?;
    Ok(val.as_deref() == Some("true"))
}

#[tauri::command]
pub fn system_set_start_minimized(state: State<'_, DbState>, enabled: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "startMinimized", &enabled.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_get_tray_enabled(state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val = app_settings_repository::get(&conn, "trayEnabled").map_err(|e| e.to_string())?;
    Ok(val.as_deref() != Some("false"))
}

#[tauri::command]
pub fn system_set_tray_enabled(state: State<'_, DbState>, enabled: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "trayEnabled", &enabled.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_get_global_shortcuts(state: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val =
        app_settings_repository::get(&conn, "globalShortcuts").map_err(|e| e.to_string())?;
    match val {
        Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        None => Ok(HashMap::new()),
    }
}

#[tauri::command]
pub fn system_set_global_shortcuts(
    state: State<'_, DbState>,
    shortcuts: HashMap<String, String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&shortcuts).map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "globalShortcuts", &json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_reregister_global_shortcuts() -> Result<Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn tray_update_timer(state: Value) -> Result<(), String> {
    let _ = state;
    Ok(())
}
