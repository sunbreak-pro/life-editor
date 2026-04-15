use crate::db::playlist_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_playlists_fetch_all(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::fetch_all(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_playlists_create(
    state: State<'_, DbState>,
    id: String,
    name: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::create(&conn, &id, &name)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_playlists_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::update(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_playlists_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_playlists_fetch_items(
    state: State<'_, DbState>,
    playlist_id: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::fetch_items(&conn, &playlist_id)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_playlists_fetch_all_items(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::fetch_all_items(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_playlists_add_item(
    state: State<'_, DbState>,
    id: String,
    playlist_id: String,
    sound_id: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::add_item(&conn, &id, &playlist_id, &sound_id)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_playlists_remove_item(state: State<'_, DbState>, item_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::remove_item(&conn, &item_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_playlists_reorder_items(
    state: State<'_, DbState>,
    playlist_id: String,
    item_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    playlist_repository::reorder_items(&conn, &playlist_id, &item_ids)
        .map_err(|e| e.to_string())
}
