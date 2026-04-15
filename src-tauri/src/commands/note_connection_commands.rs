use crate::db::note_connection_repository::{self, NoteConnection};
use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub fn db_note_connections_fetch_all(
    state: State<'_, DbState>,
) -> Result<Vec<NoteConnection>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_connection_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_connections_create(
    state: State<'_, DbState>,
    source_note_id: String,
    target_note_id: String,
) -> Result<NoteConnection, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_connection_repository::create(&conn, &source_note_id, &target_note_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_connections_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_connection_repository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_connections_delete_by_note_pair(
    state: State<'_, DbState>,
    source_note_id: String,
    target_note_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_connection_repository::delete_by_note_pair(&conn, &source_note_id, &target_note_id)
        .map_err(|e| e.to_string())
}
