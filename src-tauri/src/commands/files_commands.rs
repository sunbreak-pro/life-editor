use crate::db::{app_settings_repository, DbState};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

const SETTINGS_KEY: &str = "files_root_path";
const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    name: String,
    relative_path: String,
    #[serde(rename = "type")]
    entry_type: String,
    size: u64,
    modified_at: String,
    extension: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInfo {
    name: String,
    relative_path: String,
    #[serde(rename = "type")]
    entry_type: String,
    size: u64,
    modified_at: String,
    extension: String,
    created_at: String,
    mime_type: String,
}

fn get_root_path_from_db(state: &State<'_, DbState>) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::get(&conn, SETTINGS_KEY).map_err(|e| e.to_string())
}

fn validate_path(root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root_pb = PathBuf::from(root);
    let root = root_pb.canonicalize().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            format!(
                "Configured root folder not found: {}. Please reconfigure in Settings.",
                root_pb.display()
            )
        } else {
            format!("Cannot access root folder: {}", e)
        }
    })?;
    let resolved = root.join(relative_path);
    // Canonicalize parent if path doesn't exist yet, or full path if it does
    let check_path = if resolved.exists() {
        resolved.canonicalize().map_err(|e| e.to_string())?
    } else {
        let parent = resolved
            .parent()
            .ok_or("Invalid path")?
            .canonicalize()
            .map_err(|e| e.to_string())?;
        parent.join(resolved.file_name().ok_or("Invalid filename")?)
    };
    if !check_path.starts_with(&root) {
        return Err("Path traversal detected".to_string());
    }
    Ok(check_path)
}

fn get_mime_type(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "txt" | "log" | "toml" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "yaml" | "yml" => "text/yaml",
        "xml" => "application/xml",
        "csv" => "text/csv",
        "ts" | "tsx" => "text/typescript",
        "js" | "jsx" => "text/javascript",
        "html" => "text/html",
        "css" | "scss" => "text/css",
        "py" => "text/x-python",
        "go" => "text/x-go",
        "rs" => "text/x-rust",
        "java" => "text/x-java",
        "c" | "h" => "text/x-c",
        "cpp" => "text/x-c++",
        "sh" => "text/x-shellscript",
        "sql" => "text/x-sql",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "mkv" => "video/x-matroska",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "gz" => "application/gzip",
        "tar" => "application/x-tar",
        _ => "application/octet-stream",
    }
}

fn stat_to_entry(root: &Path, path: &Path, meta: &fs::Metadata) -> FileEntry {
    let rel = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            Some(dt.to_rfc3339())
        })
        .unwrap_or_default();

    FileEntry {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        relative_path: rel,
        entry_type: if meta.is_dir() {
            "directory".to_string()
        } else {
            "file".to_string()
        },
        size: meta.len(),
        modified_at: modified,
        extension: if ext.is_empty() {
            String::new()
        } else {
            format!(".{}", ext)
        },
    }
}

#[tauri::command]
pub async fn files_select_folder(
    _app: tauri::AppHandle,
    _state: State<'_, DbState>,
) -> Result<Option<String>, String> {
    #[cfg(not(mobile))]
    {
        use tauri_plugin_dialog::DialogExt;

        let picked = _app.dialog().file().blocking_pick_folder();
        match picked {
            Some(path) => {
                let path_str = path.to_string();
                let conn = _state.conn.lock().map_err(|e| e.to_string())?;
                app_settings_repository::set(&conn, SETTINGS_KEY, &path_str)
                    .map_err(|e| e.to_string())?;
                Ok(Some(path_str))
            }
            None => Ok(None),
        }
    }
    #[cfg(mobile)]
    {
        Err("Folder selection is not available on mobile".to_string())
    }
}

#[tauri::command]
pub fn files_get_root_path(state: State<'_, DbState>) -> Result<Option<String>, String> {
    get_root_path_from_db(&state)
}

