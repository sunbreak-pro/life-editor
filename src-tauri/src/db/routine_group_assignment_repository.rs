use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::row_converter::{query_all, FromRow};
use crate::db::helpers::{new_uuid, now};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoutineGroupAssignment {
    pub id: String,
    pub routine_id: String,
    pub group_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
    pub deleted_at: Option<String>,
}

impl FromRow for RoutineGroupAssignment {
    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(RoutineGroupAssignment {
            id: row.get("id")?,
            routine_id: row.get("routine_id")?,
            group_id: row.get("group_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            is_deleted: row.get::<_, i64>("is_deleted")? != 0,
            deleted_at: row.get("deleted_at")?,
        })
    }
}

/// Returns currently-active assignments only. Soft-deleted rows are kept in
/// the table for Cloud Sync delta replication but hidden from UI consumers.
pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<RoutineGroupAssignment>> {
    query_all(
        conn,
        "SELECT * FROM routine_group_assignments WHERE is_deleted = 0",
        [],
    )
}

/// Replace the assignment set for a single routine. Existing rows that are
/// no longer in `group_ids` are soft-deleted; previously-deleted rows that
/// reappear are restored. Bumps the parent routine's version + updated_at
/// so the routine itself shows up in the next delta-sync push.
pub fn set_groups_for_routine(
    conn: &mut Connection,
    routine_id: &str,
    group_ids: &[String],
) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let timestamp = now();

    let existing: Vec<(String, String, bool)> = {
        let mut stmt = tx.prepare(
            "SELECT id, group_id, is_deleted FROM routine_group_assignments \
             WHERE routine_id = ?1",
        )?;
        let rows = stmt.query_map([routine_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)? != 0,
            ))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    for (id, group_id, is_deleted) in &existing {
        let in_new_set = group_ids.contains(group_id);
        if in_new_set && *is_deleted {
            tx.execute(
                "UPDATE routine_group_assignments \
                 SET is_deleted = 0, deleted_at = NULL, updated_at = ?1 \
                 WHERE id = ?2",
                params![timestamp, id],
            )?;
        } else if !in_new_set && !is_deleted {
            tx.execute(
                "UPDATE routine_group_assignments \
                 SET is_deleted = 1, deleted_at = ?1, updated_at = ?1 \
                 WHERE id = ?2",
                params![timestamp, id],
            )?;
        }
    }

    let existing_group_ids: std::collections::HashSet<&String> =
        existing.iter().map(|(_, g, _)| g).collect();
    for group_id in group_ids {
        if !existing_group_ids.contains(group_id) {
            let new_id = format!("rga-{}", new_uuid());
            tx.execute(
                "INSERT INTO routine_group_assignments \
                    (id, routine_id, group_id, created_at, updated_at, is_deleted) \
                 VALUES (?1, ?2, ?3, ?4, ?4, 0)",
                params![new_id, routine_id, group_id, timestamp],
            )?;
        }
    }

    tx.execute(
        "UPDATE routines SET version = version + 1, updated_at = ?1 WHERE id = ?2",
        params![timestamp, routine_id],
    )?;

    tx.commit()
}
