import type Database from "better-sqlite3";
import log from "../logger";

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;
  log.info(`[DB] Current schema version: ${currentVersion}`);

  if (currentVersion < 1) {
    log.info("[DB] Running migration V1");
    migrateV1(db);
  }
  if (currentVersion < 2) {
    log.info("[DB] Running migration V2");
    migrateV2(db);
  }
  if (currentVersion < 3) {
    log.info("[DB] Running migration V3");
    migrateV3(db);
  }
  if (currentVersion < 4) {
    log.info("[DB] Running migration V4");
    migrateV4(db);
  }
  if (currentVersion < 5) {
    log.info("[DB] Running migration V5");
    migrateV5(db);
  }
  if (currentVersion < 6) {
    log.info("[DB] Running migration V6");
    migrateV6(db);
  }
  if (currentVersion < 7) {
    log.info("[DB] Running migration V7");
    migrateV7(db);
  }
  if (currentVersion < 8) {
    log.info("[DB] Running migration V8");
    migrateV8(db);
  }
  if (currentVersion < 9) {
    log.info("[DB] Running migration V9");
    migrateV9(db);
  }
  if (currentVersion < 10) {
    log.info("[DB] Running migration V10");
    migrateV10(db);
  }
  if (currentVersion < 11) {
    log.info("[DB] Running migration V11");
    migrateV11(db);
  }
  if (currentVersion < 12) {
    log.info("[DB] Running migration V12");
    migrateV12(db);
  }
  if (currentVersion < 13) {
    log.info("[DB] Running migration V13");
    migrateV13(db);
  }
  if (currentVersion < 14) {
    log.info("[DB] Running migration V14");
    migrateV14(db);
  }
  if (currentVersion < 15) {
    log.info("[DB] Running migration V15");
    migrateV15(db);
  }
  if (currentVersion < 16) {
    log.info("[DB] Running migration V16");
    migrateV16(db);
  }

  const newVersion = db.pragma("user_version", { simple: true }) as number;
  if (newVersion !== currentVersion) {
    log.info(`[DB] Schema migrated: ${currentVersion} → ${newVersion}`);
  }
}

function migrateV1(db: Database.Database): void {
  db.exec(`
    -- Tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('folder', 'task')),
      title TEXT NOT NULL DEFAULT '',
      parent_id TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      status TEXT CHECK(status IN ('TODO', 'DONE')),
      is_expanded INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      scheduled_at TEXT,
      content TEXT,
      work_duration_minutes INTEGER,
      color TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(is_deleted);

    -- Timer Settings (singleton)
    CREATE TABLE IF NOT EXISTS timer_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      work_duration INTEGER NOT NULL DEFAULT 25,
      break_duration INTEGER NOT NULL DEFAULT 5,
      long_break_duration INTEGER NOT NULL DEFAULT 15,
      sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO timer_settings (id, work_duration, break_duration, long_break_duration, sessions_before_long_break, updated_at)
    VALUES (1, 25, 5, 15, 4, datetime('now'));

    -- Timer Sessions
    CREATE TABLE IF NOT EXISTS timer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT,
      session_type TEXT NOT NULL CHECK(session_type IN ('WORK', 'BREAK', 'LONG_BREAK')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration INTEGER,
      completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_timer_sessions_task ON timer_sessions(task_id);

    -- Sound Settings
    CREATE TABLE IF NOT EXISTS sound_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sound_type TEXT NOT NULL UNIQUE,
      volume INTEGER NOT NULL DEFAULT 50,
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- Sound Presets
    CREATE TABLE IF NOT EXISTS sound_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Memos
    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memos_date ON memos(date);

    -- AI Settings (singleton)
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      api_key TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-lite',
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO ai_settings (id, api_key, model, updated_at)
    VALUES (1, '', 'gemini-2.5-flash-lite', datetime('now'));

    PRAGMA user_version = 1;
  `);
}

function migrateV2(db: Database.Database): void {
  db.exec(`
    -- Tags
    CREATE TABLE IF NOT EXISTS tags (
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

    -- Task Templates
    CREATE TABLE IF NOT EXISTS task_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nodes_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    PRAGMA user_version = 2;
  `);
}

