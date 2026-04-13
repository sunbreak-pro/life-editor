import { query, mutation } from "./handlerUtil";
import type { ScheduleItemRepository } from "../database/scheduleItemRepository";
import type { ScheduleItem } from "../types";

export function registerScheduleItemHandlers(
  repo: ScheduleItemRepository,
): void {
  query(
    "db:scheduleItems:fetchByDate",
    "ScheduleItems",
    "fetchByDate",
    (_event, date: string) => {
      return repo.fetchByDate(date);
    },
  );

  query(
    "db:scheduleItems:fetchByDateAll",
    "ScheduleItems",
    "fetchByDateAll",
    (_event, date: string) => {
      return repo.fetchByDateAll(date);
    },
  );

  query(
    "db:scheduleItems:fetchByDateRange",
    "ScheduleItems",
    "fetchByDateRange",
    (_event, startDate: string, endDate: string) => {
      return repo.fetchByDateRange(startDate, endDate);
    },
  );

  mutation(
    "db:scheduleItems:create",
    "ScheduleItems",
    "create",
    "scheduleItem",
    "create",
    (
      _event,
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
      reminderEnabled?: boolean,
      reminderOffset?: number,
    ) => {
      return repo.create(
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
        reminderEnabled,
        reminderOffset,
      );
    },
  );

  mutation(
    "db:scheduleItems:update",
    "ScheduleItems",
    "update",
    "scheduleItem",
    "update",
    (
      _event,
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
          | "reminderEnabled"
          | "reminderOffset"
        >
      >,
    ) => {
      return repo.update(id, updates);
    },
  );

  query("db:scheduleItems:fetchEvents", "ScheduleItems", "fetchEvents", () => {
    return repo.fetchEvents();
  });

  mutation(
    "db:scheduleItems:delete",
    "ScheduleItems",
    "delete",
    "scheduleItem",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  mutation(
    "db:scheduleItems:toggleComplete",
    "ScheduleItems",
    "toggleComplete",
    "scheduleItem",
    "update",
    (_event, id: string) => {
      return repo.toggleComplete(id);
    },
  );

  mutation(
    "db:scheduleItems:dismiss",
    "ScheduleItems",
    "dismiss",
    "scheduleItem",
    "update",
    (_event, id: string) => {
      repo.dismiss(id);
    },
  );

  mutation(
    "db:scheduleItems:undismiss",
    "ScheduleItems",
    "undismiss",
    "scheduleItem",
    "update",
    (_event, id: string) => {
      repo.undismiss(id);
    },
  );

  mutation(
    "db:scheduleItems:updateFutureByRoutine",
    "ScheduleItems",
    "updateFutureByRoutine",
    "scheduleItem",
    "bulk",
    (
      _event,
      routineId: string,
      updates: { title?: string; startTime?: string; endTime?: string },
      fromDate: string,
    ) => {
      return repo.updateFutureByRoutine(routineId, updates, fromDate);
    },
    () => undefined,
  );

  query(
    "db:scheduleItems:fetchLastRoutineDate",
    "ScheduleItems",
    "fetchLastRoutineDate",
    () => {
      return repo.fetchLastRoutineDate();
    },
  );

  mutation(
    "db:scheduleItems:bulkCreate",
    "ScheduleItems",
    "bulkCreate",
    "scheduleItem",
    "bulk",
    (
      _event,
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
    ) => {
      return repo.bulkCreate(items);
    },
    () => undefined,
  );

  query(
    "db:scheduleItems:fetchByRoutineId",
    "ScheduleItems",
    "fetchByRoutineId",
    (_event, routineId: string) => {
      return repo.fetchByRoutineId(routineId);
    },
  );

  mutation(
    "db:scheduleItems:bulkDelete",
    "ScheduleItems",
    "bulkDelete",
    "scheduleItem",
    "bulk",
    (_event, ids: string[]) => {
      return repo.bulkDelete(ids);
    },
    () => undefined,
  );

  query(
    "db:scheduleItems:fetchDeleted",
    "ScheduleItems",
    "fetchDeleted",
    () => {
      return repo.fetchDeleted();
    },
  );

  mutation(
    "db:scheduleItems:softDelete",
    "ScheduleItems",
    "softDelete",
    "scheduleItem",
    "delete",
    (_event, id: string) => {
      repo.softDelete(id);
    },
  );

  mutation(
    "db:scheduleItems:restore",
    "ScheduleItems",
    "restore",
    "scheduleItem",
    "update",
    (_event, id: string) => {
      repo.restore(id);
    },
  );

  mutation(
    "db:scheduleItems:permanentDelete",
    "ScheduleItems",
    "permanentDelete",
    "scheduleItem",
    "delete",
    (_event, id: string) => {
      repo.permanentDelete(id);
    },
  );
}
