use crate::db::custom_sound_repository;
use crate::db::custom_sound_repository::CustomSoundMeta;
use serde_json::Value;
use tauri::{AppHandle, State};
use crate::db::DbState;

#[tauri::command]
pub fn db_custom_sound_save(
    _app: AppHandle,
    _state: State<'_, DbState>,
    meta: Value,
    data: Vec<u8>,
) -> Result<(), String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    let parsed_meta: CustomSoundMeta =
        serde_json::from_value(meta).map_err(|e| e.to_string())?;
    let id = parsed_meta.id.clone();
    custom_sound_repository::save_meta(&data_dir, parsed_meta)?;
    custom_sound_repository::save_blob(&data_dir, &id, &data)
}

#[tauri::command]
pub fn db_custom_sound_load(
    _app: AppHandle,
    _state: State<'_, DbState>,
    id: String,
) -> Result<Option<Vec<u8>>, String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    custom_sound_repository::load_blob(&data_dir, &id)
}

#[tauri::command]
pub fn db_custom_sound_delete(
    _app: AppHandle,
    _state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    custom_sound_repository::soft_delete_meta(&data_dir, &id)
}

#[tauri::command]
pub fn db_custom_sound_fetch_metas(_app: AppHandle) -> Result<Value, String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    custom_sound_repository::fetch_all_metas(&data_dir)
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_custom_sound_fetch_deleted(_app: AppHandle) -> Result<Value, String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    custom_sound_repository::fetch_deleted_metas(&data_dir)
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_custom_sound_restore(_app: AppHandle, id: String) -> Result<(), String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    custom_sound_repository::restore_meta(&data_dir, &id)
}

#[tauri::command]
pub fn db_custom_sound_permanent_delete(
    _app: AppHandle,
    _state: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    custom_sound_repository::permanent_delete(&data_dir, &id)
}

#[tauri::command]
pub fn db_custom_sound_update_label(
    _app: AppHandle,
    id: String,
    label: String,
) -> Result<(), String> {
    let data_dir = dirs::data_dir().ok_or("failed to resolve data dir")?.join("life-editor");
    custom_sound_repository::update_label(&data_dir, &id, &label)
}
