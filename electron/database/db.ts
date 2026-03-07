import Database from "better-sqlite3";
import * as path from "path";
import { app } from "electron";
import { runMigrations } from "./migrations";
import log from "../logger";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath("userData"), "sonic-flow.db");
  log.info(`[DB] Opening database at: ${dbPath}`);

  try {
    db = new Database(dbPath);
  } catch (e) {
    log.error(`[DB] Failed to open database at ${dbPath}:`, e);
    throw e;
  }

  // WAL mode for better concurrent read/write performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  // Verify latest migration tables exist (V15: playlists)
  const playlistTableExists = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name='playlists'`,
    )
    .get();
  if (!playlistTableExists) {
    log.error(
      "[DB] playlists table not found after migration — attempting V15 re-run",
    );
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

  log.info("[DB] Database initialized successfully");

  return db;
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (e) {
      log.error("[DB] WAL checkpoint failed:", e);
    }
    db.close();
    db = null;
  }
}
