use crate::db::task_repository::{self, TaskNode};
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_tasks_fetch_tree(state: State<'_, DbState>) -> Result<Vec<TaskNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::fetch_tree(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_tasks_fetch_deleted(state: State<'_, DbState>) -> Result<Vec<TaskNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::fetch_deleted(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_tasks_create(state: State<'_, DbState>, node: TaskNode) -> Result<TaskNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::create(&conn, &node).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_tasks_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<TaskNode, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::update(&conn, &id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_tasks_sync_tree(
    state: State<'_, DbState>,
    nodes: Vec<TaskNode>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::sync_tree(&conn, &nodes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_tasks_soft_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::soft_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_tasks_restore(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::restore(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_tasks_permanent_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::permanent_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_migrate_from_local_storage(
    state: State<'_, DbState>,
    tasks: Vec<TaskNode>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    task_repository::sync_tree(&conn, &tasks).map_err(|e| e.to_string())
}
