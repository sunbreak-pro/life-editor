//! Incremental migrations V2 .. V30.
//!
//! Applied on top of either a freshly-created V60 schema (which jumps
//! straight to V61 and skips this module) or an existing pre-V31 database
//! that needs to catch up. Each version block is gated by
//! `if current_version < N`; keeping the gates idempotent is what lets
//! upgraders skip versions and still arrive at the latest schema.

use rusqlite::Connection;

use super::util::{exec_ignore, has_column};

pub(super) fn apply(conn: &Connection, current_version: i32) -> rusqlite::Result<()> {
    // V2: Tags (unified) + task_templates
    if current_version < 2 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#808080'
            );
            CREATE TABLE IF NOT EXISTS task_tags (
                task_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (task_id, tag_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
            CREATE TABLE IF NOT EXISTS task_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                nodes_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );",
        );
        conn.pragma_update(None, "user_version", &2i32)?;
    }

    // V3: Notes + note_tags
    if current_version < 3 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'Untitled',
                content TEXT NOT NULL DEFAULT '',
                is_pinned INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);
            CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
            CREATE TABLE IF NOT EXISTS note_tags (
                note_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
            CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);",
        );
        conn.pragma_update(None, "user_version", &3i32)?;
    }

    // V4: sound_settings add session_category (intermediate, reverted in V13)
    if current_version < 4 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS sound_settings_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sound_type TEXT NOT NULL,
                volume INTEGER NOT NULL DEFAULT 50,
                enabled INTEGER NOT NULL DEFAULT 0,
                session_category TEXT NOT NULL DEFAULT 'WORK',
                updated_at TEXT NOT NULL,
                UNIQUE(sound_type, session_category)
            );
            INSERT INTO sound_settings_new (sound_type, volume, enabled, session_category, updated_at)
                SELECT sound_type, volume, enabled, 'WORK', updated_at FROM sound_settings;
            DROP TABLE sound_settings;
            ALTER TABLE sound_settings_new RENAME TO sound_settings;",
        );
        conn.pragma_update(None, "user_version", &4i32)?;
    }

    // V5: tasks.due_date
    if current_version < 5 {
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN due_date TEXT");
        conn.pragma_update(None, "user_version", &5i32)?;
    }

    // V6: Split tags into task_tag_definitions / note_tag_definitions
    // For Tauri migration of existing DBs, the tables should already exist
    // or be created fresh. We just ensure the final tables exist.
    if current_version < 6 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS task_tag_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#808080'
            );
            CREATE TABLE IF NOT EXISTS note_tag_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#808080'
            );",
        );
        // Migrate data from old unified `tags` table if it exists
        exec_ignore(conn,
            "INSERT OR IGNORE INTO task_tag_definitions (id, name, color)
                SELECT id, name, color FROM tags;
            INSERT OR IGNORE INTO note_tag_definitions (name, color)
                SELECT name, color FROM tags;",
        );
        // Recreate task_tags with FK to task_tag_definitions
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS task_tags_new (
                task_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (task_id, tag_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES task_tag_definitions(id) ON DELETE CASCADE
            );
            INSERT OR IGNORE INTO task_tags_new SELECT * FROM task_tags;
            DROP TABLE IF EXISTS task_tags;
            ALTER TABLE task_tags_new RENAME TO task_tags;
            CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);",
        );
        // Recreate note_tags with FK to note_tag_definitions
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS note_tags_new (
                note_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES note_tag_definitions(id) ON DELETE CASCADE
            );
            INSERT OR IGNORE INTO note_tags_new (note_id, tag_id)
                SELECT note_id, tag_id FROM note_tags;
            DROP TABLE IF EXISTS note_tags;
            ALTER TABLE note_tags_new RENAME TO note_tags;
            CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
            CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);",
        );
        exec_ignore(conn, "DROP TABLE IF EXISTS tags");
        conn.pragma_update(None, "user_version", &6i32)?;
    }

    // V7: Sound tags + display meta
    if current_version < 7 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS sound_tag_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#808080'
            );
            CREATE TABLE IF NOT EXISTS sound_tag_assignments (
                sound_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (sound_id, tag_id),
                FOREIGN KEY (tag_id) REFERENCES sound_tag_definitions(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS sound_display_meta (
                sound_id TEXT PRIMARY KEY,
                display_name TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_sta_sound ON sound_tag_assignments(sound_id);",
        );
        conn.pragma_update(None, "user_version", &7i32)?;
    }

    // V8: sound_workscreen_selections (with session_category, reverted in V13)
    if current_version < 8 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS sound_workscreen_selections (
                sound_id TEXT NOT NULL,
                session_category TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (sound_id, session_category)
            );",
        );
        conn.pragma_update(None, "user_version", &8i32)?;
    }

    // V9: Backup tag tables (preparation for wiki_tags migration)
    if current_version < 9 {
        exec_ignore(conn,
            "ALTER TABLE task_tags RENAME TO task_tags_backup_v9;
            ALTER TABLE task_tag_definitions RENAME TO task_tag_definitions_backup_v9;
            ALTER TABLE note_tags RENAME TO note_tags_backup_v9;
            ALTER TABLE note_tag_definitions RENAME TO note_tag_definitions_backup_v9;",
        );
        conn.pragma_update(None, "user_version", &9i32)?;
    }

    // V10: Calendars
    if current_version < 10 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS calendars (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                folder_id TEXT NOT NULL,
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (folder_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_calendars_folder ON calendars(folder_id);",
        );
        conn.pragma_update(None, "user_version", &10i32)?;
    }

    // V11: tasks.scheduled_end_at + tasks.is_all_day
    if current_version < 11 {
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN scheduled_end_at TEXT");
        exec_ignore(conn, "ALTER TABLE tasks ADD COLUMN is_all_day INTEGER DEFAULT 0");
        conn.pragma_update(None, "user_version", &11i32)?;
    }

    // V12: Pomodoro presets + timer_settings.auto_start_breaks
    if current_version < 12 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS pomodoro_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                work_duration INTEGER NOT NULL DEFAULT 25,
                break_duration INTEGER NOT NULL DEFAULT 5,
                long_break_duration INTEGER NOT NULL DEFAULT 15,
                sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
                created_at TEXT NOT NULL
            );
            INSERT INTO pomodoro_presets (name, work_duration, break_duration, long_break_duration, sessions_before_long_break, created_at)
            VALUES
                ('Standard', 25, 5, 15, 4, datetime('now')),
                ('Deep Work', 50, 10, 30, 3, datetime('now')),
                ('Quick Sprint', 15, 3, 10, 4, datetime('now'));",
        );
        exec_ignore(conn, "ALTER TABLE timer_settings ADD COLUMN auto_start_breaks INTEGER DEFAULT 0");
        conn.pragma_update(None, "user_version", &12i32)?;
    }

    // V13: Simplify sound_settings / sound_workscreen_selections (remove session_category)
    if current_version < 13 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS sound_settings_v13 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sound_type TEXT NOT NULL UNIQUE,
                volume INTEGER NOT NULL DEFAULT 50,
                enabled INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            INSERT OR IGNORE INTO sound_settings_v13 (sound_type, volume, enabled, updated_at)
                SELECT sound_type, volume, enabled, updated_at FROM sound_settings WHERE session_category = 'WORK';
            DROP TABLE IF EXISTS sound_settings;
            ALTER TABLE sound_settings_v13 RENAME TO sound_settings;

            CREATE TABLE IF NOT EXISTS sound_workscreen_selections_v13 (
                sound_id TEXT PRIMARY KEY,
                display_order INTEGER NOT NULL DEFAULT 0
            );
            INSERT OR IGNORE INTO sound_workscreen_selections_v13 (sound_id, display_order)
                SELECT sound_id, display_order FROM sound_workscreen_selections WHERE session_category = 'WORK';
            DROP TABLE IF EXISTS sound_workscreen_selections;
            ALTER TABLE sound_workscreen_selections_v13 RENAME TO sound_workscreen_selections;",
        );
        conn.pragma_update(None, "user_version", &13i32)?;
    }

    // V14: Routines + routine_logs
    if current_version < 14 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS routines (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                frequency_type TEXT NOT NULL DEFAULT 'daily',
                frequency_days TEXT NOT NULL DEFAULT '[]',
                is_archived INTEGER NOT NULL DEFAULT 0,
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS routine_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                routine_id TEXT NOT NULL,
                date TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                UNIQUE(routine_id, date),
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_routine_logs_routine ON routine_logs(routine_id);
            CREATE INDEX IF NOT EXISTS idx_routine_logs_date ON routine_logs(date);
            CREATE INDEX IF NOT EXISTS idx_routine_logs_routine_date ON routine_logs(routine_id, date);",
        );
        conn.pragma_update(None, "user_version", &14i32)?;
    }

    // V15: Playlists + playlist_items
    if current_version < 15 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT 'Untitled Playlist',
                sort_order INTEGER NOT NULL DEFAULT 0,
                repeat_mode TEXT NOT NULL DEFAULT 'all',
                is_shuffle INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS playlist_items (
                id TEXT PRIMARY KEY,
                playlist_id TEXT NOT NULL,
                sound_id TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            );",
        );
        conn.pragma_update(None, "user_version", &15i32)?;
    }

    // V16: routines add columns + routine_stacks (intermediate, dropped in V17)
    if current_version < 16 {
        exec_ignore(conn, "ALTER TABLE routines ADD COLUMN time_slot TEXT NOT NULL DEFAULT 'anytime'");
        exec_ignore(conn, "ALTER TABLE routines ADD COLUMN times_per_week INTEGER");
        exec_ignore(conn, "ALTER TABLE routines ADD COLUMN sound_preset_id TEXT");
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS routine_stacks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS routine_stack_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stack_id TEXT NOT NULL,
                routine_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                FOREIGN KEY (stack_id) REFERENCES routine_stacks(id) ON DELETE CASCADE,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
                UNIQUE(stack_id, routine_id)
            );",
        );
        conn.pragma_update(None, "user_version", &16i32)?;
    }

    // V17: Rebuild routines (simplified) + schedule_items + routine_templates
    if current_version < 17 {
        exec_ignore(conn,
            "DROP TABLE IF EXISTS routine_stack_items;
            DROP TABLE IF EXISTS routine_stacks;
            DROP TABLE IF EXISTS routine_logs;
            DROP TABLE IF EXISTS routines;

            CREATE TABLE routines (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                is_archived INTEGER NOT NULL DEFAULT 0,
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE routine_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                frequency_type TEXT NOT NULL DEFAULT 'daily',
                frequency_days TEXT NOT NULL DEFAULT '[]',
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE routine_template_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id TEXT NOT NULL,
                routine_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                FOREIGN KEY (template_id) REFERENCES routine_templates(id) ON DELETE CASCADE,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
                UNIQUE(template_id, routine_id)
            );
            CREATE INDEX IF NOT EXISTS idx_rti_template ON routine_template_items(template_id);

            CREATE TABLE schedule_items (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                routine_id TEXT,
                template_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL,
                FOREIGN KEY (template_id) REFERENCES routine_templates(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS idx_si_date ON schedule_items(date);
            CREATE INDEX IF NOT EXISTS idx_si_routine ON schedule_items(routine_id);

            CREATE TABLE IF NOT EXISTS routine_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                routine_id TEXT NOT NULL,
                date TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                UNIQUE(routine_id, date),
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_routine_logs_routine ON routine_logs(routine_id);
            CREATE INDEX IF NOT EXISTS idx_routine_logs_date ON routine_logs(date);
            CREATE INDEX IF NOT EXISTS idx_routine_logs_routine_date ON routine_logs(routine_id, date);",
        );
        conn.pragma_update(None, "user_version", &17i32)?;
    }

    // V18: routine_template_items add start_time/end_time
    if current_version < 18 {
        exec_ignore(conn, "ALTER TABLE routine_template_items ADD COLUMN start_time TEXT");
        exec_ignore(conn, "ALTER TABLE routine_template_items ADD COLUMN end_time TEXT");
        conn.pragma_update(None, "user_version", &18i32)?;
    }

    // V19: routine_tag_definitions + routines.tag_id
    if current_version < 19 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS routine_tag_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#808080',
                \"order\" INTEGER NOT NULL DEFAULT 0
            );
            INSERT OR IGNORE INTO routine_tag_definitions (name, color, \"order\") VALUES
                ('Morning', '#D9730D', 0),
                ('Afternoon', '#2EAADC', 1),
                ('Night', '#6940A5', 2);",
        );
        exec_ignore(conn, "ALTER TABLE routines ADD COLUMN tag_id INTEGER REFERENCES routine_tag_definitions(id) ON DELETE SET NULL");
        exec_ignore(conn, "ALTER TABLE routine_templates ADD COLUMN tag_id INTEGER REFERENCES routine_tag_definitions(id) ON DELETE SET NULL");
        conn.pragma_update(None, "user_version", &19i32)?;
    }

    // V20: routine_tag_assignments (many-to-many) + drop routine_templates
    if current_version < 20 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS routine_tag_assignments (
                routine_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (routine_id, tag_id),
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES routine_tag_definitions(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_rta_routine ON routine_tag_assignments(routine_id);
            CREATE INDEX IF NOT EXISTS idx_rta_tag ON routine_tag_assignments(tag_id);",
        );
        // Migrate existing tag_id data
        if has_column(conn, "routines", "tag_id") {
            exec_ignore(conn,
                "INSERT OR IGNORE INTO routine_tag_assignments (routine_id, tag_id)
                    SELECT id, tag_id FROM routines WHERE tag_id IS NOT NULL;",
            );
        }
        // Rebuild routines without tag_id
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS routines_new (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                is_archived INTEGER NOT NULL DEFAULT 0,
                \"order\" INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO routines_new (id, title, start_time, end_time, is_archived, \"order\", created_at, updated_at)
                SELECT id, title, start_time, end_time, is_archived, \"order\", created_at, updated_at FROM routines;
            DROP TABLE routines;
            ALTER TABLE routines_new RENAME TO routines;",
        );
        exec_ignore(conn,
            "DROP TABLE IF EXISTS routine_template_items;
            DROP TABLE IF EXISTS routine_templates;",
        );
        conn.pragma_update(None, "user_version", &20i32)?;
    }

    // V21: Soft-delete for routines + memos
    if current_version < 21 {
        if !has_column(conn, "routines", "is_deleted") {
            exec_ignore(conn, "ALTER TABLE routines ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0");
        }
        if !has_column(conn, "routines", "deleted_at") {
            exec_ignore(conn, "ALTER TABLE routines ADD COLUMN deleted_at TEXT");
        }
        exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_routines_deleted ON routines(is_deleted)");
        if !has_column(conn, "memos", "is_deleted") {
            exec_ignore(conn, "ALTER TABLE memos ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0");
        }
        if !has_column(conn, "memos", "deleted_at") {
            exec_ignore(conn, "ALTER TABLE memos ADD COLUMN deleted_at TEXT");
        }
        exec_ignore(conn, "CREATE INDEX IF NOT EXISTS idx_memos_deleted ON memos(is_deleted)");
        conn.pragma_update(None, "user_version", &21i32)?;
    }

    // V22: Recreate schedule_items without FK to dropped routine_templates
    if current_version < 22 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS schedule_items_new (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                routine_id TEXT,
                template_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL
            );
            INSERT INTO schedule_items_new SELECT * FROM schedule_items;
            DROP TABLE schedule_items;
            ALTER TABLE schedule_items_new RENAME TO schedule_items;
            CREATE INDEX IF NOT EXISTS idx_si_date ON schedule_items(date);
            CREATE INDEX IF NOT EXISTS idx_si_routine ON schedule_items(routine_id);",
        );
        conn.pragma_update(None, "user_version", &22i32)?;
    }

    // V23: Wiki tags + wiki_tag_assignments
    if current_version < 23 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS wiki_tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#808080',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS wiki_tag_assignments (
                tag_id TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'inline',
                created_at TEXT NOT NULL,
                PRIMARY KEY (tag_id, entity_id),
                FOREIGN KEY (tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_wta_entity ON wiki_tag_assignments(entity_id);
            CREATE INDEX IF NOT EXISTS idx_wta_tag ON wiki_tag_assignments(tag_id);
            CREATE INDEX IF NOT EXISTS idx_wta_type ON wiki_tag_assignments(entity_type);",
        );
        conn.pragma_update(None, "user_version", &23i32)?;
    }

    // V24: text_color columns
    if current_version < 24 {
        if !has_column(conn, "wiki_tags", "text_color") {
            exec_ignore(conn, "ALTER TABLE wiki_tags ADD COLUMN text_color TEXT DEFAULT NULL");
        }
        if !has_column(conn, "routine_tag_definitions", "text_color") {
            exec_ignore(conn, "ALTER TABLE routine_tag_definitions ADD COLUMN text_color TEXT DEFAULT NULL");
        }
        if !has_column(conn, "sound_tag_definitions", "text_color") {
            exec_ignore(conn, "ALTER TABLE sound_tag_definitions ADD COLUMN text_color TEXT DEFAULT NULL");
        }
        conn.pragma_update(None, "user_version", &24i32)?;
    }

    // V25: wiki_tag_connections
    if current_version < 25 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS wiki_tag_connections (
                id TEXT PRIMARY KEY,
                source_tag_id TEXT NOT NULL,
                target_tag_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (source_tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE,
                FOREIGN KEY (target_tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE,
                UNIQUE(source_tag_id, target_tag_id)
            );
            CREATE INDEX IF NOT EXISTS idx_wtc_source ON wiki_tag_connections(source_tag_id);
            CREATE INDEX IF NOT EXISTS idx_wtc_target ON wiki_tag_connections(target_tag_id);",
        );
        conn.pragma_update(None, "user_version", &25i32)?;
    }

    // V26: memos.is_pinned
    if current_version < 26 {
        if !has_column(conn, "memos", "is_pinned") {
            exec_ignore(conn, "ALTER TABLE memos ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0");
        }
        conn.pragma_update(None, "user_version", &26i32)?;
    }

    // V27: wiki_tag_groups + wiki_tag_group_members (tag-based, rebuilt in V30)
    if current_version < 27 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS wiki_tag_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS wiki_tag_group_members (
                group_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (group_id, tag_id),
                FOREIGN KEY (group_id) REFERENCES wiki_tag_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_wtgm_group ON wiki_tag_group_members(group_id);
            CREATE INDEX IF NOT EXISTS idx_wtgm_tag ON wiki_tag_group_members(tag_id);",
        );
        conn.pragma_update(None, "user_version", &27i32)?;
    }

    // V28: time_memos
    if current_version < 28 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS time_memos (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                hour INTEGER NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(date, hour)
            );
            CREATE INDEX IF NOT EXISTS idx_time_memos_date ON time_memos(date);",
        );
        conn.pragma_update(None, "user_version", &28i32)?;
    }

    // V29: notes.color
    if current_version < 29 {
        exec_ignore(conn, "ALTER TABLE notes ADD COLUMN color TEXT");
        conn.pragma_update(None, "user_version", &29i32)?;
    }

    // V30: Rebuild wiki_tag_group_members (tag_id -> note_id) + filter_tags + note_connections
    if current_version < 30 {
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS wiki_tag_group_members_new (
                group_id TEXT NOT NULL,
                note_id TEXT NOT NULL,
                PRIMARY KEY (group_id, note_id),
                FOREIGN KEY (group_id) REFERENCES wiki_tag_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
            );
            INSERT OR IGNORE INTO wiki_tag_group_members_new (group_id, note_id)
                SELECT m.group_id, a.entity_id
                FROM wiki_tag_group_members m
                JOIN wiki_tag_assignments a ON a.tag_id = m.tag_id AND a.entity_type = 'note';
            DROP TABLE IF EXISTS wiki_tag_group_members;
            ALTER TABLE wiki_tag_group_members_new RENAME TO wiki_tag_group_members;
            CREATE INDEX IF NOT EXISTS idx_wtgm_group ON wiki_tag_group_members(group_id);
            CREATE INDEX IF NOT EXISTS idx_wtgm_note ON wiki_tag_group_members(note_id);",
        );
        exec_ignore(conn, "ALTER TABLE wiki_tag_groups ADD COLUMN filter_tags TEXT DEFAULT '[]'");
        exec_ignore(conn,
            "CREATE TABLE IF NOT EXISTS note_connections (
                id TEXT PRIMARY KEY,
                source_note_id TEXT NOT NULL,
                target_note_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE,
                UNIQUE(source_note_id, target_note_id)
            );
            CREATE INDEX IF NOT EXISTS idx_nc_source ON note_connections(source_note_id);
            CREATE INDEX IF NOT EXISTS idx_nc_target ON note_connections(target_note_id);",
        );
        conn.pragma_update(None, "user_version", &30i32)?;
    }

    Ok(())
}
