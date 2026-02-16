import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { RoutineTemplateRepository } from "../database/routineTemplateRepository";
import type { RoutineTemplate } from "../types";

export function registerRoutineTemplateHandlers(
  repo: RoutineTemplateRepository,
): void {
  ipcMain.handle(
    "db:routineTemplates:fetchAll",
    loggedHandler("RoutineTemplates", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:routineTemplates:create",
    loggedHandler(
      "RoutineTemplates",
      "create",
      (
        _event,
        id: string,
        name: string,
        frequencyType?: string,
        frequencyDays?: number[],
      ) => {
        return repo.create(id, name, frequencyType, frequencyDays);
      },
    ),
  );

  ipcMain.handle(
    "db:routineTemplates:update",
    loggedHandler(
      "RoutineTemplates",
      "update",
      (
        _event,
        id: string,
        updates: Partial<
          Pick<
            RoutineTemplate,
            "name" | "frequencyType" | "frequencyDays" | "order"
          >
        >,
      ) => {
        return repo.update(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:routineTemplates:delete",
    loggedHandler("RoutineTemplates", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );

  ipcMain.handle(
    "db:routineTemplates:addItem",
    loggedHandler(
      "RoutineTemplates",
      "addItem",
      (_event, templateId: string, routineId: string) => {
        repo.addItem(templateId, routineId);
      },
    ),
  );

  ipcMain.handle(
    "db:routineTemplates:removeItem",
    loggedHandler(
      "RoutineTemplates",
      "removeItem",
      (_event, templateId: string, routineId: string) => {
        repo.removeItem(templateId, routineId);
      },
    ),
  );

  ipcMain.handle(
    "db:routineTemplates:reorderItems",
    loggedHandler(
      "RoutineTemplates",
      "reorderItems",
      (_event, templateId: string, routineIds: string[]) => {
        repo.reorderItems(templateId, routineIds);
      },
    ),
  );
}
