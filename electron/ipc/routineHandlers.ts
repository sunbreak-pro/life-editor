import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { RoutineRepository } from "../database/routineRepository";
import type { RoutineNode } from "../types";

export function registerRoutineHandlers(repo: RoutineRepository): void {
  ipcMain.handle(
    "db:routines:fetchAll",
    loggedHandler("Routines", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:routines:create",
    loggedHandler(
      "Routines",
      "create",
      (
        _event,
        id: string,
        title: string,
        frequencyType: string,
        frequencyDays: number[],
        timesPerWeek?: number,
        timeSlot?: string,
        soundPresetId?: string,
      ) => {
        return repo.create(
          id,
          title,
          frequencyType,
          frequencyDays,
          timesPerWeek,
          timeSlot,
          soundPresetId,
        );
      },
    ),
  );

  ipcMain.handle(
    "db:routines:update",
    loggedHandler(
      "Routines",
      "update",
      (
        _event,
        id: string,
        updates: Partial<
          Pick<
            RoutineNode,
            | "title"
            | "frequencyType"
            | "frequencyDays"
            | "timesPerWeek"
            | "timeSlot"
            | "soundPresetId"
            | "isArchived"
            | "order"
          >
        >,
      ) => {
        return repo.update(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:routines:delete",
    loggedHandler("Routines", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );

  ipcMain.handle(
    "db:routines:fetchLogs",
    loggedHandler("Routines", "fetchLogs", (_event, routineId: string) => {
      return repo.fetchLogs(routineId);
    }),
  );

  ipcMain.handle(
    "db:routines:toggleLog",
    loggedHandler(
      "Routines",
      "toggleLog",
      (_event, routineId: string, date: string) => {
        return repo.toggleLog(routineId, date);
      },
    ),
  );

  ipcMain.handle(
    "db:routines:fetchLogsByDateRange",
    loggedHandler(
      "Routines",
      "fetchLogsByDateRange",
      (_event, startDate: string, endDate: string) => {
        return repo.fetchLogsByDateRange(startDate, endDate);
      },
    ),
  );
}
