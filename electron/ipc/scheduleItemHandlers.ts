import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
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
        const result = repo.create(
          id,
          date,
          title,
          startTime,
          endTime,
          routineId,
          templateId,
        );
        broadcastChange("scheduleItem", "create", id);
        return result;
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
        const result = repo.update(id, updates);
        broadcastChange("scheduleItem", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:scheduleItems:delete",
    loggedHandler("ScheduleItems", "delete", (_event, id: string) => {
      repo.delete(id);
      broadcastChange("scheduleItem", "delete", id);
    }),
  );

  ipcMain.handle(
    "db:scheduleItems:toggleComplete",
    loggedHandler("ScheduleItems", "toggleComplete", (_event, id: string) => {
      const result = repo.toggleComplete(id);
      broadcastChange("scheduleItem", "update", id);
      return result;
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
        const result = repo.bulkCreate(items);
        broadcastChange("scheduleItem", "bulk");
        return result;
      },
    ),
  );
}
