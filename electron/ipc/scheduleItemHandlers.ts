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
        >
      >,
    ) => {
      return repo.update(id, updates);
    },
  );

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
      }>,
    ) => {
      return repo.bulkCreate(items);
    },
    () => undefined,
  );
}
