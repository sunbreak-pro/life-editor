use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentMeta {
    pub id: String,
    #[serde(rename = "type")]
    pub attachment_type: String,
    pub filename: String,
    pub mime_type: String,
    pub size: i64,
    pub created_at: String,
}

fn attachments_dir(data_dir: &Path) -> std::path::PathBuf {
    data_dir.join("attachments")
}

fn meta_path(data_dir: &Path) -> std::path::PathBuf {
    attachments_dir(data_dir).join("_meta.json")
}

fn blob_path(data_dir: &Path, id: &str) -> std::path::PathBuf {
    attachments_dir(data_dir).join(id)
}

fn ensure_dir(data_dir: &Path) -> Result<(), String> {
    let dir = attachments_dir(data_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create attachments dir: {}", e))
}

fn read_all_metas(data_dir: &Path) -> Result<Vec<AttachmentMeta>, String> {
    let path = meta_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read _meta.json: {}", e))?;
    let metas: Vec<AttachmentMeta> =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse _meta.json: {}", e))?;
    Ok(metas)
}

fn write_all_metas(data_dir: &Path, metas: &[AttachmentMeta]) -> Result<(), String> {
    ensure_dir(data_dir)?;
    let content = serde_json::to_string_pretty(metas)
        .map_err(|e| format!("Failed to serialize metas: {}", e))?;
    fs::write(meta_path(data_dir), content)
        .map_err(|e| format!("Failed to write _meta.json: {}", e))
}

pub fn fetch_all_metas(data_dir: &Path) -> Result<Vec<AttachmentMeta>, String> {
    read_all_metas(data_dir)
}

pub fn save_meta(data_dir: &Path, meta: &AttachmentMeta) -> Result<(), String> {
    let mut metas = read_all_metas(data_dir)?;

    // Update existing or append new
    if let Some(existing) = metas.iter_mut().find(|m| m.id == meta.id) {
        *existing = meta.clone();
    } else {
        metas.push(meta.clone());
    }

    write_all_metas(data_dir, &metas)
}

pub fn save_blob(data_dir: &Path, id: &str, data: &[u8]) -> Result<(), String> {
    ensure_dir(data_dir)?;
    fs::write(blob_path(data_dir, id), data)
        .map_err(|e| format!("Failed to write blob {}: {}", id, e))
}

pub fn load_blob(data_dir: &Path, id: &str) -> Result<Option<Vec<u8>>, String> {
    let path = blob_path(data_dir, id);
    if !path.exists() {
        return Ok(None);
    }
    let data =
        fs::read(&path).map_err(|e| format!("Failed to read blob {}: {}", id, e))?;
    Ok(Some(data))
}

pub fn delete_permanent(data_dir: &Path, id: &str) -> Result<(), String> {
    // Remove blob file
    let path = blob_path(data_dir, id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete blob {}: {}", id, e))?;
    }

    // Remove from meta
    let mut metas = read_all_metas(data_dir)?;
    metas.retain(|m| m.id != id);
    write_all_metas(data_dir, &metas)
}
