import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

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
  is_deleted: number;
  deleted_at: string | null;
  reminder_enabled: number;
  reminder_offset: number | null;
  created_at: string;
  updated_at: string;
}

function formatItem(row: ScheduleItemRow) {
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
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    reminderEnabled: row.reminder_enabled === 1,
    reminderOffset: row.reminder_offset,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSchedule(args: {
  date?: string;
  start_date?: string;
  end_date?: string;
}) {
  const db = getDb();

  // Date range query
  if (args.start_date && args.end_date) {
    const rows = db
      .prepare(
        `SELECT * FROM schedule_items WHERE date >= ? AND date <= ? AND is_dismissed = 0 AND is_deleted = 0
         ORDER BY date ASC, start_time ASC, created_at ASC`,
      )
      .all(args.start_date, args.end_date) as ScheduleItemRow[];

    const tasks = db
      .prepare(
        `SELECT id, title, scheduled_at, scheduled_end_at, is_all_day, status
         FROM tasks WHERE is_deleted = 0 AND scheduled_at IS NOT NULL
         AND date(scheduled_at) >= ? AND date(scheduled_at) <= ?
         ORDER BY scheduled_at ASC`,
      )
      .all(args.start_date, args.end_date) as Array<{
      id: string;
      title: string;
      scheduled_at: string;
      scheduled_end_at: string | null;
      is_all_day: number;
      status: string;
    }>;

    return {
      scheduleItems: rows.map(formatItem),
      scheduledTasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        scheduledAt: t.scheduled_at,
        scheduledEndAt: t.scheduled_end_at,
        isAllDay: t.is_all_day === 1,
        status: t.status,
      })),
    };
  }

  // Single date query (original behavior)
  const date = args.date ?? new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT * FROM schedule_items WHERE date = ? AND is_dismissed = 0 AND is_deleted = 0
       ORDER BY start_time ASC, created_at ASC`,
    )
    .all(date) as ScheduleItemRow[];

  const tasks = db
    .prepare(
      `SELECT id, title, scheduled_at, scheduled_end_at, is_all_day, status
       FROM tasks WHERE is_deleted = 0 AND scheduled_at IS NOT NULL
       AND date(scheduled_at) = ?
       ORDER BY scheduled_at ASC`,
    )
    .all(date) as Array<{
    id: string;
    title: string;
    scheduled_at: string;
    scheduled_end_at: string | null;
    is_all_day: number;
    status: string;
  }>;

  return {
    scheduleItems: rows.map(formatItem),
    scheduledTasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      scheduledAt: t.scheduled_at,
      scheduledEndAt: t.scheduled_end_at,
      isAllDay: t.is_all_day === 1,
      status: t.status,
    })),
  };
}

export function createScheduleItem(args: {
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  is_all_day?: boolean;
  note_id?: string;
  content?: string;
}) {
  const db = getDb();
  const id = `si-${randomUUID()}`;

  db.prepare(
    `INSERT INTO schedule_items (id, date, title, start_time, end_time, completed, completed_at, routine_id, template_id, note_id, is_all_day, content, created_at, updated_at)
     VALUES (@id, @date, @title, @start_time, @end_time, 0, NULL, NULL, NULL, @note_id, @is_all_day, @content, datetime('now'), datetime('now'))`,
  ).run({
    id,
    date: args.date,
    title: args.title,
    start_time: args.start_time,
    end_time: args.end_time,
    note_id: args.note_id ?? null,
    is_all_day: args.is_all_day ? 1 : 0,
    content: args.content ?? null,
  });

  const row = db
    .prepare("SELECT * FROM schedule_items WHERE id = ?")
    .get(id) as ScheduleItemRow;
  return formatItem(row);
}

export function updateScheduleItem(args: {
  id: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  memo?: string;
  is_all_day?: boolean;
  content?: string;
}) {
  const db = getDb();

  const existing = db
    .prepare("SELECT * FROM schedule_items WHERE id = ?")
    .get(args.id) as ScheduleItemRow | undefined;
  if (!existing) throw new Error(`Schedule item not found: ${args.id}`);

  const updates: string[] = [];
  const params: Record<string, unknown> = { id: args.id };

  if (args.title !== undefined) {
    updates.push("title = @title");
    params.title = args.title;
  }
  if (args.start_time !== undefined) {
    updates.push("start_time = @start_time");
    params.start_time = args.start_time;
  }
  if (args.end_time !== undefined) {
    updates.push("end_time = @end_time");
    params.end_time = args.end_time;
  }
  if (args.memo !== undefined) {
    updates.push("memo = @memo");
    params.memo = args.memo;
  }
  if (args.is_all_day !== undefined) {
    updates.push("is_all_day = @is_all_day");
    params.is_all_day = args.is_all_day ? 1 : 0;
  }
  if (args.content !== undefined) {
    updates.push("content = @content");
    params.content = args.content;
  }

  if (updates.length === 0) return formatItem(existing);

  updates.push("version = version + 1");
  updates.push("updated_at = datetime('now')");
  db.prepare(
    `UPDATE schedule_items SET ${updates.join(", ")} WHERE id = @id`,
  ).run(params);

  const row = db
    .prepare("SELECT * FROM schedule_items WHERE id = ?")
    .get(args.id) as ScheduleItemRow;
  return formatItem(row);
}

export function dismissScheduleItem(args: { id: string }) {
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM schedule_items WHERE id = ?")
    .get(args.id) as { id: string } | undefined;
  if (!existing) throw new Error(`Schedule item not found: ${args.id}`);

  db.prepare(
    `UPDATE schedule_items SET is_dismissed = 1, version = version + 1,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(args.id);

  const row = db
    .prepare("SELECT * FROM schedule_items WHERE id = ?")
    .get(args.id) as ScheduleItemRow;
  return formatItem(row);
}

export function undismissScheduleItem(args: { id: string }) {
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM schedule_items WHERE id = ?")
    .get(args.id) as { id: string } | undefined;
  if (!existing) throw new Error(`Schedule item not found: ${args.id}`);

  db.prepare(
    `UPDATE schedule_items SET is_dismissed = 0, version = version + 1,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(args.id);

  const row = db
    .prepare("SELECT * FROM schedule_items WHERE id = ?")
    .get(args.id) as ScheduleItemRow;
  return formatItem(row);
}

export function deleteScheduleItem(args: { id: string }) {
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM schedule_items WHERE id = ?")
    .get(args.id) as { id: string } | undefined;
  if (!existing) throw new Error(`Schedule item not found: ${args.id}`);

  db.prepare("DELETE FROM schedule_items WHERE id = ?").run(args.id);
  return { success: true, id: args.id };
}

export function toggleScheduleComplete(args: { id: string }) {
  const db = getDb();

  const existing = db
    .prepare("SELECT * FROM schedule_items WHERE id = ?")
    .get(args.id) as ScheduleItemRow | undefined;
  if (!existing) throw new Error(`Schedule item not found: ${args.id}`);

  const newCompleted = existing.completed === 1 ? 0 : 1;
  const completedAt = newCompleted === 1 ? new Date().toISOString() : null;

  db.prepare(
    `UPDATE schedule_items SET completed = @completed, completed_at = @completed_at,
     version = version + 1, updated_at = datetime('now') WHERE id = @id`,
  ).run({
    id: args.id,
    completed: newCompleted,
    completed_at: completedAt,
  });

  const row = db
    .prepare("SELECT * FROM schedule_items WHERE id = ?")
    .get(args.id) as ScheduleItemRow;
  return formatItem(row);
}
