use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroPreset {
    pub id: i64,
    pub name: String,
    pub work_duration: i64,
    pub break_duration: i64,
    pub long_break_duration: i64,
    pub sessions_before_long_break: i64,
    pub created_at: String,
}

impl FromRow for PomodoroPreset {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(PomodoroPreset {
            id: row.get("id")?,
            name: row.get("name")?,
            work_duration: row.get("work_duration")?,
            break_duration: row.get("break_duration")?,
            long_break_duration: row.get("long_break_duration")?,
            sessions_before_long_break: row.get("sessions_before_long_break")?,
            created_at: row.get("created_at")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<PomodoroPreset>> {
    query_all(conn, "SELECT * FROM pomodoro_presets ORDER BY id ASC", [])
}

pub fn create(conn: &Connection, preset: &Value) -> rusqlite::Result<PomodoroPreset> {
    let name = preset.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let work_duration = preset.get("workDuration").and_then(|v| v.as_i64()).unwrap_or(25);
    let break_duration = preset.get("breakDuration").and_then(|v| v.as_i64()).unwrap_or(5);
    let long_break_duration = preset
        .get("longBreakDuration")
        .and_then(|v| v.as_i64())
        .unwrap_or(15);
    let sessions_before_long_break = preset
        .get("sessionsBeforeLongBreak")
        .and_then(|v| v.as_i64())
        .unwrap_or(4);

    conn.execute(
        "INSERT INTO pomodoro_presets \
         (name, work_duration, break_duration, long_break_duration, \
          sessions_before_long_break, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
        params![
            name,
            work_duration,
            break_duration,
            long_break_duration,
            sessions_before_long_break,
        ],
    )?;

    let id = conn.last_insert_rowid();
    query_one(conn, "SELECT * FROM pomodoro_presets WHERE id = ?1", [id])
}

pub fn update(conn: &Connection, id: i64, updates: &Value) -> rusqlite::Result<PomodoroPreset> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name") {
        sets.push("name = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("workDuration") {
        sets.push("work_duration = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("breakDuration") {
        sets.push("break_duration = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("longBreakDuration") {
        sets.push("long_break_duration = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("sessionsBeforeLongBreak") {
        sets.push("sessions_before_long_break = ?");
        values.push(Box::new(v.as_i64()));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM pomodoro_presets WHERE id = ?1", [id]);
    }

    values.push(Box::new(id));

    let sql = format!(
        "UPDATE pomodoro_presets SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM pomodoro_presets WHERE id = ?1", [id])
}

pub fn delete(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM pomodoro_presets WHERE id = ?1", [id])?;
    Ok(())
}
