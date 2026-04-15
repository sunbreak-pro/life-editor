use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiTag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub text_color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiTagAssignment {
    pub tag_id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub source: String,
    pub created_at: String,
}

fn row_to_wiki_tag(row: &rusqlite::Row) -> rusqlite::Result<WikiTag> {
    Ok(WikiTag {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        text_color: row.get("text_color")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn row_to_assignment(row: &rusqlite::Row) -> rusqlite::Result<WikiTagAssignment> {
    Ok(WikiTagAssignment {
        tag_id: row.get("tag_id")?,
        entity_id: row.get("entity_id")?,
        entity_type: row.get("entity_type")?,
        source: row.get("source")?,
        created_at: row.get("created_at")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<WikiTag>> {
    let mut stmt = conn.prepare("SELECT * FROM wiki_tags ORDER BY name")?;
    let rows = stmt.query_map([], |row| row_to_wiki_tag(row))?;
    rows.collect()
}

pub fn search(conn: &Connection, query: &str) -> rusqlite::Result<Vec<WikiTag>> {
    let pattern = format!("%{}%", query);
    let mut stmt =
        conn.prepare("SELECT * FROM wiki_tags WHERE name LIKE ?1 ORDER BY name")?;
    let rows = stmt.query_map([&pattern], |row| row_to_wiki_tag(row))?;
    rows.collect()
}

pub fn create(conn: &Connection, name: &str, color: &str) -> rusqlite::Result<WikiTag> {
    let id = format!("tag-{}", helpers::new_uuid());
    create_with_id(conn, &id, name, color)
}

pub fn create_with_id(
    conn: &Connection,
    id: &str,
    name: &str,
    color: &str,
) -> rusqlite::Result<WikiTag> {
    let now = helpers::now();
    conn.execute(
        "INSERT OR REPLACE INTO wiki_tags (id, name, color, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, color, &now, &now],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM wiki_tags WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_wiki_tag(row))
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<WikiTag> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name") {
        sets.push("name = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("color") {
        sets.push("color = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("textColor") {
        sets.push("text_color = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM wiki_tags WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_wiki_tag(row));
    }

    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!("UPDATE wiki_tags SET {} WHERE id = ?", sets.join(", "));
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM wiki_tags WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_wiki_tag(row))
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM wiki_tag_assignments WHERE tag_id = ?1", [id])?;
    conn.execute("DELETE FROM wiki_tags WHERE id = ?1", [id])?;
    Ok(())
}

pub fn merge(
    conn: &Connection,
    source_id: &str,
    target_id: &str,
) -> rusqlite::Result<WikiTag> {
    let tx = conn.unchecked_transaction()?;

    // Move assignments from source to target (skip duplicates)
    tx.execute(
        "INSERT OR IGNORE INTO wiki_tag_assignments (tag_id, entity_id, entity_type, source, created_at) \
         SELECT ?2, entity_id, entity_type, source, created_at \
         FROM wiki_tag_assignments WHERE tag_id = ?1",
        params![source_id, target_id],
    )?;

    // Delete source assignments
    tx.execute(
        "DELETE FROM wiki_tag_assignments WHERE tag_id = ?1",
        [source_id],
    )?;

    // Delete source tag
    tx.execute("DELETE FROM wiki_tags WHERE id = ?1", [source_id])?;

    tx.commit()?;

    let mut stmt = conn.prepare("SELECT * FROM wiki_tags WHERE id = ?1")?;
    stmt.query_row([target_id], |row| row_to_wiki_tag(row))
}

pub fn fetch_tags_for_entity(
    conn: &Connection,
    entity_id: &str,
) -> rusqlite::Result<Vec<WikiTag>> {
    let mut stmt = conn.prepare(
        "SELECT t.* FROM wiki_tags t \
         INNER JOIN wiki_tag_assignments a ON t.id = a.tag_id \
         WHERE a.entity_id = ?1 \
         ORDER BY t.name",
    )?;
    let rows = stmt.query_map([entity_id], |row| row_to_wiki_tag(row))?;
    rows.collect()
}

pub fn set_tags_for_entity(
    conn: &Connection,
    entity_id: &str,
    entity_type: &str,
    tag_ids: &[String],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "DELETE FROM wiki_tag_assignments WHERE entity_id = ?1 AND source = 'manual'",
        [entity_id],
    )?;

    let now = helpers::now();
    for tag_id in tag_ids {
        tx.execute(
            "INSERT OR IGNORE INTO wiki_tag_assignments \
             (tag_id, entity_id, entity_type, source, created_at) \
             VALUES (?1, ?2, ?3, 'manual', ?4)",
            params![tag_id, entity_id, entity_type, &now],
        )?;
    }

    tx.commit()
}

pub fn sync_inline_tags(
    conn: &Connection,
    entity_id: &str,
    entity_type: &str,
    tag_names: &[String],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    let now = helpers::now();

    // Find or create each tag
    let mut tag_ids = Vec::new();
    for name in tag_names {
        let existing: Option<String> = tx
            .query_row(
                "SELECT id FROM wiki_tags WHERE name = ?1",
                [name],
                |row| row.get(0),
            )
            .ok();

        let tag_id = match existing {
            Some(id) => id,
            None => {
                let id = format!("tag-{}", helpers::new_uuid());
                tx.execute(
                    "INSERT INTO wiki_tags (id, name, color, created_at, updated_at) \
                     VALUES (?1, ?2, '#6B7280', ?3, ?4)",
                    params![&id, name, &now, &now],
                )?;
                id
            }
        };
        tag_ids.push(tag_id);
    }

    // Remove old inline assignments
    tx.execute(
        "DELETE FROM wiki_tag_assignments WHERE entity_id = ?1 AND source = 'inline'",
        [entity_id],
    )?;

    // Insert new inline assignments
    for tag_id in &tag_ids {
        tx.execute(
            "INSERT OR IGNORE INTO wiki_tag_assignments \
             (tag_id, entity_id, entity_type, source, created_at) \
             VALUES (?1, ?2, ?3, 'inline', ?4)",
            params![tag_id, entity_id, entity_type, &now],
        )?;
    }

    tx.commit()
}

pub fn fetch_all_assignments(conn: &Connection) -> rusqlite::Result<Vec<WikiTagAssignment>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM wiki_tag_assignments ORDER BY created_at",
    )?;
    let rows = stmt.query_map([], |row| row_to_assignment(row))?;
    rows.collect()
}

pub fn restore_assignment(
    conn: &Connection,
    tag_id: &str,
    entity_id: &str,
    entity_type: &str,
    source: &str,
) -> rusqlite::Result<()> {
    let now = helpers::now();
    conn.execute(
        "INSERT OR IGNORE INTO wiki_tag_assignments \
         (tag_id, entity_id, entity_type, source, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![tag_id, entity_id, entity_type, source, &now],
    )?;
    Ok(())
}
