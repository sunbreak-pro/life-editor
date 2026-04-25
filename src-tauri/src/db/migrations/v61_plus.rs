//! Incremental migrations V61 onward.
//!
//! These are the migrations that ship in addition to the consolidated V60
//! schema produced by `full_schema::create_full_schema`. Adding a new
//! migration means appending another `if current_version < N { ... }`
//! block here and bumping the user_version inside it.

use rusqlite::Connection;

use super::util::{exec_ignore, has_column, has_table};

pub(super) fn apply(conn: &Connection, current_version: i32) -> rusqlite::Result<()> {
    // V61: Obsidian-style Note Links + Note Aliases
    // - note_links: [[NoteName]] / [[Note|alias]] / [[Note#Heading]] / [[Note#^block-id]] / ![[Note]]
    // - note_aliases: frontmatter aliases + [[Note|alias]] display text registry
    if current_version < 61 {
        eprintln!("V61: adding note_links + note_aliases tables");
        exec_ignore(
            conn,
            "CREATE TABLE IF NOT EXISTS note_links (
                id TEXT PRIMARY KEY,
                source_note_id TEXT,
                source_memo_date TEXT,
                target_note_id TEXT NOT NULL,
                target_heading TEXT,
                target_block_id TEXT,
                alias TEXT,
                link_type TEXT NOT NULL DEFAULT 'inline'
                    CHECK(link_type IN ('inline','embed')),
                created_at TEXT NOT NULL,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_deleted INTEGER DEFAULT 0,
                deleted_at TEXT,
                FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id);
            CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);
            CREATE INDEX IF NOT EXISTS idx_note_links_source_memo ON note_links(source_memo_date);
            CREATE INDEX IF NOT EXISTS idx_note_links_updated_at ON note_links(updated_at);
            CREATE INDEX IF NOT EXISTS idx_note_links_deleted ON note_links(is_deleted);

            CREATE TABLE IF NOT EXISTS note_aliases (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                alias TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(alias),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_note_aliases_note ON note_aliases(note_id);
            CREATE INDEX IF NOT EXISTS idx_note_aliases_alias ON note_aliases(alias);",
        );
        conn.pragma_update(None, "user_version", &61i32)?;
    }

    if current_version < 62 {
        eprintln!("V62: backfill NULL updated_at for versioned tables + tasks trigger (sync blocker fix)");
        exec_ignore(
            conn,
            "UPDATE tasks           SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE memos           SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE notes           SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE schedule_items  SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE routines        SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE wiki_tags       SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE time_memos      SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE calendars       SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE templates       SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
             UPDATE routine_groups  SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;

             DROP TRIGGER IF EXISTS tasks_updated_at_insert;
             CREATE TRIGGER tasks_updated_at_insert
                 AFTER INSERT ON tasks
                 FOR EACH ROW WHEN NEW.updated_at IS NULL
             BEGIN
                 UPDATE tasks SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE id = NEW.id;
             END;",
        );
        conn.pragma_update(None, "user_version", &62i32)?;
    }

    if current_version < 63 {
        eprintln!(
            "V63: deduplicate schedule_items by (routine_id, date) + add partial UNIQUE index"
        );
        // Idempotent cleanup: keep one row per (routine_id, date) where
        // routine_id IS NOT NULL AND is_deleted = 0. Keep the one with the
        // earliest updated_at (ties broken by id) so user-edited rows — which
        // would have bumped updated_at — are preferred as survivors only when
        // they happen to be the earliest; in this codebase's observed data all
        // duplicates are version=1 so none have user edits to preserve.
        exec_ignore(
            conn,
            "DELETE FROM schedule_items
             WHERE routine_id IS NOT NULL
               AND is_deleted = 0
               AND EXISTS (
                 SELECT 1 FROM schedule_items s2
                 WHERE s2.routine_id = schedule_items.routine_id
                   AND s2.date = schedule_items.date
                   AND s2.routine_id IS NOT NULL
                   AND s2.is_deleted = 0
                   AND (
                     s2.updated_at < schedule_items.updated_at
                     OR (s2.updated_at = schedule_items.updated_at AND s2.id < schedule_items.id)
                   )
               );
             CREATE UNIQUE INDEX IF NOT EXISTS idx_si_routine_date
               ON schedule_items(routine_id, date)
               WHERE routine_id IS NOT NULL AND is_deleted = 0;",
        );
        conn.pragma_update(None, "user_version", &63i32)?;
    }

    if current_version < 64 {
        eprintln!(
            "V64: rename memos → dailies (incl. note_links.source_memo_date → source_daily_date)"
        );

        // 1) Create new `dailies` table (same shape as `memos`)
        exec_ignore(
            conn,
            "CREATE TABLE IF NOT EXISTS dailies (
                 id TEXT PRIMARY KEY,
                 date TEXT NOT NULL UNIQUE,
                 content TEXT DEFAULT '',
                 created_at TEXT NOT NULL,
                 updated_at TEXT NOT NULL,
                 is_deleted INTEGER DEFAULT 0,
                 deleted_at TEXT,
                 is_pinned INTEGER DEFAULT 0,
                 password_hash TEXT DEFAULT NULL,
                 is_edit_locked INTEGER DEFAULT 0,
                 version INTEGER DEFAULT 1
             );",
        );

        // 2) Copy rows from `memos` with id transform
        //    memo-YYYY-MM-DD → daily-YYYY-MM-DD (substr(id, 6) strips "memo-")
        //    Guarded with has_table so rerun / fresh-install paths stay idempotent.
        if has_table(conn, "memos") {
            exec_ignore(
                conn,
                "INSERT OR IGNORE INTO dailies
                     (id, date, content, created_at, updated_at,
                      is_deleted, deleted_at, is_pinned,
                      password_hash, is_edit_locked, version)
                 SELECT 'daily-' || substr(id, 6),
                        date, content, created_at, updated_at,
                        is_deleted, deleted_at, is_pinned,
                        password_hash, is_edit_locked, version
                 FROM memos;",
            );
        }

        // 3) Rename note_links column: source_memo_date → source_daily_date
        //    (SQLite 3.25+ supports RENAME COLUMN; rusqlite bundled ships ≥3.40)
        if has_column(conn, "note_links", "source_memo_date") {
            exec_ignore(
                conn,
                "ALTER TABLE note_links RENAME COLUMN source_memo_date TO source_daily_date;",
            );
        }

        // 3b) Update wiki_tag_assignments: rewrite entity_type 'memo' → 'daily'
        //     and transform entity_id from memo-YYYY-MM-DD to daily-YYYY-MM-DD.
        exec_ignore(
            conn,
            "UPDATE wiki_tag_assignments
                 SET entity_type = 'daily',
                     entity_id   = 'daily-' || substr(entity_id, 6)
                 WHERE entity_type = 'memo';",
        );

        // 3c) Update paper_nodes.ref_entity_type/ref_entity_id the same way.
        exec_ignore(
            conn,
            "UPDATE paper_nodes
                 SET ref_entity_type = 'daily',
                     ref_entity_id   = 'daily-' || substr(ref_entity_id, 6)
                 WHERE ref_entity_type = 'memo';",
        );

        // 4) Drop old `memos` table
        exec_ignore(conn, "DROP TABLE IF EXISTS memos;");

        // 5) Rebuild indexes
        exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_dailies_date ON dailies(date);");
        exec_ignore(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_dailies_deleted ON dailies(is_deleted);",
        );
        exec_ignore(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_dailies_updated_at ON dailies(updated_at);",
        );
        exec_ignore(conn, "DROP INDEX IF EXISTS idx_note_links_source_memo;");
        exec_ignore(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_note_links_source_daily ON note_links(source_daily_date);",
        );

        conn.pragma_update(None, "user_version", &64i32)?;
    }

    // V65: CalendarTags single-tag + Task support
    //  - calendar_tag_definitions: add created_at / updated_at / version / is_deleted / deleted_at for Cloud Sync
    //  - calendar_tag_assignments: rebuild with (entity_type, entity_id, tag_id) + UNIQUE(entity_type, entity_id) for 1:1
    //  - Migrate existing rows: pick smallest tag_id per schedule_item_id (collapse multi-tag → single-tag)
    if current_version < 65 {
        eprintln!("V65: CalendarTags single-tag + Task support");

        // 1) Augment calendar_tag_definitions for Cloud Sync
        if !has_column(conn, "calendar_tag_definitions", "created_at") {
            exec_ignore(
                conn,
                "ALTER TABLE calendar_tag_definitions ADD COLUMN created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'))",
            );
        }
        if !has_column(conn, "calendar_tag_definitions", "updated_at") {
            exec_ignore(
                conn,
                "ALTER TABLE calendar_tag_definitions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'))",
            );
        }
        if !has_column(conn, "calendar_tag_definitions", "version") {
            exec_ignore(
                conn,
                "ALTER TABLE calendar_tag_definitions ADD COLUMN version INTEGER NOT NULL DEFAULT 1",
            );
        }
        if !has_column(conn, "calendar_tag_definitions", "is_deleted") {
            exec_ignore(
                conn,
                "ALTER TABLE calendar_tag_definitions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0",
            );
        }
        if !has_column(conn, "calendar_tag_definitions", "deleted_at") {
            exec_ignore(
                conn,
                "ALTER TABLE calendar_tag_definitions ADD COLUMN deleted_at TEXT",
            );
        }

        // 2) Rebuild calendar_tag_assignments with new shape
        //    Old PK: (schedule_item_id, tag_id) — allows multiple tags per item
        //    New shape: id PK + entity_type + entity_id + tag_id, UNIQUE(entity_type, entity_id)
        let needs_rebuild = !has_column(conn, "calendar_tag_assignments", "entity_type");
        if needs_rebuild {
            exec_ignore(
                conn,
                "CREATE TABLE IF NOT EXISTS calendar_tag_assignments_v2 (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL CHECK(entity_type IN ('task','schedule_item')),
                    entity_id TEXT NOT NULL,
                    tag_id INTEGER NOT NULL REFERENCES calendar_tag_definitions(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(entity_type, entity_id)
                );",
            );

            // Collapse multi-tag rows: pick MIN(tag_id) per schedule_item_id
            // ID format: 'cta-' || hex(randomblob(8)) (16 hex chars) — collision-resistant within migration scope
            if has_table(conn, "calendar_tag_assignments") {
                exec_ignore(
                    conn,
                    "INSERT OR IGNORE INTO calendar_tag_assignments_v2
                        (id, entity_type, entity_id, tag_id, created_at, updated_at)
                     SELECT
                        'cta-' || lower(hex(randomblob(8))),
                        'schedule_item',
                        schedule_item_id,
                        MIN(tag_id),
                        strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'),
                        strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')
                     FROM calendar_tag_assignments
                     GROUP BY schedule_item_id;",
                );
                exec_ignore(conn, "DROP TABLE calendar_tag_assignments;");
            }
            exec_ignore(
                conn,
                "ALTER TABLE calendar_tag_assignments_v2 RENAME TO calendar_tag_assignments;",
            );

            exec_ignore(
                conn,
                "CREATE INDEX IF NOT EXISTS idx_cta_entity ON calendar_tag_assignments(entity_type, entity_id);",
            );
            exec_ignore(
                conn,
                "CREATE INDEX IF NOT EXISTS idx_cta_tag ON calendar_tag_assignments(tag_id);",
            );
        }

        conn.pragma_update(None, "user_version", &65i32)?;
    }

    // V66: timer_sessions.label for Free-mode session naming on save
    if current_version < 66 {
        eprintln!("V66: timer_sessions.label for Free-mode session naming");
        if !has_column(conn, "timer_sessions", "label") {
            exec_ignore(conn, "ALTER TABLE timer_sessions ADD COLUMN label TEXT");
        }
        conn.pragma_update(None, "user_version", &66i32)?;
    }

    // V67: sidebar_links — user-defined quick links in LeftSidebar
    //  - kind='url': open in selected default browser (or system default)
    //  - kind='app': launch a macOS .app via `open -a` (Desktop only; iOS grays out)
    //  - Cloud Sync: versioned table (version + LWW), syncs across devices.
    if current_version < 67 {
        eprintln!("V67: sidebar_links");
        exec_ignore(
            conn,
            "CREATE TABLE IF NOT EXISTS sidebar_links (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL CHECK(kind IN ('url','app')),
                name TEXT NOT NULL,
                target TEXT NOT NULL,
                emoji TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );",
        );
        exec_ignore(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_sidebar_links_deleted ON sidebar_links(is_deleted);",
        );
        exec_ignore(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_sidebar_links_sort_order ON sidebar_links(sort_order);",
        );
        exec_ignore(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_sidebar_links_updated_at ON sidebar_links(updated_at);",
        );
        conn.pragma_update(None, "user_version", &67i32)?;
    }

    Ok(())
}
