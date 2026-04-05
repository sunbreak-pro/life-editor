import type Database from "better-sqlite3";
import type { RoutineNode } from "../types";

import type { FrequencyType } from "../types";

interface RoutineRow {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_archived: number;
  is_visible: number;
  is_deleted: number;
  deleted_at: string | null;
  order: number;
  frequency_type: string;
  frequency_days: string;
  frequency_interval: number | null;
  frequency_start_date: string | null;
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
    isVisible: row.is_visible === 1,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    order: row.order,
    frequencyType: (row.frequency_type as FrequencyType) ?? "daily",
    frequencyDays: JSON.parse(row.frequency_days || "[]") as number[],
    frequencyInterval: row.frequency_interval,
    frequencyStartDate: row.frequency_start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRoutineRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM routines WHERE is_archived = 0 AND is_deleted = 0 ORDER BY "order" ASC, created_at ASC`,
    ),
    fetchDeleted: db.prepare(
      `SELECT * FROM routines WHERE is_deleted = 1 ORDER BY deleted_at DESC`,
    ),
    softDelete: db.prepare(
      `UPDATE routines SET is_deleted = 1, deleted_at = datetime('now'), version = version + 1, updated_at = datetime('now') WHERE id = ?`,
    ),
    restore: db.prepare(
      `UPDATE routines SET is_deleted = 0, deleted_at = NULL, version = version + 1, updated_at = datetime('now') WHERE id = ?`,
    ),
    permanentDelete: db.prepare(
      `DELETE FROM routines WHERE id = ? AND is_deleted = 1`,
    ),
    fetchById: db.prepare(`SELECT * FROM routines WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO routines (id, title, start_time, end_time, is_archived, is_visible, "order",
        frequency_type, frequency_days, frequency_interval, frequency_start_date,
        created_at, updated_at)
      VALUES (@id, @title, @start_time, @end_time, 0, 1, @order,
        @frequency_type, @frequency_days, @frequency_interval, @frequency_start_date,
        datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE routines SET title = @title, start_time = @start_time, end_time = @end_time,
      is_archived = @is_archived, is_visible = @is_visible, "order" = @order,
      frequency_type = @frequency_type, frequency_days = @frequency_days,
      frequency_interval = @frequency_interval, frequency_start_date = @frequency_start_date,
      version = version + 1, updated_at = datetime('now')
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
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
    ): RoutineNode {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      stmts.insert.run({
        id,
        title,
        start_time: startTime ?? null,
        end_time: endTime ?? null,
        order: maxOrder + 1,
        frequency_type: frequencyType ?? "daily",
        frequency_days: JSON.stringify(frequencyDays ?? []),
        frequency_interval: frequencyInterval ?? null,
        frequency_start_date: frequencyStartDate ?? null,
      });
      const row = stmts.fetchById.get(id) as RoutineRow;
      return rowToNode(row);
    },

    update(
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          | "title"
          | "startTime"
          | "endTime"
          | "isArchived"
          | "isVisible"
          | "order"
          | "frequencyType"
          | "frequencyDays"
          | "frequencyInterval"
          | "frequencyStartDate"
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
        is_visible: (updates.isVisible ?? current.isVisible) ? 1 : 0,
        order: updates.order ?? current.order,
        frequency_type: updates.frequencyType ?? current.frequencyType,
        frequency_days: JSON.stringify(
          updates.frequencyDays ?? current.frequencyDays,
        ),
        frequency_interval:
          updates.frequencyInterval !== undefined
            ? updates.frequencyInterval
            : current.frequencyInterval,
        frequency_start_date:
          updates.frequencyStartDate !== undefined
            ? updates.frequencyStartDate
            : current.frequencyStartDate,
      });
      const row = stmts.fetchById.get(id) as RoutineRow;
      return rowToNode(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    fetchDeleted(): RoutineNode[] {
      return (stmts.fetchDeleted.all() as RoutineRow[]).map(rowToNode);
    },

    softDelete(id: string): void {
      stmts.softDelete.run(id);
    },

    restore(id: string): void {
      stmts.restore.run(id);
    },

    permanentDelete(id: string): void {
      stmts.permanentDelete.run(id);
    },
  };
}

export type RoutineRepository = ReturnType<typeof createRoutineRepository>;
