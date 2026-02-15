import { ipcMain } from "electron";
import log from "../logger";
import type { RoutineRepository } from "../database/routineRepository";
import type { RoutineNode } from "../types";

export function registerRoutineHandlers(repo: RoutineRepository): void {
  ipcMain.handle("db:routines:fetchAll", () => {
    try {
      return repo.fetchAll();
    } catch (e) {
      log.error("[Routines] fetchAll failed:", e);
      throw e;
    }
  });

  ipcMain.handle(
    "db:routines:create",
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
      try {
        return repo.create(
          id,
          title,
          frequencyType,
          frequencyDays,
          timesPerWeek,
          timeSlot,
          soundPresetId,
        );
      } catch (e) {
        log.error("[Routines] create failed:", e);
        throw e;
      }
    },
  );

  ipcMain.handle(
    "db:routines:update",
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
      try {
        return repo.update(id, updates);
      } catch (e) {
        log.error("[Routines] update failed:", e);
        throw e;
      }
    },
  );

  ipcMain.handle("db:routines:delete", (_event, id: string) => {
    try {
      repo.delete(id);
    } catch (e) {
      log.error("[Routines] delete failed:", e);
      throw e;
    }
  });

  ipcMain.handle("db:routines:fetchLogs", (_event, routineId: string) => {
    try {
      return repo.fetchLogs(routineId);
    } catch (e) {
      log.error("[Routines] fetchLogs failed:", e);
      throw e;
    }
  });

  ipcMain.handle(
    "db:routines:toggleLog",
    (_event, routineId: string, date: string) => {
      try {
        return repo.toggleLog(routineId, date);
      } catch (e) {
        log.error("[Routines] toggleLog failed:", e);
        throw e;
      }
    },
  );

  ipcMain.handle(
    "db:routines:fetchLogsByDateRange",
    (_event, startDate: string, endDate: string) => {
      try {
        return repo.fetchLogsByDateRange(startDate, endDate);
      } catch (e) {
        log.error("[Routines] fetchLogsByDateRange failed:", e);
        throw e;
      }
    },
  );
}
