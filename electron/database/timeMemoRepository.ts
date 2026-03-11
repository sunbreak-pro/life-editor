import type Database from "better-sqlite3";
import type { TimeMemo } from "../types";

interface TimeMemoRow {
  id: string;
  date: string;
  hour: number;
  content: string;
  created_at: string;
  updated_at: string;
}

function rowToNode(row: TimeMemoRow): TimeMemo {
  return {
    id: row.id,
    date: row.date,
    hour: row.hour,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTimeMemoRepository(db: Database.Database) {
  const stmts = {
    fetchByDate: db.prepare(
      `SELECT * FROM time_memos WHERE date = ? ORDER BY hour`,
    ),
    upsert: db.prepare(`
      INSERT INTO time_memos (id, date, hour, content, created_at, updated_at)
      VALUES (@id, @date, @hour, @content, datetime('now'), datetime('now'))
      ON CONFLICT(date, hour) DO UPDATE SET
        content = @content, updated_at = datetime('now')
    `),
    delete: db.prepare(`DELETE FROM time_memos WHERE id = ?`),
    fetchById: db.prepare(`SELECT * FROM time_memos WHERE id = ?`),
    fetchByDateHour: db.prepare(
      `SELECT * FROM time_memos WHERE date = ? AND hour = ?`,
    ),
  };

  return {
    fetchByDate(date: string): TimeMemo[] {
      return (stmts.fetchByDate.all(date) as TimeMemoRow[]).map(rowToNode);
    },

    upsert(id: string, date: string, hour: number, content: string): TimeMemo {
      stmts.upsert.run({ id, date, hour, content });
      const row = stmts.fetchByDateHour.get(date, hour) as TimeMemoRow;
      return rowToNode(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },
  };
}

export type TimeMemoRepository = ReturnType<typeof createTimeMemoRepository>;
