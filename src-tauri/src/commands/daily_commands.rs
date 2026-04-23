use crate::db::daily_repository::{self, DailyNode};
use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub fn db_daily_fetch_all(state: State<'_, DbState>) -> Result<Vec<DailyNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_fetch_by_date(
    state: State<'_, DbState>,
    date: String,
) -> Result<Option<DailyNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::fetch_by_date(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_upsert(
    state: State<'_, DbState>,
    date: String,
    content: String,
) -> Result<DailyNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::upsert(&conn, &date, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_delete(state: State<'_, DbState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::delete(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_fetch_deleted(state: State<'_, DbState>) -> Result<Vec<DailyNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::fetch_deleted(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_restore(state: State<'_, DbState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::restore(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_permanent_delete(state: State<'_, DbState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::permanent_delete(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_toggle_pin(state: State<'_, DbState>, date: String) -> Result<DailyNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::toggle_pin(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_set_password(
    state: State<'_, DbState>,
    date: String,
    password: String,
) -> Result<DailyNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::set_password(&conn, &date, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_remove_password(
    state: State<'_, DbState>,
    date: String,
    current_password: String,
) -> Result<DailyNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    // Verify password before removing
    let valid =
        daily_repository::verify_password(&conn, &date, &current_password).map_err(|e| e.to_string())?;
    if !valid {
        return Err("Invalid password".to_string());
    }
    daily_repository::remove_password(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_verify_password(
    state: State<'_, DbState>,
    date: String,
    password: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::verify_password(&conn, &date, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_daily_toggle_edit_lock(
    state: State<'_, DbState>,
    date: String,
) -> Result<DailyNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    daily_repository::toggle_edit_lock(&conn, &date).map_err(|e| e.to_string())
}