function migrateV4(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sound_settings_new (
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
    ALTER TABLE sound_settings_new RENAME TO sound_settings;

    PRAGMA user_version = 4;
  `);
}

function migrateV7(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sound_tag_definitions (
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

    CREATE INDEX IF NOT EXISTS idx_sta_sound ON sound_tag_assignments(sound_id);

    PRAGMA user_version = 7;
  `);
}

function migrateV8(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sound_workscreen_selections (
      sound_id TEXT NOT NULL,
      session_category TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (sound_id, session_category)
    );

    CREATE INDEX IF NOT EXISTS idx_sws_category ON sound_workscreen_selections(session_category);

    PRAGMA user_version = 8;
  `);
}

function migrateV6(db: Database.Database): void {
  // Check if note_tags table exists before migrating (V3 may have created it)
  const hasNoteTags = !!db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name='note_tags'`,
    )
    .get();
  const hasOldTags = !!db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='tags'`)
    .get();

  const migrate = db.transaction(() => {
    // Create separate tag definition tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_tag_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#808080'
      );

      CREATE TABLE IF NOT EXISTS note_tag_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#808080'
      );
    `);

    if (hasOldTags) {
      // Migrate existing tag data
      // Tags used by task_tags go to task_tag_definitions (preserve IDs)
      db.exec(`
        INSERT OR IGNORE INTO task_tag_definitions (id, name, color)
        SELECT DISTINCT t.id, t.name, t.color FROM tags t
        INNER JOIN task_tags tt ON t.id = tt.tag_id;
      `);

      if (hasNoteTags) {
        // Tags used by note_tags go to note_tag_definitions (new IDs, name-based)
        db.exec(`
          INSERT OR IGNORE INTO note_tag_definitions (name, color)
          SELECT DISTINCT t.name, t.color FROM tags t
          INNER JOIN note_tags nt ON t.id = nt.tag_id;
        `);

        // Unused tags go to both
        db.exec(`
          INSERT OR IGNORE INTO task_tag_definitions (name, color)
          SELECT name, color FROM tags
          WHERE id NOT IN (SELECT tag_id FROM task_tags UNION SELECT tag_id FROM note_tags);

          INSERT OR IGNORE INTO note_tag_definitions (name, color)
          SELECT name, color FROM tags
          WHERE id NOT IN (SELECT tag_id FROM task_tags UNION SELECT tag_id FROM note_tags);
        `);
      } else {
        // No note_tags table — unused tags go to task_tag_definitions only
        db.exec(`
          INSERT OR IGNORE INTO task_tag_definitions (name, color)
          SELECT name, color FROM tags
          WHERE id NOT IN (SELECT tag_id FROM task_tags);
        `);
      }
    }

    // Recreate task_tags with FK to task_tag_definitions
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_tags_new (
        task_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (task_id, tag_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES task_tag_definitions(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO task_tags_new SELECT * FROM task_tags;
      DROP TABLE task_tags;
      ALTER TABLE task_tags_new RENAME TO task_tags;
      CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
    `);

    if (hasNoteTags) {
      // Recreate note_tags with FK to note_tag_definitions (remap IDs by name)
      db.exec(`
        CREATE TABLE IF NOT EXISTS note_tags_new (
          note_id TEXT NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (note_id, tag_id),
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES note_tag_definitions(id) ON DELETE CASCADE
        );
        INSERT OR IGNORE INTO note_tags_new (note_id, tag_id)
        SELECT nt.note_id, ntd.id FROM note_tags nt
        JOIN tags t ON nt.tag_id = t.id
        JOIN note_tag_definitions ntd ON ntd.name = t.name;
        DROP TABLE note_tags;
        ALTER TABLE note_tags_new RENAME TO note_tags;
        CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
        CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);
      `);
    } else {
      // Create note_tags from scratch (no data to migrate)
      db.exec(`
        CREATE TABLE IF NOT EXISTS note_tags (
          note_id TEXT NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (note_id, tag_id),
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES note_tag_definitions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
        CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);
      `);
    }

    // Drop old unified tags table
    db.exec(`DROP TABLE IF EXISTS tags;`);
  });

  migrate();
  // PRAGMA doesn't participate in transactions, set it after success
  db.pragma("user_version = 6");
}

function migrateV5(db: Database.Database): void {
  db.exec(`
    ALTER TABLE tasks ADD COLUMN due_date TEXT;
    PRAGMA user_version = 5;
  `);
}

function backupTableIfExists(
  db: Database.Database,
  table: string,
  suffix: string,
): void {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  if (exists) {
    db.exec(`ALTER TABLE "${table}" RENAME TO "${table}_backup_${suffix}"`);
  }
}

function migrateV9(db: Database.Database): void {
  const migrate = db.transaction(() => {
    backupTableIfExists(db, "task_tags", "v9");
    backupTableIfExists(db, "task_tag_definitions", "v9");
    backupTableIfExists(db, "note_tags", "v9");
    backupTableIfExists(db, "note_tag_definitions", "v9");
  });
  migrate();
  db.pragma("user_version = 9");
}

function migrateV10(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_calendars_folder ON calendars(folder_id);

    PRAGMA user_version = 10;
  `);
}

