import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { ScheduleItemRepository } from "../database/scheduleItemRepository";
import type { ScheduleItem } from "../types";

export function registerScheduleItemHandlers(
  repo: ScheduleItemRepository,
): void {
  ipcMain.handle(
    "db:scheduleItems:fetchByDate",
    loggedHandler("ScheduleItems", "fetchByDate", (_event, date: string) => {
      return repo.fetchByDate(date);
    }),
  );

  ipcMain.handle(
    "db:scheduleItems:fetchByDateRange",
    loggedHandler(
      "ScheduleItems",
      "fetchByDateRange",
      (_event, startDate: string, endDate: string) => {
        return repo.fetchByDateRange(startDate, endDate);
      },
    ),
  );

  ipcMain.handle(
    "db:scheduleItems:create",
    loggedHandler(
      "ScheduleItems",
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
      ) => {
        return repo.create(
          id,
          date,
          title,
          startTime,
          endTime,
          routineId,
          templateId,
        );
      },
    ),
  );

  ipcMain.handle(
    "db:scheduleItems:update",
    loggedHandler(
      "ScheduleItems",
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
    ),
  );

  ipcMain.handle(
    "db:scheduleItems:delete",
    loggedHandler("ScheduleItems", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );

  ipcMain.handle(
    "db:scheduleItems:toggleComplete",
    loggedHandler("ScheduleItems", "toggleComplete", (_event, id: string) => {
      return repo.toggleComplete(id);
    }),
  );

  ipcMain.handle(
    "db:scheduleItems:bulkCreate",
    loggedHandler(
      "ScheduleItems",
      "bulkCreate",
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
        }>,
      ) => {
        return repo.bulkCreate(items);
      },
    ),
  );
}
