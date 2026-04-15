use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;

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

fn row_to_database(row: &rusqlite::Row) -> rusqlite::Result<DatabaseEntity> {
    Ok(DatabaseEntity {
        id: row.get("id")?,
        title: row.get("title")?,
        is_deleted: row.get::<_, i64>("is_deleted")? != 0,
        deleted_at: row.get("deleted_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn row_to_property(row: &rusqlite::Row) -> rusqlite::Result<DatabaseProperty> {
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

fn row_to_row(row: &rusqlite::Row) -> rusqlite::Result<DatabaseRow> {
    Ok(DatabaseRow {
        id: row.get("id")?,
        database_id: row.get("database_id")?,
        order: row.get("order_index")?,
        created_at: row.get("created_at")?,
    })
}

fn row_to_cell(row: &rusqlite::Row) -> rusqlite::Result<DatabaseCell> {
    Ok(DatabaseCell {
        id: row.get("id")?,
        row_id: row.get("row_id")?,
        property_id: row.get("property_id")?,
        value: row.get("value")?,
    })
}

// --- Database CRUD ---

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<DatabaseEntity>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM databases WHERE is_deleted = 0 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |row| row_to_database(row))?;
    rows.collect()
}

pub fn fetch_full(conn: &Connection, id: &str) -> rusqlite::Result<Option<Value>> {
    let database: DatabaseEntity = match conn
        .prepare("SELECT * FROM databases WHERE id = ?1")?
        .query_row([id], |row| row_to_database(row))
    {
        Ok(db) => db,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e),
    };

    let mut prop_stmt = conn.prepare(
        "SELECT * FROM database_properties WHERE database_id = ?1 ORDER BY order_index ASC",
    )?;
    let properties: Vec<DatabaseProperty> = prop_stmt
        .query_map([id], |row| row_to_property(row))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut row_stmt = conn.prepare(
        "SELECT * FROM database_rows WHERE database_id = ?1 ORDER BY order_index ASC",
    )?;
    let db_rows: Vec<DatabaseRow> = row_stmt
        .query_map([id], |row| row_to_row(row))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut cell_stmt = conn.prepare(
        "SELECT c.* FROM database_cells c \
         INNER JOIN database_rows r ON c.row_id = r.id \
         WHERE r.database_id = ?1",
    )?;
    let cells: Vec<DatabaseCell> = cell_stmt
        .query_map([id], |row| row_to_cell(row))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

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

    let mut stmt = conn.prepare("SELECT * FROM databases WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_database(row))
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

    let mut stmt = conn.prepare("SELECT * FROM databases WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_database(row))
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

    let mut stmt = conn.prepare("SELECT * FROM database_properties WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_property(row))
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
        let mut stmt = conn.prepare("SELECT * FROM database_properties WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_property(row));
    }

    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE database_properties SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM database_properties WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_property(row))
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

    let mut stmt = conn.prepare("SELECT * FROM database_rows WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_row(row))
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

    let mut stmt = conn.prepare(
        "SELECT * FROM database_cells WHERE row_id = ?1 AND property_id = ?2",
    )?;
    stmt.query_row(params![row_id, property_id], |row| row_to_cell(row))
}
