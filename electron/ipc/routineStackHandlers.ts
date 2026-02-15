import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { RoutineStackRepository } from "../database/routineStackRepository";
import type { RoutineStack } from "../types";

export function registerRoutineStackHandlers(
  repo: RoutineStackRepository,
): void {
  ipcMain.handle(
    "db:routineStacks:fetchAll",
    loggedHandler("RoutineStacks", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:routineStacks:create",
    loggedHandler(
      "RoutineStacks",
      "create",
      (_event, id: string, name: string) => {
        return repo.create(id, name);
      },
    ),
  );

  ipcMain.handle(
    "db:routineStacks:update",
    loggedHandler(
      "RoutineStacks",
      "update",
      (
        _event,
        id: string,
        updates: Partial<Pick<RoutineStack, "name" | "order">>,
      ) => {
        return repo.update(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:routineStacks:delete",
    loggedHandler("RoutineStacks", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );

  ipcMain.handle(
    "db:routineStacks:addItem",
    loggedHandler(
      "RoutineStacks",
      "addItem",
      (_event, stackId: string, routineId: string) => {
        repo.addItem(stackId, routineId);
      },
    ),
  );

  ipcMain.handle(
    "db:routineStacks:removeItem",
    loggedHandler(
      "RoutineStacks",
      "removeItem",
      (_event, stackId: string, routineId: string) => {
        repo.removeItem(stackId, routineId);
      },
    ),
  );

  ipcMain.handle(
    "db:routineStacks:reorderItems",
    loggedHandler(
      "RoutineStacks",
      "reorderItems",
      (_event, stackId: string, routineIds: string[]) => {
        repo.reorderItems(stackId, routineIds);
      },
    ),
  );
}
