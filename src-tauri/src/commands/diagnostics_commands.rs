use serde_json::Value;

#[tauri::command]
pub fn diagnostics_fetch_logs(options: Option<Value>) -> Result<Vec<Value>, String> {
    let _ = options;
    Ok(vec![])
}

#[tauri::command]
pub fn diagnostics_open_log_folder() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn diagnostics_export_logs() -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub fn diagnostics_fetch_metrics() -> Result<Vec<Value>, String> {
    Ok(vec![])
}

#[tauri::command]
pub fn diagnostics_reset_metrics() -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub fn diagnostics_fetch_system_info() -> Result<Value, String> {
    Ok(serde_json::json!({
        "appVersion": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}
