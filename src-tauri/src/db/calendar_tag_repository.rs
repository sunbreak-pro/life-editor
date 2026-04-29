use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalendarTag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub text_color: Option<String>,
    pub order: i64,
}

impl FromRow for CalendarTag {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(CalendarTag {
            id: row.get("id")?,
            name: row.get("name")?,
            color: row.get("color")?,
            text_color: row.get("text_color")?,
            order: row.get("order")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<CalendarTag>> {
    query_all(
        conn,
        "SELECT id, name, color, text_color, \"order\" FROM calendar_tag_definitions \
         WHERE is_deleted = 0 ORDER BY \"order\" ASC, id ASC",
        [],
    )
}

pub fn create(conn: &Connection, name: &str, color: &str) -> rusqlite::Result<CalendarTag> {
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(\"order\"), -1) FROM calendar_tag_definitions",
        [],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO calendar_tag_definitions (name, color, \"order\", created_at, updated_at, version) \
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), 1)",
        params![name, color, max_order + 1],
    )?;
    let id = conn.last_insert_rowid();
    query_one(
        conn,
        "SELECT id, name, color, text_color, \"order\" FROM calendar_tag_definitions WHERE id = ?1",
        [id],
    )
}

pub fn update(conn: &Connection, id: i64, updates: &Value) -> rusqlite::Result<CalendarTag> {
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
    if let Some(v) = updates.get("order") {
        sets.push("\"order\" = ?");
        values.push(Box::new(v.as_i64()));
    }

    if sets.is_empty() {
        return query_one(
            conn,
            "SELECT id, name, color, text_color, \"order\" FROM calendar_tag_definitions WHERE id = ?1",
            [id],
        );
    }

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')");
    sets.push("version = version + 1");

    values.push(Box::new(id));

    let sql = format!(
        "UPDATE calendar_tag_definitions SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(
        conn,
        "SELECT id, name, color, text_color, \"order\" FROM calendar_tag_definitions WHERE id = ?1",
        [id],
    )
}

pub fn delete(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    // Soft delete + cascade-clear all assignments for this tag
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE calendar_tag_definitions \
         SET is_deleted = 1, \
             deleted_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), \
             updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), \
             version = version + 1 \
         WHERE id = ?1",
        [id],
    )?;
    // Bump entity updated_at so Cloud Sync delta picks up the cleared assignment
    tx.execute(
        "UPDATE schedule_items SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), version = version + 1 \
         WHERE id IN (SELECT entity_id FROM calendar_tag_assignments \
                      WHERE entity_type = 'schedule_item' AND tag_id = ?1)",
        [id],
    )?;
    tx.execute(
        "UPDATE tasks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), version = version + 1 \
         WHERE id IN (SELECT entity_id FROM calendar_tag_assignments \
                      WHERE entity_type = 'task' AND tag_id = ?1)",
        [id],
    )?;
    tx.execute(
        "DELETE FROM calendar_tag_assignments WHERE tag_id = ?1",
        [id],
    )?;
    tx.commit()
}

pub fn fetch_all_assignments(conn: &Connection) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(
        "SELECT entity_type, entity_id, tag_id FROM calendar_tag_assignments",
    )?;
    let rows = stmt.query_map([], |row| {
        let entity_type: String = row.get("entity_type")?;
        let entity_id: String = row.get("entity_id")?;
        let tag_id: i64 = row.get("tag_id")?;
        Ok(serde_json::json!({
            "entityType": entity_type,
            "entityId": entity_id,
            "tagId": tag_id,
        }))
    })?;
    rows.collect()
}

/// Set a single tag for an entity (1:1). Pass tag_id = None to clear.
pub fn set_tag_for_entity(
    conn: &Connection,
    entity_type: &str,
    entity_id: &str,
    tag_id: Option<i64>,
) -> rusqlite::Result<()> {
    if entity_type != "task" && entity_type != "schedule_item" {
        return Err(rusqlite::Error::InvalidQuery);
    }

    let tx = conn.unchecked_transaction()?;

    // Clear any existing assignment first (UNIQUE on entity_type+entity_id enforces 1:1)
    tx.execute(
        "DELETE FROM calendar_tag_assignments WHERE entity_type = ?1 AND entity_id = ?2",
        params![entity_type, entity_id],
    )?;

    if let Some(tid) = tag_id {
        // hex(randomblob(8)) → 16 hex chars; combined with entity_type+entity_id stays unique
        tx.execute(
            "INSERT INTO calendar_tag_assignments \
                (id, entity_type, entity_id, tag_id, created_at, updated_at) \
             VALUES ('cta-' || lower(hex(randomblob(8))), ?1, ?2, ?3, \
                     strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), \
                     strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'))",
            params![entity_type, entity_id, tid],
        )?;
    }

    // Bump parent entity's updated_at + version so Cloud Sync delta query picks it up
    let bump_sql = match entity_type {
        "schedule_item" => {
            "UPDATE schedule_items SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), version = version + 1 WHERE id = ?1"
        }
        "task" => {
            "UPDATE tasks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), version = version + 1 WHERE id = ?1"
        }
        _ => unreachable!(),
    };
    tx.execute(bump_sql, [entity_id])?;

    tx.commit()
}

/// Backwards-compat shim: existing UI calls set_tags_for_schedule_item with an array.
/// We collapse to first element (or clear if empty) since CalendarTags are now 1:1.
pub fn set_tags_for_schedule_item(
    conn: &Connection,
    schedule_item_id: &str,
    tag_ids: &[i64],
) -> rusqlite::Result<()> {
    let single = tag_ids.first().copied();
    set_tag_for_entity(conn, "schedule_item", schedule_item_id, single)
}
