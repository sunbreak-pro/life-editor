use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseEntity {
    pub id: String,
    pub title: String,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseProperty {
    pub id: String,
    pub database_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub property_type: String,
    pub order: i64,
    pub config: Value,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseRow {
    pub id: String,
    pub database_id: String,
    pub order: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseCell {
    pub id: String,
    pub row_id: String,
    pub property_id: String,
    pub value: Option<String>,
}

impl FromRow for DatabaseEntity {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(DatabaseEntity {
            id: row.get("id")?,
            title: row.get("title")?,
            is_deleted: row.get::<_, i64>("is_deleted")? != 0,
            deleted_at: row.get("deleted_at")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

impl FromRow for DatabaseProperty {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let config_json: Option<String> = row.get("config_json")?;
        let config = config_json
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(Value::Null);

        Ok(DatabaseProperty {
            id: row.get("id")?,
            database_id: row.get("database_id")?,
            name: row.get("name")?,
            property_type: row.get("type")?,
            order: row.get("order_index")?,
            config,
            created_at: row.get("created_at")?,
        })
    }
}

impl FromRow for DatabaseRow {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(DatabaseRow {
            id: row.get("id")?,
            database_id: row.get("database_id")?,
            order: row.get("order_index")?,
            created_at: row.get("created_at")?,
        })
    }
}

impl FromRow for DatabaseCell {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(DatabaseCell {
            id: row.get("id")?,
            row_id: row.get("row_id")?,
            property_id: row.get("property_id")?,
            value: row.get("value")?,
        })
    }
}

// --- Database CRUD ---

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<DatabaseEntity>> {
    query_all(
        conn,
        "SELECT * FROM databases WHERE is_deleted = 0 ORDER BY updated_at DESC",
        [],
    )
}

pub fn fetch_full(conn: &Connection, id: &str) -> rusqlite::Result<Option<Value>> {
    let database: DatabaseEntity =
        match query_one::<DatabaseEntity, _>(conn, "SELECT * FROM databases WHERE id = ?1", [id]) {
            Ok(db) => db,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e),
        };

    let properties: Vec<DatabaseProperty> = query_all(
        conn,
        "SELECT * FROM database_properties WHERE database_id = ?1 ORDER BY order_index ASC",
        [id],
    )?;

    let db_rows: Vec<DatabaseRow> = query_all(
        conn,
        "SELECT * FROM database_rows WHERE database_id = ?1 ORDER BY order_index ASC",
        [id],
    )?;

    let cells: Vec<DatabaseCell> = query_all(
        conn,
        "SELECT c.* FROM database_cells c \
         INNER JOIN database_rows r ON c.row_id = r.id \
         WHERE r.database_id = ?1",
        [id],
    )?;

    Ok(Some(serde_json::json!({
        "database": serde_json::to_value(&database).unwrap_or(Value::Null),
        "properties": serde_json::to_value(&properties).unwrap_or(Value::Null),
        "rows": serde_json::to_value(&db_rows).unwrap_or(Value::Null),
        "cells": serde_json::to_value(&cells).unwrap_or(Value::Null),
    })))
}

pub fn create(
    conn: &Connection,
    id: &str,
    title: &str,
) -> rusqlite::Result<DatabaseEntity> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO databases (id, title, is_deleted, created_at, updated_at) \
         VALUES (?1, ?2, 0, ?3, ?4)",
        params![id, title, &now, &now],
    )?;

    query_one(conn, "SELECT * FROM databases WHERE id = ?1", [id])
}

pub fn update(
    conn: &Connection,
    id: &str,
    title: &str,
) -> rusqlite::Result<DatabaseEntity> {
    let now = helpers::now();
    conn.execute(
        "UPDATE databases SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, &now, id],
    )?;

    query_one(conn, "SELECT * FROM databases WHERE id = ?1", [id])
}

pub fn soft_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::soft_delete(conn, "databases", id)
}

pub fn permanent_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM database_cells WHERE row_id IN \
         (SELECT id FROM database_rows WHERE database_id = ?1)", [id])?;
    conn.execute("DELETE FROM database_rows WHERE database_id = ?1", [id])?;
    conn.execute("DELETE FROM database_properties WHERE database_id = ?1", [id])?;
    conn.execute("DELETE FROM databases WHERE id = ?1", [id])?;
    Ok(())
}

// --- Properties ---

pub fn add_property(
    conn: &Connection,
    id: &str,
    database_id: &str,
    name: &str,
    property_type: &str,
    order: i64,
    config: &Value,
) -> rusqlite::Result<DatabaseProperty> {
    let now = helpers::now();
    let config_json = serde_json::to_string(config).unwrap_or_else(|_| "{}".to_string());
    conn.execute(
        "INSERT INTO database_properties (id, database_id, name, type, order_index, config_json, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, database_id, name, property_type, order, &config_json, &now],
    )?;

    // Update parent timestamp
    conn.execute(
        "UPDATE databases SET updated_at = ?1 WHERE id = ?2",
        params![&now, database_id],
    )?;

    query_one(conn, "SELECT * FROM database_properties WHERE id = ?1", [id])
}

pub fn update_property(
    conn: &Connection,
    id: &str,
    updates: &Value,
) -> rusqlite::Result<DatabaseProperty> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name") {
        sets.push("name = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("type") {
        sets.push("type = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("order") {
        sets.push("order_index = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("config") {
        sets.push("config_json = ?");
        let json_str = serde_json::to_string(v).unwrap_or_else(|_| "{}".to_string());
        values.push(Box::new(json_str));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM database_properties WHERE id = ?1", [id]);
    }

    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE database_properties SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM database_properties WHERE id = ?1", [id])
}

pub fn remove_property(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM database_cells WHERE property_id = ?1", [id])?;
    conn.execute("DELETE FROM database_properties WHERE id = ?1", [id])?;
    Ok(())
}

// --- Rows ---

pub fn add_row(
    conn: &Connection,
    id: &str,
    database_id: &str,
    order: i64,
) -> rusqlite::Result<DatabaseRow> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO database_rows (id, database_id, order_index, created_at) \
         VALUES (?1, ?2, ?3, ?4)",
        params![id, database_id, order, &now],
    )?;

    conn.execute(
        "UPDATE databases SET updated_at = ?1 WHERE id = ?2",
        params![&now, database_id],
    )?;

    query_one(conn, "SELECT * FROM database_rows WHERE id = ?1", [id])
}

pub fn reorder_rows(conn: &Connection, row_ids: &[String]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;

    for (index, row_id) in row_ids.iter().enumerate() {
        tx.execute(
            "UPDATE database_rows SET order_index = ?1 WHERE id = ?2",
            params![index as i64, row_id],
        )?;
    }

    tx.commit()
}

pub fn remove_row(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM database_cells WHERE row_id = ?1", [id])?;
    conn.execute("DELETE FROM database_rows WHERE id = ?1", [id])?;
    Ok(())
}

// --- Cells ---

pub fn upsert_cell(
    conn: &Connection,
    id: &str,
    row_id: &str,
    property_id: &str,
    value: &str,
) -> rusqlite::Result<DatabaseCell> {
    conn.execute(
        "INSERT INTO database_cells (id, row_id, property_id, value) \
         VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(row_id, property_id) DO UPDATE SET value = excluded.value",
        params![id, row_id, property_id, value],
    )?;

    query_one(
        conn,
        "SELECT * FROM database_cells WHERE row_id = ?1 AND property_id = ?2",
        params![row_id, property_id],
    )
}
