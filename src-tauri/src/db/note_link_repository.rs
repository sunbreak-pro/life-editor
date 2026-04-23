use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::helpers;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteLink {
    pub id: String,
    pub source_note_id: Option<String>,
    pub source_daily_date: Option<String>,
    pub target_note_id: String,
    pub target_heading: Option<String>,
    pub target_block_id: Option<String>,
    pub alias: Option<String>,
    pub link_type: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub version: i64,
    pub is_deleted: i64,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteLinkPayload {
    pub target_note_id: String,
    pub target_heading: Option<String>,
    pub target_block_id: Option<String>,
    pub alias: Option<String>,
    pub link_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkHit {
    pub link: NoteLink,
    pub source_title: Option<String>,
    pub source_preview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkedMention {
    pub source_note_id: String,
    pub source_title: String,
    pub match_text: String,
}

fn row_to_note_link(row: &rusqlite::Row) -> rusqlite::Result<NoteLink> {
    Ok(NoteLink {
        id: row.get("id")?,
        source_note_id: row.get("source_note_id")?,
        source_daily_date: row.get("source_daily_date")?,
        target_note_id: row.get("target_note_id")?,
        target_heading: row.get("target_heading")?,
        target_block_id: row.get("target_block_id")?,
        alias: row.get("alias")?,
        link_type: row.get("link_type")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        version: row.get("version")?,
        is_deleted: row.get("is_deleted")?,
        deleted_at: row.get("deleted_at")?,
    })
}

pub fn fetch_all(conn: &Connection) -> rusqlite::Result<Vec<NoteLink>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM note_links WHERE is_deleted = 0 ORDER BY created_at",
    )?;
    let rows = stmt.query_map([], |row| row_to_note_link(row))?;
    rows.collect()
}

pub fn fetch_forward_links(
    conn: &Connection,
    source_note_id: &str,
) -> rusqlite::Result<Vec<NoteLink>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM note_links \
         WHERE source_note_id = ?1 AND is_deleted = 0 \
         ORDER BY created_at",
    )?;
    let rows = stmt.query_map([source_note_id], |row| row_to_note_link(row))?;
    rows.collect()
}

/// Links into `target_note_id` with source Note title/preview joined in.
pub fn fetch_backlinks(
    conn: &Connection,
    target_note_id: &str,
) -> rusqlite::Result<Vec<BacklinkHit>> {
    let mut stmt = conn.prepare(
        "SELECT nl.*, \
                n.title AS __source_title, \
                substr(n.content, 1, 200) AS __source_preview \
         FROM note_links nl \
         LEFT JOIN notes n ON n.id = nl.source_note_id \
         WHERE nl.target_note_id = ?1 AND nl.is_deleted = 0 \
         ORDER BY nl.created_at DESC",
    )?;
    let rows = stmt.query_map([target_note_id], |row| {
        let source_title: Option<String> = row.get("__source_title").ok();
        let source_preview: Option<String> = row.get("__source_preview").ok();
        let link = row_to_note_link(row)?;
        Ok(BacklinkHit {
            link,
            source_title,
            source_preview,
        })
    })?;
    rows.collect()
}

/// Replace *all* links sourced from `source_note_id` with the provided list.
/// Uses soft-delete for stale rows so Cloud Sync LWW can propagate removals.
pub fn upsert_links_for_note(
    conn: &Connection,
    source_note_id: &str,
    links: Vec<NoteLinkPayload>,
) -> rusqlite::Result<()> {
    let now = helpers::now();

    // Soft-delete existing non-deleted links from this source; we re-insert fresh below.
    conn.execute(
        "UPDATE note_links SET is_deleted = 1, deleted_at = ?2, \
         updated_at = ?2, version = version + 1 \
         WHERE source_note_id = ?1 AND is_deleted = 0",
        params![source_note_id, &now],
    )?;

    for link in links {
        let id = format!("nl-{}", helpers::new_uuid());
        let link_type = link.link_type.unwrap_or_else(|| "inline".to_string());
        conn.execute(
            "INSERT INTO note_links \
             (id, source_note_id, source_daily_date, target_note_id, target_heading, \
              target_block_id, alias, link_type, created_at, updated_at, version, is_deleted) \
             VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, ?8, ?8, 1, 0)",
            params![
                &id,
                source_note_id,
                link.target_note_id,
                link.target_heading,
                link.target_block_id,
                link.alias,
                link_type,
                &now,
            ],
        )?;
    }
    Ok(())
}

/// Same as above but keyed by a daily date (YYYY-MM-DD).
pub fn upsert_links_for_daily(
    conn: &Connection,
    source_daily_date: &str,
    links: Vec<NoteLinkPayload>,
) -> rusqlite::Result<()> {
    let now = helpers::now();

    conn.execute(
        "UPDATE note_links SET is_deleted = 1, deleted_at = ?2, \
         updated_at = ?2, version = version + 1 \
         WHERE source_daily_date = ?1 AND is_deleted = 0",
        params![source_daily_date, &now],
    )?;

    for link in links {
        let id = format!("nl-{}", helpers::new_uuid());
        let link_type = link.link_type.unwrap_or_else(|| "inline".to_string());
        conn.execute(
            "INSERT INTO note_links \
             (id, source_note_id, source_daily_date, target_note_id, target_heading, \
              target_block_id, alias, link_type, created_at, updated_at, version, is_deleted) \
             VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, 1, 0)",
            params![
                &id,
                source_daily_date,
                link.target_note_id,
                link.target_heading,
                link.target_block_id,
                link.alias,
                link_type,
                &now,
            ],
        )?;
    }
    Ok(())
}

