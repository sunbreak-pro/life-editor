use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SidebarLink {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub target: String,
    pub emoji: Option<String>,
    pub sort_order: i64,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl FromRow for SidebarLink {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(SidebarLink {
            id: row.get("id")?,
            kind: row.get("kind")?,
            name: row.get("name")?,
            target: row.get("target")?,
            emoji: row.get("emoji")?,
            sort_order: row.get("sort_order")?,
            is_deleted: row.get::<_, i64>("is_deleted").map(|v| v != 0)?,
            deleted_at: row.get("deleted_at")?,
            version: row.get("version")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<SidebarLink>> {
    query_all(
        conn,
        "SELECT * FROM sidebar_links WHERE is_deleted = 0 \
         ORDER BY sort_order ASC, created_at ASC",
        [],
    )
}

pub fn create(
    conn: &Connection,
    id: &str,
    kind: &str,
    name: &str,
    target: &str,
    emoji: Option<&str>,
) -> rusqlite::Result<SidebarLink> {
    if kind != "url" && kind != "app" {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "invalid kind: {kind}"
        )));
    }
    let now = helpers::now();
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM sidebar_links WHERE is_deleted = 0",
        [],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO sidebar_links (id, kind, name, target, emoji, sort_order, \
                                    is_deleted, version, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 1, ?7, ?7)",
        params![id, kind, name, target, emoji, next_order, &now],
    )?;
    query_one(conn, "SELECT * FROM sidebar_links WHERE id = ?1", [id])
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<SidebarLink> {
    let mut sets: Vec<&str> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name").and_then(|v| v.as_str()) {
        sets.push("name = ?");
        values.push(Box::new(v.to_string()));
    }
    if let Some(v) = updates.get("target").and_then(|v| v.as_str()) {
        sets.push("target = ?");
        values.push(Box::new(v.to_string()));
    }
    if let Some(v) = updates.get("kind").and_then(|v| v.as_str()) {
        if v != "url" && v != "app" {
            return Err(rusqlite::Error::InvalidParameterName(format!(
                "invalid kind: {v}"
            )));
        }
        sets.push("kind = ?");
        values.push(Box::new(v.to_string()));
    }
    if let Some(v) = updates.get("emoji") {
        sets.push("emoji = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("sortOrder").and_then(|v| v.as_i64()) {
        sets.push("sort_order = ?");
        values.push(Box::new(v));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM sidebar_links WHERE id = ?1", [id]);
    }

    sets.push("version = version + 1");
    sets.push("updated_at = ?");
    values.push(Box::new(helpers::now()));
    values.push(Box::new(id.to_string()));

    let sql = format!("UPDATE sidebar_links SET {} WHERE id = ?", sets.join(", "));
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM sidebar_links WHERE id = ?1", [id])
}

pub fn soft_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::soft_delete(conn, "sidebar_links", id)
}

/// Reorder links by id list. Items not in `ids` keep their existing sort_order
/// (they shift naturally since reordered ids reclaim the low end). Each
/// touched row gets a version bump and updated_at refresh so Cloud Sync picks
/// it up.
pub fn reorder(conn: &Connection, ids: &[String]) -> rusqlite::Result<()> {
    let now = helpers::now();
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE sidebar_links \
             SET sort_order = ?1, version = version + 1, updated_at = ?2 \
             WHERE id = ?3",
            params![idx as i64, &now, id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn create_then_fetch_all_returns_inserted_link() {
        let conn = fresh_conn();
        create(
            &conn,
            "sl-1",
            "url",
            "Anthropic",
            "https://www.anthropic.com",
            Some("🤖"),
        )
        .unwrap();
        let rows = fetch_all(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Anthropic");
        assert_eq!(rows[0].emoji.as_deref(), Some("🤖"));
        assert_eq!(rows[0].kind, "url");
    }

    #[test]
    fn create_rejects_invalid_kind() {
        let conn = fresh_conn();
        let err = create(&conn, "sl-x", "ftp", "X", "ftp://x", None);
        assert!(err.is_err(), "invalid kind must error");
    }

    #[test]
    fn update_bumps_version_and_changes_fields() {
        let conn = fresh_conn();
        let created = create(&conn, "sl-1", "url", "Old", "https://old", None).unwrap();
        assert_eq!(created.version, 1);

        let updated = update(
            &conn,
            "sl-1",
            &serde_json::json!({ "name": "New", "emoji": "✨" }),
        )
        .unwrap();
        assert_eq!(updated.name, "New");
        assert_eq!(updated.emoji.as_deref(), Some("✨"));
        assert_eq!(updated.version, 2);
    }

    #[test]
    fn soft_delete_excludes_link_from_fetch_all() {
        let conn = fresh_conn();
        create(&conn, "sl-1", "url", "A", "https://a", None).unwrap();
        soft_delete(&conn, "sl-1").unwrap();
        let rows = fetch_all(&conn).unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn reorder_assigns_sequential_sort_order() {
        let conn = fresh_conn();
        create(&conn, "sl-a", "url", "A", "https://a", None).unwrap();
        create(&conn, "sl-b", "url", "B", "https://b", None).unwrap();
        create(&conn, "sl-c", "url", "C", "https://c", None).unwrap();

        reorder(
            &conn,
            &vec!["sl-c".into(), "sl-a".into(), "sl-b".into()],
        )
        .unwrap();
        let rows = fetch_all(&conn).unwrap();
        let names: Vec<String> = rows.iter().map(|r| r.name.clone()).collect();
        assert_eq!(names, vec!["C", "A", "B"]);
    }
}
