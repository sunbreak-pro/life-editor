use crate::db::database_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_database_fetch_all(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::fetch_all(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_database_fetch_full(
    state: State<'_, DbState>,
    id: String,
) -> Result<Option<Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::fetch_full(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_database_create(
    state: State<'_, DbState>,
    id: String,
    title: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::create(&conn, &id, &title)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_database_update(
    state: State<'_, DbState>,
    id: String,
    title: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::update(&conn, &id, &title)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_database_soft_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::soft_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_database_permanent_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::permanent_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_database_add_property(
    state: State<'_, DbState>,
    id: String,
    database_id: String,
    name: String,
    property_type: String,
    order: i64,
    config: Option<Value>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let default_config = Value::Object(serde_json::Map::new());
    let config_ref = config.as_ref().unwrap_or(&default_config);
    database_repository::add_property(
        &conn,
        &id,
        &database_id,
        &name,
        &property_type,
        order,
        config_ref,
    )
    .map_err(|e| e.to_string())
    .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_database_update_property(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::update_property(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .map(|_| ())
}

#[tauri::command]
pub fn db_database_remove_property(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::remove_property(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_database_add_row(
    state: State<'_, DbState>,
    id: String,
    database_id: String,
    order: i64,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::add_row(&conn, &id, &database_id, order)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_database_reorder_rows(
    state: State<'_, DbState>,
    row_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::reorder_rows(&conn, &row_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_database_remove_row(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::remove_row(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_database_upsert_cell(
    state: State<'_, DbState>,
    id: String,
    row_id: String,
    property_id: String,
    value: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    database_repository::upsert_cell(&conn, &id, &row_id, &property_id, &value)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}
