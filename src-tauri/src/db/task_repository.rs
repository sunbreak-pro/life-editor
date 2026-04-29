use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::helpers;
use super::row_converter::{query_all, query_one, FromRow};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: Option<String>,
    pub title: Option<String>,
    pub parent_id: Option<String>,
    pub order: Option<i64>,
    pub status: Option<String>,
    pub is_expanded: Option<bool>,
    pub is_deleted: Option<bool>,
    pub deleted_at: Option<String>,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub scheduled_at: Option<String>,
    pub scheduled_end_at: Option<String>,
    pub is_all_day: Option<bool>,
    pub content: Option<String>,
    pub work_duration_minutes: Option<i64>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub due_date: Option<String>,
    pub time_memo: Option<String>,
    pub updated_at: Option<String>,
    pub version: Option<i64>,
    pub folder_type: Option<String>,
    pub original_parent_id: Option<String>,
    pub priority: Option<i64>,
    pub reminder_enabled: Option<bool>,
    pub reminder_offset: Option<i64>,
}

impl FromRow for TaskNode {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(TaskNode {
            id: row.get("id")?,
            node_type: row.get("type")?,
            title: row.get("title")?,
            parent_id: row.get("parent_id")?,
            order: row.get("order")?,
            status: row.get("status")?,
            is_expanded: row.get::<_, Option<i64>>("is_expanded")?.map(|v| v != 0),
            is_deleted: row.get::<_, Option<i64>>("is_deleted")?.map(|v| v != 0),
            deleted_at: row.get("deleted_at")?,
            created_at: row.get("created_at")?,
            completed_at: row.get("completed_at")?,
            scheduled_at: row.get("scheduled_at")?,
            scheduled_end_at: row.get("scheduled_end_at")?,
            is_all_day: row.get::<_, Option<i64>>("is_all_day")?.map(|v| v != 0),
            content: row.get("content")?,
            work_duration_minutes: row.get("work_duration_minutes")?,
            color: row.get("color")?,
            icon: row.get("icon")?,
            due_date: row.get("due_date")?,
            time_memo: row.get("time_memo")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            folder_type: row.get("folder_type")?,
            original_parent_id: row.get("original_parent_id")?,
            priority: row.get("priority")?,
            reminder_enabled: row.get::<_, Option<i64>>("reminder_enabled")?.map(|v| v != 0),
            reminder_offset: row.get("reminder_offset")?,
        })
    }
}

pub fn fetch_tree(conn: &Connection) -> rusqlite::Result<Vec<TaskNode>> {
    query_all(
        conn,
        "SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY \"order\" ASC",
        [],
    )
}

pub fn fetch_deleted(conn: &Connection) -> rusqlite::Result<Vec<TaskNode>> {
    query_all(
        conn,
        "SELECT * FROM tasks WHERE is_deleted = 1 ORDER BY deleted_at DESC",
        [],
    )
}

pub fn create(conn: &Connection, node: &TaskNode) -> rusqlite::Result<TaskNode> {
    let now = helpers::now();
    conn.execute(
        "INSERT INTO tasks (id, type, title, parent_id, \"order\", status, is_expanded, \
         is_deleted, created_at, completed_at, scheduled_at, content, \
         work_duration_minutes, color, icon, due_date, scheduled_end_at, is_all_day, \
         time_memo, version, updated_at, folder_type, original_parent_id, priority, \
         reminder_enabled, reminder_offset) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,0,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,1,?19,?20,?21,?22,?23,?24)",
        params![
            node.id,
            node.node_type,
            node.title.as_deref().unwrap_or(""),
            node.parent_id,
            node.order.unwrap_or(0),
            node.status.as_deref().unwrap_or("NOT_STARTED"),
            node.is_expanded.map(|b| b as i64).unwrap_or(0),
            node.created_at.as_deref().unwrap_or(&now),
            node.completed_at,
            node.scheduled_at,
            node.content,
            node.work_duration_minutes,
            node.color,
            node.icon,
            node.due_date,
            node.scheduled_end_at,
            node.is_all_day.map(|b| b as i64).unwrap_or(0),
            node.time_memo,
            &now,
            node.folder_type,
            node.original_parent_id,
            node.priority,
            node.reminder_enabled.map(|b| b as i64).unwrap_or(0),
            node.reminder_offset,
        ],
    )?;

    query_one(conn, "SELECT * FROM tasks WHERE id = ?1", [&node.id])
}

