use crate::db::{app_settings_repository, helpers, DbState};
use crate::sync::{http_client::SyncClient, sync_engine, types::*};
use tauri::State;

/// Configure sync: save url/token, verify auth, generate device_id.
#[tauri::command]
pub async fn sync_configure(
    state: State<'_, DbState>,
    url: String,
    token: String,
) -> Result<bool, String> {
    // Verify auth first
    let client = SyncClient::new(&url, &token);
    client.verify_auth().await.map_err(|e| e.to_string())?;

    // Save settings
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "sync_url", &url).map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "sync_token", &token).map_err(|e| e.to_string())?;
    app_settings_repository::set(&conn, "sync_enabled", "true").map_err(|e| e.to_string())?;

    // Generate device_id if not exists
    let existing_id =
        app_settings_repository::get(&conn, "sync_device_id").map_err(|e| e.to_string())?;
    if existing_id.is_none() {
        let device_id = helpers::new_uuid();
        app_settings_repository::set(&conn, "sync_device_id", &device_id)
            .map_err(|e| e.to_string())?;
    }

    Ok(true)
}

/// Trigger a sync cycle: push local changes, then pull remote changes.
#[tauri::command]
pub async fn sync_trigger(state: State<'_, DbState>) -> Result<SyncResult, String> {
    // Read sync settings while holding the lock, then release
    let (url, token, last_synced_at, device_id) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let enabled = app_settings_repository::get(&conn, "sync_enabled")
            .map_err(|e| e.to_string())?;
        if enabled.as_deref() != Some("true") {
            return Err(SyncError::NotConfigured.to_string());
        }
        let url = app_settings_repository::get(&conn, "sync_url")
            .map_err(|e| e.to_string())?
            .ok_or_else(|| SyncError::NotConfigured.to_string())?;
        let token = app_settings_repository::get(&conn, "sync_token")
            .map_err(|e| e.to_string())?
            .ok_or_else(|| SyncError::NotConfigured.to_string())?;
        let last = app_settings_repository::get(&conn, "sync_last_synced_at")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string());
        let device = app_settings_repository::get(&conn, "sync_device_id")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(helpers::new_uuid);
        (url, token, last, device)
    };

    // Collect local changes (hold lock briefly)
    let local_changes = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        sync_engine::collect_local_changes(&conn, &last_synced_at)
            .map_err(|e| e.to_string())?
    };

    // Network operations (no lock held)
    let client = SyncClient::new(&url, &token);

    let push_result = client
        .push_changes(&local_changes)
        .await
        .map_err(|e| e.to_string())?;

    let remote_changes = client
        .fetch_changes(&last_synced_at, &device_id)
        .await
        .map_err(|e| e.to_string())?;

    // Apply remote changes (hold lock briefly)
    let pulled = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let count =
            sync_engine::apply_remote_changes(&conn, &remote_changes).map_err(|e| e.to_string())?;

        // Update last_synced_at
        app_settings_repository::set(&conn, "sync_last_synced_at", &remote_changes.timestamp)
            .map_err(|e| e.to_string())?;

        count
    };

    Ok(SyncResult {
        pushed: push_result.pushed,
        pulled,
        timestamp: remote_changes.timestamp,
    })
}

/// Get current sync status.
#[tauri::command]
pub async fn sync_get_status(state: State<'_, DbState>) -> Result<SyncStatus, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let enabled = app_settings_repository::get(&conn, "sync_enabled")
        .map_err(|e| e.to_string())?;
    let last_synced_at = app_settings_repository::get(&conn, "sync_last_synced_at")
        .map_err(|e| e.to_string())?;
    let device_id = app_settings_repository::get(&conn, "sync_device_id")
        .map_err(|e| e.to_string())?;
    let url = app_settings_repository::get(&conn, "sync_url")
        .map_err(|e| e.to_string())?;

    Ok(SyncStatus {
        enabled: enabled.as_deref() == Some("true"),
        last_synced_at,
        device_id,
        url,
    })
}

/// Disconnect sync: clear all sync settings.
#[tauri::command]
pub async fn sync_disconnect(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    app_settings_repository::remove(&conn, "sync_enabled").map_err(|e| e.to_string())?;
    app_settings_repository::remove(&conn, "sync_token").map_err(|e| e.to_string())?;
    app_settings_repository::remove(&conn, "sync_url").map_err(|e| e.to_string())?;
    app_settings_repository::remove(&conn, "sync_last_synced_at").map_err(|e| e.to_string())?;
    // Keep sync_device_id for future reconnection
    Ok(())
}

/// Force a full download from cloud, ignoring last_synced_at.
#[tauri::command]
pub async fn sync_full_download(state: State<'_, DbState>) -> Result<SyncResult, String> {
    let (url, token) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let enabled = app_settings_repository::get(&conn, "sync_enabled")
            .map_err(|e| e.to_string())?;
        if enabled.as_deref() != Some("true") {
            return Err(SyncError::NotConfigured.to_string());
        }
        let url = app_settings_repository::get(&conn, "sync_url")
            .map_err(|e| e.to_string())?
            .ok_or_else(|| SyncError::NotConfigured.to_string())?;
        let token = app_settings_repository::get(&conn, "sync_token")
            .map_err(|e| e.to_string())?
            .ok_or_else(|| SyncError::NotConfigured.to_string())?;
        (url, token)
    };

    // Push all local data first
    let all_local = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        sync_engine::collect_all(&conn).map_err(|e| e.to_string())?
    };

    let client = SyncClient::new(&url, &token);
    let push_result = client
        .push_changes(&all_local)
        .await
        .map_err(|e| e.to_string())?;

    // Then pull everything
    let remote = client.fetch_full().await.map_err(|e| e.to_string())?;

    let pulled = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let count =
            sync_engine::apply_remote_changes(&conn, &remote).map_err(|e| e.to_string())?;
        app_settings_repository::set(&conn, "sync_last_synced_at", &remote.timestamp)
            .map_err(|e| e.to_string())?;
        count
    };

    Ok(SyncResult {
        pushed: push_result.pushed,
        pulled,
        timestamp: remote.timestamp,
    })
}
