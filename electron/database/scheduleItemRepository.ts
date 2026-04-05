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
  note_id: string | null;
  content: string | null;
  is_dismissed: number;
  is_all_day: number;
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
    noteId: row.note_id ?? null,
    content: row.content ?? null,
    isDismissed: row.is_dismissed === 1,
    isAllDay: row.is_all_day === 1,
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
      INSERT INTO schedule_items (id, date, title, start_time, end_time, completed, completed_at, routine_id, template_id, note_id, is_all_day, content, created_at, updated_at)
      VALUES (@id, @date, @title, @start_time, @end_time, 0, NULL, @routine_id, @template_id, @note_id, @is_all_day, @content, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE schedule_items SET title = @title, start_time = @start_time, end_time = @end_time,
      completed = @completed, completed_at = @completed_at, memo = @memo, is_all_day = @is_all_day,
      content = @content, version = version + 1, updated_at = datetime('now')
      WHERE id = @id
    `),
    fetchEvents: db.prepare(
      `SELECT * FROM schedule_items WHERE routine_id IS NULL AND is_dismissed = 0 ORDER BY date DESC, start_time ASC`,
    ),
    delete: db.prepare(`DELETE FROM schedule_items WHERE id = ?`),
    findByRoutineAndDate: db.prepare(
      `SELECT * FROM schedule_items WHERE routine_id = ? AND date = ?`,
    ),
    fetchLastRoutineDate: db.prepare(
      `SELECT MAX(date) as last_date FROM schedule_items WHERE routine_id IS NOT NULL`,
    ),
    fetchByRoutineId: db.prepare(
      `SELECT * FROM schedule_items WHERE routine_id = ? AND is_dismissed = 0 ORDER BY date ASC`,
    ),
    updateFutureByRoutine: db.prepare(`
      UPDATE schedule_items SET
        title = CASE WHEN @update_title THEN @title ELSE title END,
        start_time = CASE WHEN @update_start_time THEN @start_time ELSE start_time END,
        end_time = CASE WHEN @update_end_time THEN @end_time ELSE end_time END,
        version = version + 1,
        updated_at = datetime('now')
      WHERE routine_id = @routine_id AND date >= @from_date AND is_dismissed = 0
    `),
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
      noteId?: string,
      isAllDay?: boolean,
      content?: string,
    ): ScheduleItem {
      stmts.insert.run({
        id,
        date,
        title,
        start_time: startTime,
        end_time: endTime,
        routine_id: routineId ?? null,
        template_id: templateId ?? null,
        note_id: noteId ?? null,
        is_all_day: isAllDay ? 1 : 0,
        content: content ?? null,
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
          | "isAllDay"
          | "content"
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
        is_all_day:
          updates.isAllDay !== undefined
            ? updates.isAllDay
              ? 1
              : 0
            : current.isAllDay
              ? 1
              : 0,
        content:
          updates.content !== undefined ? updates.content : current.content,
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

    undismiss(id: string): void {
      db.prepare(
        `UPDATE schedule_items SET is_dismissed = 0, version = version + 1, updated_at = datetime('now') WHERE id = ?`,
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
        is_all_day: existing.is_all_day,
        content: existing.content,
      });
      const row = stmts.fetchById.get(id) as ScheduleItemRow;
      return rowToItem(row);
    },

    updateFutureByRoutine(
      routineId: string,
      updates: { title?: string; startTime?: string; endTime?: string },
      fromDate: string,
    ): number {
      if (
        updates.title === undefined &&
        updates.startTime === undefined &&
        updates.endTime === undefined
      )
        return 0;
      const result = stmts.updateFutureByRoutine.run({
        update_title: updates.title !== undefined ? 1 : 0,
        title: updates.title ?? "",
        update_start_time: updates.startTime !== undefined ? 1 : 0,
        start_time: updates.startTime ?? "",
        update_end_time: updates.endTime !== undefined ? 1 : 0,
        end_time: updates.endTime ?? "",
        routine_id: routineId,
        from_date: fromDate,
      });
      return result.changes;
    },

    fetchEvents(): ScheduleItem[] {
      return (stmts.fetchEvents.all() as ScheduleItemRow[]).map(rowToItem);
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
        noteId?: string;
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
            note_id: item.noteId ?? null,
            is_all_day: 0,
            content: null,
          });
          const row = stmts.fetchById.get(item.id) as ScheduleItemRow;
          results.push(rowToItem(row));
        }
        return results;
      });
      return bulkInsert();
    },

    fetchLastRoutineDate(): string | null {
      const row = stmts.fetchLastRoutineDate.get() as
        | {
            last_date: string | null;
          }
        | undefined;
      return row?.last_date ?? null;
    },

    fetchByRoutineId(routineId: string): ScheduleItem[] {
      return (stmts.fetchByRoutineId.all(routineId) as ScheduleItemRow[]).map(
        rowToItem,
      );
    },

    bulkDelete(ids: string[]): number {
      if (ids.length === 0) return 0;
      const bulkDel = db.transaction(() => {
        let count = 0;
        for (const id of ids) {
          const result = stmts.delete.run(id);
          count += result.changes;
        }
        return count;
      });
      return bulkDel();
    },
  };
}

export type ScheduleItemRepository = ReturnType<
  typeof createScheduleItemRepository
>;
