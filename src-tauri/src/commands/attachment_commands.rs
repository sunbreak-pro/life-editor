use crate::db::attachment_repository;
use serde_json::Value;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn attachment_save(app: AppHandle, meta: Value, data: Vec<u8>) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let meta: attachment_repository::AttachmentMeta =
        serde_json::from_value(meta).map_err(|e| e.to_string())?;
    attachment_repository::save_meta(&data_dir, &meta)?;
    attachment_repository::save_blob(&data_dir, &meta.id, &data)
}

#[tauri::command]
pub fn attachment_load(app: AppHandle, id: String) -> Result<Option<Vec<u8>>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    attachment_repository::load_blob(&data_dir, &id)
}

#[tauri::command]
pub fn attachment_delete(app: AppHandle, id: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    attachment_repository::delete_permanent(&data_dir, &id)
}

#[tauri::command]
pub fn attachment_fetch_metas(app: AppHandle) -> Result<Vec<attachment_repository::AttachmentMeta>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    attachment_repository::fetch_all_metas(&data_dir)
}