function migrateV11(db: Database.Database): void {
  db.exec(`
    ALTER TABLE tasks ADD COLUMN scheduled_end_at TEXT;
    ALTER TABLE tasks ADD COLUMN is_all_day INTEGER DEFAULT 0;
    PRAGMA user_version = 11;
  `);
}

function migrateV12(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pomodoro_presets (
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
      ('Quick Sprint', 15, 3, 10, 4, datetime('now'));

    -- Add auto_start_breaks column to timer_settings
    ALTER TABLE timer_settings ADD COLUMN auto_start_breaks INTEGER DEFAULT 0;

    PRAGMA user_version = 12;
  `);
}

function migrateV3(db: Database.Database): void {
  db.exec(`
    -- Notes (free-form memos)
    CREATE TABLE IF NOT EXISTS notes (
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

    -- Note-Tag associations
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

    PRAGMA user_version = 3;
  `);
}

function migrateV13(db: Database.Database): void {
  db.exec(`
    -- sound_settings: remove session_category, keep WORK rows only
    CREATE TABLE sound_settings_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sound_type TEXT NOT NULL UNIQUE,
      volume INTEGER NOT NULL DEFAULT 50,
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO sound_settings_new (sound_type, volume, enabled, updated_at)
      SELECT sound_type, volume, enabled, updated_at FROM sound_settings WHERE session_category = 'WORK';
    DROP TABLE sound_settings;
    ALTER TABLE sound_settings_new RENAME TO sound_settings;

    -- sound_workscreen_selections: remove session_category, keep WORK rows only
    CREATE TABLE sound_workscreen_selections_new (
      sound_id TEXT PRIMARY KEY,
      display_order INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO sound_workscreen_selections_new (sound_id, display_order)
      SELECT sound_id, display_order FROM sound_workscreen_selections WHERE session_category = 'WORK';
    DROP TABLE sound_workscreen_selections;
    ALTER TABLE sound_workscreen_selections_new RENAME TO sound_workscreen_selections;

    PRAGMA user_version = 13;
  `);
}

function migrateV15(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
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
    );
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);

    PRAGMA user_version = 15;
  `);
}

function migrateV14(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      frequency_type TEXT NOT NULL DEFAULT 'daily',
      frequency_days TEXT NOT NULL DEFAULT '[]',
      is_archived INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 0,
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
    CREATE INDEX IF NOT EXISTS idx_routine_logs_routine_date ON routine_logs(routine_id, date);

    PRAGMA user_version = 14;
  `);
}

function migrateV16(db: Database.Database): void {
  db.exec(`
    -- Add new columns to routines
    ALTER TABLE routines ADD COLUMN time_slot TEXT NOT NULL DEFAULT 'anytime';
    ALTER TABLE routines ADD COLUMN times_per_week INTEGER;
    ALTER TABLE routines ADD COLUMN sound_preset_id TEXT;

    -- Routine stacks (Habit Stacking)
    CREATE TABLE IF NOT EXISTS routine_stacks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
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
    );

    CREATE INDEX IF NOT EXISTS idx_routine_stack_items_stack ON routine_stack_items(stack_id);

    PRAGMA user_version = 16;
  `);
}
