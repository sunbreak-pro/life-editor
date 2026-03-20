import type Database from "better-sqlite3";
import type { MemoNode } from "../types";
import { prepareSoftDeleteStatements } from "./repositoryHelpers";

interface MemoRow {
  id: string;
  date: string;
  content: string;
  is_pinned: number;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToNode(row: MemoRow): MemoNode {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    isPinned: row.is_pinned === 1,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createMemoRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM memos WHERE is_deleted = 0 ORDER BY date DESC`,
    ),
    fetchByDate: db.prepare(`SELECT * FROM memos WHERE date = ?`),
    upsert: db.prepare(`
      INSERT INTO memos (id, date, content, created_at, updated_at)
      VALUES (@id, @date, @content, datetime('now'), datetime('now'))
      ON CONFLICT(date) DO UPDATE SET
        content = @content, version = version + 1, updated_at = datetime('now')
    `),
    ...prepareSoftDeleteStatements(db, "memos", {
      keyColumn: "date",
      safePermanentDelete: true,
    }),
    togglePin: db.prepare(
      `UPDATE memos SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END, version = version + 1, updated_at = datetime('now') WHERE date = ?`,
    ),
  };

  return {
    fetchAll(): MemoNode[] {
      return (stmts.fetchAll.all() as MemoRow[]).map(rowToNode);
    },

    fetchByDate(date: string): MemoNode | null {
      const row = stmts.fetchByDate.get(date) as MemoRow | undefined;
      return row ? rowToNode(row) : null;
    },

    upsert(date: string, content: string): MemoNode {
      const id = `memo-${date}`;
      stmts.upsert.run({ id, date, content });
      const row = stmts.fetchByDate.get(date) as MemoRow;
      return rowToNode(row);
    },

    delete(date: string): void {
      stmts.softDelete.run(date);
    },

    fetchDeleted(): MemoNode[] {
      return (stmts.fetchDeleted.all() as MemoRow[]).map(rowToNode);
    },

    restore(date: string): void {
      stmts.restore.run(date);
    },

    permanentDelete(date: string): void {
      stmts.permanentDelete.run(date);
    },

    togglePin(date: string): MemoNode {
      stmts.togglePin.run(date);
      const row = stmts.fetchByDate.get(date) as MemoRow;
      return rowToNode(row);
    },
  };
}

export type MemoRepository = ReturnType<typeof createMemoRepository>;
