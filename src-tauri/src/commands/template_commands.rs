use crate::db::{template_repository, DbState};
use crate::db::template_repository::Template;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_templates_fetch_all(state: State<'_, DbState>) -> Result<Vec<Template>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    template_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_templates_fetch_by_id(state: State<'_, DbState>, id: String) -> Result<Option<Template>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    template_repository::fetch_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_templates_create(state: State<'_, DbState>, id: String, name: String) -> Result<Template, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    template_repository::create(&conn, &id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_templates_update(state: State<'_, DbState>, id: String, updates: Value) -> Result<Template, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    template_repository::update(&conn, &id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_templates_soft_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    template_repository::soft_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_templates_permanent_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    template_repository::permanent_delete(&conn, &id).map_err(|e| e.to_string())
}
