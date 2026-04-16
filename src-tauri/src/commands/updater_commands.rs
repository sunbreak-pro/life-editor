use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub fn updater_check_for_updates(app: AppHandle) -> Result<(), String> {
    // Stub: emit "not-available" status to frontend
    // Will be replaced with tauri-plugin-updater when app signing is configured
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("updater_status", json!({ "event": "not-available", "data": { "version": env!("CARGO_PKG_VERSION") } }));
    }
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
