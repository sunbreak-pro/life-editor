use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleItem {
    pub id: String,
    pub date: String,
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub routine_id: Option<String>,
    pub memo: Option<String>,
    pub note_id: Option<String>,
    pub content: Option<String>,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
    pub is_dismissed: bool,
    pub is_all_day: bool,
    pub reminder_enabled: bool,
    pub reminder_offset: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_schedule_item(row: &rusqlite::Row) -> rusqlite::Result<ScheduleItem> {
    Ok(ScheduleItem {
        id: row.get("id")?,
        date: row.get("date")?,
        title: row.get("title")?,
        start_time: row.get("start_time")?,
        end_time: row.get("end_time")?,
        completed: row.get::<_, i64>("completed")? != 0,
        completed_at: row.get("completed_at")?,
        routine_id: row.get("routine_id")?,
        memo: row.get("memo")?,
        note_id: row.get("note_id")?,
        content: row.get("content")?,
        is_deleted: row.get::<_, i64>("is_deleted")? != 0,
        deleted_at: row.get("deleted_at")?,
        is_dismissed: row.get::<_, i64>("is_dismissed")? != 0,
        is_all_day: row.get::<_, i64>("is_all_day")? != 0,
        reminder_enabled: row.get::<_, i64>("reminder_enabled")? != 0,
        reminder_offset: row.get("reminder_offset")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn fetch_by_date(conn: &Connection, date: &str) -> rusqlite::Result<Vec<ScheduleItem>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM schedule_items \
         WHERE date = ?1 AND is_deleted = 0 AND is_dismissed = 0 \
         ORDER BY start_time",
    )?;
    let rows = stmt.query_map([date], |row| row_to_schedule_item(row))?;
    rows.collect()
}

pub fn fetch_by_date_all(conn: &Connection, date: &str) -> rusqlite::Result<Vec<ScheduleItem>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM schedule_items \
         WHERE date = ?1 AND is_deleted = 0 \
         ORDER BY start_time",
    )?;
    let rows = stmt.query_map([date], |row| row_to_schedule_item(row))?;
    rows.collect()
}

pub fn fetch_by_date_range(
    conn: &Connection,
    start: &str,
    end: &str,
) -> rusqlite::Result<Vec<ScheduleItem>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM schedule_items \
         WHERE date BETWEEN ?1 AND ?2 AND is_deleted = 0 \
         ORDER BY date, start_time",
    )?;
    let rows = stmt.query_map(params![start, end], |row| row_to_schedule_item(row))?;
    rows.collect()
}

pub fn create(
    conn: &Connection,
    id: &str,
    date: &str,
    title: &str,
    start_time: &str,
    end_time: &str,
    routine_id: Option<&str>,
    template_id: Option<&str>,
    note_id: Option<&str>,
    is_all_day: Option<bool>,
    content: Option<&str>,
) -> rusqlite::Result<ScheduleItem> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO schedule_items \
         (id, date, title, start_time, end_time, completed, routine_id, \
          template_id, note_id, is_all_day, content, is_deleted, is_dismissed, \
          reminder_enabled, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8, ?9, ?10, 0, 0, 0, ?11, ?12)",
        params![
            id,
            date,
            title,
            start_time,
            end_time,
            routine_id,
            template_id,
            note_id,
            is_all_day.map(|b| b as i64).unwrap_or(0),
            content,
            &now,
            &now,
        ],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM schedule_items WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_schedule_item(row))
}

