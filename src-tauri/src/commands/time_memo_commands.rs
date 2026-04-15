use crate::db::time_memo_repository::{self, TimeMemo};
use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub fn db_time_memos_fetch_by_date(
    state: State<'_, DbState>,
    date: String,
) -> Result<Vec<TimeMemo>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    time_memo_repository::fetch_by_date(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_time_memos_upsert(
    state: State<'_, DbState>,
    id: String,
    date: String,
    hour: i64,
    content: String,
) -> Result<TimeMemo, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    time_memo_repository::upsert(&conn, &id, &date, hour, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_time_memos_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    time_memo_repository::delete(&conn, &id).map_err(|e| e.to_string())
}
