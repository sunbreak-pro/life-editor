use crate::db::pomodoro_preset_repository::{self, PomodoroPreset};
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_timer_fetch_pomodoro_presets(
    state: State<'_, DbState>,
) -> Result<Vec<PomodoroPreset>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    pomodoro_preset_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_create_pomodoro_preset(
    state: State<'_, DbState>,
    preset: Value,
) -> Result<PomodoroPreset, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    pomodoro_preset_repository::create(&conn, &preset).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_update_pomodoro_preset(
    state: State<'_, DbState>,
    id: i64,
    updates: Value,
) -> Result<PomodoroPreset, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    pomodoro_preset_repository::update(&conn, id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_delete_pomodoro_preset(
    state: State<'_, DbState>,
    id: i64,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    pomodoro_preset_repository::delete(&conn, id).map_err(|e| e.to_string())
}
