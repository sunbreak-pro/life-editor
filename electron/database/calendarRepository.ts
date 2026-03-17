import type Database from "better-sqlite3";
import type { CalendarNode } from "../types";

interface CalendarRow {
  id: string;
  title: string;
  folder_id: string;
  order: number;
  created_at: string;
  updated_at: string;
}

function rowToNode(row: CalendarRow): CalendarNode {
  return {
    id: row.id,
    title: row.title,
    folderId: row.folder_id,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCalendarRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM calendars ORDER BY "order" ASC, created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM calendars WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO calendars (id, title, folder_id, "order", created_at, updated_at)
      VALUES (@id, @title, @folder_id, @order, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE calendars SET title = @title, folder_id = @folder_id, "order" = @order,
        version = version + 1, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM calendars WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM calendars`,
    ),
  };

  return {
    fetchAll(): CalendarNode[] {
      return (stmts.fetchAll.all() as CalendarRow[]).map(rowToNode);
    },

    create(id: string, title: string, folderId: string): CalendarNode {
      const { max_order } = stmts.maxOrder.get() as { max_order: number };
      stmts.insert.run({
        id,
        title,
        folder_id: folderId,
        order: max_order + 1,
      });
      const row = stmts.fetchById.get(id) as CalendarRow;
      return rowToNode(row);
    },

    update(
      id: string,
      updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
    ): CalendarNode {
      const existing = stmts.fetchById.get(id) as CalendarRow | undefined;
      if (!existing) throw new Error(`Calendar not found: ${id}`);
      const current = rowToNode(existing);
      stmts.update.run({
        id,
        title: updates.title ?? current.title,
        folder_id: updates.folderId ?? current.folderId,
        order: updates.order ?? current.order,
      });
      const row = stmts.fetchById.get(id) as CalendarRow;
      return rowToNode(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },
  };
}

export type CalendarRepository = ReturnType<typeof createCalendarRepository>;
