#[tauri::command]
pub fn updater_check_for_updates() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn updater_download_update() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn updater_install_update() -> Result<(), String> {
    Ok(())
}
