#[cfg(not(mobile))]
mod desktop {
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
}

#[cfg(not(mobile))]
pub use desktop::*;

#[cfg(mobile)]
mod mobile {
    #[tauri::command]
    pub fn terminal_create() -> Result<String, String> {
        Err("Terminal is not available on mobile".to_string())
    }

    #[tauri::command]
    pub fn terminal_write(_session_id: String, _data: String) -> Result<(), String> {
        Err("Terminal is not available on mobile".to_string())
    }

    #[tauri::command]
    pub fn terminal_resize(
        _session_id: String,
        _cols: u16,
        _rows: u16,
    ) -> Result<(), String> {
        Err("Terminal is not available on mobile".to_string())
    }

    #[tauri::command]
    pub fn terminal_destroy(_session_id: String) -> Result<(), String> {
        Err("Terminal is not available on mobile".to_string())
    }

    #[tauri::command]
    pub fn terminal_claude_state(_session_id: String) -> Result<String, String> {
        Err("Terminal is not available on mobile".to_string())
    }
}

#[cfg(mobile)]
pub use mobile::*;
