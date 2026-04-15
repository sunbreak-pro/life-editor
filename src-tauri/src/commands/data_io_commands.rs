// Data I/O commands - Phase 2 で dialog API と統合時に実装
#[tauri::command]
pub fn data_export() -> Result<bool, String> {
    Ok(false) // stub: requires dialog API
}

#[tauri::command]
pub fn data_import() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub fn data_reset() -> Result<bool, String> {
    Ok(false)
}
