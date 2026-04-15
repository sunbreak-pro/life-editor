use crate::db::sound_repository;
use crate::db::DbState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn db_sound_fetch_settings(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::fetch_settings(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_update_setting(
    state: State<'_, DbState>,
    sound_type: String,
    volume: i64,
    enabled: bool,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::update_setting(&conn, &sound_type, volume, enabled)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_fetch_presets(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::fetch_presets(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_create_preset(
    state: State<'_, DbState>,
    name: String,
    settings_json: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::create_preset(&conn, &name, &settings_json)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_delete_preset(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::delete_preset(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_sound_fetch_all_sound_tags(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::fetch_all_sound_tags(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_create_sound_tag(
    state: State<'_, DbState>,
    name: String,
    color: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::create_sound_tag(&conn, &name, &color)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_update_sound_tag(
    state: State<'_, DbState>,
    id: i64,
    updates: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::update_sound_tag(&conn, id, &updates)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_delete_sound_tag(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::delete_sound_tag(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_sound_fetch_tags_for_sound(
    state: State<'_, DbState>,
    sound_id: String,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::fetch_tags_for_sound(&conn, &sound_id)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_set_tags_for_sound(
    state: State<'_, DbState>,
    sound_id: String,
    tag_ids: Vec<i64>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::set_tags_for_sound(&conn, &sound_id, &tag_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_sound_fetch_all_sound_tag_assignments(
    state: State<'_, DbState>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::fetch_all_sound_tag_assignments(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_fetch_all_sound_display_meta(
    state: State<'_, DbState>,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::fetch_all_sound_display_meta(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_update_sound_display_meta(
    state: State<'_, DbState>,
    sound_id: String,
    display_name: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::update_sound_display_meta(&conn, &sound_id, &display_name)
        .map_err(|e| e.to_string())
        .map(|_| ())
}

#[tauri::command]
pub fn db_sound_fetch_workscreen_selections(state: State<'_, DbState>) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::fetch_workscreen_selections(&conn)
        .map_err(|e| e.to_string())
        .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_sound_set_workscreen_selections(
    state: State<'_, DbState>,
    sound_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    sound_repository::set_workscreen_selections(&conn, &sound_ids).map_err(|e| e.to_string())
}
