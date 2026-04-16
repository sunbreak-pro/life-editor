use crate::terminal::pty_manager::PtyState;
use tauri::State;

#[tauri::command]
pub fn terminal_create(state: State<'_, PtyState>) -> Result<String, String> {
    state.create()
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.write(&session_id, &data)
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, PtyState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows)
}

#[tauri::command]
pub fn terminal_destroy(
    state: State<'_, PtyState>,
    session_id: String,
) -> Result<(), String> {
    state.destroy(&session_id)
}

#[tauri::command]
pub fn terminal_claude_state(
    state: State<'_, PtyState>,
    session_id: String,
) -> Result<String, String> {
    Ok(state.get_claude_state(&session_id))
}
