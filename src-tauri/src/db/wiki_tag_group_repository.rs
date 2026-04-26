use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiTagGroup {
    pub id: String,
    pub name: String,
    pub filter_tags: Vec<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiTagGroupMember {
    pub group_id: String,
    pub note_id: String,
}

impl FromRow for WikiTagGroup {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let filter_tags_raw: String = row.get("filter_tags")?;
        let filter_tags: Vec<String> =
            serde_json::from_str(&filter_tags_raw).unwrap_or_default();
        Ok(WikiTagGroup {
            id: row.get("id")?,
            name: row.get("name")?,
            filter_tags,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

impl FromRow for WikiTagGroupMember {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(WikiTagGroupMember {
            group_id: row.get("group_id")?,
            note_id: row.get("note_id")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<WikiTagGroup>> {
    query_all(
        conn,
        "SELECT * FROM wiki_tag_groups ORDER BY created_at ASC",
        [],
    )
}

pub fn create(
    conn: &Connection,
    name: &str,
    note_ids: &[String],
    filter_tags: Option<&[String]>,
) -> rusqlite::Result<WikiTagGroup> {
    let now = helpers::now();
    let id = format!("wtg-{}", helpers::new_uuid());
    let ft_json = serde_json::to_string(filter_tags.unwrap_or(&[])).unwrap_or_else(|_| "[]".to_string());

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO wiki_tag_groups (id, name, filter_tags, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, ft_json, now, now],
    )?;
    for note_id in note_ids {
        tx.execute(
            "INSERT OR IGNORE INTO wiki_tag_group_members (group_id, note_id) VALUES (?1, ?2)",
            params![id, note_id],
        )?;
    }
    tx.commit()?;

    query_one(conn, "SELECT * FROM wiki_tag_groups WHERE id = ?1", [&id])
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<WikiTagGroup> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name") {
        sets.push("name = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("filterTags") {
        sets.push("filter_tags = ?");
        let json = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        values.push(Box::new(json));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM wiki_tag_groups WHERE id = ?1", [id]);
    }

    sets.push("updated_at = ?");
    values.push(Box::new(helpers::now()));
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE wiki_tag_groups SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM wiki_tag_groups WHERE id = ?1", [id])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM wiki_tag_groups WHERE id = ?1", [id])?;
    Ok(())
}

pub fn fetch_all_members(conn: &Connection) -> rusqlite::Result<Vec<WikiTagGroupMember>> {
    query_all(
        conn,
        "SELECT * FROM wiki_tag_group_members ORDER BY group_id",
        [],
    )
}

pub fn set_members(
    conn: &Connection,
    group_id: &str,
    note_ids: &[String],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM wiki_tag_group_members WHERE group_id = ?1",
        [group_id],
    )?;
    for note_id in note_ids {
        tx.execute(
            "INSERT OR IGNORE INTO wiki_tag_group_members (group_id, note_id) VALUES (?1, ?2)",
            params![group_id, note_id],
        )?;
    }
    tx.commit()
}

pub fn add_member(
    conn: &Connection,
    group_id: &str,
    note_id: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO wiki_tag_group_members (group_id, note_id) VALUES (?1, ?2)",
        params![group_id, note_id],
    )?;
    Ok(())
}

pub fn remove_member(
    conn: &Connection,
    group_id: &str,
    note_id: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM wiki_tag_group_members WHERE group_id = ?1 AND note_id = ?2",
        params![group_id, note_id],
    )?;
    Ok(())
}
