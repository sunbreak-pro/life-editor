use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CalendarTag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub text_color: Option<String>,
    pub order: i64,
}

fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<CalendarTag> {
    Ok(CalendarTag {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        text_color: row.get("text_color")?,
        order: row.get("order")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<CalendarTag>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM calendar_tag_definitions ORDER BY \"order\" ASC, id ASC",
    )?;
    let rows = stmt.query_map([], |row| row_to_tag(row))?;
    rows.collect()
}

pub fn create(conn: &Connection, name: &str, color: &str) -> rusqlite::Result<CalendarTag> {
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(\"order\"), -1) FROM calendar_tag_definitions",
        [],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO calendar_tag_definitions (name, color, \"order\") VALUES (?1, ?2, ?3)",
        params![name, color, max_order + 1],
    )?;
    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT * FROM calendar_tag_definitions WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_tag(row))
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
        let mut stmt = conn.prepare("SELECT * FROM calendar_tag_definitions WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_tag(row));
    }

    values.push(Box::new(id));

    let sql = format!(
        "UPDATE calendar_tag_definitions SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM calendar_tag_definitions WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_tag(row))
}

pub fn delete(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM calendar_tag_definitions WHERE id = ?1", [id])?;
    Ok(())
}

pub fn fetch_all_assignments(conn: &Connection) -> rusqlite::Result<Vec<Value>> {
    let mut stmt =
        conn.prepare("SELECT schedule_item_id, tag_id FROM calendar_tag_assignments")?;
    let rows = stmt.query_map([], |row| {
        let schedule_item_id: String = row.get("schedule_item_id")?;
        let tag_id: i64 = row.get("tag_id")?;
        Ok(serde_json::json!({
            "scheduleItemId": schedule_item_id,
            "tagId": tag_id,
        }))
    })?;
    rows.collect()
}

pub fn set_tags_for_schedule_item(
    conn: &Connection,
    schedule_item_id: &str,
    tag_ids: &[i64],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM calendar_tag_assignments WHERE schedule_item_id = ?1",
        [schedule_item_id],
    )?;
    for tag_id in tag_ids {
        tx.execute(
            "INSERT OR IGNORE INTO calendar_tag_assignments (schedule_item_id, tag_id) \
             VALUES (?1, ?2)",
            params![schedule_item_id, tag_id],
        )?;
    }
    // Bump parent schedule_item's updated_at + version so Cloud Sync's delta
    // query (WHERE si.updated_at > ?1) carries this tag assignment change.
    tx.execute(
        "UPDATE schedule_items SET updated_at = datetime('now'), version = version + 1 WHERE id = ?1",
        [schedule_item_id],
    )?;
    tx.commit()
}