#[tauri::command]
pub fn files_list_directory(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<Vec<Value>, String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    if !abs_path.is_dir() {
        return Err(format!("Not a directory: {}", relative_path));
    }

    let root_path = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let mut entries: Vec<FileEntry> = Vec::new();

    for entry in fs::read_dir(&abs_path).map_err(|e| e.to_string())? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            entries.push(stat_to_entry(&root_path, &entry.path(), &meta));
        }
    }

    // Directories first, then alphabetical
    entries.sort_by(|a, b| {
        if a.entry_type != b.entry_type {
            if a.entry_type == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    serde_json::to_value(entries)
        .map(|v| match v {
            Value::Array(arr) => arr,
            _ => vec![],
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_get_file_info(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<Value, String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    if !abs_path.exists() {
        return Err(format!("File not found: {}", relative_path));
    }

    let meta = fs::metadata(&abs_path).map_err(|e| e.to_string())?;
    let root_path = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let entry = stat_to_entry(&root_path, &abs_path, &meta);

    let ext = abs_path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let created = meta
        .created()
        .ok()
        .and_then(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            Some(dt.to_rfc3339())
        })
        .unwrap_or_default();

    let info = FileInfo {
        name: entry.name,
        relative_path: entry.relative_path,
        entry_type: entry.entry_type,
        size: entry.size,
        modified_at: entry.modified_at,
        extension: entry.extension,
        created_at: created,
        mime_type: get_mime_type(&ext).to_string(),
    };

    serde_json::to_value(info).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_read_text_file(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<String, String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    let meta = fs::metadata(&abs_path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File too large: {} bytes (max {})",
            meta.len(),
            MAX_FILE_SIZE
        ));
    }

    fs::read_to_string(&abs_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_read_file(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    let meta = fs::metadata(&abs_path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File too large: {} bytes (max {})",
            meta.len(),
            MAX_FILE_SIZE
        ));
    }

    fs::read(&abs_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_create_directory(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<(), String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    if abs_path.exists() {
        return Err(format!("Already exists: {}", relative_path));
    }
    fs::create_dir_all(&abs_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_create_file(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<(), String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    if abs_path.exists() {
        return Err(format!("Already exists: {}", relative_path));
    }
    if let Some(parent) = abs_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&abs_path, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_write_text_file(
    state: State<'_, DbState>,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    if let Some(parent) = abs_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&abs_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_rename(
    state: State<'_, DbState>,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let old_abs = validate_path(&root, &old_path)?;
    let new_abs = validate_path(&root, &new_path)?;

    if !old_abs.exists() {
        return Err(format!("Not found: {}", old_path));
    }
    if new_abs.exists() {
        return Err(format!("Already exists: {}", new_path));
    }
    fs::rename(&old_abs, &new_abs).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_move(
    state: State<'_, DbState>,
    source_path: String,
    dest_path: String,
) -> Result<(), String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let src_abs = validate_path(&root, &source_path)?;
    let dst_abs = validate_path(&root, &dest_path)?;

    if !src_abs.exists() {
        return Err(format!("Not found: {}", source_path));
    }
    if dst_abs.exists() {
        return Err(format!("Already exists: {}", dest_path));
    }
    if let Some(parent) = dst_abs.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::rename(&src_abs, &dst_abs).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_delete(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<(), String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    if !abs_path.exists() {
        return Err(format!("Not found: {}", relative_path));
    }

    #[cfg(not(mobile))]
    {
        trash::delete(&abs_path).map_err(|e| e.to_string())
    }
    #[cfg(mobile)]
    {
        if abs_path.is_dir() {
            std::fs::remove_dir_all(&abs_path).map_err(|e| e.to_string())
        } else {
            std::fs::remove_file(&abs_path).map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub fn files_open_in_system(
    state: State<'_, DbState>,
    relative_path: String,
) -> Result<(), String> {
    let root = get_root_path_from_db(&state)?.ok_or("No root path configured")?;
    let abs_path = validate_path(&root, &relative_path)?;

    if !abs_path.exists() {
        return Err(format!("Not found: {}", relative_path));
    }
    open::that(&abs_path).map_err(|e| e.to_string())
}
