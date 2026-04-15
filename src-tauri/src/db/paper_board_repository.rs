use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaperBoard {
    pub id: String,
    pub name: String,
    pub linked_note_id: Option<String>,
    pub viewport_x: f64,
    pub viewport_y: f64,
    pub viewport_zoom: f64,
    pub order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaperNode {
    pub id: String,
    pub board_id: String,
    pub node_type: String,
    pub position_x: f64,
    pub position_y: f64,
    pub width: f64,
    pub height: f64,
    pub z_index: i64,
    pub parent_node_id: Option<String>,
    pub ref_entity_id: Option<String>,
    pub ref_entity_type: Option<String>,
    pub text_content: Option<String>,
    pub frame_color: Option<String>,
    pub frame_label: Option<String>,
    pub label: Option<String>,
    pub hidden: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaperEdge {
    pub id: String,
    pub board_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
    pub label: Option<String>,
    pub style_json: Option<String>,
    pub created_at: String,
}

fn row_to_board(row: &rusqlite::Row) -> rusqlite::Result<PaperBoard> {
    Ok(PaperBoard {
        id: row.get("id")?,
        name: row.get("name")?,
        linked_note_id: row.get("linked_note_id")?,
        viewport_x: row.get("viewport_x")?,
        viewport_y: row.get("viewport_y")?,
        viewport_zoom: row.get("viewport_zoom")?,
        order: row.get("\"order\"").or_else(|_| row.get("order"))?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn row_to_node(row: &rusqlite::Row) -> rusqlite::Result<PaperNode> {
    Ok(PaperNode {
        id: row.get("id")?,
        board_id: row.get("board_id")?,
        node_type: row.get("node_type")?,
        position_x: row.get("position_x")?,
        position_y: row.get("position_y")?,
        width: row.get("width")?,
        height: row.get("height")?,
        z_index: row.get("z_index")?,
        parent_node_id: row.get("parent_node_id")?,
        ref_entity_id: row.get("ref_entity_id")?,
        ref_entity_type: row.get("ref_entity_type")?,
        text_content: row.get("text_content")?,
        frame_color: row.get("frame_color")?,
        frame_label: row.get("frame_label")?,
        label: row.get("label")?,
        hidden: row.get::<_, i64>("hidden")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn row_to_edge(row: &rusqlite::Row) -> rusqlite::Result<PaperEdge> {
    Ok(PaperEdge {
        id: row.get("id")?,
        board_id: row.get("board_id")?,
        source_node_id: row.get("source_node_id")?,
        target_node_id: row.get("target_node_id")?,
        source_handle: row.get("source_handle")?,
        target_handle: row.get("target_handle")?,
        label: row.get("label")?,
        style_json: row.get("style_json")?,
        created_at: row.get("created_at")?,
    })
}

// --- Board functions ---

pub fn fetch_all_boards(conn: &Connection) -> rusqlite::Result<Vec<PaperBoard>> {
    let mut stmt =
        conn.prepare("SELECT * FROM paper_boards ORDER BY \"order\" ASC")?;
    let rows = stmt.query_map([], |row| row_to_board(row))?;
    rows.collect()
}

pub fn fetch_board_by_id(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<Option<PaperBoard>> {
    let mut stmt = conn.prepare("SELECT * FROM paper_boards WHERE id = ?1")?;
    let result = stmt.query_row([id], |row| row_to_board(row));
    match result {
        Ok(board) => Ok(Some(board)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn fetch_board_by_note_id(
    conn: &Connection,
    note_id: &str,
) -> rusqlite::Result<Option<PaperBoard>> {
    let mut stmt =
        conn.prepare("SELECT * FROM paper_boards WHERE linked_note_id = ?1")?;
    let result = stmt.query_row([note_id], |row| row_to_board(row));
    match result {
        Ok(board) => Ok(Some(board)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn create_board(
    conn: &Connection,
    name: &str,
    linked_note_id: Option<&str>,
) -> rusqlite::Result<PaperBoard> {
    let id = format!("board-{}", helpers::new_uuid());
    let now = helpers::now();
    let order = helpers::next_order(conn, "paper_boards")?;

    conn.execute(
        "INSERT INTO paper_boards \
         (id, name, linked_note_id, viewport_x, viewport_y, viewport_zoom, \
          \"order\", created_at, updated_at) \
         VALUES (?1, ?2, ?3, 0.0, 0.0, 1.0, ?4, ?5, ?6)",
        params![&id, name, linked_note_id, order, &now, &now],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM paper_boards WHERE id = ?1")?;
    stmt.query_row([&id], |row| row_to_board(row))
}

pub fn update_board(
    conn: &Connection,
    id: &str,
    updates: &Value,
) -> rusqlite::Result<PaperBoard> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("name") {
        sets.push("name = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("linkedNoteId") {
        sets.push("linked_note_id = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("viewportX") {
        sets.push("viewport_x = ?");
        values.push(Box::new(v.as_f64()));
    }
    if let Some(v) = updates.get("viewportY") {
        sets.push("viewport_y = ?");
        values.push(Box::new(v.as_f64()));
    }
    if let Some(v) = updates.get("viewportZoom") {
        sets.push("viewport_zoom = ?");
        values.push(Box::new(v.as_f64()));
    }
    if let Some(v) = updates.get("order") {
        sets.push("\"order\" = ?");
        values.push(Box::new(v.as_i64()));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM paper_boards WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_board(row));
    }

    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE paper_boards SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM paper_boards WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_board(row))
}

pub fn delete_board(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM paper_edges WHERE board_id = ?1", [id])?;
    conn.execute("DELETE FROM paper_nodes WHERE board_id = ?1", [id])?;
    conn.execute("DELETE FROM paper_boards WHERE id = ?1", [id])?;
    Ok(())
}

// --- Node functions ---

pub fn fetch_node_counts_by_board(conn: &Connection) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare(
        "SELECT board_id, COUNT(*) as count FROM paper_nodes GROUP BY board_id",
    )?;
    let mut map = serde_json::Map::new();
    stmt.query_map([], |row| {
        let board_id: String = row.get("board_id")?;
        let count: i64 = row.get("count")?;
        Ok((board_id, count))
    })?
    .for_each(|r| {
        if let Ok((board_id, count)) = r {
            map.insert(board_id, Value::from(count));
        }
    });
    Ok(Value::Object(map))
}

pub fn fetch_nodes_by_board(
    conn: &Connection,
    board_id: &str,
) -> rusqlite::Result<Vec<PaperNode>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM paper_nodes WHERE board_id = ?1 \
         ORDER BY CASE WHEN parent_node_id IS NULL THEN 0 ELSE 1 END, z_index ASC",
    )?;
    let rows = stmt.query_map([board_id], |row| row_to_node(row))?;
    rows.collect()
}

pub fn create_node(
    conn: &Connection,
    params_val: &Value,
) -> rusqlite::Result<PaperNode> {
    let id = params_val
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("node-{}", helpers::new_uuid()));
    let board_id = params_val.get("boardId").and_then(|v| v.as_str()).unwrap_or("");
    let node_type = params_val.get("nodeType").and_then(|v| v.as_str()).unwrap_or("default");
    let position_x = params_val.get("positionX").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let position_y = params_val.get("positionY").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let width = params_val.get("width").and_then(|v| v.as_f64()).unwrap_or(200.0);
    let height = params_val.get("height").and_then(|v| v.as_f64()).unwrap_or(100.0);
    let z_index = params_val.get("zIndex").and_then(|v| v.as_i64()).unwrap_or(0);
    let parent_node_id = params_val.get("parentNodeId").and_then(|v| v.as_str());
    let ref_entity_id = params_val.get("refEntityId").and_then(|v| v.as_str());
    let ref_entity_type = params_val.get("refEntityType").and_then(|v| v.as_str());
    let text_content = params_val.get("textContent").and_then(|v| v.as_str());
    let frame_color = params_val.get("frameColor").and_then(|v| v.as_str());
    let frame_label = params_val.get("frameLabel").and_then(|v| v.as_str());
    let label = params_val.get("label").and_then(|v| v.as_str());
    let hidden = params_val.get("hidden").and_then(|v| v.as_bool()).unwrap_or(false);
    let now = helpers::now();

    conn.execute(
        "INSERT INTO paper_nodes \
         (id, board_id, node_type, position_x, position_y, width, height, z_index, \
          parent_node_id, ref_entity_id, ref_entity_type, text_content, \
          frame_color, frame_label, label, hidden, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            &id,
            board_id,
            node_type,
            position_x,
            position_y,
            width,
            height,
            z_index,
            parent_node_id,
            ref_entity_id,
            ref_entity_type,
            text_content,
            frame_color,
            frame_label,
            label,
            hidden as i64,
            &now,
            &now,
        ],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM paper_nodes WHERE id = ?1")?;
    stmt.query_row([&id], |row| row_to_node(row))
}

pub fn update_node(
    conn: &Connection,
    id: &str,
    updates: &Value,
) -> rusqlite::Result<PaperNode> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("nodeType") {
        sets.push("node_type = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("positionX") {
        sets.push("position_x = ?");
        values.push(Box::new(v.as_f64()));
    }
    if let Some(v) = updates.get("positionY") {
        sets.push("position_y = ?");
        values.push(Box::new(v.as_f64()));
    }
    if let Some(v) = updates.get("width") {
        sets.push("width = ?");
        values.push(Box::new(v.as_f64()));
    }
    if let Some(v) = updates.get("height") {
        sets.push("height = ?");
        values.push(Box::new(v.as_f64()));
    }
    if let Some(v) = updates.get("zIndex") {
        sets.push("z_index = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("parentNodeId") {
        sets.push("parent_node_id = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("refEntityId") {
        sets.push("ref_entity_id = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("refEntityType") {
        sets.push("ref_entity_type = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("textContent") {
        sets.push("text_content = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("frameColor") {
        sets.push("frame_color = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("frameLabel") {
        sets.push("frame_label = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("label") {
        sets.push("label = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("hidden") {
        sets.push("hidden = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }

    if sets.is_empty() {
        let mut stmt = conn.prepare("SELECT * FROM paper_nodes WHERE id = ?1")?;
        return stmt.query_row([id], |row| row_to_node(row));
    }

    sets.push("updated_at = datetime('now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE paper_nodes SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    let mut stmt = conn.prepare("SELECT * FROM paper_nodes WHERE id = ?1")?;
    stmt.query_row([id], |row| row_to_node(row))
}

pub fn bulk_update_positions(
    conn: &Connection,
    updates: &[Value],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;

    for update in updates {
        let id = update.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let position_x = update.get("positionX").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let position_y = update.get("positionY").and_then(|v| v.as_f64()).unwrap_or(0.0);

        tx.execute(
            "UPDATE paper_nodes SET position_x = ?1, position_y = ?2, \
             updated_at = datetime('now') WHERE id = ?3",
            params![position_x, position_y, id],
        )?;
    }

    tx.commit()
}

pub fn bulk_update_z_indices(
    conn: &Connection,
    updates: &[Value],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;

    for update in updates {
        let id = update.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let z_index = update.get("zIndex").and_then(|v| v.as_i64()).unwrap_or(0);

        tx.execute(
            "UPDATE paper_nodes SET z_index = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![z_index, id],
        )?;
    }

    tx.commit()
}

pub fn delete_node(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM paper_edges WHERE source_node_id = ?1 OR target_node_id = ?1",
        [id],
    )?;
    // Unparent children
    conn.execute(
        "UPDATE paper_nodes SET parent_node_id = NULL WHERE parent_node_id = ?1",
        [id],
    )?;
    conn.execute("DELETE FROM paper_nodes WHERE id = ?1", [id])?;
    Ok(())
}

// --- Edge functions ---

pub fn fetch_edges_by_board(
    conn: &Connection,
    board_id: &str,
) -> rusqlite::Result<Vec<PaperEdge>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM paper_edges WHERE board_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map([board_id], |row| row_to_edge(row))?;
    rows.collect()
}

pub fn create_edge(
    conn: &Connection,
    params_val: &Value,
) -> rusqlite::Result<PaperEdge> {
    let id = params_val
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("edge-{}", helpers::new_uuid()));
    let board_id = params_val.get("boardId").and_then(|v| v.as_str()).unwrap_or("");
    let source_node_id = params_val.get("sourceNodeId").and_then(|v| v.as_str()).unwrap_or("");
    let target_node_id = params_val.get("targetNodeId").and_then(|v| v.as_str()).unwrap_or("");
    let source_handle = params_val.get("sourceHandle").and_then(|v| v.as_str());
    let target_handle = params_val.get("targetHandle").and_then(|v| v.as_str());
    let label = params_val.get("label").and_then(|v| v.as_str());
    let style_json = params_val.get("styleJson").and_then(|v| v.as_str());
    let now = helpers::now();

    conn.execute(
        "INSERT INTO paper_edges \
         (id, board_id, source_node_id, target_node_id, source_handle, \
          target_handle, label, style_json, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            board_id,
            source_node_id,
            target_node_id,
            source_handle,
            target_handle,
            label,
            style_json,
            &now,
        ],
    )?;

    let mut stmt = conn.prepare("SELECT * FROM paper_edges WHERE id = ?1")?;
    stmt.query_row([&id], |row| row_to_edge(row))
}

pub fn delete_edge(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM paper_edges WHERE id = ?1", [id])?;
    Ok(())
}
