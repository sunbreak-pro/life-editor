use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;



#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoutineGroup {
    pub id: String,
    pub name: String,
    pub color: String,
    pub order: i64,
    pub is_visible: bool,
    pub frequency_type: String,
    pub frequency_days: Value,
    pub frequency_interval: Option<i64>,
    pub frequency_start_date: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn row_to_group(row: &rusqlite::Row) -> rusqlite::Result<RoutineGroup> {
    let frequency_days_raw: String = row.get("frequency_days")?;
    let frequency_days: Value =
        serde_json::from_str(&frequency_days_raw).unwrap_or(Value::Array(vec![]));
    Ok(RoutineGroup {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        order: row.get("order")?,
        is_visible: row.get::<_, i64>("is_visible")? != 0,
        frequency_type: row.get::<_, Option<String>>("frequency_type")?
            .unwrap_or_else(|| "daily".to_string()),
        frequency_days,
        frequency_interval: row.get("frequency_interval")?,
        frequency_start_date: row.get("frequency_start_date")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<RoutineGroup>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM routine_groups ORDER BY \"order\" ASC, created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| row_to_group(row))?;
    rows.collect()
}

pub fn create(
    conn: &Connection,
    id: &str,
    name: &str,
    color: &str,
    frequency_type: Option<&str>,
    frequency_days: Option<&Value>,
    frequency_interval: Option<i64>,
    frequency_start_date: Option<&str>,
) -> rusqlite::Result<RoutineGroup> {
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(\"order\"), -1) FROM routine_groups",
        [],
        |row| row.get(0),
    )?;
    let fd_json = frequency_days
        .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()))
        .unwrap_or_else(|| "[]".to_string());

    conn.execute(
        "INSERT INTO routine_groups (id, name, color, is_visible, \"order\", \
         frequency_type, frequency_days, frequency_interval, frequency_start_date, \
         created_at, updated_at) \
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))",
        params![
            id,
            name,
            color,
            max_order + 1,
            frequency_type.unwrap_or("daily"),
            fd_json,
            frequency_interval,
            frequency_start_date,
        ],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM routine_groups WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_group(row))
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<RoutineGroup> {
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
    if let Some(v) = updates.get("isVisible") {
        sets.push("is_visible = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("order") {
        sets.push("\"order\" = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("frequencyType") {
        sets.push("frequency_type = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("frequencyDays") {
        sets.push("frequency_days = ?");
        let json = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        values.push(Box::new(json));
    }
    if let Some(v) = updates.get("frequencyInterval") {
        sets.push("frequency_interval = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("frequencyStartDate") {
        sets.push("frequency_start_date = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM routine_groups WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_group(row));
    }

    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE routine_groups SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM routine_groups WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_group(row))
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM routine_groups WHERE id = ?1", [id])?;
    Ok(())
}

pub fn fetch_all_tag_assignments(conn: &Connection) -> rusqlite::Result<Vec<Value>> {
    let mut stmt =
        conn.prepare("SELECT group_id, tag_id FROM routine_group_tag_assignments")?;
    let rows = stmt.query_map([], |row| {
        let group_id: String = row.get("group_id")?;
        let tag_id: i64 = row.get("tag_id")?;
        Ok(serde_json::json!({
            "groupId": group_id,
            "tagId": tag_id,
        }))
    })?;
    rows.collect()
}

pub fn set_tags_for_group(
    conn: &Connection,
    group_id: &str,
    tag_ids: &[i64],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM routine_group_tag_assignments WHERE group_id = ?1",
        [group_id],
    )?;
    for tag_id in tag_ids {
        tx.execute(
            "INSERT OR IGNORE INTO routine_group_tag_assignments (group_id, tag_id) \
             VALUES (?1, ?2)",
            params![group_id, tag_id],
        )?;
    }
    // Bump parent group's updated_at + version so Cloud Sync's delta query
    // (WHERE rg.updated_at > ?1) carries this tag assignment change.
    tx.execute(
        "UPDATE routine_groups SET updated_at = datetime('now'), version = version + 1 WHERE id = ?1",
        [group_id],
    )?;
    tx.commit()
}
