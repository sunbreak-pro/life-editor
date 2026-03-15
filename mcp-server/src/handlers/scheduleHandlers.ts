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
  memo: string | null;
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
    memo: row.memo ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSchedule(args: { date: string }) {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM schedule_items WHERE date = ? ORDER BY start_time ASC, created_at ASC",
    )
    .all(args.date) as ScheduleItemRow[];

  // Also include tasks scheduled for this date
  const tasks = db
    .prepare(
      `SELECT id, title, scheduled_at, scheduled_end_at, is_all_day, status
       FROM tasks WHERE is_deleted = 0 AND scheduled_at IS NOT NULL
       AND date(scheduled_at) = ?
       ORDER BY scheduled_at ASC`,
    )
    .all(args.date) as Array<{
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