pub fn delete_links_for_note(
    conn: &Connection,
    source_note_id: &str,
) -> rusqlite::Result<()> {
    let now = helpers::now();
    conn.execute(
        "UPDATE note_links SET is_deleted = 1, deleted_at = ?2, \
         updated_at = ?2, version = version + 1 \
         WHERE source_note_id = ?1 AND is_deleted = 0",
        params![source_note_id, &now],
    )?;
    Ok(())
}

/// Find notes whose `title` occurs verbatim inside `source`'s content but are
/// not already linked. Naive LIKE-based lookup; replace with FTS5 if needed.
pub fn fetch_unlinked_mentions(
    conn: &Connection,
    source_note_id: &str,
) -> rusqlite::Result<Vec<UnlinkedMention>> {
    // Load source content once.
    let source_content: String = conn
        .query_row(
            "SELECT COALESCE(content, '') FROM notes WHERE id = ?1 AND is_deleted = 0",
            [source_note_id],
            |row| row.get(0),
        )
        .unwrap_or_default();
    if source_content.is_empty() {
        return Ok(Vec::new());
    }

    // Existing forward-link target ids for this note (to exclude).
    let mut linked_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    {
        let mut stmt = conn.prepare(
            "SELECT target_note_id FROM note_links \
             WHERE source_note_id = ?1 AND is_deleted = 0",
        )?;
        let rows = stmt.query_map([source_note_id], |row| row.get::<_, String>(0))?;
        for r in rows {
            linked_ids.insert(r?);
        }
    }

    // Candidate pool: all other notes with non-empty title.
    let mut stmt = conn.prepare(
        "SELECT id, title FROM notes \
         WHERE id != ?1 AND is_deleted = 0 AND title IS NOT NULL AND title != ''",
    )?;
    let rows = stmt.query_map([source_note_id], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        Ok((id, title))
    })?;

    let mut hits = Vec::new();
    for row in rows {
        let (id, title) = row?;
        if linked_ids.contains(&id) {
            continue;
        }
        if title.len() < 2 {
            continue; // skip single-character titles to avoid noise
        }
        if source_content.contains(&title) {
            hits.push(UnlinkedMention {
                source_note_id: source_note_id.to_string(),
                source_title: title.clone(),
                match_text: title,
            });
        }
    }
    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrations::run_migrations(&conn).unwrap();
        conn
    }

    fn insert_note(conn: &Connection, id: &str, title: &str, content: &str) {
        let now = helpers::now();
        conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, version, is_deleted) \
             VALUES (?1, ?2, ?3, ?4, ?4, 1, 0)",
            params![id, title, content, &now],
        )
        .unwrap();
    }

    #[test]
    fn upsert_then_fetch_forward_and_backward() {
        let conn = setup();
        insert_note(&conn, "note-a", "Alpha", "");
        insert_note(&conn, "note-b", "Beta", "");

        upsert_links_for_note(
            &conn,
            "note-a",
            vec![NoteLinkPayload {
                target_note_id: "note-b".into(),
                target_heading: Some("Intro".into()),
                target_block_id: None,
                alias: Some("See Beta".into()),
                link_type: None,
            }],
        )
        .unwrap();

        let fwd = fetch_forward_links(&conn, "note-a").unwrap();
        assert_eq!(fwd.len(), 1);
        assert_eq!(fwd[0].target_note_id, "note-b");
        assert_eq!(fwd[0].target_heading.as_deref(), Some("Intro"));
        assert_eq!(fwd[0].link_type, "inline");

        let back = fetch_backlinks(&conn, "note-b").unwrap();
        assert_eq!(back.len(), 1);
        assert_eq!(back[0].link.source_note_id.as_deref(), Some("note-a"));
        assert_eq!(back[0].source_title.as_deref(), Some("Alpha"));
    }

    #[test]
    fn upsert_replaces_prior_links() {
        let conn = setup();
        insert_note(&conn, "note-a", "Alpha", "");
        insert_note(&conn, "note-b", "Beta", "");
        insert_note(&conn, "note-c", "Gamma", "");

        upsert_links_for_note(
            &conn,
            "note-a",
            vec![NoteLinkPayload {
                target_note_id: "note-b".into(),
                target_heading: None,
                target_block_id: None,
                alias: None,
                link_type: None,
            }],
        )
        .unwrap();
        upsert_links_for_note(
            &conn,
            "note-a",
            vec![NoteLinkPayload {
                target_note_id: "note-c".into(),
                target_heading: None,
                target_block_id: None,
                alias: None,
                link_type: None,
            }],
        )
        .unwrap();

        let fwd = fetch_forward_links(&conn, "note-a").unwrap();
        assert_eq!(fwd.len(), 1);
        assert_eq!(fwd[0].target_note_id, "note-c");
    }

    #[test]
    fn unlinked_mentions_detects_title_in_content() {
        let conn = setup();
        insert_note(&conn, "note-a", "Alpha", "I was reading Beta today.");
        insert_note(&conn, "note-b", "Beta", "");

        let hits = fetch_unlinked_mentions(&conn, "note-a").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].match_text, "Beta");
    }

    #[test]
    fn unlinked_mentions_excludes_already_linked() {
        let conn = setup();
        insert_note(&conn, "note-a", "Alpha", "I was reading Beta today.");
        insert_note(&conn, "note-b", "Beta", "");
        upsert_links_for_note(
            &conn,
            "note-a",
            vec![NoteLinkPayload {
                target_note_id: "note-b".into(),
                target_heading: None,
                target_block_id: None,
                alias: None,
                link_type: None,
            }],
        )
        .unwrap();

        let hits = fetch_unlinked_mentions(&conn, "note-a").unwrap();
        assert!(hits.is_empty());
    }
}
