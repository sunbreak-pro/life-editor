use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteConnection {
    pub id: String,
    pub source_note_id: String,
    pub target_note_id: String,
    pub created_at: String,
    pub updated_at: String,
}

impl FromRow for NoteConnection {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(NoteConnection {
            id: row.get("id")?,
            source_note_id: row.get("source_note_id")?,
            target_note_id: row.get("target_note_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<NoteConnection>> {
    query_all(
        conn,
        "SELECT * FROM note_connections ORDER BY created_at",
        [],
    )
}

pub fn create(
    conn: &Connection,
    source_note_id: &str,
    target_note_id: &str,
) -> rusqlite::Result<NoteConnection> {
    let id = format!("nc-{}", helpers::new_uuid());
    let now = helpers::now();
    conn.execute(
        "INSERT INTO note_connections (id, source_note_id, target_note_id, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&id, source_note_id, target_note_id, &now, &now],
    )?;

    query_one(conn, "SELECT * FROM note_connections WHERE id = ?1", [&id])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM note_connections WHERE id = ?1", [id])?;
    Ok(())
}

pub fn delete_by_note_pair(
    conn: &Connection,
    source_note_id: &str,
    target_note_id: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM note_connections \
         WHERE (source_note_id = ?1 AND target_note_id = ?2) \
         OR (source_note_id = ?2 AND target_note_id = ?1)",
        params![source_note_id, target_note_id],
    )?;
    Ok(())
}
