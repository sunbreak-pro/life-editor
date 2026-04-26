use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimeMemo {
    pub id: String,
    pub date: String,
    pub hour: i64,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

impl FromRow for TimeMemo {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(TimeMemo {
            id: row.get("id")?,
            date: row.get("date")?,
            hour: row.get("hour")?,
            content: row.get("content")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

pub fn fetch_by_date(conn: &Connection, date: &str) -> rusqlite::Result<Vec<TimeMemo>> {
    query_all(
        conn,
        "SELECT * FROM time_memos WHERE date = ?1 ORDER BY hour ASC",
        [date],
    )
}

pub fn upsert(
    conn: &Connection,
    id: &str,
    date: &str,
    hour: i64,
    content: &str,
) -> rusqlite::Result<TimeMemo> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO time_memos (id, date, hour, content, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6) \
         ON CONFLICT(date, hour) DO UPDATE SET \
         content = excluded.content, updated_at = excluded.updated_at",
        params![id, date, hour, content, &now, &now],
    )?;

    query_one(
        conn,
        "SELECT * FROM time_memos WHERE date = ?1 AND hour = ?2",
        params![date, hour],
    )
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM time_memos WHERE id = ?1", [id])?;
    Ok(())
}
