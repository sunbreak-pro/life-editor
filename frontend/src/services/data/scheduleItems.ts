import type { ScheduleItem } from "../../types/schedule";
import { tauriInvoke } from "../bridge";

export const scheduleItemsApi = {
  fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_date", { date });
  },
  fetchScheduleItemsByDateAll(date: string): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_date_all", { date });
  },
  fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_date_range", {
      startDate,
      endDate,
    });
  },
  createScheduleItem(
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
  ): Promise<ScheduleItem> {
    return tauriInvoke("db_schedule_items_create", {
      id,
      date,
      title,
      startTime,
      endTime,
      routineId,
      templateId,
      noteId,
      isAllDay,
      content,
    });
  },
  updateScheduleItem(
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
        | "date"
      >
    >,
  ): Promise<ScheduleItem> {
    return tauriInvoke("db_schedule_items_update", { id, updates });
  },
  deleteScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_delete", { id });
  },
  softDeleteScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_soft_delete", { id });
  },
  restoreScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_restore", { id });
  },
  permanentDeleteScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_permanent_delete", { id });
  },
  fetchDeletedScheduleItems(): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_deleted");
  },
  toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    return tauriInvoke("db_schedule_items_toggle_complete", { id });
  },
  dismissScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_dismiss", { id });
  },
  undismissScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_undismiss", { id });
  },
  fetchLastRoutineDate(): Promise<string | null> {
    return tauriInvoke("db_schedule_items_fetch_last_routine_date");
  },
  bulkCreateScheduleItems(
    items: Array<{
      id: string;
      date: string;
      title: string;
      startTime: string;
      endTime: string;
      routineId?: string;
      templateId?: string;
      noteId?: string;
      reminderEnabled?: boolean;
      reminderOffset?: number;
    }>,
  ): Promise<void> {
    return tauriInvoke("db_schedule_items_bulk_create", { items });
  },
  updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
  ): Promise<number> {
    return tauriInvoke("db_schedule_items_update_future_by_routine", {
      routineId,
      updates,
      fromDate,
    });
  },
  fetchScheduleItemsByRoutineId(routineId: string): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_routine_id", {
      routineId,
    });
  },
  bulkDeleteScheduleItems(ids: string[]): Promise<number> {
    return tauriInvoke("db_schedule_items_bulk_delete", { ids });
  },
  fetchEvents(): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_events");
  },
};
