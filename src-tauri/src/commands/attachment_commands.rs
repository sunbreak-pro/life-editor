use crate::db::attachment_repository;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub fn attachment_save(_app: AppHandle, meta: Value, data: Vec<u8>) -> Result<(), String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    let meta: attachment_repository::AttachmentMeta =
        serde_json::from_value(meta).map_err(|e| e.to_string())?;
    attachment_repository::save_meta(&data_dir, &meta)?;
    attachment_repository::save_blob(&data_dir, &meta.id, &data)
}

#[tauri::command]
pub fn attachment_load(_app: AppHandle, id: String) -> Result<Option<Vec<u8>>, String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    attachment_repository::load_blob(&data_dir, &id)
}

#[tauri::command]
pub fn attachment_delete(_app: AppHandle, id: String) -> Result<(), String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    attachment_repository::delete_permanent(&data_dir, &id)
}

#[tauri::command]
pub fn attachment_fetch_metas(_app: AppHandle) -> Result<Vec<attachment_repository::AttachmentMeta>, String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    attachment_repository::fetch_all_metas(&data_dir)
}
