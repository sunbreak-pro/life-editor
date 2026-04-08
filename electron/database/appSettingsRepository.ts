import type Database from "better-sqlite3";

export function createAppSettingsRepository(db: Database.Database) {
  const stmts = {
    get: db.prepare(`SELECT value FROM app_settings WHERE key = ?`),
    set: db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `),
    getAll: db.prepare(`SELECT key, value FROM app_settings`),
    remove: db.prepare(`DELETE FROM app_settings WHERE key = ?`),
  };

  return {
    get(key: string): string | null {
      const row = stmts.get.get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },

    set(key: string, value: string): void {
      stmts.set.run(key, value);
    },

    getAll(): Record<string, string> {
      const rows = stmts.getAll.all() as { key: string; value: string }[];
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    },

    remove(key: string): void {
      stmts.remove.run(key);
    },
  };
}

export type AppSettingsRepository = ReturnType<
  typeof createAppSettingsRepository
>;
