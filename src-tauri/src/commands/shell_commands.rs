#[tauri::command]
pub fn shell_open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn shell_open_path(id: String) -> Result<(), String> {
    open::that(&id).map_err(|e| e.to_string())
}
