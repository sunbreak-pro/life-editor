use rusqlite::Connection;

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
        create_full_schema(conn)?;
        conn.pragma_update(None, "user_version", &61i32)?;
        61
    } else {
        current_version
    };

    run_incremental_migrations(conn, start_version)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Full schema creation (V60 final state)
// ---------------------------------------------------------------------------

fn create_full_schema(conn: &Connection) -> rusqlite::Result<()> {
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
        INSERT OR IGNORE INTO timer_settings (id, updated_at) VALUES (1, datetime('now'));

        -- ===== Timer Sessions =====
        CREATE TABLE IF NOT EXISTS timer_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT,
            session_type TEXT CHECK(session_type IN ('WORK','BREAK','LONG_BREAK')),
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
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
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
            updated_at TEXT DEFAULT (datetime('now'))
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

// ---------------------------------------------------------------------------
// Incremental migrations (V2 .. V59)
// ---------------------------------------------------------------------------

/// Helper: execute a SQL statement, ignoring errors (used for ALTER TABLE ADD COLUMN
/// which fails if the column already exists).
fn exec_ignore(conn: &Connection, sql: &str) {
    let _ = conn.execute_batch(sql);
}

/// Helper: check if a column exists in a table.
fn has_column(conn: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&sql).unwrap();
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap();
    for name in rows {
        if let Ok(name) = name {
            if name == column {
                return true;
            }
        }
    }
    false
}

fn run_incremental_migrations(conn: &Connection, current_version: i32) -> rusqlite::Result<()> {
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

    // Defensive: ensure schedule_items.template_id exists. Fresh DBs created
    // before the initial schema was fixed (v59-) lack this column, which
    // breaks Cloud Sync when pulling data from other devices.
    if !has_column(conn, "schedule_items", "template_id") {
        exec_ignore(conn, "ALTER TABLE schedule_items ADD COLUMN template_id TEXT");
    }

    // Defensive: routine_groups was created in V42 without a `version` column.
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
    use super::*;

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

        assert_eq!(user_version(&conn), 62);
        for orphan in [
            "ai_settings",
            "routine_logs",
            "task_tags",
            "task_tag_definitions",
            "note_tags",
            "note_tag_definitions",
        ] {
            assert!(
                !table_exists(&conn, orphan),
                "orphan table {orphan} should not exist in fresh V61 schema"
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

        assert_eq!(user_version(&conn), 62);
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

        assert_eq!(user_version(&conn), 62);
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
        for live in ["tasks", "notes", "memos", "routines", "wiki_tags", "schedule_items"] {
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
        assert_eq!(user_version(&conn), 62);
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
