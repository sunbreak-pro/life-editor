use crate::db::wiki_tag_connection_repository::{self, WikiTagConnection};
use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub fn db_wiki_tag_connections_fetch_all(
    state: State<'_, DbState>,
) -> Result<Vec<WikiTagConnection>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_connection_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tag_connections_create(
    state: State<'_, DbState>,
    source_tag_id: String,
    target_tag_id: String,
) -> Result<WikiTagConnection, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_connection_repository::create(&conn, &source_tag_id, &target_tag_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tag_connections_delete(
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_connection_repository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tag_connections_delete_by_tag_pair(
    state: State<'_, DbState>,
    source_tag_id: String,
    target_tag_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_connection_repository::delete_by_tag_pair(&conn, &source_tag_id, &target_tag_id)
        .map_err(|e| e.to_string())
}
