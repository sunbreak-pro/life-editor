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
  if (currentVersion < 17) {
    log.info("[DB] Running migration V17");
    migrateV17(db);
  }
  if (currentVersion < 18) {
    log.info("[DB] Running migration V18");
    migrateV18(db);
  }
  if (currentVersion < 19) {
    log.info("[DB] Running migration V19");
    migrateV19(db);
  }
  if (currentVersion < 20) {
    log.info("[DB] Running migration V20");
    migrateV20(db);
  }
  if (currentVersion < 21) {
    log.info("[DB] Running migration V21");
    migrateV21(db);
  }

  if (currentVersion < 22) {
    log.info("[DB] Running migration V22");
    migrateV22(db);
  }

  if (currentVersion < 23) {
    log.info("[DB] Running migration V23");
    migrateV23(db);
  }

  if (currentVersion < 24) {
    log.info("[DB] Running migration V24");
    migrateV24(db);
  }

  if (currentVersion < 25) {
    log.info("[DB] Running migration V25");
    migrateV25(db);
  }

  if (currentVersion < 26) {
    log.info("[DB] Running migration V26");
    migrateV26(db);
  }

  if (currentVersion < 27) {
    log.info("[DB] Running migration V27");
    migrateV27(db);
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

function migrateV17(db: Database.Database): void {
  const migrate = db.transaction(() => {
    // Drop old routine tables
    db.exec(`
      DROP TABLE IF EXISTS routine_stack_items;
      DROP TABLE IF EXISTS routine_stacks;
      DROP TABLE IF EXISTS routine_logs;
      DROP TABLE IF EXISTS routines;
    `);

    // New routines (simplified — startTime/endTime instead of timeSlot/frequency)
    db.exec(`
      CREATE TABLE routines (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Routine templates (replaces routine_stacks)
    db.exec(`
      CREATE TABLE routine_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        frequency_type TEXT NOT NULL DEFAULT 'daily',
        frequency_days TEXT NOT NULL DEFAULT '[]',
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Template items
    db.exec(`
      CREATE TABLE routine_template_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id TEXT NOT NULL,
        routine_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (template_id) REFERENCES routine_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
        UNIQUE(template_id, routine_id)
      );
      CREATE INDEX idx_rti_template ON routine_template_items(template_id);
    `);

    // Schedule items (new entity)
    db.exec(`
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
      CREATE INDEX idx_si_date ON schedule_items(date);
      CREATE INDEX idx_si_routine ON schedule_items(routine_id);
    `);
  });

  migrate();
  db.pragma("user_version = 17");
}

function migrateV18(db: Database.Database): void {
  db.exec(`
    ALTER TABLE routine_template_items ADD COLUMN start_time TEXT;
    ALTER TABLE routine_template_items ADD COLUMN end_time TEXT;
    PRAGMA user_version = 18;
  `);
}

function hasColumn(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  const cols = db.pragma(`table_info(${table})`) as { name: string }[];
  return cols.some((c) => c.name === column);
}

function migrateV19(db: Database.Database): void {
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS routine_tag_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#808080',
        "order" INTEGER NOT NULL DEFAULT 0
      );

      INSERT OR IGNORE INTO routine_tag_definitions (name, color, "order") VALUES
        ('Morning', '#D9730D', 0),
        ('Afternoon', '#2EAADC', 1),
        ('Night', '#6940A5', 2);
    `);

    if (!hasColumn(db, "routines", "tag_id")) {
      db.exec(`
        ALTER TABLE routines ADD COLUMN tag_id INTEGER
          REFERENCES routine_tag_definitions(id) ON DELETE SET NULL;
      `);
    }

    if (!hasColumn(db, "routine_templates", "tag_id")) {
      db.exec(`
        ALTER TABLE routine_templates ADD COLUMN tag_id INTEGER
          REFERENCES routine_tag_definitions(id) ON DELETE SET NULL;
      `);
    }
  });
  migrate();
  db.pragma("user_version = 19");
}

function migrateV20(db: Database.Database): void {
  const migrate = db.transaction(() => {
    // 1. Create routine_tag_assignments junction table
    db.exec(`
      CREATE TABLE IF NOT EXISTS routine_tag_assignments (
        routine_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (routine_id, tag_id),
        FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES routine_tag_definitions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_rta_routine ON routine_tag_assignments(routine_id);
      CREATE INDEX IF NOT EXISTS idx_rta_tag ON routine_tag_assignments(tag_id);
    `);

    // 2. Migrate existing routines.tag_id data to junction table
    if (hasColumn(db, "routines", "tag_id")) {
      db.exec(`
        INSERT OR IGNORE INTO routine_tag_assignments (routine_id, tag_id)
        SELECT id, tag_id FROM routines WHERE tag_id IS NOT NULL;
      `);
    }

    // 3. Recreate routines table without tag_id column (SQLite limitation)
    db.exec(`
      CREATE TABLE routines_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO routines_new (id, title, start_time, end_time, is_archived, "order", created_at, updated_at)
        SELECT id, title, start_time, end_time, is_archived, "order", created_at, updated_at FROM routines;
      DROP TABLE routines;
      ALTER TABLE routines_new RENAME TO routines;
    `);

    // 4. Drop routine_templates and routine_template_items
    db.exec(`
      DROP TABLE IF EXISTS routine_template_items;
      DROP TABLE IF EXISTS routine_templates;
    `);
  });
  migrate();
  db.pragma("user_version = 20");
}

function migrateV22(db: Database.Database): void {
  // Recreate schedule_items without FK to dropped routine_templates table
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE schedule_items_new (
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
      CREATE INDEX idx_si_date ON schedule_items(date);
      CREATE INDEX idx_si_routine ON schedule_items(routine_id);
    `);
  });
  migrate();
  db.pragma("user_version = 22");
}

