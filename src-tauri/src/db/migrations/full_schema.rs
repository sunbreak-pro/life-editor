//! Consolidated schema for fresh databases (V60 final state).
//!
//! Brand-new SQLite databases (user_version=0) get this single batch of
//! `CREATE TABLE IF NOT EXISTS` statements as their initial state; the V61+
//! incremental migrations then apply on top so newly-shipped schema changes
//! always run regardless of how the DB was bootstrapped.

use rusqlite::Connection;

pub(super) fn create_full_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        -- ===== Tasks =====
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            type TEXT CHECK(type IN ('folder','task')),
            title TEXT DEFAULT '',
            parent_id TEXT,
            \"order\" INTEGER DEFAULT 0,
            status TEXT CHECK(status IN ('NOT_STARTED','IN_PROGRESS','DONE')),
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
            icon TEXT,
            FOREIGN KEY (parent_id) REFERENCES tasks(id)
        );

        -- ===== Timer Settings (singleton) =====
        CREATE TABLE IF NOT EXISTS timer_settings (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            work_duration INTEGER DEFAULT 25,
            break_duration INTEGER DEFAULT 5,
            long_break_duration INTEGER DEFAULT 15,
            sessions_before_long_break INTEGER DEFAULT 4,
            auto_start_breaks INTEGER DEFAULT 0,
            target_sessions INTEGER DEFAULT 4,
            updated_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO timer_settings (id, updated_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

        -- ===== Timer Sessions =====
        CREATE TABLE IF NOT EXISTS timer_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT,
            session_type TEXT CHECK(session_type IN ('WORK','BREAK','LONG_BREAK','FREE')),
            started_at TEXT NOT NULL,
            completed_at TEXT,
            duration INTEGER,
            completed INTEGER DEFAULT 0
        );

        -- ===== Sound Settings =====
        CREATE TABLE IF NOT EXISTS sound_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sound_type TEXT NOT NULL UNIQUE,
            volume INTEGER DEFAULT 50,
            enabled INTEGER DEFAULT 0,
            updated_at TEXT NOT NULL
        );

        -- ===== Sound Presets =====
        CREATE TABLE IF NOT EXISTS sound_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            settings_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        -- ===== Memos =====
        CREATE TABLE IF NOT EXISTS memos (
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
        );

        -- ===== Task Templates =====
        CREATE TABLE IF NOT EXISTS task_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            nodes_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        -- ===== Notes =====
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Untitled',
            content TEXT DEFAULT '',
            is_pinned INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            color TEXT,
            parent_id TEXT DEFAULT NULL,
            order_index INTEGER DEFAULT 0,
            type TEXT DEFAULT 'note',
            password_hash TEXT DEFAULT NULL,
            is_edit_locked INTEGER DEFAULT 0,
            icon TEXT DEFAULT NULL,
            version INTEGER DEFAULT 1
        );

        -- ===== Sound Tag Definitions =====
        CREATE TABLE IF NOT EXISTS sound_tag_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#808080',
            text_color TEXT DEFAULT NULL
        );

        -- ===== Sound Tag Assignments =====
        CREATE TABLE IF NOT EXISTS sound_tag_assignments (
            sound_id TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (sound_id, tag_id),
            FOREIGN KEY (tag_id) REFERENCES sound_tag_definitions(id) ON DELETE CASCADE
        );

        -- ===== Sound Display Meta =====
        CREATE TABLE IF NOT EXISTS sound_display_meta (
            sound_id TEXT PRIMARY KEY,
            display_name TEXT
        );

        -- ===== Sound Workscreen Selections =====
        CREATE TABLE IF NOT EXISTS sound_workscreen_selections (
            sound_id TEXT PRIMARY KEY,
            display_order INTEGER DEFAULT 0
        );

        -- ===== Calendars =====
        CREATE TABLE IF NOT EXISTS calendars (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            folder_id TEXT NOT NULL,
            \"order\" INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER DEFAULT 1,
            FOREIGN KEY (folder_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        -- ===== Pomodoro Presets =====
        CREATE TABLE IF NOT EXISTS pomodoro_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            work_duration INTEGER DEFAULT 25,
            break_duration INTEGER DEFAULT 5,
            long_break_duration INTEGER DEFAULT 15,
            sessions_before_long_break INTEGER DEFAULT 4,
            created_at TEXT NOT NULL
        );

        -- ===== Routines =====
        CREATE TABLE IF NOT EXISTS routines (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            is_archived INTEGER DEFAULT 0,
            \"order\" INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            is_deleted INTEGER DEFAULT 0,
            deleted_at TEXT,
            version INTEGER DEFAULT 1,
            frequency_type TEXT DEFAULT 'daily',
            frequency_days TEXT DEFAULT '[]',
            frequency_interval INTEGER DEFAULT NULL,
            frequency_start_date TEXT DEFAULT NULL,
            is_visible INTEGER DEFAULT 1,
            start_time TEXT,
            end_time TEXT,
            reminder_enabled INTEGER DEFAULT 0,
            reminder_offset INTEGER
        );

        -- ===== Playlists =====
        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT DEFAULT 'Untitled Playlist',
            sort_order INTEGER DEFAULT 0,
            repeat_mode TEXT DEFAULT 'all',
            is_shuffle INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- ===== Playlist Items =====
        CREATE TABLE IF NOT EXISTS playlist_items (
            id TEXT PRIMARY KEY,
            playlist_id TEXT NOT NULL,
            sound_id TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        );

        -- ===== Schedule Items =====
        CREATE TABLE IF NOT EXISTS schedule_items (
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
            deleted_at TEXT,
            FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL
        );

        -- ===== Routine Tag Definitions =====
        CREATE TABLE IF NOT EXISTS routine_tag_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#808080',
            \"order\" INTEGER DEFAULT 0,
            text_color TEXT DEFAULT NULL
        );
        INSERT OR IGNORE INTO routine_tag_definitions (name, color, \"order\") VALUES ('Morning', '#F59E0B', 0);
        INSERT OR IGNORE INTO routine_tag_definitions (name, color, \"order\") VALUES ('Afternoon', '#3B82F6', 1);
        INSERT OR IGNORE INTO routine_tag_definitions (name, color, \"order\") VALUES ('Night', '#8B5CF6', 2);

        -- ===== Routine Tag Assignments =====
        CREATE TABLE IF NOT EXISTS routine_tag_assignments (
            routine_id TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (routine_id, tag_id),
            FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES routine_tag_definitions(id) ON DELETE CASCADE
        );

        -- ===== Wiki Tags =====
        CREATE TABLE IF NOT EXISTS wiki_tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#808080',
            text_color TEXT DEFAULT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER DEFAULT 1
        );

        -- ===== Wiki Tag Assignments =====
        CREATE TABLE IF NOT EXISTS wiki_tag_assignments (
            tag_id TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            source TEXT DEFAULT 'inline',
            created_at TEXT NOT NULL,
            updated_at TEXT,
            PRIMARY KEY (tag_id, entity_id),
            FOREIGN KEY (tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
        );

        -- ===== Wiki Tag Connections =====
        CREATE TABLE IF NOT EXISTS wiki_tag_connections (
            id TEXT PRIMARY KEY,
            source_tag_id TEXT NOT NULL,
            target_tag_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            UNIQUE(source_tag_id, target_tag_id),
            FOREIGN KEY (source_tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE,
            FOREIGN KEY (target_tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
        );

        -- ===== Wiki Tag Groups =====
        CREATE TABLE IF NOT EXISTS wiki_tag_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            filter_tags TEXT DEFAULT '[]'
        );

        -- ===== Wiki Tag Group Members =====
        CREATE TABLE IF NOT EXISTS wiki_tag_group_members (
            group_id TEXT NOT NULL,
            note_id TEXT NOT NULL,
            PRIMARY KEY (group_id, note_id),
            FOREIGN KEY (group_id) REFERENCES wiki_tag_groups(id) ON DELETE CASCADE,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        -- ===== Time Memos =====
        CREATE TABLE IF NOT EXISTS time_memos (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            hour INTEGER NOT NULL,
            content TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER DEFAULT 1,
            UNIQUE(date, hour)
        );

        -- ===== Note Connections =====
        CREATE TABLE IF NOT EXISTS note_connections (
            id TEXT PRIMARY KEY,
            source_note_id TEXT NOT NULL,
            target_note_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
            FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE,
            UNIQUE(source_note_id, target_note_id)
        );

        -- ===== Note Links (Obsidian-style [[...]] syntax) =====
        CREATE TABLE IF NOT EXISTS note_links (
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

        -- ===== Note Aliases (for [[Note|alias]] / frontmatter aliases) =====
        CREATE TABLE IF NOT EXISTS note_aliases (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL,
            alias TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(alias),
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        -- ===== Paper Boards =====
        CREATE TABLE IF NOT EXISTS paper_boards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            linked_note_id TEXT,
            viewport_x REAL DEFAULT 0,
            viewport_y REAL DEFAULT 0,
            viewport_zoom REAL DEFAULT 1,
            \"order\" INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (linked_note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        -- ===== Paper Nodes =====
        CREATE TABLE IF NOT EXISTS paper_nodes (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            node_type TEXT CHECK(node_type IN ('card','text','frame')),
            position_x REAL DEFAULT 0,
            position_y REAL DEFAULT 0,
            width REAL DEFAULT 200,
            height REAL DEFAULT 100,
            z_index INTEGER DEFAULT 0,
            parent_node_id TEXT,
            ref_entity_id TEXT,
            ref_entity_type TEXT,
            text_content TEXT,
            frame_color TEXT,
            frame_label TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            label TEXT DEFAULT NULL,
            hidden INTEGER DEFAULT 0,
            FOREIGN KEY (board_id) REFERENCES paper_boards(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_node_id) REFERENCES paper_nodes(id) ON DELETE SET NULL
        );

        -- ===== Paper Edges =====
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

        -- ===== Routine Groups =====
        CREATE TABLE IF NOT EXISTS routine_groups (
            id TEXT PRIMARY KEY,
            name TEXT DEFAULT '',
            color TEXT DEFAULT '#6B7280',
            \"order\" INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            version INTEGER DEFAULT 1,
            frequency_type TEXT DEFAULT 'daily',
            frequency_days TEXT DEFAULT '[]',
            frequency_interval INTEGER DEFAULT NULL,
            frequency_start_date TEXT DEFAULT NULL,
            is_visible INTEGER DEFAULT 1
        );

        -- ===== Routine Group Tag Assignments =====
        CREATE TABLE IF NOT EXISTS routine_group_tag_assignments (
            group_id TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (group_id, tag_id),
            FOREIGN KEY (group_id) REFERENCES routine_groups(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES routine_tag_definitions(id) ON DELETE CASCADE
        );

        -- ===== Calendar Tag Definitions =====
        CREATE TABLE IF NOT EXISTS calendar_tag_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#808080',
            text_color TEXT DEFAULT NULL,
            \"order\" INTEGER DEFAULT 0
        );

        -- ===== Calendar Tag Assignments =====
        CREATE TABLE IF NOT EXISTS calendar_tag_assignments (
            schedule_item_id TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (schedule_item_id, tag_id),
            FOREIGN KEY (schedule_item_id) REFERENCES schedule_items(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES calendar_tag_definitions(id) ON DELETE CASCADE
        );

        -- ===== Databases =====
        CREATE TABLE IF NOT EXISTS databases (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Untitled',
            is_deleted INTEGER DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- ===== Database Properties =====
        CREATE TABLE IF NOT EXISTS database_properties (
            id TEXT PRIMARY KEY,
            database_id TEXT NOT NULL,
            name TEXT DEFAULT 'Property',
            type TEXT DEFAULT 'text',
            order_index INTEGER DEFAULT 0,
            config_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
        );

        -- ===== Database Rows =====
        CREATE TABLE IF NOT EXISTS database_rows (
            id TEXT PRIMARY KEY,
            database_id TEXT NOT NULL,
            order_index INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
        );

        -- ===== Database Cells =====
        CREATE TABLE IF NOT EXISTS database_cells (
            id TEXT PRIMARY KEY,
            row_id TEXT NOT NULL,
            property_id TEXT NOT NULL,
            value TEXT DEFAULT '',
            UNIQUE(row_id, property_id),
            FOREIGN KEY (row_id) REFERENCES database_rows(id) ON DELETE CASCADE,
            FOREIGN KEY (property_id) REFERENCES database_properties(id) ON DELETE CASCADE
        );

        -- ===== App Settings =====
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        -- ===== Templates =====
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT DEFAULT 'Untitled Template',
            content TEXT DEFAULT '',
            is_deleted INTEGER DEFAULT 0,
            deleted_at TEXT,
            version INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- =========================================================
        -- Indexes
        -- =========================================================
        CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
        CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
        CREATE INDEX IF NOT EXISTS idx_timer_sessions_task ON timer_sessions(task_id);
        CREATE INDEX IF NOT EXISTS idx_memos_date ON memos(date);
        CREATE INDEX IF NOT EXISTS idx_memos_deleted ON memos(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON memos(updated_at);
        CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_sta_sound ON sound_tag_assignments(sound_id);
        CREATE INDEX IF NOT EXISTS idx_sta_tag ON sound_tag_assignments(tag_id);
        CREATE INDEX IF NOT EXISTS idx_calendars_folder ON calendars(folder_id);
        CREATE INDEX IF NOT EXISTS idx_calendars_updated_at ON calendars(updated_at);
        CREATE INDEX IF NOT EXISTS idx_si_date ON schedule_items(date);
        CREATE INDEX IF NOT EXISTS idx_si_routine ON schedule_items(routine_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_items_updated_at ON schedule_items(updated_at);
        CREATE INDEX IF NOT EXISTS idx_schedule_items_deleted ON schedule_items(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_rta_routine ON routine_tag_assignments(routine_id);
        CREATE INDEX IF NOT EXISTS idx_rta_tag ON routine_tag_assignments(tag_id);
        CREATE INDEX IF NOT EXISTS idx_routines_deleted ON routines(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_routines_updated_at ON routines(updated_at);
        CREATE INDEX IF NOT EXISTS idx_wta_entity ON wiki_tag_assignments(entity_id);
        CREATE INDEX IF NOT EXISTS idx_wta_tag ON wiki_tag_assignments(tag_id);
        CREATE INDEX IF NOT EXISTS idx_wta_type ON wiki_tag_assignments(entity_type);
        CREATE INDEX IF NOT EXISTS idx_wta_source_entity ON wiki_tag_assignments(source, entity_id);
        CREATE INDEX IF NOT EXISTS idx_wiki_tags_updated_at ON wiki_tags(updated_at);
        CREATE INDEX IF NOT EXISTS idx_wiki_tag_assignments_updated_at ON wiki_tag_assignments(updated_at);
        CREATE INDEX IF NOT EXISTS idx_wtc_source ON wiki_tag_connections(source_tag_id);
        CREATE INDEX IF NOT EXISTS idx_wtc_target ON wiki_tag_connections(target_tag_id);
        CREATE INDEX IF NOT EXISTS idx_wiki_tag_connections_updated_at ON wiki_tag_connections(updated_at);
        CREATE INDEX IF NOT EXISTS idx_wtgm_group ON wiki_tag_group_members(group_id);
        CREATE INDEX IF NOT EXISTS idx_wtgm_note ON wiki_tag_group_members(note_id);
        CREATE INDEX IF NOT EXISTS idx_time_memos_date ON time_memos(date);
        CREATE INDEX IF NOT EXISTS idx_time_memos_updated_at ON time_memos(updated_at);
        CREATE INDEX IF NOT EXISTS idx_nc_source ON note_connections(source_note_id);
        CREATE INDEX IF NOT EXISTS idx_nc_target ON note_connections(target_note_id);
        CREATE INDEX IF NOT EXISTS idx_note_connections_updated_at ON note_connections(updated_at);
        CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id);
        CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);
        CREATE INDEX IF NOT EXISTS idx_note_links_source_memo ON note_links(source_memo_date);
        CREATE INDEX IF NOT EXISTS idx_note_links_updated_at ON note_links(updated_at);
        CREATE INDEX IF NOT EXISTS idx_note_links_deleted ON note_links(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_note_aliases_note ON note_aliases(note_id);
        CREATE INDEX IF NOT EXISTS idx_note_aliases_alias ON note_aliases(alias);
        CREATE INDEX IF NOT EXISTS idx_pb_note ON paper_boards(linked_note_id);
        CREATE INDEX IF NOT EXISTS idx_pn_board ON paper_nodes(board_id);
        CREATE INDEX IF NOT EXISTS idx_pn_parent ON paper_nodes(parent_node_id);
        CREATE INDEX IF NOT EXISTS idx_pe_board ON paper_edges(board_id);
        CREATE INDEX IF NOT EXISTS idx_rgta_group ON routine_group_tag_assignments(group_id);
        CREATE INDEX IF NOT EXISTS idx_rgta_tag ON routine_group_tag_assignments(tag_id);
        CREATE INDEX IF NOT EXISTS idx_cta_item ON calendar_tag_assignments(schedule_item_id);
        CREATE INDEX IF NOT EXISTS idx_cta_tag ON calendar_tag_assignments(tag_id);
        ",
    )
}
