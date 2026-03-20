import type Database from "better-sqlite3";
import type { ScheduleItem } from "../types";

interface ScheduleItemRow {
  id: string;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  completed: number;
  completed_at: string | null;
  routine_id: string | null;
  template_id: string | null;
  memo: string | null;
  is_dismissed: number;
  created_at: string;
  updated_at: string;
}

function rowToItem(row: ScheduleItemRow): ScheduleItem {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    completed: row.completed === 1,
    completedAt: row.completed_at,
    routineId: row.routine_id,
    templateId: row.template_id,
    memo: row.memo ?? null,
    isDismissed: row.is_dismissed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createScheduleItemRepository(db: Database.Database) {
  const stmts = {
    fetchByDate: db.prepare(
      `SELECT * FROM schedule_items WHERE date = ? AND is_dismissed = 0 ORDER BY start_time ASC, created_at ASC`,
    ),
    fetchByDateRange: db.prepare(
      `SELECT * FROM schedule_items WHERE date >= ? AND date <= ? AND is_dismissed = 0 ORDER BY date ASC, start_time ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM schedule_items WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO schedule_items (id, date, title, start_time, end_time, completed, completed_at, routine_id, template_id, created_at, updated_at)
      VALUES (@id, @date, @title, @start_time, @end_time, 0, NULL, @routine_id, @template_id, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE schedule_items SET title = @title, start_time = @start_time, end_time = @end_time,
      completed = @completed, completed_at = @completed_at, memo = @memo,
      version = version + 1, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM schedule_items WHERE id = ?`),
    findByRoutineAndDate: db.prepare(
      `SELECT * FROM schedule_items WHERE routine_id = ? AND date = ?`,
    ),
  };

  return {
    fetchByDate(date: string): ScheduleItem[] {
      return (stmts.fetchByDate.all(date) as ScheduleItemRow[]).map(rowToItem);
    },

    fetchByDateRange(startDate: string, endDate: string): ScheduleItem[] {
      return (
        stmts.fetchByDateRange.all(startDate, endDate) as ScheduleItemRow[]
      ).map(rowToItem);
    },

    create(
      id: string,
      date: string,
      title: string,
      startTime: string,
      endTime: string,
      routineId?: string,
      templateId?: string,
    ): ScheduleItem {
      stmts.insert.run({
        id,
        date,
        title,
        start_time: startTime,
        end_time: endTime,
        routine_id: routineId ?? null,
        template_id: templateId ?? null,
      });
      const row = stmts.fetchById.get(id) as ScheduleItemRow;
      return rowToItem(row);
    },

    update(
      id: string,
      updates: Partial<
        Pick<
          ScheduleItem,
          | "title"
          | "startTime"
          | "endTime"
          | "completed"
          | "completedAt"
          | "memo"
        >
      >,
    ): ScheduleItem {
      const existing = stmts.fetchById.get(id) as ScheduleItemRow | undefined;
      if (!existing) throw new Error(`ScheduleItem not found: ${id}`);
      const current = rowToItem(existing);
      stmts.update.run({
        id,
        title: updates.title ?? current.title,
        start_time: updates.startTime ?? current.startTime,
        end_time: updates.endTime ?? current.endTime,
        completed: (updates.completed ?? current.completed) ? 1 : 0,
        completed_at:
          updates.completedAt !== undefined
            ? updates.completedAt
            : current.completedAt,
        memo: updates.memo !== undefined ? updates.memo : current.memo,
      });
      const row = stmts.fetchById.get(id) as ScheduleItemRow;
      return rowToItem(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    dismiss(id: string): void {
      db.prepare(
        `UPDATE schedule_items SET is_dismissed = 1, version = version + 1, updated_at = datetime('now') WHERE id = ?`,
      ).run(id);
    },

    toggleComplete(id: string): ScheduleItem {
      const existing = stmts.fetchById.get(id) as ScheduleItemRow | undefined;
      if (!existing) throw new Error(`ScheduleItem not found: ${id}`);
      const nowCompleted = existing.completed === 0;
      stmts.update.run({
        id,
        title: existing.title,
        start_time: existing.start_time,
        end_time: existing.end_time,
        completed: nowCompleted ? 1 : 0,
        completed_at: nowCompleted ? new Date().toISOString() : null,
        memo: existing.memo,
      });
      const row = stmts.fetchById.get(id) as ScheduleItemRow;
      return rowToItem(row);
    },

    bulkCreate(
      items: Array<{
        id: string;
        date: string;
        title: string;
        startTime: string;
        endTime: string;
        routineId?: string;
        templateId?: string;
      }>,
    ): ScheduleItem[] {
      const bulkInsert = db.transaction(() => {
        const results: ScheduleItem[] = [];
        for (const item of items) {
          // Skip if already exists for this routine+date
          if (item.routineId) {
            const existing = stmts.findByRoutineAndDate.get(
              item.routineId,
              item.date,
            );
            if (existing) continue;
          }
          stmts.insert.run({
            id: item.id,
            date: item.date,
            title: item.title,
            start_time: item.startTime,
            end_time: item.endTime,
            routine_id: item.routineId ?? null,
            template_id: item.templateId ?? null,
          });
          const row = stmts.fetchById.get(item.id) as ScheduleItemRow;
          results.push(rowToItem(row));
        }
        return results;
      });
      return bulkInsert();
    },
  };
}

export type ScheduleItemRepository = ReturnType<
  typeof createScheduleItemRepository
>;
