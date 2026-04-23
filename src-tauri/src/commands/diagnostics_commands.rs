use crate::db::DbState;
use serde_json::Value;
use tauri::State;

fn data_dir() -> Result<std::path::PathBuf, String> {
    dirs::data_dir()
        .ok_or_else(|| "failed to resolve data dir".to_string())
        .map(|d| d.join("life-editor"))
}

fn log_dir() -> Result<std::path::PathBuf, String> {
    data_dir().map(|d| d.join("logs"))
}

fn log_file() -> Result<std::path::PathBuf, String> {
    log_dir().map(|d| d.join("main.log"))
}

#[tauri::command]
pub fn diagnostics_fetch_logs(options: Option<Value>) -> Result<Vec<Value>, String> {
    let log_path = log_file()?;
    if !log_path.exists() {
        return Ok(vec![]);
    }

    let limit = options
        .as_ref()
        .and_then(|o| o["limit"].as_u64())
        .unwrap_or(200) as usize;
    let level_filter = options
        .as_ref()
        .and_then(|o| o["level"].as_str())
        .map(|s| s.to_lowercase());

    let content = std::fs::read_to_string(&log_path).map_err(|e| e.to_string())?;
    let log_re = regex::Regex::new(
        r"^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\] \[(\w+)\]\s*(.*)",
    )
    .map_err(|e| e.to_string())?;

    let mut entries: Vec<Value> = Vec::new();
    for line in content.lines() {
        if let Some(caps) = log_re.captures(line) {
            let level = caps[2].to_string();
            if let Some(ref filter) = level_filter {
                if filter != "all" && level.to_lowercase() != *filter {
                    continue;
                }
            }
            entries.push(serde_json::json!({
                "timestamp": &caps[1],
                "level": level,
                "message": &caps[3],
            }));
        }
    }

    // Return last N entries
    let start = entries.len().saturating_sub(limit);
    Ok(entries[start..].to_vec())
}

#[tauri::command]
pub fn diagnostics_open_log_folder() -> Result<(), String> {
    let dir = log_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    open::that(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn diagnostics_export_logs(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;

    let log_path = log_file()?;
    if !log_path.exists() {
        return Ok(false);
    }

    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let default_name = format!("life-editor-logs-{}.log", date);
    let save_path = app
        .dialog()
        .file()
        .add_filter("Log Files", &["log", "txt"])
        .set_file_name(&default_name)
        .blocking_save_file();

    match save_path {
        Some(path) => {
            std::fs::copy(&log_path, path.as_path().ok_or("Invalid file path")?).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[tauri::command]
pub fn diagnostics_fetch_metrics() -> Result<Vec<Value>, String> {
    // IPC metrics tracking not implemented in Tauri — return empty
    Ok(vec![])
}

#[tauri::command]
pub fn diagnostics_reset_metrics() -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub fn diagnostics_fetch_system_info(state: State<'_, DbState>) -> Result<Value, String> {
    let dir = data_dir()?;
    let db_path = dir.join("life-editor.db");

    let db_size_bytes: u64 = if db_path.exists() {
        std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tables = [
        "tasks",
        "timer_sessions",
        "sound_settings",
        "dailies",
        "notes",
        "routines",
    ];
    let mut table_counts = serde_json::Map::new();
    for table in &tables {
        let count: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM \"{}\"", table),
                [],
                |row| row.get(0),
            )
            .unwrap_or(-1);
        table_counts.insert(table.to_string(), Value::from(count));
    }

    Ok(serde_json::json!({
        "appVersion": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "dbSizeBytes": db_size_bytes,
        "memoryUsage": {
            "heapUsed": 0,
            "heapTotal": 0,
            "rss": 0
        },
        "tableCounts": table_counts,
    }))
}
