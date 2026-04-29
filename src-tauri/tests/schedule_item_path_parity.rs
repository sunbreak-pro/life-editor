//! Integration test: schedule_item fetch path parity
//!
//! Guards against the regression class from Known Issue 009
//! (Mobile/Desktop path asymmetry in `schedule_item_repository` fetchers).
//!
//! The three fetchers exposed by the Repository have different filter semantics;
//! this test pins those differences so a future rename / SQL tweak can't silently
//! change the filter contract.

use life_editor_lib::db::schedule_item_repository as repo;
use rusqlite::Connection;

/// Minimal schedule_items schema for integration testing.
/// Mirrors the columns read by `row_to_schedule_item` (no FK constraints).
const SCHEMA_SQL: &str = r#"
CREATE TABLE schedule_items (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    routine_id TEXT,
    template_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    memo TEXT,
    is_dismissed INTEGER DEFAULT 0,
    note_id TEXT DEFAULT NULL,
    is_all_day INTEGER DEFAULT 0,
    content TEXT DEFAULT NULL,
    version INTEGER DEFAULT 1,
    reminder_enabled INTEGER DEFAULT 0,
    reminder_offset INTEGER,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
);
"#;

fn setup() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory DB");
    conn.execute_batch(SCHEMA_SQL).expect("create schema");
    conn
}

#[allow(clippy::too_many_arguments)]
fn insert_item(
    conn: &Connection,
    id: &str,
    date: &str,
    routine_id: Option<&str>,
    is_deleted: bool,
    is_dismissed: bool,
) {
    conn.execute(
        "INSERT INTO schedule_items (id, date, title, start_time, end_time, routine_id, \
         is_deleted, is_dismissed, created_at, updated_at) \
         VALUES (?1, ?2, 'Test', '09:00', '10:00', ?3, ?4, ?5, \
         datetime('now'), datetime('now'))",
        rusqlite::params![
            id,
            date,
            routine_id,
            is_deleted as i64,
            is_dismissed as i64,
        ],
    )
    .expect("insert");
}

#[test]
fn fetch_by_date_active_excludes_dismissed_and_deleted() {
    let conn = setup();
    insert_item(&conn, "a", "2026-04-22", None, false, false); // visible
    insert_item(&conn, "b", "2026-04-22", None, false, true); // dismissed
    insert_item(&conn, "c", "2026-04-22", None, true, false); // deleted
    insert_item(&conn, "d", "2026-04-22", Some("r1"), false, false); // routine, visible

    let items = repo::fetch_by_date_active(&conn, "2026-04-22").expect("fetch");
    let ids: Vec<&str> = items.iter().map(|i| i.id.as_str()).collect();

    assert!(ids.contains(&"a"), "active event must be included");
    assert!(ids.contains(&"d"), "active routine must be included");
    assert!(
        !ids.contains(&"b"),
        "dismissed item must be excluded by fetch_by_date_active"
    );
    assert!(!ids.contains(&"c"), "deleted item must be excluded");
    assert_eq!(items.len(), 2);
}

#[test]
fn fetch_by_date_all_includes_dismissed_but_excludes_deleted() {
    let conn = setup();
    insert_item(&conn, "a", "2026-04-22", None, false, false);
    insert_item(&conn, "b", "2026-04-22", None, false, true); // dismissed
    insert_item(&conn, "c", "2026-04-22", None, true, false); // deleted

    let items = repo::fetch_by_date_all(&conn, "2026-04-22").expect("fetch");
    let ids: Vec<&str> = items.iter().map(|i| i.id.as_str()).collect();

    assert!(ids.contains(&"a"));
    assert!(
        ids.contains(&"b"),
        "fetch_by_date_all must include dismissed items"
    );
    assert!(!ids.contains(&"c"), "deleted item must still be excluded");
    assert_eq!(items.len(), 2);
}

#[test]
fn fetch_by_date_range_active_spans_dates_and_excludes_dismissed() {
    let conn = setup();
    insert_item(&conn, "a", "2026-04-20", None, false, false);
    insert_item(&conn, "b", "2026-04-21", None, false, true); // dismissed
    insert_item(&conn, "c", "2026-04-22", None, false, false);
    insert_item(&conn, "d", "2026-04-30", None, false, false); // out of range

    let items = repo::fetch_by_date_range_active(&conn, "2026-04-20", "2026-04-25")
        .expect("fetch");
    let ids: Vec<&str> = items.iter().map(|i| i.id.as_str()).collect();

    assert!(ids.contains(&"a"));
    assert!(ids.contains(&"c"));
    assert!(!ids.contains(&"b"), "dismissed must be excluded");
    assert!(!ids.contains(&"d"), "out-of-range must be excluded");
    assert_eq!(items.len(), 2);
}

#[test]
fn fetch_events_returns_only_non_routine_items_across_all_dates() {
    let conn = setup();
    insert_item(&conn, "e1", "2026-04-22", None, false, false); // event (past month)
    insert_item(&conn, "e2", "2026-06-15", None, false, false); // event (future)
    insert_item(&conn, "r1", "2026-04-22", Some("r"), false, false); // routine
    insert_item(&conn, "d1", "2026-04-22", None, true, false); // deleted event

    let items = repo::fetch_events(&conn).expect("fetch");
    let ids: Vec<&str> = items.iter().map(|i| i.id.as_str()).collect();

    assert!(ids.contains(&"e1"));
    assert!(ids.contains(&"e2"), "future-dated events must be included");
    assert!(
        !ids.contains(&"r1"),
        "routine-linked items must be excluded (routine_id IS NULL filter)"
    );
    assert!(!ids.contains(&"d1"), "deleted event must be excluded");
    assert_eq!(items.len(), 2);
}
