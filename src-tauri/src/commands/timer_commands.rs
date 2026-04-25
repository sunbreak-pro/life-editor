use crate::db::timer_repository::{self, TimerSession, TimerSettings};
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_timer_fetch_settings(state: State<'_, DbState>) -> Result<TimerSettings, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    timer_repository::fetch_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_update_settings(
    state: State<'_, DbState>,
    settings: Value,
) -> Result<TimerSettings, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    timer_repository::update_settings(&conn, &settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_start_session(
    state: State<'_, DbState>,
    session_type: String,
    task_id: Option<String>,
) -> Result<TimerSession, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    timer_repository::start_session(&conn, &session_type, task_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_end_session(
    state: State<'_, DbState>,
    id: i64,
    duration: i64,
    completed: bool,
) -> Result<TimerSession, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    timer_repository::end_session(&conn, id, duration, completed).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_end_session_with_label(
    state: State<'_, DbState>,
    id: i64,
    duration: i64,
    completed: bool,
    label: Option<String>,
) -> Result<TimerSession, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    timer_repository::end_session_with_label(&conn, id, duration, completed, label.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_fetch_sessions(state: State<'_, DbState>) -> Result<Vec<TimerSession>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    timer_repository::fetch_sessions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_timer_fetch_sessions_by_task_id(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Vec<TimerSession>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    timer_repository::fetch_sessions_by_task_id(&conn, &task_id).map_err(|e| e.to_string())
}
