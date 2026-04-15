use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SoundSettings {
    pub id: i64,
    pub sound_type: String,
    pub volume: i64,
    pub enabled: bool,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SoundPreset {
    pub id: i64,
    pub name: String,
    pub settings_json: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SoundTag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub text_color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SoundDisplayMeta {
    pub sound_id: String,
    pub display_name: String,
}

fn row_to_sound_settings(row: &rusqlite::Row) -> rusqlite::Result<SoundSettings> {
    Ok(SoundSettings {
        id: row.get("id")?,
        sound_type: row.get("sound_type")?,
        volume: row.get("volume")?,
        enabled: row.get::<_, i64>("enabled")? != 0,
        updated_at: row.get("updated_at")?,
    })
}

fn row_to_sound_preset(row: &rusqlite::Row) -> rusqlite::Result<SoundPreset> {
    Ok(SoundPreset {
        id: row.get("id")?,
        name: row.get("name")?,
        settings_json: row.get("settings_json")?,
        created_at: row.get("created_at")?,
    })
}

fn row_to_sound_tag(row: &rusqlite::Row) -> rusqlite::Result<SoundTag> {
    Ok(SoundTag {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        text_color: row.get("text_color")?,
    })
}

fn row_to_sound_display_meta(row: &rusqlite::Row) -> rusqlite::Result<SoundDisplayMeta> {
    Ok(SoundDisplayMeta {
        sound_id: row.get("sound_id")?,
        display_name: row.get("display_name")?,
    })
}

// --- Sound Settings ---

pub fn fetch_settings(conn: &Connection) -> rusqlite::Result<Vec<SoundSettings>> {
    let mut stmt = conn.prepare("SELECT * FROM sound_settings")?;
    let rows = stmt.query_map([], |row| row_to_sound_settings(row))?;
    rows.collect()
}

pub fn update_setting(
    conn: &Connection,
    sound_type: &str,
    volume: i64,
    enabled: bool,
) -> rusqlite::Result<SoundSettings> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO sound_settings (sound_type, volume, enabled, updated_at) \
         VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(sound_type) DO UPDATE SET \
         volume = excluded.volume, enabled = excluded.enabled, updated_at = excluded.updated_at",
        params![sound_type, volume, enabled as i64, &now],
    )?;

    let mut stmt =
        conn.prepare("SELECT * FROM sound_settings WHERE sound_type = ?1")?;
    stmt.query_row([sound_type], |row| row_to_sound_settings(row))
}

// --- Sound Presets ---

pub fn fetch_presets(conn: &Connection) -> rusqlite::Result<Vec<SoundPreset>> {
    let mut stmt =
        conn.prepare("SELECT * FROM sound_presets ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| row_to_sound_preset(row))?;
    rows.collect()
}

pub fn create_preset(
    conn: &Connection,
    name: &str,
    settings_json: &str,
) -> rusqlite::Result<SoundPreset> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO sound_presets (name, settings_json, created_at) \
         VALUES (?1, ?2, ?3)",
        params![name, settings_json, &now],
    )?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT * FROM sound_presets WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_sound_preset(row))
}

pub fn delete_preset(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM sound_presets WHERE id = ?1", [id])?;
    Ok(())
}

// --- Sound Tags ---

pub fn fetch_all_sound_tags(conn: &Connection) -> rusqlite::Result<Vec<SoundTag>> {
    let mut stmt = conn.prepare("SELECT * FROM sound_tag_definitions")?;
    let rows = stmt.query_map([], |row| row_to_sound_tag(row))?;
    rows.collect()
}

pub fn create_sound_tag(
    conn: &Connection,
    name: &str,
    color: &str,
) -> rusqlite::Result<SoundTag> {
    conn.execute(
        "INSERT INTO sound_tag_definitions (name, color) VALUES (?1, ?2)",
        params![name, color],
    )?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT * FROM sound_tag_definitions WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_sound_tag(row))
}

