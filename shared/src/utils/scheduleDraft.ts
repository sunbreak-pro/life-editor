import type { ScheduleItem } from "../types/schedule";

/*
 * Optimistic ScheduleItem factory (#280, extracted from CalendarTab). The
 * host inserts this local row into its visible-range store the moment a
 * create is issued, so the grid shows the new event before the INSERT
 * settles; the next range fetch replaces it with the server row.
 */

/** Local optimistic row for a just-created event (defaults mirror the
 *  provider's create: manual, timed, not completed, nothing attached).
 *
 *  `reminderOffset` is the reminder the create resolved (#1642 P6, N-12).
 *  The editor reads this row before the server's, so leaving it off made
 *  "create and open" show an empty reminder for an event that has one.
 *  Omitted = the row says nothing about reminders, as before. */
export function makeOptimisticScheduleItem(
  id: string,
  date: string,
  title: string,
  startTime: string,
  endTime: string,
  reminderOffset?: number | null,
): ScheduleItem {
  const now = new Date().toISOString();
  return {
    id,
    date,
    title,
    startTime,
    endTime,
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    isAllDay: false,
    ...(reminderOffset !== undefined
      ? { reminderEnabled: reminderOffset !== null, reminderOffset }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}
