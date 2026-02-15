import { ipcMain } from "electron";
import log from "../logger";
import type { RoutineStackRepository } from "../database/routineStackRepository";
import type { RoutineStack } from "../types";

export function registerRoutineStackHandlers(
  repo: RoutineStackRepository,
): void {
  ipcMain.handle("db:routineStacks:fetchAll", () => {
    try {
      return repo.fetchAll();
    } catch (e) {
      log.error("[RoutineStacks] fetchAll failed:", e);
      throw e;
    }
  });

  ipcMain.handle(
    "db:routineStacks:create",
    (_event, id: string, name: string) => {
      try {
        return repo.create(id, name);
      } catch (e) {
        log.error("[RoutineStacks] create failed:", e);
        throw e;
      }
    },
  );

  ipcMain.handle(
    "db:routineStacks:update",
    (
      _event,
      id: string,
      updates: Partial<Pick<RoutineStack, "name" | "order">>,
    ) => {
      try {
        return repo.update(id, updates);
      } catch (e) {
        log.error("[RoutineStacks] update failed:", e);
        throw e;
      }
    },
  );

  ipcMain.handle("db:routineStacks:delete", (_event, id: string) => {
    try {
      repo.delete(id);
    } catch (e) {
      log.error("[RoutineStacks] delete failed:", e);
      throw e;
    }
  });

  ipcMain.handle(
    "db:routineStacks:addItem",
    (_event, stackId: string, routineId: string) => {
      try {
        repo.addItem(stackId, routineId);
      } catch (e) {
        log.error("[RoutineStacks] addItem failed:", e);
        throw e;
      }
    },
  );

  ipcMain.handle(
    "db:routineStacks:removeItem",
    (_event, stackId: string, routineId: string) => {
      try {
        repo.removeItem(stackId, routineId);
      } catch (e) {
        log.error("[RoutineStacks] removeItem failed:", e);
        throw e;
      }
    },
  );

  ipcMain.handle(
    "db:routineStacks:reorderItems",
    (_event, stackId: string, routineIds: string[]) => {
      try {
        repo.reorderItems(stackId, routineIds);
      } catch (e) {
        log.error("[RoutineStacks] reorderItems failed:", e);
        throw e;
      }
    },
  );
}
