use serde_json::Value;

#[tauri::command]
pub fn copy_note_to_file(note_id: String, directory_path: String) -> Result<String, String> {
    let _ = (note_id, directory_path);
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn copy_memo_to_file(memo_date: String, directory_path: String) -> Result<String, String> {
    let _ = (memo_date, directory_path);
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn copy_convert_file_to_tiptap(relative_file_path: String) -> Result<Value, String> {
    let _ = relative_file_path;
    Err("Not implemented yet".to_string())
}
