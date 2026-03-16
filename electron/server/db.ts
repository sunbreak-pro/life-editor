import Database from "better-sqlite3";
import { runMigrations } from "../database/migrations";

let db: Database.Database | null = null;

/**
 * Initialize a standalone DB connection (no Electron dependency).
 * When called from Electron main process, pass the same path as getDatabase().
 * When called from standalone server, pass DB_PATH env var.
 */
export function initServerDb(dbPath: string): Database.Database {
  if (db) return db;

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  runMigrations(db);

  return db;
}

export function getServerDb(): Database.Database {
  if (!db)
    throw new Error("Server DB not initialized. Call initServerDb() first.");
  return db;
}

export function closeServerDb(): void {
  if (db) {
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // ignore checkpoint errors on close
    }
    db.close();
    db = null;
  }
}
