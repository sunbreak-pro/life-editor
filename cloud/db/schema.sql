-- Life Editor Cloud Sync — D1 Schema
-- Derived from src-tauri/src/db/migrations.rs create_full_schema() (V59)
-- Only sync-target tables are included.

-- ===== Tasks =====
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('folder','task')),
    title TEXT DEFAULT '',
    parent_id TEXT,
    "order" INTEGER DEFAULT 0,
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

-- ===== Dailies =====
CREATE TABLE IF NOT EXISTS dailies (
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

-- ===== Calendars =====
CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    FOREIGN KEY (folder_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ===== Routines =====
CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    is_archived INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
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
    template_id TEXT DEFAULT NULL,
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

-- ===== Routine Groups =====
CREATE TABLE IF NOT EXISTS routine_groups (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    color TEXT DEFAULT '#6B7280',
    "order" INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version INTEGER DEFAULT 1,
    frequency_type TEXT DEFAULT 'daily',
    frequency_days TEXT DEFAULT '[]',
    frequency_interval INTEGER DEFAULT NULL,
    frequency_start_date TEXT DEFAULT NULL,
    is_visible INTEGER DEFAULT 1
);

-- ===== Relation Tables =====

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

CREATE TABLE IF NOT EXISTS routine_tag_assignments (
    routine_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (routine_id, tag_id),
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_tag_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#808080',
    "order" INTEGER DEFAULT 0,
    text_color TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS calendar_tag_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#808080',
    text_color TEXT DEFAULT NULL,
    "order" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calendar_tag_assignments (
    schedule_item_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (schedule_item_id, tag_id),
    FOREIGN KEY (schedule_item_id) REFERENCES schedule_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_group_tag_assignments (
    group_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (group_id, tag_id),
    FOREIGN KEY (group_id) REFERENCES routine_groups(id) ON DELETE CASCADE
);

-- ===== Sync Metadata =====

CREATE TABLE IF NOT EXISTS sync_devices (
    device_id TEXT PRIMARY KEY,
    device_name TEXT,
    last_synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- ===== Indexes =====

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_dailies_date ON dailies(date);
CREATE INDEX IF NOT EXISTS idx_dailies_deleted ON dailies(is_deleted);
CREATE INDEX IF NOT EXISTS idx_dailies_updated_at ON dailies(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_calendars_updated_at ON calendars(updated_at);
CREATE INDEX IF NOT EXISTS idx_routines_deleted ON routines(is_deleted);
CREATE INDEX IF NOT EXISTS idx_routines_updated_at ON routines(updated_at);
CREATE INDEX IF NOT EXISTS idx_si_date ON schedule_items(date);
CREATE INDEX IF NOT EXISTS idx_si_routine ON schedule_items(routine_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_updated_at ON schedule_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_schedule_items_deleted ON schedule_items(is_deleted);
-- Partial UNIQUE: one active routine row per (routine_id, date). Mirrors the
-- V63 migration on the Desktop / iOS SQLite side.
CREATE UNIQUE INDEX IF NOT EXISTS idx_si_routine_date
  ON schedule_items(routine_id, date)
  WHERE routine_id IS NOT NULL AND is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_wiki_tags_updated_at ON wiki_tags(updated_at);
CREATE INDEX IF NOT EXISTS idx_wta_entity ON wiki_tag_assignments(entity_id);
CREATE INDEX IF NOT EXISTS idx_wta_tag ON wiki_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_wiki_tag_assignments_updated_at ON wiki_tag_assignments(updated_at);
CREATE INDEX IF NOT EXISTS idx_wiki_tag_connections_updated_at ON wiki_tag_connections(updated_at);
CREATE INDEX IF NOT EXISTS idx_note_connections_updated_at ON note_connections(updated_at);
CREATE INDEX IF NOT EXISTS idx_time_memos_date ON time_memos(date);
CREATE INDEX IF NOT EXISTS idx_time_memos_updated_at ON time_memos(updated_at);
