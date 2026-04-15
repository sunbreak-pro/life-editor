use crate::db::{app_settings_repository, DbState};
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn reminder_get_settings(state: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val =
        app_settings_repository::get(&conn, "reminderSettings").map_err(|e| e.to_string())?;
    match val {
        Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        None => Ok(HashMap::new()),
    }
}

#[tauri::command]
pub fn reminder_set_settings(
    state: State<'_, DbState>,
    settings: HashMap<String, String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "reminderSettings", &json).map_err(|e| e.to_string())
}
