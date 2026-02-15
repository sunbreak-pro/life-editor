import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { TemplateRepository } from "../database/templateRepository";

export function registerTemplateHandlers(repo: TemplateRepository): void {
  ipcMain.handle(
    "db:templates:fetchAll",
    loggedHandler("Templates", "fetchAll", () => {
      return repo.getAll();
    }),
  );

  ipcMain.handle(
    "db:templates:create",
    loggedHandler(
      "Templates",
      "create",
      (_event, name: string, nodesJson: string) => {
        return repo.create(name, nodesJson);
      },
    ),
  );

  ipcMain.handle(
    "db:templates:getById",
    loggedHandler("Templates", "getById", (_event, id: number) => {
      return repo.getById(id);
    }),
  );

  ipcMain.handle(
    "db:templates:delete",
    loggedHandler("Templates", "delete", (_event, id: number) => {
      repo.delete(id);
    }),
  );
}
