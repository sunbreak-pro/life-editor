use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub name: String,
    pub content: String,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_template(row: &rusqlite::Row) -> rusqlite::Result<Template> {
    Ok(Template {
        id: row.get("id")?,
        name: row.get("name")?,
        content: row.get("content")?,
        is_deleted: row.get::<_, i64>("is_deleted").map(|v| v != 0)?,
        deleted_at: row.get("deleted_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<Template>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM templates WHERE is_deleted = 0 ORDER BY created_at",
    )?;
    let rows = stmt.query_map([], |row| row_to_template(row))?;
    rows.collect()
}

pub fn fetch_by_id(conn: &Connection, id: &str) -> rusqlite::Result<Option<Template>> {
    let mut stmt = conn.prepare("SELECT * FROM templates WHERE id = ?1")?;
    let result = stmt.query_row([id], |row| row_to_template(row));
    match result {
        Ok(template) => Ok(Some(template)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn create(conn: &Connection, id: &str, name: &str) -> rusqlite::Result<Template> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO templates (id, name, content, is_deleted, version, created_at, updated_at) \
         VALUES (?1, ?2, '', 0, 1, ?3, ?4)",
        params![id, name, &now, &now],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM templates WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_template(row))
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<Template> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name") {
        sets.push("name = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("content") {
        sets.push("content = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM templates WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_template(row));
    }

    sets.push("version = version + 1");
    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE templates SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM templates WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_template(row))
}

pub fn soft_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::soft_delete(conn, "templates", id)
}

pub fn permanent_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::permanent_delete(conn, "templates", id)
}