pub fn update(conn: &Connection, id: &str, updates: &Value) -> rusqlite::Result<TaskNode> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = updates.get("title") {
        sets.push("title = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("parentId") {
        sets.push("parent_id = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("order") {
        sets.push("\"order\" = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("status") {
        sets.push("status = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("isExpanded") {
        sets.push("is_expanded = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("completedAt") {
        sets.push("completed_at = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("scheduledAt") {
        sets.push("scheduled_at = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("scheduledEndAt") {
        sets.push("scheduled_end_at = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("isAllDay") {
        sets.push("is_all_day = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("content") {
        sets.push("content = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("workDurationMinutes") {
        sets.push("work_duration_minutes = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("color") {
        sets.push("color = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("icon") {
        sets.push("icon = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("dueDdate") {
        sets.push("due_date = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("timeMemo") {
        sets.push("time_memo = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("folderType") {
        sets.push("folder_type = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("originalParentId") {
        sets.push("original_parent_id = ?");
        values.push(Box::new(v.as_str().map(|s| s.to_string())));
    }
    if let Some(v) = updates.get("priority") {
        sets.push("priority = ?");
        values.push(Box::new(v.as_i64()));
    }
    if let Some(v) = updates.get("reminderEnabled") {
        sets.push("reminder_enabled = ?");
        values.push(Box::new(v.as_bool().map(|b| b as i64)));
    }
    if let Some(v) = updates.get("reminderOffset") {
        sets.push("reminder_offset = ?");
        values.push(Box::new(v.as_i64()));
    }

    if sets.is_empty() {
        return query_one(conn, "SELECT * FROM tasks WHERE id = ?1", [id]);
    }

    sets.push("version = version + 1");
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    values.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE tasks SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())?;

    query_one(conn, "SELECT * FROM tasks WHERE id = ?1", [id])
}

pub fn sync_tree(conn: &Connection, nodes: &[TaskNode]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch("PRAGMA defer_foreign_keys = ON")?;

    for node in nodes {
        let now = helpers::now();
        tx.execute(
            "INSERT INTO tasks (id, type, title, parent_id, \"order\", status, is_expanded, \
             is_deleted, created_at, completed_at, scheduled_at, content, \
             work_duration_minutes, color, icon, due_date, scheduled_end_at, is_all_day, \
             time_memo, version, updated_at, folder_type, original_parent_id, priority, \
             reminder_enabled, reminder_offset) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26) \
             ON CONFLICT(id) DO UPDATE SET \
             type=excluded.type, title=excluded.title, parent_id=excluded.parent_id, \
             \"order\"=excluded.\"order\", status=excluded.status, is_expanded=excluded.is_expanded, \
             is_deleted=excluded.is_deleted, completed_at=excluded.completed_at, \
             scheduled_at=excluded.scheduled_at, content=excluded.content, \
             work_duration_minutes=excluded.work_duration_minutes, color=excluded.color, \
             icon=excluded.icon, due_date=excluded.due_date, scheduled_end_at=excluded.scheduled_end_at, \
             is_all_day=excluded.is_all_day, time_memo=excluded.time_memo, \
             version=version+1, updated_at=excluded.updated_at, \
             folder_type=excluded.folder_type, original_parent_id=excluded.original_parent_id, \
             priority=excluded.priority, reminder_enabled=excluded.reminder_enabled, \
             reminder_offset=excluded.reminder_offset",
            params![
                node.id,
                node.node_type,
                node.title.as_deref().unwrap_or(""),
                node.parent_id,
                node.order.unwrap_or(0),
                node.status.as_deref().unwrap_or("NOT_STARTED"),
                node.is_expanded.map(|b| b as i64).unwrap_or(0),
                node.is_deleted.map(|b| b as i64).unwrap_or(0),
                node.created_at.as_deref().unwrap_or(&now),
                node.completed_at,
                node.scheduled_at,
                node.content,
                node.work_duration_minutes,
                node.color,
                node.icon,
                node.due_date,
                node.scheduled_end_at,
                node.is_all_day.map(|b| b as i64).unwrap_or(0),
                node.time_memo,
                node.version.unwrap_or(1),
                &now,
                node.folder_type,
                node.original_parent_id,
                node.priority,
                node.reminder_enabled.map(|b| b as i64).unwrap_or(0),
                node.reminder_offset,
            ],
        )?;
    }

    tx.commit()
}

pub fn soft_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::soft_delete(conn, "tasks", id)
}

pub fn restore(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::restore(conn, "tasks", id)
}

pub fn permanent_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    helpers::permanent_delete(conn, "tasks", id)
}

#[cfg(test)]
mod fetch_tree_benchmark {
    use super::*;
    use rusqlite::Connection;
    use std::time::Instant;

    fn setup_tasks_schema(conn: &Connection) {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                type TEXT,
                title TEXT DEFAULT '',
                parent_id TEXT,
                \"order\" INTEGER DEFAULT 0,
                status TEXT,
                is_expanded INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                scheduled_at TEXT,
                content TEXT,
                work_duration_minutes INTEGER,
                color TEXT,
                due_date TEXT,
                scheduled_end_at TEXT,
                is_all_day INTEGER DEFAULT 0,
                time_memo TEXT DEFAULT NULL,
                version INTEGER DEFAULT 1,
                updated_at TEXT,
                folder_type TEXT DEFAULT NULL,
                original_parent_id TEXT DEFAULT NULL,
                priority INTEGER DEFAULT NULL,
                reminder_enabled INTEGER DEFAULT 0,
                reminder_offset INTEGER,
                icon TEXT
            );",
        )
        .unwrap();
    }

    fn insert_dummy_tasks(conn: &Connection, n: usize) {
        let tx = conn.unchecked_transaction().unwrap();
        for i in 0..n {
            tx.execute(
                "INSERT INTO tasks (id, type, title, \"order\", status, created_at, updated_at) \
                 VALUES (?1, 'task', ?2, ?3, 'NOT_STARTED', '2026-04-18T00:00:00Z', '2026-04-18T00:00:00Z')",
                params![format!("task-{}", i), format!("Task #{}", i), i as i64],
            )
            .unwrap();
        }
        tx.commit().unwrap();
    }

    fn measure_fetch_tree(n: usize, runs: usize) -> (f64, f64) {
        let conn = Connection::open_in_memory().unwrap();
        setup_tasks_schema(&conn);
        insert_dummy_tasks(&conn, n);

        // Warm-up run (populate SQLite caches)
        let _ = fetch_tree(&conn).unwrap();

        let mut total_ms = 0.0;
        let mut max_ms = 0.0f64;
        for _ in 0..runs {
            let start = Instant::now();
            let result = fetch_tree(&conn).unwrap();
            let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
            assert_eq!(result.len(), n);
            total_ms += elapsed_ms;
            if elapsed_ms > max_ms {
                max_ms = elapsed_ms;
            }
        }
        (total_ms / runs as f64, max_ms)
    }

    #[test]
    #[ignore] // Run manually: cargo test --release --lib db::task_repository::fetch_tree_benchmark -- --ignored --nocapture
    fn bench_fetch_tree() {
        let sizes = [500usize, 1000, 3000];
        let runs = 10;
        println!(
            "\n=== fetch_tree benchmark (release build recommended, {} runs each) ===",
            runs
        );
        for n in sizes.iter() {
            let (avg_ms, max_ms) = measure_fetch_tree(*n, runs);
            println!(
                "  n = {:>5}  avg = {:>7.2} ms   max = {:>7.2} ms",
                n, avg_ms, max_ms
            );
        }
        println!("=== end ===\n");
    }
}
