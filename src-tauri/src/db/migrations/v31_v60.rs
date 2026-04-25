//! Incremental migrations V31 .. V60.
//!
//! Each version block is idempotent and gated on `current_version`; the V60
//! pragma_update is the cut-off where freshly-bootstrapped DBs (which start
//! at V61 via `full_schema`) leave this module behind.

use rusqlite::Connection;

use super::util::{exec_ignore, has_column};

pub(super) fn apply(conn: &Connection, current_version: i32) -> rusqlite::Result<()> {

    // V31: Additional indexes
    if current_version < 31 {
        exec_ignore(conn,
            "CREATE INDEX IF NOT EXISTS idx_wta_source_entity ON wiki_tag_assignments(source, entity_id);
            CREATE INDEX IF NOT EXISTS idx_sta_tag ON sound_tag_assignments(tag_id);",
        );
        conn.pragma_update(None, "user_version", &31i32)?;
    }

    // V32: schedule_items.memo
    if current_version < 32 {
        if !has_column(conn, "schedule_items", "memo") {
            exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN memo TEXT");
        }
        conn.pragma_update(None, "user_version", &32i32)?;
    }

    // V33: timer_settings.target_sessions
    if current_version < 33 {
        if !has_column(conn, "timer_settings", "target_sessions") {
            exec_ignore(conn, "ALTER TABLE timer_settings ADD COLUMN target_sessions INTEGER NOT NULL DEFAULT 4");
        }
        conn.pragma_update(None, "user_version", &33i32)?;
    }

    // V34: Paper boards + nodes + edges
    if current_version < 34 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS paper_boards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                linked_note_id TEXT,
                viewport_x REAL NOT NULL DEFAULT 0,
                viewport_y REAL NOT NULL DEFAULT 0,
                viewport_zoom REAL NOT NULL DEFAULT 1,
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (linked_note_id) REFERENCES notes(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_pb_note ON paper_boards(linked_note_id);

            CREATE TABLE IF NOT EXISTS paper_nodes (
                id TEXT PRIMARY KEY,
                board_id TEXT NOT NULL,
                node_type TEXT NOT NULL CHECK(node_type IN ('card', 'text', 'frame')),
                position_x REAL NOT NULL DEFAULT 0,
                position_y REAL NOT NULL DEFAULT 0,
                width REAL NOT NULL DEFAULT 200,
                height REAL NOT NULL DEFAULT 100,
                z_index INTEGER NOT NULL DEFAULT 0,
                parent_node_id TEXT,
                ref_entity_id TEXT,
                ref_entity_type TEXT,
                text_content TEXT,
                frame_color TEXT,
                frame_label TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (board_id) REFERENCES paper_boards(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_node_id) REFERENCES paper_nodes(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_pn_board ON paper_nodes(board_id);
            CREATE INDEX IF NOT EXISTS idx_pn_parent ON paper_nodes(parent_node_id);

            CREATE TABLE IF NOT EXISTS paper_edges (
                id TEXT PRIMARY KEY,
                board_id TEXT NOT NULL,
                source_node_id TEXT NOT NULL,
                target_node_id TEXT NOT NULL,
                source_handle TEXT,
                target_handle TEXT,
                label TEXT,
                style_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (board_id) REFERENCES paper_boards(id) ON DELETE CASCADE,
                FOREIGN KEY (source_node_id) REFERENCES paper_nodes(id) ON DELETE CASCADE,
                FOREIGN KEY (target_node_id) REFERENCES paper_nodes(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_pe_board ON paper_edges(board_id);",
        );
        conn.pragma_update(None, "user_version", &34i32)?;
    }

    // V35: tasks.time_memo
    if current_version < 35 {
        if !has_column(conn, "tasks", "time_memo") {
            exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN time_memo TEXT DEFAULT NULL");
        }
        conn.pragma_update(None, "user_version", &35i32)?;
    }

    // V36: version + updated_at columns for sync + sync indexes
    if current_version < 36 {
        let tables_with_version = [
            "tasks", "memos", "notes", "schedule_items", "routines",
            "wiki_tags", "time_memos", "calendars",
        ];
        for table in &tables_with_version {
            if !has_column(conn, table, "version") {
                exec_ignore(conn, &format!(
                    "ALTER TABLE {} ADD COLUMN version INTEGER NOT NULL DEFAULT 1", table
                ));
            }
        }
        if !has_column(conn, "tasks", "updated_at") {
            exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN updated_at TEXT");
            exec_ignore(conn, "UPDATE tasks SET updated_at = COALESCE(completed_at, created_at)");
        }
        if !has_column(conn, "wiki_tag_assignments", "updated_at") {
            exec_ignore(conn, "ALTER TABLE wiki_tag_assignments ADD COLUMN updated_at TEXT");
            exec_ignore(conn, "UPDATE wiki_tag_assignments SET updated_at = created_at");
        }
        if !has_column(conn, "wiki_tag_connections", "updated_at") {
            exec_ignore(conn, "ALTER TABLE wiki_tag_connections ADD COLUMN updated_at TEXT");
            exec_ignore(conn, "UPDATE wiki_tag_connections SET updated_at = created_at");
        }
        if !has_column(conn, "note_connections", "updated_at") {
            exec_ignore(conn, "ALTER TABLE note_connections ADD COLUMN updated_at TEXT");
            exec_ignore(conn, "UPDATE note_connections SET updated_at = created_at");
        }
        exec_ignore(conn,
            "CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
            CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON memos(updated_at);
            CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
            CREATE INDEX IF NOT EXISTS idx_schedule_items_updated_at ON schedule_items(updated_at);
            CREATE INDEX IF NOT EXISTS idx_routines_updated_at ON routines(updated_at);
            CREATE INDEX IF NOT EXISTS idx_wiki_tags_updated_at ON wiki_tags(updated_at);
            CREATE INDEX IF NOT EXISTS idx_time_memos_updated_at ON time_memos(updated_at);
            CREATE INDEX IF NOT EXISTS idx_calendars_updated_at ON calendars(updated_at);
            CREATE INDEX IF NOT EXISTS idx_wiki_tag_assignments_updated_at ON wiki_tag_assignments(updated_at);
            CREATE INDEX IF NOT EXISTS idx_wiki_tag_connections_updated_at ON wiki_tag_connections(updated_at);
            CREATE INDEX IF NOT EXISTS idx_note_connections_updated_at ON note_connections(updated_at);",
        );
        conn.pragma_update(None, "user_version", &36i32)?;
    }

    // V37: chaos_settings + chaos_display_log (removed in V41, but still run for version tracking)
    if current_version < 37 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS chaos_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chaos_display_log (
                id TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                entity_type TEXT NOT NULL CHECK(entity_type IN ('memo', 'note')),
                display_type TEXT NOT NULL CHECK(display_type IN ('oracle', 'timecapsule', 'drift')),
                displayed_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chaos_log_entity ON chaos_display_log(entity_id);
            CREATE INDEX IF NOT EXISTS idx_chaos_log_displayed ON chaos_display_log(displayed_at);",
        );
        conn.pragma_update(None, "user_version", &37i32)?;
    }

    // V38: Rebuild tasks with 3-state status (TODO -> NOT_STARTED, add IN_PROGRESS)
    if current_version < 38 {
        exec_ignore(conn, "PRAGMA foreign_keys = OFF");
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS tasks_new (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL CHECK(type IN ('folder', 'task')),
                title TEXT NOT NULL DEFAULT '',
                parent_id TEXT,
                \"order\" INTEGER NOT NULL DEFAULT 0,
                status TEXT CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'DONE')),
                is_expanded INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                content TEXT,
                work_duration_minutes INTEGER,
                color TEXT,
                due_date TEXT,
                scheduled_at TEXT,
                scheduled_end_at TEXT,
                is_all_day INTEGER DEFAULT 0,
                time_memo TEXT DEFAULT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT,
                FOREIGN KEY (parent_id) REFERENCES tasks_new(id)
            );
            INSERT INTO tasks_new
                SELECT id, type, title, parent_id, \"order\",
                    CASE
                        WHEN status = 'TODO' THEN 'NOT_STARTED'
                        WHEN status = 'DONE' THEN 'DONE'
                        ELSE 'NOT_STARTED'
                    END AS status,
                    is_expanded, is_deleted, deleted_at, created_at, completed_at,
                    content, work_duration_minutes, color, due_date,
                    scheduled_at, scheduled_end_at, is_all_day, time_memo,
                    version, updated_at
                FROM tasks;
            UPDATE tasks_new SET parent_id = NULL
                WHERE parent_id IS NOT NULL
                AND parent_id NOT IN (SELECT id FROM tasks_new);
            DROP TABLE tasks;
            ALTER TABLE tasks_new RENAME TO tasks;
            CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(is_deleted);
            CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);",
        );
        exec_ignore(conn, "PRAGMA foreign_keys = ON");
        conn.pragma_update(None, "user_version", &38i32)?;
    }

    // V39: Repair orphan parent_id references
    if current_version < 39 {
        exec_ignore(conn,
            "UPDATE tasks SET parent_id = NULL
                WHERE parent_id IS NOT NULL
                AND parent_id NOT IN (SELECT id FROM tasks);",
        );
        conn.pragma_update(None, "user_version", &39i32)?;
    }

    // V40: schedule_items.is_dismissed
    if current_version < 40 {
        if !has_column(conn, "schedule_items", "is_dismissed") {
            exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN is_dismissed INTEGER NOT NULL DEFAULT 0");
        }
        conn.pragma_update(None, "user_version", &40i32)?;
    }

    // V41: Drop chaos tables
    if current_version < 41 {
        exec_ignore(conn,
            "DROP TABLE IF EXISTS chaos_display_log;
            DROP TABLE IF EXISTS chaos_settings;",
        );
        conn.pragma_update(None, "user_version", &41i32)?;
    }

    // V42: routine_groups + routine_group_tag_assignments + schedule_items.note_id
    if current_version < 42 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS routine_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '#6B7280',
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS routine_group_tag_assignments (
                group_id TEXT NOT NULL REFERENCES routine_groups(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES routine_tag_definitions(id) ON DELETE CASCADE,
                PRIMARY KEY (group_id, tag_id)
            );
            CREATE INDEX IF NOT EXISTS idx_rgta_group ON routine_group_tag_assignments(group_id);
            CREATE INDEX IF NOT EXISTS idx_rgta_tag ON routine_group_tag_assignments(tag_id);",
        );
        if !has_column(conn, "schedule_items", "note_id") {
            exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN note_id TEXT DEFAULT NULL");
        }
        conn.pragma_update(None, "user_version", &42i32)?;
    }

    // V43: paper_nodes.label + paper_nodes.hidden
    if current_version < 43 {
        if !has_column(conn, "paper_nodes", "label") {
            exec_ignore(conn, "ALTER TABLE paper_nodes ADD COLUMN label TEXT DEFAULT NULL");
        }
        if !has_column(conn, "paper_nodes", "hidden") {
            exec_ignore(conn, "ALTER TABLE paper_nodes ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
        }
        conn.pragma_update(None, "user_version", &43i32)?;
    }

    // V44: Calendar tags
    if current_version < 44 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS calendar_tag_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#808080',
                text_color TEXT DEFAULT NULL,
                \"order\" INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS calendar_tag_assignments (
                schedule_item_id TEXT NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES calendar_tag_definitions(id) ON DELETE CASCADE,
                PRIMARY KEY (schedule_item_id, tag_id)
            );
            CREATE INDEX IF NOT EXISTS idx_cta_item ON calendar_tag_assignments(schedule_item_id);
            CREATE INDEX IF NOT EXISTS idx_cta_tag ON calendar_tag_assignments(tag_id);",
        );
        conn.pragma_update(None, "user_version", &44i32)?;
    }

    // V45: schedule_items.is_all_day + routines frequency + routine_groups frequency
    if current_version < 45 {
        if !has_column(conn, "schedule_items", "is_all_day") {
            exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN is_all_day INTEGER NOT NULL DEFAULT 0");
        }
        if !has_column(conn, "routines", "frequency_type") {
            exec_ignore(conn, "ALTER TABLE routines ADD COLUMN frequency_type TEXT NOT NULL DEFAULT 'daily'");
        }
        if !has_column(conn, "routines", "frequency_days") {
            exec_ignore(conn, "ALTER TABLE routines ADD COLUMN frequency_days TEXT NOT NULL DEFAULT '[]'");
        }
        if !has_column(conn, "routines", "frequency_interval") {
            exec_ignore(conn, "ALTER TABLE routines ADD COLUMN frequency_interval INTEGER DEFAULT NULL");
        }
        if !has_column(conn, "routines", "frequency_start_date") {
            exec_ignore(conn, "ALTER TABLE routines ADD COLUMN frequency_start_date TEXT DEFAULT NULL");
        }
        if !has_column(conn, "routine_groups", "frequency_type") {
            exec_ignore(conn, "ALTER TABLE routine_groups ADD COLUMN frequency_type TEXT NOT NULL DEFAULT 'daily'");
        }
        if !has_column(conn, "routine_groups", "frequency_days") {
            exec_ignore(conn, "ALTER TABLE routine_groups ADD COLUMN frequency_days TEXT NOT NULL DEFAULT '[]'");
        }
        if !has_column(conn, "routine_groups", "frequency_interval") {
            exec_ignore(conn, "ALTER TABLE routine_groups ADD COLUMN frequency_interval INTEGER DEFAULT NULL");
        }
        if !has_column(conn, "routine_groups", "frequency_start_date") {
            exec_ignore(conn, "ALTER TABLE routine_groups ADD COLUMN frequency_start_date TEXT DEFAULT NULL");
        }
        conn.pragma_update(None, "user_version", &45i32)?;
    }

    // V46: schedule_items.content
    if current_version < 46 {
        if !has_column(conn, "schedule_items", "content") {
            exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN content TEXT DEFAULT NULL");
        }
        conn.pragma_update(None, "user_version", &46i32)?;
    }

    // V47: routines.is_visible + routine_groups.is_visible
    if current_version < 47 {
        if !has_column(conn, "routines", "is_visible") {
            exec_ignore(conn, "ALTER TABLE routines ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1");
        }
        if !has_column(conn, "routine_groups", "is_visible") {
            exec_ignore(conn, "ALTER TABLE routine_groups ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1");
        }
        conn.pragma_update(None, "user_version", &47i32)?;
    }

    // V48: notes.parent_id + notes.order_index + notes.type
    if current_version < 48 {
        if !has_column(conn, "notes", "parent_id") {
            exec_ignore(conn, "ALTER TABLE notes ADD COLUMN parent_id TEXT DEFAULT NULL");
        }
        if !has_column(conn, "notes", "order_index") {
            exec_ignore(conn, "ALTER TABLE notes ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0");
        }
        if !has_column(conn, "notes", "type") {
            exec_ignore(conn, "ALTER TABLE notes ADD COLUMN type TEXT NOT NULL DEFAULT 'note'");
        }
        conn.pragma_update(None, "user_version", &48i32)?;
    }

    // V49: Databases (database_properties, database_rows, database_cells)
    if current_version < 49 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS databases (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'Untitled',
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS database_properties (
                id TEXT PRIMARY KEY,
                database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
                name TEXT NOT NULL DEFAULT 'Property',
                type TEXT NOT NULL DEFAULT 'text',
                order_index INTEGER NOT NULL DEFAULT 0,
                config_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS database_rows (
                id TEXT PRIMARY KEY,
                database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS database_cells (
                id TEXT PRIMARY KEY,
                row_id TEXT NOT NULL REFERENCES database_rows(id) ON DELETE CASCADE,
                property_id TEXT NOT NULL REFERENCES database_properties(id) ON DELETE CASCADE,
                value TEXT DEFAULT '',
                UNIQUE(row_id, property_id)
            );",
        );
        conn.pragma_update(None, "user_version", &49i32)?;
    }

    // V50: tasks.folder_type + tasks.original_parent_id
    if current_version < 50 {
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN folder_type TEXT DEFAULT NULL");
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN original_parent_id TEXT DEFAULT NULL");
        conn.pragma_update(None, "user_version", &50i32)?;
    }

    // V51: notes.password_hash + memos.password_hash
    if current_version < 51 {
        exec_ignore(conn, "ALTER TABLE notes ADD COLUMN password_hash TEXT DEFAULT NULL");
        exec_ignore(conn, "ALTER TABLE memos ADD COLUMN password_hash TEXT DEFAULT NULL");
        conn.pragma_update(None, "user_version", &51i32)?;
    }

    // V52: tasks.priority + index
    if current_version < 52 {
        if !has_column(conn, "tasks", "priority") {
            exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT NULL");
        }
        exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)");
        conn.pragma_update(None, "user_version", &52i32)?;
    }

    // V53: app_settings
    if current_version < 53 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        );
        conn.pragma_update(None, "user_version", &53i32)?;
    }

    // V54: notes.is_edit_locked + memos.is_edit_locked
    if current_version < 54 {
        exec_ignore(conn, "ALTER TABLE notes ADD COLUMN is_edit_locked INTEGER NOT NULL DEFAULT 0");
        exec_ignore(conn, "ALTER TABLE memos ADD COLUMN is_edit_locked INTEGER NOT NULL DEFAULT 0");
        conn.pragma_update(None, "user_version", &54i32)?;
    }

    // V55: notes.icon
    if current_version < 55 {
        exec_ignore(conn, "ALTER TABLE notes ADD COLUMN icon TEXT DEFAULT NULL");
        conn.pragma_update(None, "user_version", &55i32)?;
    }

    // V56: reminder columns (tasks, schedule_items, routines)
    if current_version < 56 {
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0");
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN reminder_offset INTEGER");
        exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0");
        exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN reminder_offset INTEGER");
        exec_ignore(conn, "ALTER TABLE routines ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0");
        exec_ignore(conn, "ALTER TABLE routines ADD COLUMN reminder_offset INTEGER");
        conn.pragma_update(None, "user_version", &56i32)?;
    }

    // V57: tasks.icon
    if current_version < 57 {
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN icon TEXT");
        conn.pragma_update(None, "user_version", &57i32)?;
    }

    // V58: schedule_items soft-delete
    if current_version < 58 {
        if !has_column(conn, "schedule_items", "is_deleted") {
            exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0");
        }
        if !has_column(conn, "schedule_items", "deleted_at") {
            exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN deleted_at TEXT");
        }
        exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_schedule_items_deleted ON schedule_items(is_deleted)");
        conn.pragma_update(None, "user_version", &58i32)?;
    }

    // V59: templates
    if current_version < 59 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT 'Untitled Template',
                content TEXT NOT NULL DEFAULT '',
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );",
        );
        conn.pragma_update(None, "user_version", &59i32)?;
    }

    // V60: Drop legacy orphan tables (replaced by wiki_tags) + migration residues
    if current_version < 60 {
        eprintln!("V60: dropping legacy orphan tables and migration residues");
        exec_ignore(conn, "PRAGMA foreign_keys = OFF");
        exec_ignore(
            conn,
            "DROP TABLE IF EXISTS task_tags;
             DROP TABLE IF EXISTS note_tags;
             DROP TABLE IF EXISTS task_tag_definitions;
             DROP TABLE IF EXISTS note_tag_definitions;
             DROP TABLE IF EXISTS routine_logs;
             DROP TABLE IF EXISTS ai_settings;
             DROP TABLE IF EXISTS tasks_new;
             DROP TABLE IF EXISTS schedule_items_new;
             DROP TABLE IF EXISTS sound_settings_new;
             DROP TABLE IF EXISTS routines_new;
             DROP TABLE IF EXISTS note_tags_new;
             DROP TABLE IF EXISTS task_tags_new;
             DROP TABLE IF EXISTS wiki_tag_group_members_new;
             DROP TABLE IF EXISTS sound_settings_v13;
             DROP TABLE IF EXISTS sound_workscreen_selections_v13;
             DROP TABLE IF EXISTS task_tags_backup_v9;
             DROP TABLE IF EXISTS task_tag_definitions_backup_v9;
             DROP TABLE IF EXISTS note_tags_backup_v9;
             DROP TABLE IF EXISTS note_tag_definitions_backup_v9;",
        );
        exec_ignore(conn, "PRAGMA foreign_keys = ON");
        conn.pragma_update(None, "user_version", &60i32)?;
    }

    Ok(())
}
