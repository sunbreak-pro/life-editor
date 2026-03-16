import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
import type { RoutineTagRepository } from "../database/routineTagRepository";
import type { RoutineTag } from "../types";

export function registerRoutineTagHandlers(repo: RoutineTagRepository): void {
  ipcMain.handle(
    "db:routineTags:fetchAll",
    loggedHandler("RoutineTags", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:routineTags:create",
    loggedHandler(
      "RoutineTags",
      "create",
      (_event, name: string, color: string) => {
        const result = repo.create(name, color);
        broadcastChange("routineTag", "create", result?.id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:routineTags:update",
    loggedHandler(
      "RoutineTags",
      "update",
      (
        _event,
        id: number,
        updates: Partial<
          Pick<RoutineTag, "name" | "color" | "textColor" | "order">
        >,
      ) => {
        const result = repo.update(id, updates);
        broadcastChange("routineTag", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:routineTags:delete",
    loggedHandler("RoutineTags", "delete", (_event, id: number) => {
      repo.delete(id);
      broadcastChange("routineTag", "delete", id);
    }),
  );

  ipcMain.handle(
    "db:routineTags:fetchTagsForRoutine",
    loggedHandler(
      "RoutineTags",
      "fetchTagsForRoutine",
      (_event, routineId: string) => {
        return repo.fetchTagsForRoutine(routineId);
      },
    ),
  );

  ipcMain.handle(
    "db:routineTags:setTagsForRoutine",
    loggedHandler(
      "RoutineTags",
      "setTagsForRoutine",
      (_event, routineId: string, tagIds: number[]) => {
        repo.setTagsForRoutine(routineId, tagIds);
        broadcastChange("routineTag", "bulk", routineId);
      },
    ),
  );

  ipcMain.handle(
    "db:routineTags:fetchAllAssignments",
    loggedHandler("RoutineTags", "fetchAllAssignments", () => {
      return repo.fetchAllAssignments();
    }),
  );
}
