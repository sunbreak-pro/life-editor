use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalendarNode {
    pub id: String,
    pub title: String,
    pub folder_id: String,
    pub order: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl FromRow for CalendarNode {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(CalendarNode {
            id: row.get("id")?,
            title: row.get("title")?,
            folder_id: row.get("folder_id")?,
            order: row.get("order")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<CalendarNode>> {
    query_all(
        conn,
        "SELECT * FROM calendars ORDER BY \"order\" ASC, created_at ASC",
        [],
    )
}

pub fn create(
    conn: &Connection,
    id: &str,
    title: &str,
    folder_id: &str,
) -> rusqlite::Result<CalendarNode> {
    let now = helpers::now();
    let order = helpers::next_order(conn, "calendars")?;
    conn.execute(
        "INSERT INTO calendars (id, title, folder_id, \"order\", created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, title, folder_id, order, &now, &now],
    )?;

    query_one(conn, "SELECT * FROM calendars WHERE id = ?1", [id])
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<CalendarNode> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("title") {
        sets.push("title = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("folderId") {
        sets.push("folder_id = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("order") {
        sets.push("\"order\" = ?");
        values.push(Box::new(v.as_i64()));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM calendars WHERE id = ?1", [id]);
    }

    sets.push("version = version + 1");
    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE calendars SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM calendars WHERE id = ?1", [id])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM calendars WHERE id = ?1", [id])?;
    Ok(())
}
