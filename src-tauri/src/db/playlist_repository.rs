use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub repeat_mode: String,
    pub is_shuffle: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistItem {
    pub id: String,
    pub playlist_id: String,
    pub sound_id: String,
    pub sort_order: i64,
}

impl FromRow for Playlist {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Playlist {
            id: row.get("id")?,
            name: row.get("name")?,
            sort_order: row.get("sort_order")?,
            repeat_mode: row.get("repeat_mode")?,
            is_shuffle: row.get::<_, i64>("is_shuffle")? != 0,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

impl FromRow for PlaylistItem {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(PlaylistItem {
            id: row.get("id")?,
            playlist_id: row.get("playlist_id")?,
            sound_id: row.get("sound_id")?,
            sort_order: row.get("sort_order")?,
        })
    }
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<Playlist>> {
    query_all(
        conn,
        "SELECT * FROM playlists ORDER BY sort_order ASC, created_at ASC",
        [],
    )
}

pub fn create(conn: &Connection, id: &str, name: &str) -> rusqlite::Result<Playlist> {
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM playlists",
        [],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO playlists (id, name, sort_order, repeat_mode, is_shuffle, \
         created_at, updated_at) \
         VALUES (?1, ?2, ?3, 'all', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
        params![id, name, max_order + 1],
    )?;

    query_one(conn, "SELECT * FROM playlists WHERE id = ?1", [id])
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<Playlist> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name") {
        sets.push("name = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("sortOrder") {
        sets.push("sort_order = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("repeatMode") {
        sets.push("repeat_mode = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("isShuffle") {
        sets.push("is_shuffle = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM playlists WHERE id = ?1", [id]);
    }

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE playlists SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM playlists WHERE id = ?1", [id])
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM playlists WHERE id = ?1", [id])?;
    Ok(())
}

pub fn fetch_items(conn: &Connection, playlist_id: &str) -> rusqlite::Result<Vec<PlaylistItem>> {
    query_all(
        conn,
        "SELECT * FROM playlist_items WHERE playlist_id = ?1 ORDER BY sort_order ASC",
        [playlist_id],
    )
}

pub fn fetch_all_items(conn: &Connection) -> rusqlite::Result<Vec<PlaylistItem>> {
    query_all(
        conn,
        "SELECT * FROM playlist_items ORDER BY playlist_id, sort_order ASC",
        [],
    )
}

pub fn add_item(
    conn: &Connection,
    id: &str,
    playlist_id: &str,
    sound_id: &str,
) -> rusqlite::Result<PlaylistItem> {
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM playlist_items WHERE playlist_id = ?1",
        [playlist_id],
        |row| row.get(0),
    )?;
    let sort_order = max_order + 1;
    conn.execute(
        "INSERT INTO playlist_items (id, playlist_id, sound_id, sort_order) \
         VALUES (?1, ?2, ?3, ?4)",
        params![id, playlist_id, sound_id, sort_order],
    )?;
    Ok(PlaylistItem {
        id: id.to_string(),
        playlist_id: playlist_id.to_string(),
        sound_id: sound_id.to_string(),
        sort_order,
    })
}

pub fn remove_item(conn: &Connection, item_id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM playlist_items WHERE id = ?1", [item_id])?;
    Ok(())
}

pub fn reorder_items(
    conn: &Connection,
    _playlist_id: &str,
    item_ids: &[String],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    for (i, item_id) in item_ids.iter().enumerate() {
        tx.execute(
            "UPDATE playlist_items SET sort_order = ?1 WHERE id = ?2",
            params![i as i64, item_id],
        )?;
    }
    tx.commit()
}
