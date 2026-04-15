use crate::db::wiki_tag_group_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_wiki_tag_groups_fetch_all(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::fetch_all(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_wiki_tag_groups_create(
    state: State<'_, DbState>,
    name: String,
    note_ids: Vec<String>,
    filter_tags: Option<Vec<String>>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::create(&conn, &name, &note_ids, filter_tags.as_deref())
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_wiki_tag_groups_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::update(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_wiki_tag_groups_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tag_groups_fetch_all_members(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::fetch_all_members(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_wiki_tag_groups_set_members(
    state: State<'_, DbState>,
    group_id: String,
    note_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::set_members(&conn, &group_id, &note_ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tag_groups_add_member(
    state: State<'_, DbState>,
    group_id: String,
    note_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::add_member(&conn, &group_id, &note_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tag_groups_remove_member(
    state: State<'_, DbState>,
    group_id: String,
    note_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_group_repository::remove_member(&conn, &group_id, &note_id)
        .map_err(|e| e.to_string())
}
