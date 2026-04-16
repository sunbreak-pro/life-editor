use crate::db::DbState;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const SIX_HOURS: Duration = Duration::from_secs(6 * 60 * 60);

/// Start the auto-archive background loop
pub fn start(app: &AppHandle) {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        // Run immediately, then every 6 hours
        run(&app_handle);
        loop {
            tokio::time::sleep(SIX_HOURS).await;
            run(&app_handle);
        }
    });
    eprintln!("[AutoArchiveService] Started");
}

fn run(app: &AppHandle) {
    let db_state = match app.try_state::<DbState>() {
        Some(s) => s,
        None => return,
    };
    let conn = match db_state.conn.lock() {
        Ok(c) => c,
        Err(_) => return,
    };

    let days: i64 = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'auto_archive_days'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    if days <= 0 {
        return;
    }

    match conn.execute(
        "UPDATE tasks
         SET is_deleted = 1, deleted_at = datetime('now')
         WHERE status = 'DONE'
           AND completed_at IS NOT NULL
           AND completed_at < datetime('now', '-' || ?1 || ' days')
           AND is_deleted = 0",
        [days],
    ) {
        Ok(count) => {
            if count > 0 {
                eprintln!(
                    "[AutoArchiveService] Archived {} completed task(s) older than {} day(s)",
                    count, days
                );
            }
        }
        Err(e) => eprintln!("[AutoArchiveService] Error: {}", e),
    }
}
