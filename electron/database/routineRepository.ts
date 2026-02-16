import type Database from "better-sqlite3";
import type { RoutineNode } from "../types";

interface RoutineRow {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_archived: number;
  order: number;
  created_at: string;
  updated_at: string;
}

function rowToNode(row: RoutineRow): RoutineNode {
  return {
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    isArchived: row.is_archived === 1,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRoutineRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM routines WHERE is_archived = 0 ORDER BY "order" ASC, created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM routines WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO routines (id, title, start_time, end_time, is_archived, "order", created_at, updated_at)
      VALUES (@id, @title, @start_time, @end_time, 0, @order, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE routines SET title = @title, start_time = @start_time, end_time = @end_time,
      is_archived = @is_archived, "order" = @order, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM routines WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM routines`,
    ),
  };

  return {
    fetchAll(): RoutineNode[] {
      return (stmts.fetchAll.all() as RoutineRow[]).map(rowToNode);
    },

    create(
      id: string,
      title: string,
      startTime?: string,
      endTime?: string,
    ): RoutineNode {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      stmts.insert.run({
        id,
        title,
        start_time: startTime ?? null,
        end_time: endTime ?? null,
        order: maxOrder + 1,
      });
      const row = stmts.fetchById.get(id) as RoutineRow;
      return rowToNode(row);
    },

    update(
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          "title" | "startTime" | "endTime" | "isArchived" | "order"
        >
      >,
    ): RoutineNode {
      const existing = stmts.fetchById.get(id) as RoutineRow | undefined;
      if (!existing) throw new Error(`Routine not found: ${id}`);
      const current = rowToNode(existing);
      stmts.update.run({
        id,
        title: updates.title ?? current.title,
        start_time:
          updates.startTime !== undefined
            ? updates.startTime
            : current.startTime,
        end_time:
          updates.endTime !== undefined ? updates.endTime : current.endTime,
        is_archived: (updates.isArchived ?? current.isArchived) ? 1 : 0,
        order: updates.order ?? current.order,
      });
      const row = stmts.fetchById.get(id) as RoutineRow;
      return rowToNode(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },
  };
}

export type RoutineRepository = ReturnType<typeof createRoutineRepository>;
