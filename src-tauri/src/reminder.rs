use crate::db::DbState;
use rusqlite::Connection;
use serde_json::json;
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const CHECK_INTERVAL: Duration = Duration::from_secs(60);

static FIRED_REMINDERS: Mutex<Option<HashSet<String>>> = Mutex::new(None);
static FIRED_DAILY_REVIEW: Mutex<Option<String>> = Mutex::new(None);

/// Start the reminder background loop
pub fn start(app: &AppHandle) {
    {
        let mut guard = FIRED_REMINDERS.lock().unwrap();
        *guard = Some(HashSet::new());
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(CHECK_INTERVAL).await;
            check(&app_handle);
        }
    });
    eprintln!("[ReminderService] Started");
}

fn check(app: &AppHandle) {
    let db_state = app.try_state::<DbState>();
    let db_state = match db_state {
        Some(s) => s,
        None => return,
    };
    let conn = match db_state.conn.lock() {
        Ok(c) => c,
        Err(_) => return,
    };

    let _ = check_task_reminders(app, &conn);
    let _ = check_per_item_reminders(app, &conn);
    let _ = check_daily_review(app, &conn);
}

fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        [key],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

fn fire_reminder(app: &AppHandle, dedup_key: &str, title: &str, reminder_type: &str) {
    let mut guard = FIRED_REMINDERS.lock().unwrap();
    let fired = guard.get_or_insert_with(HashSet::new);
    if fired.contains(dedup_key) {
        return;
    }
    fired.insert(dedup_key.to_string());

    // Send notification via plugin
    #[cfg(not(target_os = "ios"))]
    {
        use tauri_plugin_notification::NotificationExt;
        let _ = app
            .notification()
            .builder()
            .title("Reminder")
            .body(title)
            .show();
    }

    // Emit to frontend
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(
            "reminder_notify",
            json!({ "id": dedup_key, "title": title, "type": reminder_type }),
        );
    }
}

fn check_task_reminders(app: &AppHandle, conn: &Connection) -> Result<(), String> {
    let enabled = get_setting(conn, "reminder_enabled");
    if enabled.as_deref() != Some("true") {
        return Ok(());
    }

    let offset_str = get_setting(conn, "reminder_default_offset").unwrap_or("30".to_string());
    let offset: i64 = offset_str.parse().unwrap_or(30);

    let mut stmt = conn
        .prepare(
            "SELECT id, title FROM tasks
             WHERE scheduled_at IS NOT NULL
               AND scheduled_at <= datetime('now', '+' || ?1 || ' minutes')
               AND scheduled_at > datetime('now')
               AND status != 'DONE'
               AND is_deleted = 0",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([offset], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        if let Ok((id, title)) = row {
            fire_reminder(app, &id, &title, "taskDue");
        }
    }
    Ok(())
}

fn check_per_item_reminders(app: &AppHandle, conn: &Connection) -> Result<(), String> {
    let default_offset_str =
        get_setting(conn, "reminder_default_offset").unwrap_or("30".to_string());
    let default_offset: i64 = default_offset_str.parse().unwrap_or(30);

    // Per-item task reminders
    let mut stmt = conn
        .prepare(
            "SELECT id, title, scheduled_at, reminder_offset
             FROM tasks
             WHERE reminder_enabled = 1
               AND scheduled_at IS NOT NULL
               AND status != 'DONE'
               AND is_deleted = 0",
        )
        .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().timestamp_millis();

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        if let Ok((id, title, scheduled_at, reminder_offset)) = row {
            let offset = reminder_offset.unwrap_or(default_offset);
            if let Ok(scheduled) = chrono::NaiveDateTime::parse_from_str(&scheduled_at, "%Y-%m-%d %H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(&scheduled_at, "%Y-%m-%dT%H:%M:%S"))
            {
                let scheduled_ms = scheduled.and_utc().timestamp_millis();
                let reminder_ms = scheduled_ms - offset * 60_000;
                if now >= reminder_ms && now < scheduled_ms {
                    fire_reminder(app, &format!("task:{}", id), &title, "itemReminder");
                }
            }
        }
    }

    // Per-item schedule item reminders
    let mut stmt2 = conn
        .prepare(
            "SELECT id, title, datetime(date || 'T' || start_time) as scheduled_datetime, reminder_offset
             FROM schedule_items
             WHERE reminder_enabled = 1
               AND completed = 0
               AND is_dismissed = 0
               AND is_all_day = 0",
        )
        .map_err(|e| e.to_string())?;

    let rows2 = stmt2
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows2 {
        if let Ok((id, title, scheduled_datetime, reminder_offset)) = row {
            let offset = reminder_offset.unwrap_or(default_offset);
            if let Ok(scheduled) =
                chrono::NaiveDateTime::parse_from_str(&scheduled_datetime, "%Y-%m-%dT%H:%M:%S")
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(&scheduled_datetime, "%Y-%m-%d %H:%M:%S"))
            {
                let scheduled_ms = scheduled.and_utc().timestamp_millis();
                let reminder_ms = scheduled_ms - offset * 60_000;
                if now >= reminder_ms && now < scheduled_ms {
                    fire_reminder(app, &format!("schedule:{}", id), &title, "itemReminder");
                }
            }
        }
    }

    Ok(())
}

fn check_daily_review(app: &AppHandle, conn: &Connection) -> Result<(), String> {
    let enabled = get_setting(conn, "daily_review_enabled");
    if enabled.as_deref() != Some("true") {
        return Ok(());
    }

    let review_time = get_setting(conn, "daily_review_time").unwrap_or("21:00".to_string());
    let now = chrono::Local::now();
    let current_time = now.format("%H:%M").to_string();
    let today_str = now.format("%Y-%m-%d").to_string();

    if current_time != review_time {
        return Ok(());
    }

    let mut guard = FIRED_DAILY_REVIEW.lock().unwrap();
    if guard.as_deref() == Some(today_str.as_str()) {
        return Ok(());
    }
    *guard = Some(today_str.clone());

    #[cfg(not(target_os = "ios"))]
    {
        use tauri_plugin_notification::NotificationExt;
        let _ = app
            .notification()
            .builder()
            .title("Daily Review")
            .body("Time to review your day!")
            .show();
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(
            "reminder_notify",
            json!({
                "id": format!("daily-review-{}", today_str),
                "title": "Daily Review",
                "type": "dailyReview",
            }),
        );
    }

    Ok(())
}
