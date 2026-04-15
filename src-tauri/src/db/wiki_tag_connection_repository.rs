use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiTagConnection {
    pub id: String,
    pub source_tag_id: String,
    pub target_tag_id: String,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_wiki_tag_connection(row: &rusqlite::Row) -> rusqlite::Result<WikiTagConnection> {
    Ok(WikiTagConnection {
        id: row.get("id")?,
        source_tag_id: row.get("source_tag_id")?,
        target_tag_id: row.get("target_tag_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<WikiTagConnection>> {
    let mut stmt =
        conn.prepare("SELECT * FROM wiki_tag_connections ORDER BY created_at")?;
    let rows = stmt.query_map([], |row| row_to_wiki_tag_connection(row))?;
    rows.collect()
}

pub fn create(
    conn: &Connection,
    source_tag_id: &str,
    target_tag_id: &str,
) -> rusqlite::Result<WikiTagConnection> {
    let id = format!("wtc-{}", helpers::new_uuid());
    let now = helpers::now();
    conn.execute(
        "INSERT INTO wiki_tag_connections (id, source_tag_id, target_tag_id, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&id, source_tag_id, target_tag_id, &now, &now],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM wiki_tag_connections WHERE id = ?1")?;
    stmt.query_row([&id], |row| row_to_wiki_tag_connection(row))
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM wiki_tag_connections WHERE id = ?1", [id])?;
    Ok(())
}

pub fn delete_by_tag_pair(
    conn: &Connection,
    source_tag_id: &str,
    target_tag_id: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM wiki_tag_connections \
         WHERE (source_tag_id = ?1 AND target_tag_id = ?2) \
         OR (source_tag_id = ?2 AND target_tag_id = ?1)",
        params![source_tag_id, target_tag_id],
    )?;
    Ok(())
}
