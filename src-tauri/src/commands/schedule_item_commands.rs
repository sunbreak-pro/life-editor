use crate::db::schedule_item_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_schedule_items_fetch_by_date(
    state: State<'_, DbState>,
    date: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::fetch_by_date(&conn, &date)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_fetch_by_date_all(
    state: State<'_, DbState>,
    date: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::fetch_by_date_all(&conn, &date)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_fetch_by_date_range(
    state: State<'_, DbState>,
    start_date: String,
    end_date: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::fetch_by_date_range(&conn, &start_date, &end_date)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_create(
    state: State<'_, DbState>,
    id: String,
    date: String,
    title: String,
    start_time: String,
    end_time: String,
    routine_id: Option<String>,
    template_id: Option<String>,
    note_id: Option<String>,
    is_all_day: Option<bool>,
    content: Option<String>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::create(
        &conn,
        &id,
        &date,
        &title,
        &start_time,
        &end_time,
        routine_id.as_deref(),
        template_id.as_deref(),
        note_id.as_deref(),
        is_all_day,
        content.as_deref(),
    )
    .map_err(|e| e.to_string())
    .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::update(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_soft_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::soft_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_restore(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::restore(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_permanent_delete(
    state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::permanent_delete(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_fetch_deleted(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::fetch_deleted(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_toggle_complete(
    state: State<'_, DbState>,
    id: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::toggle_complete(&conn, &id)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_dismiss(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::dismiss(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_undismiss(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::undismiss(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_fetch_last_routine_date(
    state: State<'_, DbState>,
) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::fetch_last_routine_date(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_bulk_create(
    state: State<'_, DbState>,
    items: Vec<Value>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::bulk_create(&conn, &items).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_schedule_items_update_future_by_routine(
    state: State<'_, DbState>,
    routine_id: String,
    updates: Value,
    from_date: String,
) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::update_future_by_routine(&conn, &routine_id, &updates, &from_date)
        .map_err(|e| e.to_string())
        .map(|n| n as i64)
}

#[tauri::command]
pub fn db_schedule_items_fetch_by_routine_id(
    state: State<'_, DbState>,
    routine_id: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::fetch_by_routine_id(&conn, &routine_id)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_schedule_items_bulk_delete(
    state: State<'_, DbState>,
    ids: Vec<String>,
) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::bulk_delete(&conn, &ids)
        .map_err(|e| e.to_string())
        .map(|n| n as i64)
}

#[tauri::command]
pub fn db_schedule_items_fetch_events(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    schedule_item_repository::fetch_events(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}
