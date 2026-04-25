use crate::db::sidebar_link_repository::{self, SidebarLink};
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_sidebar_links_fetch_all(
    state: State<'_, DbState>,
) -> Result<Vec<SidebarLink>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sidebar_link_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_sidebar_links_create(
    state: State<'_, DbState>,
    id: String,
    kind: String,
    name: String,
    target: String,
    emoji: Option<String>,
) -> Result<SidebarLink, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sidebar_link_repository::create(&conn, &id, &kind, &name, &target, emoji.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_sidebar_links_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<SidebarLink, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sidebar_link_repository::update(&conn, &id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_sidebar_links_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sidebar_link_repository::soft_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_sidebar_links_reorder(
    state: State<'_, DbState>,
    ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sidebar_link_repository::reorder(&conn, &ids).map_err(|e| e.to_string())
}
