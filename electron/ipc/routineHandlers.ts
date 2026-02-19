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
        startTime?: string,
        endTime?: string,
      ) => {
        return repo.create(id, title, startTime, endTime);
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
            "title" | "startTime" | "endTime" | "isArchived" | "order"
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
    "db:routines:fetchDeleted",
    loggedHandler("Routines", "fetchDeleted", () => {
      return repo.fetchDeleted();
    }),
  );

  ipcMain.handle(
    "db:routines:softDelete",
    loggedHandler("Routines", "softDelete", (_event, id: string) => {
      repo.softDelete(id);
    }),
  );

  ipcMain.handle(
    "db:routines:restore",
    loggedHandler("Routines", "restore", (_event, id: string) => {
      repo.restore(id);
    }),
  );

  ipcMain.handle(
    "db:routines:permanentDelete",
    loggedHandler("Routines", "permanentDelete", (_event, id: string) => {
      repo.permanentDelete(id);
    }),
  );
}