pub fn update_sound_tag(
    conn: &Connection,
    id: i64,
    updates: &Value,
) -> rusqlite::Result<SoundTag> {
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
        let mut stmt = conn.prepare("SELECT * FROM sound_tag_definitions WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_sound_tag(row));
    }

    values.push(Box::new(id));

    let sql = format!(
        "UPDATE sound_tag_definitions SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM sound_tag_definitions WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_sound_tag(row))
}

pub fn delete_sound_tag(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM sound_tag_assignments WHERE tag_id = ?1", [id])?;
    conn.execute("DELETE FROM sound_tag_definitions WHERE id = ?1", [id])?;
    Ok(())
}

pub fn fetch_tags_for_sound(
    conn: &Connection,
    sound_id: &str,
) -> rusqlite::Result<Vec<SoundTag>> {
    let mut stmt = conn.prepare(
        "SELECT d.* FROM sound_tag_definitions d \
         INNER JOIN sound_tag_assignments a ON d.id = a.tag_id \
         WHERE a.sound_id = ?1",
    )?;
    let rows = stmt.query_map([sound_id], |row| row_to_sound_tag(row))?;
    rows.collect()
}

pub fn set_tags_for_sound(
    conn: &Connection,
    sound_id: &str,
    tag_ids: &[i64],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "DELETE FROM sound_tag_assignments WHERE sound_id = ?1",
        [sound_id],
    )?;

    for tag_id in tag_ids {
        tx.execute(
            "INSERT INTO sound_tag_assignments (sound_id, tag_id) VALUES (?1, ?2)",
            params![sound_id, tag_id],
        )?;
    }

    tx.commit()
}

pub fn fetch_all_sound_tag_assignments(conn: &Connection) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare("SELECT sound_id, tag_id FROM sound_tag_assignments")?;
    let rows = stmt.query_map([], |row| {
        let sound_id: String = row.get("sound_id")?;
        let tag_id: i64 = row.get("tag_id")?;
        Ok(serde_json::json!({
            "soundId": sound_id,
            "tagId": tag_id
        }))
    })?;
    rows.collect()
}

// --- Sound Display Meta ---

pub fn fetch_all_sound_display_meta(
    conn: &Connection,
) -> rusqlite::Result<Vec<SoundDisplayMeta>> {
    let mut stmt = conn.prepare("SELECT * FROM sound_display_meta")?;
    let rows = stmt.query_map([], |row| row_to_sound_display_meta(row))?;
    rows.collect()
}

pub fn update_sound_display_meta(
    conn: &Connection,
    sound_id: &str,
    display_name: &str,
) -> rusqlite::Result<SoundDisplayMeta> {
    conn.execute(
        "INSERT INTO sound_display_meta (sound_id, display_name) \
         VALUES (?1, ?2) \
         ON CONFLICT(sound_id) DO UPDATE SET display_name = excluded.display_name",
        params![sound_id, display_name],
    )?;

    let mut stmt =
        conn.prepare("SELECT * FROM sound_display_meta WHERE sound_id = ?1")?;
    stmt.query_row([sound_id], |row| row_to_sound_display_meta(row))
}

// --- Workscreen Selections ---

pub fn fetch_workscreen_selections(conn: &Connection) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(
        "SELECT sound_id, display_order FROM workscreen_sound_selections \
         ORDER BY display_order ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let sound_id: String = row.get("sound_id")?;
        let display_order: i64 = row.get("display_order")?;
        Ok(serde_json::json!({
            "soundId": sound_id,
            "displayOrder": display_order
        }))
    })?;
    rows.collect()
}

pub fn set_workscreen_selections(
    conn: &Connection,
    sound_ids: &[String],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;

    tx.execute("DELETE FROM workscreen_sound_selections", [])?;

    for (index, sound_id) in sound_ids.iter().enumerate() {
        tx.execute(
            "INSERT INTO workscreen_sound_selections (sound_id, display_order) \
             VALUES (?1, ?2)",
            params![sound_id, index as i64],
        )?;
    }

    tx.commit()
}
