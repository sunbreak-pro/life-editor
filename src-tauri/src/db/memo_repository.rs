use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoNode {
    pub id: Option<String>,
    pub date: String,
    pub content: Option<String>,
    pub is_pinned: bool,
    pub has_password: bool,
    pub is_edit_locked: bool,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn row_to_memo(row: &rusqlite::Row) -> rusqlite::Result<MemoNode> {
    let password_hash: Option<String> = row.get("password_hash")?;
    Ok(MemoNode {
        id: row.get("id")?,
        date: row.get("date")?,
        content: row.get("content")?,
        is_pinned: row.get::<_, i64>("is_pinned")? != 0,
        has_password: password_hash.is_some(),
        is_edit_locked: row.get::<_, i64>("is_edit_locked")? != 0,
        is_deleted: row.get::<_, i64>("is_deleted")? != 0,
        deleted_at: row.get("deleted_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<MemoNode>> {
    let mut stmt =
        conn.prepare("SELECT * FROM memos WHERE is_deleted = 0 ORDER BY date DESC")?;
    let rows = stmt.query_map([], |row| row_to_memo(row))?;
    rows.collect()
}

pub fn fetch_by_date(conn: &Connection, date: &str) -> rusqlite::Result<Option<MemoNode>> {
    let mut stmt = conn.prepare("SELECT * FROM memos WHERE date = ?1")?;
    let result = stmt.query_row([date], |row| row_to_memo(row));
    match result {
        Ok(memo) => Ok(Some(memo)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn upsert(conn: &Connection, date: &str, content: &str) -> rusqlite::Result<MemoNode> {
    let id = format!("memo-{}", date);
    conn.execute(
        "INSERT INTO memos (id, date, content, created_at, updated_at) \
         VALUES (?1, ?2, ?3, datetime('now'), datetime('now')) \
         ON CONFLICT(date) DO UPDATE SET \
         content = ?3, version = version + 1, updated_at = datetime('now')",
        params![id, date, content],
    )?;
    let mut stmt = conn.prepare("SELECT * FROM memos WHERE date = ?1")?;
    stmt.query_row([date], |row| row_to_memo(row))
}

pub fn delete(conn: &Connection, date: &str) -> rusqlite::Result<()> {
    helpers::soft_delete_by_key(conn, "memos", "date", date)
}

pub fn fetch_deleted(conn: &Connection) -> rusqlite::Result<Vec<MemoNode>> {
    let mut stmt =
        conn.prepare("SELECT * FROM memos WHERE is_deleted = 1 ORDER BY deleted_at DESC")?;
    let rows = stmt.query_map([], |row| row_to_memo(row))?;
    rows.collect()
}

pub fn restore(conn: &Connection, date: &str) -> rusqlite::Result<()> {
    helpers::restore_by_key(conn, "memos", "date", date)
}

pub fn permanent_delete(conn: &Connection, date: &str) -> rusqlite::Result<()> {
    helpers::permanent_delete_by_key(conn, "memos", "date", date)
}

pub fn toggle_pin(conn: &Connection, date: &str) -> rusqlite::Result<MemoNode> {
    conn.execute(
        "UPDATE memos SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END, \
         version = version + 1, updated_at = datetime('now') WHERE date = ?1",
        [date],
    )?;
    let mut stmt = conn.prepare("SELECT * FROM memos WHERE date = ?1")?;
    stmt.query_row([date], |row| row_to_memo(row))
}

pub fn set_password(conn: &Connection, date: &str, hash: &str) -> rusqlite::Result<MemoNode> {
    conn.execute(
        "UPDATE memos SET password_hash = ?1, version = version + 1, updated_at = datetime('now') \
         WHERE date = ?2",
        params![hash, date],
    )?;
    let mut stmt = conn.prepare("SELECT * FROM memos WHERE date = ?1")?;
    stmt.query_row([date], |row| row_to_memo(row))
}

pub fn remove_password(conn: &Connection, date: &str) -> rusqlite::Result<MemoNode> {
    conn.execute(
        "UPDATE memos SET password_hash = NULL, version = version + 1, updated_at = datetime('now') \
         WHERE date = ?1",
        [date],
    )?;
    let mut stmt = conn.prepare("SELECT * FROM memos WHERE date = ?1")?;
    stmt.query_row([date], |row| row_to_memo(row))
}

pub fn verify_password(conn: &Connection, date: &str, password: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare("SELECT password_hash FROM memos WHERE date = ?1")?;
    let hash: Option<String> = stmt.query_row([date], |row| row.get(0))?;
    match hash {
        Some(h) => Ok(h == password),
        None => Ok(false),
    }
}

pub fn toggle_edit_lock(conn: &Connection, date: &str) -> rusqlite::Result<MemoNode> {
    conn.execute(
        "UPDATE memos SET is_edit_locked = CASE WHEN is_edit_locked = 1 THEN 0 ELSE 1 END, \
         version = version + 1, updated_at = datetime('now') WHERE date = ?1",
        [date],
    )?;
    let mut stmt = conn.prepare("SELECT * FROM memos WHERE date = ?1")?;
    stmt.query_row([date], |row| row_to_memo(row))
}
