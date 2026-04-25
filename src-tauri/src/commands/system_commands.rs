use crate::db::{app_settings_repository, DbState};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tauri::State;

/// macOS browser candidates surfaced in Settings → Browser. Order is the
/// presentation order; only entries whose `.app` is present on disk are
/// returned to the renderer (`system_list_browsers`).
const BROWSER_CANDIDATES: &[(&str, &str, &str)] = &[
    ("chrome", "Google Chrome", "/Applications/Google Chrome.app"),
    ("safari", "Safari", "/Applications/Safari.app"),
    ("firefox", "Firefox", "/Applications/Firefox.app"),
    ("edge", "Microsoft Edge", "/Applications/Microsoft Edge.app"),
    ("arc", "Arc", "/Applications/Arc.app"),
    ("brave", "Brave Browser", "/Applications/Brave Browser.app"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserInfo {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn system_get_auto_launch(state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val = app_settings_repository::get(&conn, "autoLaunch").map_err(|e| e.to_string())?;
    Ok(val.as_deref() == Some("true"))
}

#[tauri::command]
pub fn system_set_auto_launch(state: State<'_, DbState>, enabled: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "autoLaunch", &enabled.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_get_start_minimized(state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val =
        app_settings_repository::get(&conn, "startMinimized").map_err(|e| e.to_string())?;
    Ok(val.as_deref() == Some("true"))
}

#[tauri::command]
pub fn system_set_start_minimized(state: State<'_, DbState>, enabled: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "startMinimized", &enabled.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_get_tray_enabled(state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val = app_settings_repository::get(&conn, "trayEnabled").map_err(|e| e.to_string())?;
    Ok(val.as_deref() != Some("false"))
}

#[tauri::command]
pub fn system_set_tray_enabled(
    _app: tauri::AppHandle,
    state: State<'_, DbState>,
    enabled: bool,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "trayEnabled", &enabled.to_string())
        .map_err(|e| e.to_string())?;

    #[cfg(not(mobile))]
    {
        if enabled {
            crate::tray::setup_tray(&_app).map_err(|e| e.to_string())?;
        } else {
            crate::tray::remove_tray(&_app);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn system_get_global_shortcuts(state: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val =
        app_settings_repository::get(&conn, "globalShortcuts").map_err(|e| e.to_string())?;
    match val {
        Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        None => Ok(HashMap::new()),
    }
}

#[tauri::command]
pub fn system_set_global_shortcuts(
    state: State<'_, DbState>,
    shortcuts: HashMap<String, String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&shortcuts).map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "globalShortcuts", &json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_reregister_global_shortcuts(
    _app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let _val =
        app_settings_repository::get(&conn, "globalShortcuts").map_err(|e| e.to_string())?;

    #[cfg(not(mobile))]
    {
        match _val {
            Some(json) => {
                let config: HashMap<String, String> =
                    serde_json::from_str(&json).map_err(|e| e.to_string())?;
                crate::shortcuts::register_shortcuts(&_app, &config);
            }
            None => {
                crate::shortcuts::unregister_all(&_app);
            }
        }
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn system_list_browsers() -> Result<Vec<BrowserInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        let mut found = Vec::new();
        for (id, name, path) in BROWSER_CANDIDATES {
            if std::path::Path::new(path).exists() {
                found.push(BrowserInfo {
                    id: (*id).into(),
                    name: (*name).into(),
                    path: (*path).into(),
                });
            }
        }
        Ok(found)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn system_list_applications() -> Result<Vec<InstalledApp>, String> {
    #[cfg(target_os = "macos")]
    {
        let mut apps = Vec::new();
        let entries = std::fs::read_dir("/Applications").map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(file_name) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            if !file_name.ends_with(".app") {
                continue;
            }
            let name = file_name.trim_end_matches(".app").to_string();
            let path_str = path.to_string_lossy().to_string();
            apps.push(InstalledApp {
                name,
                path: path_str,
            });
        }
        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(apps)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(Vec::new())
    }
}

/// Open `url` in `browser_id`'s browser, or the system default if `browser_id`
/// is None / unknown / not currently installed. Browser ids match
/// `BROWSER_CANDIDATES`.
#[tauri::command]
pub fn system_open_url(url: String, browser_id: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(id) = browser_id.as_deref() {
            if let Some((_, _, path)) = BROWSER_CANDIDATES
                .iter()
                .find(|(candidate_id, _, _)| *candidate_id == id)
            {
                if std::path::Path::new(path).exists() {
                    let status = std::process::Command::new("open")
                        .args(["-a", path, &url])
                        .status()
                        .map_err(|e| e.to_string())?;
                    if !status.success() {
                        return Err(format!("open exited with status: {status:?}"));
                    }
                    return Ok(());
                }
            }
        }
        // Fallback: system default browser via `open <url>`.
        open::that(&url).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = browser_id;
        open::that(&url).map_err(|e| e.to_string())
    }
}

/// Launch a macOS .app at `app_path` via `open -a`. iOS / non-macOS targets
/// return an error so the renderer can show a localized "not supported"
/// notice rather than silently failing.
#[tauri::command]
pub fn system_open_app(app_path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if !std::path::Path::new(&app_path).exists() {
            return Err(format!("App not found: {app_path}"));
        }
        let status = std::process::Command::new("open")
            .args(["-a", &app_path])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!("open exited with status: {status:?}"));
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app_path;
        Err("Launching applications is only supported on macOS".into())
    }
}

#[tauri::command]
pub fn tray_update_timer(_app: tauri::AppHandle, state: Value) -> Result<(), String> {
    #[cfg(not(mobile))]
    {
        let remaining = state
            .get("remaining")
            .and_then(|v| v.as_str())
            .unwrap_or("00:00");
        let is_running = state
            .get("isRunning")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        crate::tray::update_timer(&_app, remaining, is_running);
    }
    #[cfg(mobile)]
    let _ = state;
    Ok(())
}
