import log from "../logger";
import { ipcMain, dialog, BrowserWindow, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type Database from "better-sqlite3";
import { loggedHandler } from "./handlerUtil";

function safeQuery(db: Database.Database, sql: string): unknown[] {
  try {
    return db.prepare(sql).all();
  } catch {
    return [];
  }
}

function safeQueryOne(db: Database.Database, sql: string): unknown | null {
  try {
    return db.prepare(sql).get() ?? null;
  } catch {
    return null;
  }
}

export function registerDataIOHandlers(db: Database.Database): void {
  ipcMain.handle(
    "data:export",
    loggedHandler("DataIO", "export", async () => {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return false;

      const result = await dialog.showSaveDialog(win, {
        title: "Export Data",
        defaultPath: `sonic-flow-export-${formatTimestamp()}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (result.canceled || !result.filePath) return false;

      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        app: "Sonic Flow",
        data: {
          tasks: safeQuery(db, "SELECT * FROM tasks"),
          timerSettings: safeQueryOne(
            db,
            "SELECT * FROM timer_settings WHERE id = 1",
          ),
          timerSessions: safeQuery(db, "SELECT * FROM timer_sessions"),
          soundSettings: safeQuery(db, "SELECT * FROM sound_settings"),
          soundPresets: safeQuery(db, "SELECT * FROM sound_presets"),
          memos: safeQuery(db, "SELECT * FROM memos"),
          notes: safeQuery(db, "SELECT * FROM notes"),
          soundTagDefinitions: safeQuery(
            db,
            "SELECT * FROM sound_tag_definitions",
          ),
          soundTagAssignments: safeQuery(
            db,
            "SELECT * FROM sound_tag_assignments",
          ),
          soundDisplayMeta: safeQuery(db, "SELECT * FROM sound_display_meta"),
          calendars: safeQuery(db, "SELECT * FROM calendars"),
          routines: safeQuery(db, "SELECT * FROM routines"),
          routineTagAssignments: safeQuery(
            db,
            "SELECT * FROM routine_tag_assignments",
          ),
          routineTagDefinitions: safeQuery(
            db,
            "SELECT * FROM routine_tag_definitions",
          ),
          scheduleItems: safeQuery(db, "SELECT * FROM schedule_items"),
          aiSettings: safeQueryOne(
            db,
            "SELECT * FROM ai_settings WHERE id = 1",
          ),
        },
      };

      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), "utf-8");
      return true;
    }),
  );

  ipcMain.handle(
    "data:import",
    loggedHandler("DataIO", "import", async () => {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return false;

      const result = await dialog.showOpenDialog(win, {
        title: "Import Data",
        filters: [{ name: "JSON", extensions: ["json"] }],
        properties: ["openFile"],
      });

      if (result.canceled || result.filePaths.length === 0) return false;

      const raw = fs.readFileSync(result.filePaths[0], "utf-8");
      const imported = JSON.parse(raw);

      // Basic validation
      if (!imported.app || imported.app !== "Sonic Flow" || !imported.data) {
        throw new Error("Invalid Sonic Flow export file");
      }

      // Version check
      if (
        typeof imported.version !== "number" ||
        imported.version < 1 ||
        imported.version > 1
      ) {
        throw new Error(
          `Unsupported export version: ${imported.version}. Expected version 1.`,
        );
      }

      // Schema validation
      validateImportData(imported.data);

      // Create backup before import
      const dbPath = path.join(app.getPath("userData"), "sonic-flow.db");
      const backupPath = path.join(
        app.getPath("userData"),
        `sonic-flow-backup-${formatTimestamp()}.db`,
      );
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }

      const data = imported.data;

      try {
        const importAll = db.transaction(() => {
          // Clear all tables
          db.exec(`
          DELETE FROM schedule_items;
          DELETE FROM routine_tag_assignments;
          DELETE FROM routines;
          DELETE FROM calendars;
          DELETE FROM notes;
          DELETE FROM sound_tag_assignments;
          DELETE FROM sound_tag_definitions;
          DELETE FROM sound_display_meta;
          DELETE FROM timer_sessions;
          DELETE FROM sound_settings;
          DELETE FROM sound_presets;
          DELETE FROM memos;
          DELETE FROM tasks;
        `);

          // Import tasks
          if (Array.isArray(data.tasks)) {
            const insertTask = db.prepare(`
            INSERT INTO tasks (id, type, title, parent_id, "order", status, is_expanded, is_deleted, deleted_at, created_at, completed_at, scheduled_at, scheduled_end_at, is_all_day, content, work_duration_minutes, color, due_date)
            VALUES (@id, @type, @title, @parent_id, @"order", @status, @is_expanded, @is_deleted, @deleted_at, @created_at, @completed_at, @scheduled_at, @scheduled_end_at, @is_all_day, @content, @work_duration_minutes, @color, @due_date)
          `);
            for (const t of data.tasks) {
              insertTask.run({
                ...t,
                scheduled_end_at: t.scheduled_end_at ?? null,
                is_all_day: t.is_all_day ?? 0,
                due_date: t.due_date ?? null,
              });
            }
          }

          // Import timer settings
          if (data.timerSettings) {
            const ts = data.timerSettings;
            db.prepare(
              `
            UPDATE timer_settings SET work_duration=@work_duration, break_duration=@break_duration,
            long_break_duration=@long_break_duration, sessions_before_long_break=@sessions_before_long_break,
            updated_at=@updated_at WHERE id=1
          `,
            ).run(ts);
          }

          // Import timer sessions
          if (Array.isArray(data.timerSessions)) {
            const insertSession = db.prepare(`
            INSERT INTO timer_sessions (id, task_id, session_type, started_at, completed_at, duration, completed)
            VALUES (@id, @task_id, @session_type, @started_at, @completed_at, @duration, @completed)
          `);
            for (const s of data.timerSessions) {
              insertSession.run(s);
            }
          }

          // Import sound settings
          if (Array.isArray(data.soundSettings)) {
            const insertSound = db.prepare(`
            INSERT INTO sound_settings (id, sound_type, volume, enabled, updated_at)
            VALUES (@id, @sound_type, @volume, @enabled, @updated_at)
          `);
            for (const s of data.soundSettings) {
              insertSound.run(s);
            }
          }

          // Import sound presets
          if (Array.isArray(data.soundPresets)) {
            const insertPreset = db.prepare(`
            INSERT INTO sound_presets (id, name, settings_json, created_at)
            VALUES (@id, @name, @settings_json, @created_at)
          `);
            for (const p of data.soundPresets) {
              insertPreset.run(p);
            }
          }

          // Import memos
          if (Array.isArray(data.memos)) {
            const insertMemo = db.prepare(`
            INSERT INTO memos (id, date, content, created_at, updated_at)
            VALUES (@id, @date, @content, @created_at, @updated_at)
          `);
            for (const m of data.memos) {
              insertMemo.run(m);
            }
          }

          // Import notes
          if (Array.isArray(data.notes)) {
            const insertNote = db.prepare(`
            INSERT INTO notes (id, title, content, is_pinned, is_deleted, deleted_at, created_at, updated_at)
            VALUES (@id, @title, @content, @is_pinned, @is_deleted, @deleted_at, @created_at, @updated_at)
          `);
            for (const n of data.notes) {
              insertNote.run(n);
            }
          }

          // Import calendars
          if (Array.isArray(data.calendars)) {
            const insertCalendar = db.prepare(`
            INSERT INTO calendars (id, title, folder_id, "order", created_at, updated_at)
            VALUES (@id, @title, @folder_id, @order, @created_at, @updated_at)
          `);
            for (const c of data.calendars) {
              insertCalendar.run(c);
            }
          }

          // Import sound tag definitions
          if (Array.isArray(data.soundTagDefinitions)) {
            const insertSoundTag = db.prepare(
              `INSERT INTO sound_tag_definitions (id, name, color) VALUES (@id, @name, @color)`,
            );
            for (const t of data.soundTagDefinitions) {
              insertSoundTag.run(t);
            }
          }

          // Import sound tag assignments
          if (Array.isArray(data.soundTagAssignments)) {
            const insertAssignment = db.prepare(
              `INSERT INTO sound_tag_assignments (sound_id, tag_id) VALUES (@sound_id, @tag_id)`,
            );
            for (const a of data.soundTagAssignments) {
              insertAssignment.run(a);
            }
          }

          // Import sound display meta
          if (Array.isArray(data.soundDisplayMeta)) {
            const insertMeta = db.prepare(
              `INSERT INTO sound_display_meta (sound_id, display_name) VALUES (@sound_id, @display_name)`,
            );
            for (const m of data.soundDisplayMeta) {
              insertMeta.run(m);
            }
          }

          // Import routines
          if (Array.isArray(data.routines)) {
            const insertRoutine = db.prepare(`
              INSERT INTO routines (id, title, start_time, end_time, is_archived, "order", created_at, updated_at)
              VALUES (@id, @title, @start_time, @end_time, @is_archived, @order, @created_at, @updated_at)
            `);
            for (const r of data.routines) {
              insertRoutine.run({
                ...r,
                start_time: r.start_time ?? null,
                end_time: r.end_time ?? null,
              });
            }
          }

          // Import routine tag assignments
          if (Array.isArray(data.routineTagAssignments)) {
            const insertAssignment = db.prepare(
              `INSERT OR IGNORE INTO routine_tag_assignments (routine_id, tag_id) VALUES (@routine_id, @tag_id)`,
            );
            for (const a of data.routineTagAssignments) {
              insertAssignment.run(a);
            }
          }

          // Import routine tag definitions
          if (Array.isArray(data.routineTagDefinitions)) {
            const insertTag = db.prepare(
              `INSERT OR IGNORE INTO routine_tag_definitions (id, name, color, "order") VALUES (@id, @name, @color, @order)`,
            );
            for (const t of data.routineTagDefinitions) {
              insertTag.run(t);
            }
          }

          // Import schedule items
          if (Array.isArray(data.scheduleItems)) {
            const insertSI = db.prepare(`
              INSERT INTO schedule_items (id, date, title, start_time, end_time, completed, completed_at, routine_id, template_id, created_at, updated_at)
              VALUES (@id, @date, @title, @start_time, @end_time, @completed, @completed_at, @routine_id, @template_id, @created_at, @updated_at)
            `);
            for (const s of data.scheduleItems) {
              insertSI.run({
                ...s,
                completed_at: s.completed_at ?? null,
                routine_id: s.routine_id ?? null,
                template_id: s.template_id ?? null,
              });
            }
          }

          // Import AI settings
          if (data.aiSettings) {
            const ai = data.aiSettings;
            db.prepare(
              `
            UPDATE ai_settings SET api_key=@api_key, model=@model, updated_at=@updated_at WHERE id=1
          `,
            ).run(ai);
          }
        });

        importAll();
        return true;
      } catch (e) {
        log.error("[DataIO] Import failed, restoring backup:", e);
        // Restore backup on failure
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, dbPath);
        }
        throw e;
      }
    }),
  );

  ipcMain.handle(
    "data:reset",
    loggedHandler("DataIO", "reset", async () => {
      const dbPath = path.join(app.getPath("userData"), "sonic-flow.db");
      const backupPath = path.join(
        app.getPath("userData"),
        `sonic-flow-backup-${formatTimestamp()}.db`,
      );

      // Create backup before reset
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }

      try {
        const resetAll = db.transaction(() => {
          db.exec(`
            DELETE FROM playlist_items;
            DELETE FROM playlists;
            DELETE FROM schedule_items;
            DELETE FROM routine_tag_assignments;
            DELETE FROM routines;
            DELETE FROM calendars;
            DELETE FROM notes;
            DELETE FROM note_tags;
            DELETE FROM sound_tag_assignments;
            DELETE FROM sound_tag_definitions;
            DELETE FROM sound_display_meta;
            DELETE FROM sound_workscreen_selections;
            DELETE FROM timer_sessions;
            DELETE FROM pomodoro_presets;
            DELETE FROM sound_settings;
            DELETE FROM sound_presets;
            DELETE FROM memos;
            DELETE FROM task_tags;
            DELETE FROM task_tag_definitions;
            DELETE FROM tasks;
          `);

          // Reset timer_settings to defaults
          db.prepare(
            `
            UPDATE timer_settings
            SET work_duration = 25, break_duration = 5,
                long_break_duration = 15, sessions_before_long_break = 4,
                updated_at = datetime('now')
            WHERE id = 1
          `,
          ).run();

          // Clear AI settings
          db.prepare(
            `
            UPDATE ai_settings
            SET api_key = '', model = 'gemini-2.0-flash',
                updated_at = datetime('now')
            WHERE id = 1
          `,
          ).run();
        });

        resetAll();

        // Delete custom sound files
        const customSoundsDir = path.join(
          app.getPath("userData"),
          "custom-sounds",
        );
        if (fs.existsSync(customSoundsDir)) {
          const files = fs.readdirSync(customSoundsDir);
          for (const file of files) {
            fs.unlinkSync(path.join(customSoundsDir, file));
          }
        }

        return true;
      } catch (e) {
        log.error("[DataIO] Reset failed, restoring backup:", e);
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, dbPath);
        }
        throw e;
      }
    }),
  );
}

function validateImportData(data: Record<string, unknown>): void {
  const arrayFields = [
    "tasks",
    "timerSessions",
    "soundSettings",
    "soundPresets",
    "memos",
    "notes",
    "soundTagDefinitions",
    "soundTagAssignments",
    "soundDisplayMeta",
    "calendars",
    "routines",
    "routineTagAssignments",
    "routineTagDefinitions",
    "scheduleItems",
  ];
  for (const field of arrayFields) {
    if (data[field] !== undefined && !Array.isArray(data[field])) {
      throw new Error(`Invalid import data: "${field}" must be an array`);
    }
  }

  // Validate tasks have required fields
  if (Array.isArray(data.tasks)) {
    for (const task of data.tasks as Record<string, unknown>[]) {
      if (!task.id || typeof task.id !== "string") {
        throw new Error(
          'Invalid import data: each task must have a string "id"',
        );
      }
      if (!task.type || (task.type !== "folder" && task.type !== "task")) {
        throw new Error(
          `Invalid import data: task "${task.id}" has invalid type "${task.type}"`,
        );
      }
      if (!task.created_at || typeof task.created_at !== "string") {
        throw new Error(
          `Invalid import data: task "${task.id}" must have a string "created_at"`,
        );
      }
    }
  }
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