pub fn update(
    conn: &Connection,
    id: &str,
    updates: &Value,
) -> rusqlite::Result<ScheduleItem> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("title") {
        sets.push("title = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("startTime") {
        sets.push("start_time = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("endTime") {
        sets.push("end_time = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("completed") {
        sets.push("completed = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("completedAt") {
        sets.push("completed_at = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("memo") {
        sets.push("memo = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("isAllDay") {
        sets.push("is_all_day = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("content") {
        sets.push("content = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("date") {
        sets.push("date = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM schedule_items WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_schedule_item(row));
    }

    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE schedule_items SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM schedule_items WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_schedule_item(row))
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM schedule_items WHERE id = ?1", [id])?;
    Ok(())
}

pub fn soft_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::soft_delete(conn, "schedule_items", id)
}

pub fn restore(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::restore(conn, "schedule_items", id)
}

pub fn permanent_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::permanent_delete(conn, "schedule_items", id)
}

pub fn fetch_deleted(conn: &Connection) -> rusqlite::Result<Vec<ScheduleItem>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM schedule_items WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| row_to_schedule_item(row))?;
    rows.collect()
}

pub fn toggle_complete(conn: &Connection, id: &str) -> rusqlite::Result<ScheduleItem> {
    let current_completed: i64 = conn.query_row(
        "SELECT completed FROM schedule_items WHERE id = ?1",
        [id],
        |row| row.get(0),
    )?;

    if current_completed != 0 {
        conn.execute(
            "UPDATE schedule_items SET completed = 0, completed_at = NULL, \
             updated_at = datetime('now') WHERE id = ?1",
            [id],
        )?;
    } else {
        conn.execute(
            "UPDATE schedule_items SET completed = 1, completed_at = datetime('now'), \
             updated_at = datetime('now') WHERE id = ?1",
            [id],
        )?;
    }

    let mut stmt = conn.prepare("SELECT * FROM schedule_items WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_schedule_item(row))
}

pub fn dismiss(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE schedule_items SET is_dismissed = 1, updated_at = datetime('now') WHERE id = ?1",
        [id],
    )?;
    Ok(())
}

pub fn undismiss(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE schedule_items SET is_dismissed = 0, updated_at = datetime('now') WHERE id = ?1",
        [id],
    )?;
    Ok(())
}

pub fn fetch_last_routine_date(conn: &Connection) -> rusqlite::Result<Option<String>> {
    let result = conn.query_row(
        "SELECT MAX(date) FROM schedule_items WHERE routine_id IS NOT NULL",
        [],
        |row| row.get(0),
    );
    match result {
        Ok(date) => Ok(date),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn bulk_create(conn: &Connection, items: &[Value]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    let now = helpers::now();

    for item in items {
        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let date = item.get("date").and_then(|v| v.as_str()).unwrap_or("");
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("");
        let start_time = item.get("startTime").and_then(|v| v.as_str()).unwrap_or("");
        let end_time = item.get("endTime").and_then(|v| v.as_str()).unwrap_or("");
        let routine_id = item.get("routineId").and_then(|v| v.as_str());
        let template_id = item.get("templateId").and_then(|v| v.as_str());
        let note_id = item.get("noteId").and_then(|v| v.as_str());
        let is_all_day = item.get("isAllDay").and_then(|v| v.as_bool()).unwrap_or(false);
        let content = item.get("content").and_then(|v| v.as_str());

        // Skip if an item with same routine_id+date already exists
        if let Some(rid) = routine_id {
            let exists: bool = tx
                .query_row(
                    "SELECT COUNT(*) > 0 FROM schedule_items \
                     WHERE routine_id = ?1 AND date = ?2",
                    params![rid, date],
                    |row| row.get(0),
                )
                .unwrap_or(false);
            if exists {
                continue;
            }
        }

        tx.execute(
            "INSERT INTO schedule_items \
             (id, date, title, start_time, end_time, completed, routine_id, \
              template_id, note_id, is_all_day, content, is_deleted, is_dismissed, \
              reminder_enabled, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8, ?9, ?10, 0, 0, 0, ?11, ?12)",
            params![
                id,
                date,
                title,
                start_time,
                end_time,
                routine_id,
                template_id,
                note_id,
                is_all_day as i64,
                content,
                &now,
                &now,
            ],
        )?;
    }

    tx.commit()
}

pub fn update_future_by_routine(
    conn: &Connection,
    routine_id: &str,
    updates: &Value,
    from_date: &str,
) -> rusqlite::Result<usize> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("title") {
        sets.push("title = CASE WHEN date >= ? THEN ? ELSE title END");
        values.push(Box::new(from_date.to_string()));
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("startTime") {
        sets.push("start_time = CASE WHEN date >= ? THEN ? ELSE start_time END");
        values.push(Box::new(from_date.to_string()));
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("endTime") {
        sets.push("end_time = CASE WHEN date >= ? THEN ? ELSE end_time END");
        values.push(Box::new(from_date.to_string()));
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("isAllDay") {
        sets.push("is_all_day = CASE WHEN date >= ? THEN ? ELSE is_all_day END");
        values.push(Box::new(from_date.to_string()));
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("content") {
        sets.push("content = CASE WHEN date >= ? THEN ? ELSE content END");
        values.push(Box::new(from_date.to_string()));
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }

    if sets.is_empty() {
        return Ok(0);
    }

    sets.push("updated_at = datetime('now')");
    values.push(Box::new(routine_id.to_string()));

    let sql = format!(
        "UPDATE schedule_items SET {} WHERE routine_id = ? AND is_deleted = 0",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    let changes = conn.execute(&sql, params.as_slice())?;
    Ok(changes)
}

pub fn fetch_by_routine_id(
    conn: &Connection,
    routine_id: &str,
) -> rusqlite::Result<Vec<ScheduleItem>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM schedule_items \
         WHERE routine_id = ?1 AND is_deleted = 0 \
         ORDER BY date, start_time",
    )?;
    let rows = stmt.query_map([routine_id], |row| row_to_schedule_item(row))?;
    rows.collect()
}

pub fn bulk_delete(conn: &Connection, ids: &[String]) -> rusqlite::Result<usize> {
    let tx = conn.unchecked_transaction()?;
    let mut count = 0;

    for id in ids {
        let deleted = tx.execute("DELETE FROM schedule_items WHERE id = ?1", [id])?;
        count += deleted;
    }

    tx.commit()?;
    Ok(count)
}

pub fn fetch_events(conn: &Connection) -> rusqlite::Result<Vec<ScheduleItem>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM schedule_items \
         WHERE routine_id IS NULL AND is_deleted = 0 \
         ORDER BY date, start_time",
    )?;
    let rows = stmt.query_map([], |row| row_to_schedule_item(row))?;
    rows.collect()
}
