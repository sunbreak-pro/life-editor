use crate::db::paper_board_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

// --- Paper Boards ---

#[tauri::command]
pub fn db_paper_boards_fetch_all(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::fetch_all_boards(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_boards_fetch_by_id(
    state: State<'_, DbState>,
    id: String,
) -> Result<Option<Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::fetch_board_by_id(&conn, &id)
        .map_err(|e| e.to_string())
        .and_then(|opt| match opt {
            Some(b) => serde_json::to_value(b).map(Some).map_err(|e| e.to_string()),
            None => Ok(None),
        })
}

#[tauri::command]
pub fn db_paper_boards_fetch_by_note_id(
    state: State<'_, DbState>,
    note_id: String,
) -> Result<Option<Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::fetch_board_by_note_id(&conn, &note_id)
        .map_err(|e| e.to_string())
        .and_then(|opt| match opt {
            Some(b) => serde_json::to_value(b).map(Some).map_err(|e| e.to_string()),
            None => Ok(None),
        })
}

#[tauri::command]
pub fn db_paper_boards_create(
    state: State<'_, DbState>,
    name: String,
    linked_note_id: Option<String>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::create_board(&conn, &name, linked_note_id.as_deref())
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_boards_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::update_board(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_boards_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::delete_board(&conn, &id).map_err(|e| e.to_string())
}

// --- Paper Nodes ---

#[tauri::command]
pub fn db_paper_nodes_fetch_node_counts(
    state: State<'_, DbState>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::fetch_node_counts_by_board(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_paper_nodes_fetch_by_board(
    state: State<'_, DbState>,
    board_id: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::fetch_nodes_by_board(&conn, &board_id)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_nodes_create(
    state: State<'_, DbState>,
    params: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::create_node(&conn, &params)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_nodes_update(
    state: State<'_, DbState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::update_node(&conn, &id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_nodes_bulk_update_positions(
    state: State<'_, DbState>,
    updates: Vec<Value>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::bulk_update_positions(&conn, &updates)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_paper_nodes_bulk_update_z_indices(
    state: State<'_, DbState>,
    updates: Vec<Value>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::bulk_update_z_indices(&conn, &updates)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_paper_nodes_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::delete_node(&conn, &id).map_err(|e| e.to_string())
}

// --- Paper Edges ---

#[tauri::command]
pub fn db_paper_edges_fetch_by_board(
    state: State<'_, DbState>,
    board_id: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::fetch_edges_by_board(&conn, &board_id)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_edges_create(
    state: State<'_, DbState>,
    params: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::create_edge(&conn, &params)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_paper_edges_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    paper_board_repository::delete_edge(&conn, &id).map_err(|e| e.to_string())
}
