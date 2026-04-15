use crate::db::memo_repository::{self, MemoNode};
use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub fn db_memo_fetch_all(state: State<'_, DbState>) -> Result<Vec<MemoNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_fetch_by_date(
    state: State<'_, DbState>,
    date: String,
) -> Result<Option<MemoNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::fetch_by_date(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_upsert(
    state: State<'_, DbState>,
    date: String,
    content: String,
) -> Result<MemoNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::upsert(&conn, &date, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_delete(state: State<'_, DbState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::delete(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_fetch_deleted(state: State<'_, DbState>) -> Result<Vec<MemoNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::fetch_deleted(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_restore(state: State<'_, DbState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::restore(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_permanent_delete(state: State<'_, DbState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::permanent_delete(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_toggle_pin(state: State<'_, DbState>, date: String) -> Result<MemoNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::toggle_pin(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_set_password(
    state: State<'_, DbState>,
    date: String,
    password: String,
) -> Result<MemoNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::set_password(&conn, &date, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_remove_password(
    state: State<'_, DbState>,
    date: String,
    current_password: String,
) -> Result<MemoNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    // Verify password before removing
    let valid =
        memo_repository::verify_password(&conn, &date, &current_password).map_err(|e| e.to_string())?;
    if !valid {
        return Err("Invalid password".to_string());
    }
    memo_repository::remove_password(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_verify_password(
    state: State<'_, DbState>,
    date: String,
    password: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::verify_password(&conn, &date, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_memo_toggle_edit_lock(
    state: State<'_, DbState>,
    date: String,
) -> Result<MemoNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    memo_repository::toggle_edit_lock(&conn, &date).map_err(|e| e.to_string())
}
