//! Database migrations: orchestrator + version-range modules.
//!
//! Fresh DBs (user_version=0) get the consolidated V60 schema via
//! `full_schema::create_full_schema`, jump to user_version=61, then fall
//! through to the incremental modules so V61+ ships consistently.
//! Existing DBs run only the version blocks above their current
//! user_version — every block is idempotent.

mod full_schema;
mod util;
mod v2_v30;
mod v31_v60;
mod v61_plus;

use rusqlite::Connection;

use util::{exec_ignore, has_column};

/// Run database migrations to bring the schema up to the latest version.
///
/// - Fresh databases (version 0): creates tables in consolidated V61 state,
///   then falls through to incremental migrations so V62+ (triggers, backfills)
///   apply consistently.
/// - Existing databases: runs incremental migrations from current version.
pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    let current_version: i32 =
        conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

    let start_version = if current_version < 1 {
        full_schema::create_full_schema(conn)?;
        conn.pragma_update(None, "user_version", &61i32)?;
        61
    } else {
        current_version
    };

    run_incremental_migrations(conn, start_version)?;

    Ok(())
}

fn run_incremental_migrations(conn: &Connection, current_version: i32) -> rusqlite::Result<()> {
    v2_v30::apply(conn, current_version)?;
    v31_v60::apply(conn, current_version)?;
    v61_plus::apply(conn, current_version)?;

    // Defensive backfills (run unconditionally on every boot — fresh DBs
    // that bypassed the historical version blocks still need these columns).
    if !has_column(conn, "schedule_items", "template_id") {
        exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN template_id TEXT");
    }
    // routine_groups was created in V42 without a `version` column.
    // sync_engine's UPSERT references `excluded.version`, so upgraders from
    // V42-V61 fail with "no such column: excluded.version". Add it if missing.
    if !has_column(conn, "routine_groups", "version") {
        exec_ignore(
            conn,
            "ALTER TABLE routine_groups ADD COLUMN version INTEGER DEFAULT 1",
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::full_schema::create_full_schema;
    use super::util::has_column;
    use super::*;

    /// Latest schema user_version. Bump every time a new V_N block is added
    /// to `v61_plus.rs` so the cross-cutting tests (fresh DB / upgrade /
    /// idempotency) stay in sync without per-test edits.
    const LATEST_USER_VERSION: i32 = 69;

    fn table_exists(conn: &Connection, name: &str) -> bool {
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1",
            [name],
            |_| Ok(()),
        )
        .is_ok()
    }

    fn user_version(conn: &Connection) -> i32 {
        conn.pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn fresh_db_reaches_latest_without_orphan_tables() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        assert_eq!(user_version(&conn), LATEST_USER_VERSION);
        for orphan in [
            "ai_settings",
            "routine_logs",
            "task_tags",
            "task_tag_definitions",
            "note_tags",
            "note_tag_definitions",
            // V69: dropped along with the Routine Tag concept.
            "routine_tag_definitions",
            "routine_tag_assignments",
            "routine_group_tag_assignments",
        ] {
            assert!(
                !table_exists(&conn, orphan),
                "orphan table {orphan} should not exist in fresh schema"
            );
        }
        assert!(
            table_exists(&conn, "note_links"),
            "note_links table should exist in fresh V61 schema"
        );
        assert!(
            table_exists(&conn, "note_aliases"),
            "note_aliases table should exist in fresh V61 schema"
        );
    }

    #[test]
    fn v60_db_upgrades_to_v61_with_note_links_tables() {
        let conn = Connection::open_in_memory().unwrap();
        create_full_schema(&conn).unwrap();
        // Simulate a V60 DB by forcing version back and dropping the V61 tables.
        conn.pragma_update(None, "user_version", &60i32).unwrap();
        conn.execute_batch(
            "DROP TABLE IF EXISTS note_links;
             DROP TABLE IF EXISTS note_aliases;",
        )
        .unwrap();

        run_migrations(&conn).unwrap();

        assert_eq!(user_version(&conn), LATEST_USER_VERSION);
        assert!(table_exists(&conn, "note_links"));
        assert!(table_exists(&conn, "note_aliases"));
    }

    #[test]
    fn v59_db_upgrades_to_v60_and_drops_orphans() {
        let conn = Connection::open_in_memory().unwrap();
        // Seed as V59 with orphan tables + a few residue tables present.
        create_full_schema(&conn).unwrap();
        conn.pragma_update(None, "user_version", &59i32).unwrap();
        conn.execute_batch(
            "CREATE TABLE ai_settings (id INTEGER PRIMARY KEY, api_key TEXT, updated_at TEXT);
             CREATE TABLE routine_logs (id INTEGER PRIMARY KEY);
             CREATE TABLE task_tags (task_id TEXT, tag_id INTEGER);
             CREATE TABLE task_tag_definitions (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE note_tags (note_id TEXT, tag_id INTEGER);
             CREATE TABLE note_tag_definitions (id INTEGER PRIMARY KEY, name TEXT);
             CREATE TABLE tasks_new (id TEXT);
             CREATE TABLE sound_settings_v13 (id INTEGER PRIMARY KEY);
             CREATE TABLE task_tags_backup_v9 (task_id TEXT);",
        )
        .unwrap();

        run_migrations(&conn).unwrap();

        assert_eq!(user_version(&conn), LATEST_USER_VERSION);
        for dropped in [
            "ai_settings",
            "routine_logs",
            "task_tags",
            "task_tag_definitions",
            "note_tags",
            "note_tag_definitions",
            "tasks_new",
            "sound_settings_v13",
            "task_tags_backup_v9",
        ] {
            assert!(
                !table_exists(&conn, dropped),
                "table {dropped} should have been dropped by V60 migration"
            );
        }
        // Live tables remain intact.
        for live in ["tasks", "notes", "dailies", "routines", "wiki_tags", "schedule_items"] {
            assert!(table_exists(&conn, live), "live table {live} must remain");
        }
    }

    #[test]
    fn v62_migration_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let version_after_first = user_version(&conn);
        run_migrations(&conn).unwrap();
        assert_eq!(user_version(&conn), version_after_first);
        assert_eq!(user_version(&conn), LATEST_USER_VERSION);
    }

    #[test]
    fn v62_backfills_null_updated_at_and_installs_trigger() {
        let conn = Connection::open_in_memory().unwrap();
        // Simulate pre-V62 schema with a NULL updated_at task.
        create_full_schema(&conn).unwrap();
        conn.pragma_update(None, "user_version", &61i32).unwrap();
        conn.execute(
            "INSERT INTO tasks (id, type, title, created_at, updated_at) \
             VALUES ('task-legacy', 'task', 'legacy', '2026-04-18T00:00:00Z', NULL)",
            [],
        )
        .unwrap();

        run_migrations(&conn).unwrap();

        let legacy_updated_at: Option<String> = conn
            .query_row(
                "SELECT updated_at FROM tasks WHERE id = 'task-legacy'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            legacy_updated_at.is_some(),
            "V62 must backfill NULL updated_at for existing tasks"
        );

        // Insert a fresh task without updated_at → trigger should auto-set it.
        conn.execute(
            "INSERT INTO tasks (id, type, title, created_at) \
             VALUES ('task-new', 'task', 'new', '2026-04-20T00:00:00Z')",
            [],
        )
        .unwrap();
        let new_updated_at: Option<String> = conn
            .query_row(
                "SELECT updated_at FROM tasks WHERE id = 'task-new'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            new_updated_at.is_some(),
            "V62 trigger must auto-set updated_at on INSERT"
        );
    }

    #[test]
    fn v64_renames_memos_to_dailies_and_transforms_ids() {
        // Simulate pre-V64 schema: create_full_schema yields `memos` table.
        let conn = Connection::open_in_memory().unwrap();
        create_full_schema(&conn).unwrap();
        conn.pragma_update(None, "user_version", &63i32).unwrap();

        // Seed two memo rows + a note_links row referencing source_memo_date +
        // a wiki_tag_assignments row of entity_type='memo' + a paper_nodes row
        // with ref_entity_type='memo'.
        conn.execute_batch(
            "INSERT INTO memos (id, date, content, created_at, updated_at, version)
                 VALUES ('memo-2026-01-01', '2026-01-01', 'jan 1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 1);
             INSERT INTO memos (id, date, content, created_at, updated_at, version, is_pinned)
                 VALUES ('memo-2026-02-02', '2026-02-02', 'feb 2', '2026-02-02T00:00:00Z', '2026-02-02T00:00:00Z', 3, 1);
             INSERT INTO notes (id, title, content, created_at, updated_at, version, is_deleted)
                 VALUES ('note-target', 'Target', '', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 1, 0);
             INSERT INTO note_links
                 (id, source_note_id, source_memo_date, target_note_id, target_heading,
                  target_block_id, alias, link_type, created_at, updated_at, version, is_deleted)
                 VALUES ('nl-1', NULL, '2026-01-01', 'note-target', NULL, NULL, NULL, 'inline',
                         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 1, 0);
             INSERT INTO wiki_tags (id, name, color, created_at, updated_at, version)
                 VALUES ('tag-1', 'Tag1', '#000', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 1);
             INSERT INTO wiki_tag_assignments (tag_id, entity_id, entity_type, source, created_at)
                 VALUES ('tag-1', 'memo-2026-01-01', 'memo', 'inline', '2026-01-01T00:00:00Z');",
        )
        .unwrap();

        // Run migrations (V64 will fire).
        run_migrations(&conn).unwrap();

        // dailies table exists; memos table is gone.
        assert!(table_exists(&conn, "dailies"), "dailies table must exist");
        assert!(!table_exists(&conn, "memos"), "memos table must be dropped");

        // Rows preserved with id transform.
        let (new_id1, content1): (String, String) = conn
            .query_row(
                "SELECT id, content FROM dailies WHERE date = '2026-01-01'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(new_id1, "daily-2026-01-01");
        assert_eq!(content1, "jan 1");

        let (new_id2, version2, is_pinned2): (String, i64, i64) = conn
            .query_row(
                "SELECT id, version, is_pinned FROM dailies WHERE date = '2026-02-02'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(new_id2, "daily-2026-02-02");
        assert_eq!(version2, 3, "version column preserved");
        assert_eq!(is_pinned2, 1, "is_pinned column preserved");

        // note_links column renamed to source_daily_date.
        assert!(has_column(&conn, "note_links", "source_daily_date"));
        assert!(!has_column(&conn, "note_links", "source_memo_date"));

        // wiki_tag_assignments row was rewritten.
        let (new_entity_id, new_entity_type): (String, String) = conn
            .query_row(
                "SELECT entity_id, entity_type FROM wiki_tag_assignments WHERE tag_id = 'tag-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(new_entity_id, "daily-2026-01-01");
        assert_eq!(new_entity_type, "daily");

        // user_version bumped to 64.
        assert_eq!(user_version(&conn), LATEST_USER_VERSION);
    }

    #[test]
    fn v68_allows_free_session_type() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        // V68 must rebuild timer_sessions so 'FREE' is accepted.
        conn.execute(
            "INSERT INTO timer_sessions (task_id, session_type, started_at, completed) \
             VALUES (NULL, 'FREE', '2026-04-25T00:00:00.000Z', 0)",
            [],
        )
        .expect("'FREE' session_type must be allowed after V68");
    }

    #[test]
    fn v68_preserves_existing_timer_sessions_during_rebuild() {
        // Simulate a pre-V68 DB: full_schema with the legacy CHECK + V66 label
        // backfill, then a row inserted under the old constraint.
        let conn = Connection::open_in_memory().unwrap();
        create_full_schema(&conn).unwrap();
        conn.pragma_update(None, "user_version", &65i32).unwrap();
        // Bypass the legacy CHECK by inserting a 'WORK' row that V68 must keep.
        conn.execute(
            "INSERT INTO timer_sessions (id, task_id, session_type, started_at, duration, completed) \
             VALUES (42, 'task-x', 'WORK', '2026-04-20T00:00:00.000Z', 1500, 1)",
            [],
        )
        .unwrap();

        run_migrations(&conn).unwrap();

        let (id, st, dur): (i64, String, i64) = conn
            .query_row(
                "SELECT id, session_type, duration FROM timer_sessions WHERE id = 42",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("legacy row must survive V68 rebuild");
        assert_eq!(id, 42);
        assert_eq!(st, "WORK");
        assert_eq!(dur, 1500);
    }

    #[test]
    fn v67_creates_sidebar_links_table() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        assert!(table_exists(&conn, "sidebar_links"));
        for col in [
            "id",
            "kind",
            "name",
            "target",
            "emoji",
            "sort_order",
            "is_deleted",
            "deleted_at",
            "version",
            "created_at",
            "updated_at",
        ] {
            assert!(
                has_column(&conn, "sidebar_links", col),
                "sidebar_links missing column {col}"
            );
        }
    }

    #[test]
    fn v69_drops_routine_tag_tables_and_creates_group_assignments() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        assert!(!table_exists(&conn, "routine_tag_assignments"));
        assert!(!table_exists(&conn, "routine_tag_definitions"));
        assert!(!table_exists(&conn, "routine_group_tag_assignments"));
        assert!(table_exists(&conn, "routine_group_assignments"));
        for col in [
            "id",
            "routine_id",
            "group_id",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
        ] {
            assert!(
                has_column(&conn, "routine_group_assignments", col),
                "routine_group_assignments missing column {col}"
            );
        }
    }

    #[test]
    fn v69_upgrade_path_drops_seeded_routine_tag_data() {
        // Simulate a pre-V69 DB by forcing version back and reinserting the
        // V61-baseline routine tag tables that V69 must drop.
        let conn = Connection::open_in_memory().unwrap();
        create_full_schema(&conn).unwrap();
        conn.pragma_update(None, "user_version", &68i32).unwrap();
        // Seed a routine + tag + assignment to confirm V69 wipes them.
        conn.execute_batch(
            "INSERT INTO routines (id, title, frequency_type, created_at, updated_at, version)
                 VALUES ('routine-1', 'r1', 'daily', '2026-04-25T00:00:00.000Z', '2026-04-25T00:00:00.000Z', 1);
             INSERT INTO routine_tag_assignments (routine_id, tag_id) VALUES ('routine-1', 1);",
        )
        .unwrap();

        run_migrations(&conn).unwrap();

        assert_eq!(user_version(&conn), LATEST_USER_VERSION);
        assert!(!table_exists(&conn, "routine_tag_assignments"));
        assert!(!table_exists(&conn, "routine_group_tag_assignments"));
        assert!(!table_exists(&conn, "routine_tag_definitions"));
        assert!(table_exists(&conn, "routine_group_assignments"));
        // Routine itself survives.
        let routine_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM routines WHERE id = 'routine-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(routine_count, 1);
    }

    #[test]
    fn routine_groups_version_column_backfilled_on_upgrade() {
        // Simulate DB where V42-era routine_groups was created without the
        // `version` column (which sync_engine's UPSERT requires).
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE routine_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '#6B7280',
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )
        .unwrap();
        conn.pragma_update(None, "user_version", &61i32).unwrap();

        run_migrations(&conn).unwrap();

        assert!(
            has_column(&conn, "routine_groups", "version"),
            "defensive ALTER must add version column to routine_groups"
        );
    }
}
