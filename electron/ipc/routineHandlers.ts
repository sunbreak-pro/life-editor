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
        tagId?: number | null,
      ) => {
        return repo.create(id, title, startTime, endTime, tagId);
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
            "title" | "startTime" | "endTime" | "isArchived" | "order" | "tagId"
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
}
