use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimerSettings {
    pub id: i64,
    pub work_duration: i64,
    pub break_duration: i64,
    pub long_break_duration: i64,
    pub sessions_before_long_break: i64,
    pub auto_start_breaks: bool,
    pub target_sessions: i64,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimerSession {
    pub id: i64,
    pub task_id: Option<String>,
    pub session_type: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration: Option<i64>,
    pub completed: bool,
    pub label: Option<String>,
}

impl FromRow for TimerSettings {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(TimerSettings {
            id: row.get("id")?,
            work_duration: row.get("work_duration")?,
            break_duration: row.get("break_duration")?,
            long_break_duration: row.get("long_break_duration")?,
            sessions_before_long_break: row.get("sessions_before_long_break")?,
            auto_start_breaks: row.get::<_, i64>("auto_start_breaks")? != 0,
            target_sessions: row.get("target_sessions")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

impl FromRow for TimerSession {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(TimerSession {
            id: row.get("id")?,
            task_id: row.get("task_id")?,
            session_type: row.get("session_type")?,
            started_at: row.get("started_at")?,
            completed_at: row.get("completed_at")?,
            duration: row.get("duration")?,
            completed: row.get::<_, i64>("completed")? != 0,
            label: row.get::<_, Option<String>>("label").unwrap_or(None),
        })
    }
}

pub fn end_session_with_label(
    conn: &Connection,
    id: i64,
    duration: i64,
    completed: bool,
    label: Option<&str>,
) -> rusqlite::Result<TimerSession> {
    conn.execute(
        "UPDATE timer_sessions \
         SET completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), duration = ?1, completed = ?2, label = ?3 \
         WHERE id = ?4",
        params![duration, completed as i64, label, id],
    )?;
    query_one(conn, "SELECT * FROM timer_sessions WHERE id = ?1", [id])
}

pub fn fetch_settings(conn: &Connection) -> rusqlite::Result<TimerSettings> {
    query_one(conn, "SELECT * FROM timer_settings WHERE id = 1", [])
}

pub fn update_settings(conn: &Connection, updates: &Value) -> rusqlite::Result<TimerSettings> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

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
    if let Some(v) = updates.get("autoStartBreaks") {
        sets.push("auto_start_breaks = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("targetSessions") {
        sets.push("target_sessions = ?");
        values.push(Box::new(v.as_i64()));
    }

    if sets.is_empty() {
        return fetch_settings(conn);
    }

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

    let sql = format!(
        "UPDATE timer_settings SET {} WHERE id = 1",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    fetch_settings(conn)
}

pub fn start_session(
    conn: &Connection,
    session_type: &str,
    task_id: Option<&str>,
) -> rusqlite::Result<TimerSession> {
    conn.execute(
        "INSERT INTO timer_sessions (task_id, session_type, started_at, completed) \
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 0)",
        params![task_id, session_type],
    )?;
    let id = conn.last_insert_rowid();
    query_one(conn, "SELECT * FROM timer_sessions WHERE id = ?1", [id])
}

pub fn end_session(
    conn: &Connection,
    id: i64,
    duration: i64,
    completed: bool,
) -> rusqlite::Result<TimerSession> {
    conn.execute(
        "UPDATE timer_sessions SET completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), duration = ?1, completed = ?2 \
         WHERE id = ?3",
        params![duration, completed as i64, id],
    )?;
    query_one(conn, "SELECT * FROM timer_sessions WHERE id = ?1", [id])
}

pub fn fetch_sessions(conn: &Connection) -> rusqlite::Result<Vec<TimerSession>> {
    query_all(
        conn,
        "SELECT * FROM timer_sessions ORDER BY started_at DESC",
        [],
    )
}

pub fn fetch_sessions_by_task_id(
    conn: &Connection,
    task_id: &str,
) -> rusqlite::Result<Vec<TimerSession>> {
    query_all(
        conn,
        "SELECT * FROM timer_sessions WHERE task_id = ?1 ORDER BY started_at DESC",
        [task_id],
    )
}
