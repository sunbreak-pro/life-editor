use crate::db::wiki_tag_repository::{self, WikiTag, WikiTagAssignment};
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_wiki_tags_fetch_all(state: State<'_, DbState>) -> Result<Vec<WikiTag>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_search(
    state: State<'_, DbState>,
    query: String,
) -> Result<Vec<WikiTag>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::search(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_create(
    state: State<'_, DbState>,
    name: String,
    color: String,
) -> Result<WikiTag, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::create(&conn, &name, &color).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_create_with_id(
    state: State<'_, DbState>,
    id: String,
    name: String,
    color: String,
) -> Result<WikiTag, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::create_with_id(&conn, &id, &name, &color).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<WikiTag, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::update(&conn, &id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_merge(
    state: State<'_, DbState>,
    source_id: String,
    target_id: String,
) -> Result<WikiTag, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::merge(&conn, &source_id, &target_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_fetch_for_entity(
    state: State<'_, DbState>,
    entity_id: String,
) -> Result<Vec<WikiTag>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::fetch_tags_for_entity(&conn, &entity_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_set_for_entity(
    state: State<'_, DbState>,
    entity_id: String,
    entity_type: String,
    tag_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::set_tags_for_entity(&conn, &entity_id, &entity_type, &tag_ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_sync_inline(
    state: State<'_, DbState>,
    entity_id: String,
    entity_type: String,
    tag_names: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::sync_inline_tags(&conn, &entity_id, &entity_type, &tag_names)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_fetch_all_assignments(
    state: State<'_, DbState>,
) -> Result<Vec<WikiTagAssignment>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::fetch_all_assignments(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_wiki_tags_restore_assignment(
    state: State<'_, DbState>,
    tag_id: String,
    entity_id: String,
    entity_type: String,
    source: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    wiki_tag_repository::restore_assignment(&conn, &tag_id, &entity_id, &entity_type, &source)
        .map_err(|e| e.to_string())
}
