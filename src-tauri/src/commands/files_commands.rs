use serde_json::Value;

// File system commands - Phase 2 で実装
#[tauri::command]
pub fn files_select_folder() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
pub fn files_get_root_path() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
pub fn files_list_directory(relative_path: String) -> Result<Vec<Value>, String> {
    let _ = relative_path;
    Ok(vec![])
}

#[tauri::command]
pub fn files_get_file_info(relative_path: String) -> Result<Value, String> {
    let _ = relative_path;
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_read_text_file(relative_path: String) -> Result<String, String> {
    let _ = relative_path;
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_read_file(relative_path: String) -> Result<Vec<u8>, String> {
    let _ = relative_path;
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_create_directory(relative_path: String) -> Result<(), String> {
    let _ = relative_path;
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_create_file(relative_path: String) -> Result<(), String> {
    let _ = relative_path;
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_write_text_file(relative_path: String, content: String) -> Result<(), String> {
    let _ = (relative_path, content);
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_rename(old_path: String, new_path: String) -> Result<(), String> {
    let _ = (old_path, new_path);
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_move(source_path: String, dest_path: String) -> Result<(), String> {
    let _ = (source_path, dest_path);
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_delete(relative_path: String) -> Result<(), String> {
    let _ = relative_path;
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn files_open_in_system(relative_path: String) -> Result<(), String> {
    let _ = relative_path;
    Err("Not implemented yet".to_string())
}