function migrateV21(db: Database.Database): void {
  const migrate = db.transaction(() => {
    // Add soft-delete columns to routines
    if (!hasColumn(db, "routines", "is_deleted")) {
      db.exec(
        `ALTER TABLE routines ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!hasColumn(db, "routines", "deleted_at")) {
      db.exec(`ALTER TABLE routines ADD COLUMN deleted_at TEXT`);
    }
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_routines_deleted ON routines(is_deleted)`,
    );

    // Add soft-delete columns to memos
    if (!hasColumn(db, "memos", "is_deleted")) {
      db.exec(
        `ALTER TABLE memos ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!hasColumn(db, "memos", "deleted_at")) {
      db.exec(`ALTER TABLE memos ADD COLUMN deleted_at TEXT`);
    }
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_memos_deleted ON memos(is_deleted)`,
    );
  });
  migrate();
  db.pragma("user_version = 21");
}

function migrateV23(db: Database.Database): void {
  const migrate = db.transaction(() => {
    // Wiki Tags — unified tag system for tasks, memos, notes
    db.exec(`
      CREATE TABLE IF NOT EXISTS wiki_tags (
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
      CREATE INDEX IF NOT EXISTS idx_wta_type ON wiki_tag_assignments(entity_type);
    `);

    // Migrate from V9 backup tables if they exist and have data
    const hasTaskTagDefs = !!db
      .prepare(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name='task_tag_definitions_backup_v9'`,
      )
      .get();
    const hasNoteTagDefs = !!db
      .prepare(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name='note_tag_definitions_backup_v9'`,
      )
      .get();

    if (hasTaskTagDefs) {
      const now = new Date().toISOString();
      // Migrate task tag definitions
      const taskTags = db
        .prepare(`SELECT name, color FROM task_tag_definitions_backup_v9`)
        .all() as Array<{ name: string; color: string }>;
      const insertTag = db.prepare(`
        INSERT OR IGNORE INTO wiki_tags (id, name, color, created_at, updated_at)
        VALUES (@id, @name, @color, @now, @now)
      `);
      for (const tag of taskTags) {
        insertTag.run({
          id: `tag-${crypto.randomUUID()}`,
          name: tag.name,
          color: tag.color,
          now,
        });
      }

      // Migrate task tag assignments
      const hasTaskTagAssignments = !!db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type='table' AND name='task_tags_backup_v9'`,
        )
        .get();
      if (hasTaskTagAssignments) {
        db.exec(`
          INSERT OR IGNORE INTO wiki_tag_assignments (tag_id, entity_id, entity_type, source, created_at)
          SELECT wt.id, tt.task_id, 'task', 'manual', '${now}'
          FROM task_tags_backup_v9 tt
          JOIN task_tag_definitions_backup_v9 ttd ON tt.tag_id = ttd.id
          JOIN wiki_tags wt ON wt.name = ttd.name
        `);
      }
    }

    if (hasNoteTagDefs) {
      const now = new Date().toISOString();
      // Migrate note tag definitions (merge by name)
      const noteTags = db
        .prepare(`SELECT name, color FROM note_tag_definitions_backup_v9`)
        .all() as Array<{ name: string; color: string }>;
      const insertTag = db.prepare(`
        INSERT OR IGNORE INTO wiki_tags (id, name, color, created_at, updated_at)
        VALUES (@id, @name, @color, @now, @now)
      `);
      for (const tag of noteTags) {
        insertTag.run({
          id: `tag-${crypto.randomUUID()}`,
          name: tag.name,
          color: tag.color,
          now,
        });
      }

      // Migrate note tag assignments
      const hasNoteTagAssignments = !!db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type='table' AND name='note_tags_backup_v9'`,
        )
        .get();
      if (hasNoteTagAssignments) {
        db.exec(`
          INSERT OR IGNORE INTO wiki_tag_assignments (tag_id, entity_id, entity_type, source, created_at)
          SELECT wt.id, nt.note_id, 'note', 'manual', '${now}'
          FROM note_tags_backup_v9 nt
          JOIN note_tag_definitions_backup_v9 ntd ON nt.tag_id = ntd.id
          JOIN wiki_tags wt ON wt.name = ntd.name
        `);
      }
    }
  });
  migrate();
  db.pragma("user_version = 23");
}

function migrateV24(db: Database.Database): void {
  const addColumnIfMissing = (table: string, column: string) => {
    if (!hasColumn(db, table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT DEFAULT NULL`);
    }
  };
  addColumnIfMissing("wiki_tags", "text_color");
  addColumnIfMissing("routine_tag_definitions", "text_color");
  addColumnIfMissing("sound_tag_definitions", "text_color");
  db.pragma("user_version = 24");
}

function migrateV25(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_tag_connections (
      id TEXT PRIMARY KEY,
      source_tag_id TEXT NOT NULL,
      target_tag_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE,
      FOREIGN KEY (target_tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE,
      UNIQUE(source_tag_id, target_tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wtc_source ON wiki_tag_connections(source_tag_id);
    CREATE INDEX IF NOT EXISTS idx_wtc_target ON wiki_tag_connections(target_tag_id);

    PRAGMA user_version = 25;
  `);
}

function migrateV27(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_tag_groups (
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
    CREATE INDEX IF NOT EXISTS idx_wtgm_tag ON wiki_tag_group_members(tag_id);

    PRAGMA user_version = 27;
  `);
}

function migrateV26(db: Database.Database): void {
  if (!hasColumn(db, "memos", "is_pinned")) {
    db.exec(
      `ALTER TABLE memos ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`,
    );
  }
  db.pragma("user_version = 26");
}
