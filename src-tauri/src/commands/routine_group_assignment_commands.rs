use crate::db::routine_group_assignment_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_routine_group_assignments_fetch_all(
    state: State<'_, DbState>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_group_assignment_repository::fetch_all(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_routine_group_assignments_set_for_routine(
    state: State<'_, DbState>,
    routine_id: String,
    group_ids: Vec<String>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    routine_group_assignment_repository::set_groups_for_routine(
        &mut conn,
        &routine_id,
        &group_ids,
    )
    .map_err(|e| e.to_string())
}
