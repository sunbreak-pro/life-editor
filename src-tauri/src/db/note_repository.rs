use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteNode {
    pub id: String,
    #[serde(rename = "type")]
    pub note_type: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub parent_id: Option<String>,
    pub order: i64,
    pub is_pinned: bool,
    pub has_password: bool,
    pub is_edit_locked: bool,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl FromRow for NoteNode {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let password_hash: Option<String> = row.get("password_hash")?;
        Ok(NoteNode {
            id: row.get("id")?,
            note_type: row.get::<_, Option<String>>("type")?.unwrap_or_else(|| "note".to_string()),
            title: row.get("title")?,
            content: row.get("content")?,
            parent_id: row.get("parent_id")?,
            order: row.get("order_index")?,
            is_pinned: row.get::<_, i64>("is_pinned")? != 0,
            has_password: password_hash.is_some(),
            is_edit_locked: row.get::<_, i64>("is_edit_locked")? != 0,
            is_deleted: row.get::<_, i64>("is_deleted")? != 0,
            deleted_at: row.get("deleted_at")?,
            color: row.get("color")?,
            icon: row.get("icon")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<NoteNode>> {
    query_all(
        conn,
        "SELECT * FROM notes WHERE is_deleted = 0 ORDER BY order_index ASC, updated_at DESC",
        [],
    )
}

pub fn fetch_deleted(conn: &Connection) -> rusqlite::Result<Vec<NoteNode>> {
    query_all(
        conn,
        "SELECT * FROM notes WHERE is_deleted = 1 ORDER BY deleted_at DESC",
        [],
    )
}

pub fn create(
    conn: &Connection,
    id: &str,
    title: &str,
    parent_id: Option<&str>,
) -> rusqlite::Result<NoteNode> {
    conn.execute(
        "INSERT INTO notes (id, type, title, content, parent_id, order_index, is_pinned, \
         is_deleted, created_at, updated_at) \
         VALUES (?1, 'note', ?2, '', ?3, 0, 0, 0, datetime('now'), datetime('now'))",
        params![id, title, parent_id],
    )?;
    query_one(conn, "SELECT * FROM notes WHERE id = ?1", [id])
}

pub fn create_folder(
    conn: &Connection,
    id: &str,
    title: &str,
    parent_id: Option<&str>,
) -> rusqlite::Result<NoteNode> {
    conn.execute(
        "INSERT INTO notes (id, type, title, content, parent_id, order_index, is_pinned, \
         is_deleted, created_at, updated_at) \
         VALUES (?1, 'folder', ?2, '', ?3, 0, 0, 0, datetime('now'), datetime('now'))",
        params![id, title, parent_id],
    )?;
    query_one(conn, "SELECT * FROM notes WHERE id = ?1", [id])
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<NoteNode> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("title") {
        sets.push("title = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("content") {
        sets.push("content = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("isPinned") {
        sets.push("is_pinned = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("color") {
        sets.push("color = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("icon") {
        sets.push("icon = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM notes WHERE id = ?1", [id]);
    }

    sets.push("version = version + 1");
    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!("UPDATE notes SET {} WHERE id = ?", sets.join(", "));
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM notes WHERE id = ?1", [id])
}

pub fn sync_tree(conn: &Connection, items: &[Value]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    for item in items {
        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let parent_id = item.get("parentId").and_then(|v| v.as_str());
        let order = item.get("order").and_then(|v| v.as_i64()).unwrap_or(0);
        tx.execute(
            "UPDATE notes SET parent_id = ?1, order_index = ?2 WHERE id = ?3",
            params![parent_id, order, id],
        )?;
    }
    tx.commit()
}

pub fn soft_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::soft_delete(conn, "notes", id)
}

pub fn restore(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::restore(conn, "notes", id)
}

pub fn permanent_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::permanent_delete(conn, "notes", id)
}

pub fn search(conn: &Connection, query: &str) -> rusqlite::Result<Vec<NoteNode>> {
    let pattern = format!("%{}%", query);
    query_all(
        conn,
        "SELECT * FROM notes WHERE is_deleted = 0 \
         AND (title LIKE ?1 OR content LIKE ?1) \
         ORDER BY updated_at DESC",
        [&pattern],
    )
}

pub fn set_password(conn: &Connection, id: &str, hash: &str) -> rusqlite::Result<NoteNode> {
    conn.execute(
        "UPDATE notes SET password_hash = ?1, version = version + 1, updated_at = datetime('now') \
         WHERE id = ?2",
        params![hash, id],
    )?;
    query_one(conn, "SELECT * FROM notes WHERE id = ?1", [id])
}

pub fn remove_password(conn: &Connection, id: &str) -> rusqlite::Result<NoteNode> {
    conn.execute(
        "UPDATE notes SET password_hash = NULL, version = version + 1, updated_at = datetime('now') \
         WHERE id = ?1",
        [id],
    )?;
    query_one(conn, "SELECT * FROM notes WHERE id = ?1", [id])
}

pub fn verify_password(conn: &Connection, id: &str, password: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare("SELECT password_hash FROM notes WHERE id = ?1")?;
    let hash: Option<String> = stmt.query_row([id], |row| row.get(0))?;
    match hash {
        Some(h) => Ok(h == password),
        None => Ok(false),
    }
}

pub fn toggle_edit_lock(conn: &Connection, id: &str) -> rusqlite::Result<NoteNode> {
    conn.execute(
        "UPDATE notes SET is_edit_locked = CASE WHEN is_edit_locked = 1 THEN 0 ELSE 1 END, \
         version = version + 1, updated_at = datetime('now') WHERE id = ?1",
        [id],
    )?;
    query_one(conn, "SELECT * FROM notes WHERE id = ?1", [id])
}
