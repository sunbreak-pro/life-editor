import Database from "better-sqlite3";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function initDb(dbPath: string): Database.Database {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
