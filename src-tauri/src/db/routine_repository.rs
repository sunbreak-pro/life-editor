use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;



#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoutineNode {
    pub id: String,
    pub title: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub is_archived: bool,
    pub is_visible: bool,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
    pub order: i64,
    pub frequency_type: String,
    pub frequency_days: Value,
    pub frequency_interval: Option<i64>,
    pub frequency_start_date: Option<String>,
    pub reminder_enabled: bool,
    pub reminder_offset: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn row_to_routine(row: &rusqlite::Row) -> rusqlite::Result<RoutineNode> {
    let frequency_days_raw: String = row.get("frequency_days")?;
    let frequency_days: Value =
        serde_json::from_str(&frequency_days_raw).unwrap_or(Value::Array(vec![]));
    Ok(RoutineNode {
        id: row.get("id")?,
        title: row.get("title")?,
        start_time: row.get("start_time")?,
        end_time: row.get("end_time")?,
        is_archived: row.get::<_, i64>("is_archived")? != 0,
        is_visible: row.get::<_, i64>("is_visible")? != 0,
        is_deleted: row.get::<_, i64>("is_deleted")? != 0,
        deleted_at: row.get("deleted_at")?,
        order: row.get("order")?,
        frequency_type: row.get::<_, Option<String>>("frequency_type")?
            .unwrap_or_else(|| "daily".to_string()),
        frequency_days,
        frequency_interval: row.get("frequency_interval")?,
        frequency_start_date: row.get("frequency_start_date")?,
        reminder_enabled: row.get::<_, i64>("reminder_enabled")? != 0,
        reminder_offset: row.get("reminder_offset")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<RoutineNode>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM routines WHERE is_archived = 0 AND is_deleted = 0 \
         ORDER BY \"order\" ASC, created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| row_to_routine(row))?;
    rows.collect()
}

pub fn create(
    conn: &Connection,
    id: &str,
    title: &str,
    start_time: Option<&str>,
    end_time: Option<&str>,
    frequency_type: Option<&str>,
    frequency_days: Option<&Value>,
    frequency_interval: Option<i64>,
    frequency_start_date: Option<&str>,
    reminder_enabled: bool,
    reminder_offset: Option<i64>,
) -> rusqlite::Result<RoutineNode> {
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(\"order\"), -1) FROM routines",
        [],
        |row| row.get(0),
    )?;
    let fd_json = frequency_days
        .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()))
        .unwrap_or_else(|| "[]".to_string());

    conn.execute(
        "INSERT INTO routines (id, title, start_time, end_time, is_archived, is_visible, \
         \"order\", frequency_type, frequency_days, frequency_interval, frequency_start_date, \
         reminder_enabled, reminder_offset, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, 0, 1, ?5, ?6, ?7, ?8, ?9, ?10, ?11, \
         datetime('now'), datetime('now'))",
        params![
            id,
            title,
            start_time,
            end_time,
            max_order + 1,
            frequency_type.unwrap_or("daily"),
            fd_json,
            frequency_interval,
            frequency_start_date,
            reminder_enabled as i64,
            reminder_offset,
        ],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM routines WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_routine(row))
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<RoutineNode> {
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
    if let Some(v) = updates.get("isArchived") {
        sets.push("is_archived = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("isVisible") {
        sets.push("is_visible = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("order") {
        sets.push("\"order\" = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("frequencyType") {
        sets.push("frequency_type = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("frequencyDays") {
        sets.push("frequency_days = ?");
        let json = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        values.push(Box::new(json));
    }
    if let Some(v) = updates.get("frequencyInterval") {
        sets.push("frequency_interval = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("frequencyStartDate") {
        sets.push("frequency_start_date = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("reminderEnabled") {
        sets.push("reminder_enabled = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("reminderOffset") {
        sets.push("reminder_offset = ?");
        values.push(Box::new(v.as_i64()));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM routines WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_routine(row));
    }

    sets.push("version = version + 1");
    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE routines SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM routines WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_routine(row))
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM routines WHERE id = ?1", [id])?;
    Ok(())
}

pub fn fetch_deleted(conn: &Connection) -> rusqlite::Result<Vec<RoutineNode>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM routines WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| row_to_routine(row))?;
    rows.collect()
}

pub fn soft_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE routines SET is_deleted = 1, deleted_at = datetime('now'), \
         version = version + 1, updated_at = datetime('now') WHERE id = ?1",
        [id],
    )?;
    Ok(())
}

pub fn restore(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE routines SET is_deleted = 0, deleted_at = NULL, \
         version = version + 1, updated_at = datetime('now') WHERE id = ?1",
        [id],
    )?;
    Ok(())
}

pub fn permanent_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM routines WHERE id = ?1 AND is_deleted = 1",
        [id],
    )?;
    Ok(())
}
