use crate::db::note_repository::{self, NoteNode};
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_notes_fetch_all(state: State<'_, DbState>) -> Result<Vec<NoteNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_fetch_deleted(state: State<'_, DbState>) -> Result<Vec<NoteNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::fetch_deleted(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_create(
    state: State<'_, DbState>,
    id: String,
    title: String,
    parent_id: Option<String>,
) -> Result<NoteNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::create(&conn, &id, &title, parent_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<NoteNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::update(&conn, &id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_soft_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::soft_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_restore(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::restore(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_permanent_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::permanent_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_search(
    state: State<'_, DbState>,
    query: String,
) -> Result<Vec<NoteNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::search(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_set_password(
    state: State<'_, DbState>,
    id: String,
    password: String,
) -> Result<NoteNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::set_password(&conn, &id, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_remove_password(
    state: State<'_, DbState>,
    id: String,
    current_password: String,
) -> Result<NoteNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let valid =
        note_repository::verify_password(&conn, &id, &current_password).map_err(|e| e.to_string())?;
    if !valid {
        return Err("Invalid password".to_string());
    }
    note_repository::remove_password(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_verify_password(
    state: State<'_, DbState>,
    id: String,
    password: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::verify_password(&conn, &id, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_toggle_edit_lock(
    state: State<'_, DbState>,
    id: String,
) -> Result<NoteNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::toggle_edit_lock(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_create_folder(
    state: State<'_, DbState>,
    id: String,
    title: String,
    parent_id: Option<String>,
) -> Result<NoteNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::create_folder(&conn, &id, &title, parent_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_notes_sync_tree(
    state: State<'_, DbState>,
    items: Vec<Value>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_repository::sync_tree(&conn, &items).map_err(|e| e.to_string())
}
