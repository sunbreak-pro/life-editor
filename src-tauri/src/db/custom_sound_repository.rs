use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomSoundMeta {
    pub id: String,
    pub label: String,
    pub filename: String,
    pub mime_type: String,
    pub size: i64,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_deleted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
}

fn sounds_dir(data_dir: &Path) -> std::path::PathBuf {
    data_dir.join("custom-sounds")
}

fn meta_file(data_dir: &Path) -> std::path::PathBuf {
    sounds_dir(data_dir).join("_meta.json")
}

fn ensure_dir(data_dir: &Path) {
    let dir = sounds_dir(data_dir);
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
}

fn load_metas(data_dir: &Path) -> Vec<CustomSoundMeta> {
    ensure_dir(data_dir);
    let path = meta_file(data_dir);
    if !path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn write_metas(data_dir: &Path, metas: &[CustomSoundMeta]) {
    ensure_dir(data_dir);
    let path = meta_file(data_dir);
    let json = serde_json::to_string_pretty(metas).unwrap_or_else(|_| "[]".to_string());
    fs::write(path, json).ok();
}

pub fn fetch_all_metas(data_dir: &Path) -> Result<Vec<CustomSoundMeta>, String> {
    let metas = load_metas(data_dir);
    Ok(metas
        .into_iter()
        .filter(|m| !m.is_deleted.unwrap_or(false))
        .collect())
}

pub fn fetch_deleted_metas(data_dir: &Path) -> Result<Vec<CustomSoundMeta>, String> {
    let metas = load_metas(data_dir);
    Ok(metas
        .into_iter()
        .filter(|m| m.is_deleted.unwrap_or(false))
        .collect())
}

pub fn save_meta(data_dir: &Path, meta: CustomSoundMeta) -> Result<(), String> {
    let mut metas = load_metas(data_dir);
    if let Some(idx) = metas.iter().position(|m| m.id == meta.id) {
        metas[idx] = meta;
    } else {
        metas.push(meta);
    }
    write_metas(data_dir, &metas);
    Ok(())
}

pub fn soft_delete_meta(data_dir: &Path, id: &str) -> Result<(), String> {
    let mut metas = load_metas(data_dir);
    if let Some(idx) = metas.iter().position(|m| m.id == id) {
        metas[idx].is_deleted = Some(true);
        metas[idx].deleted_at = Some(chrono::Utc::now().to_rfc3339());
        write_metas(data_dir, &metas);
    }
    Ok(())
}

pub fn restore_meta(data_dir: &Path, id: &str) -> Result<(), String> {
    let mut metas = load_metas(data_dir);
    if let Some(idx) = metas.iter().position(|m| m.id == id) {
        metas[idx].is_deleted = None;
        metas[idx].deleted_at = None;
        write_metas(data_dir, &metas);
    }
    Ok(())
}

pub fn permanent_delete(data_dir: &Path, id: &str) -> Result<(), String> {
    let mut metas = load_metas(data_dir);
    metas.retain(|m| m.id != id);
    write_metas(data_dir, &metas);

    let file_path = sounds_dir(data_dir).join(id);
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn update_label(data_dir: &Path, id: &str, label: &str) -> Result<(), String> {
    let mut metas = load_metas(data_dir);
    if let Some(idx) = metas.iter().position(|m| m.id == id) {
        metas[idx].label = label.to_string();
        write_metas(data_dir, &metas);
    }
    Ok(())
}

pub fn save_blob(data_dir: &Path, id: &str, data: &[u8]) -> Result<(), String> {
    ensure_dir(data_dir);
    let file_path = sounds_dir(data_dir).join(id);
    fs::write(file_path, data).map_err(|e| e.to_string())
}

pub fn load_blob(data_dir: &Path, id: &str) -> Result<Option<Vec<u8>>, String> {
    let file_path = sounds_dir(data_dir).join(id);
    if !file_path.exists() {
        return Ok(None);
    }
    fs::read(file_path).map(Some).map_err(|e| e.to_string())
}
