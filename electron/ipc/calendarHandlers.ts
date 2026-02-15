import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { CalendarRepository } from "../database/calendarRepository";

export function registerCalendarHandlers(repo: CalendarRepository): void {
  ipcMain.handle(
    "db:calendars:fetchAll",
    loggedHandler("Calendars", "fetchAll", () => repo.fetchAll()),
  );

  ipcMain.handle(
    "db:calendars:create",
    loggedHandler(
      "Calendars",
      "create",
      (_event, id: string, title: string, folderId: string) =>
        repo.create(id, title, folderId),
    ),
  );

  ipcMain.handle(
    "db:calendars:update",
    loggedHandler(
      "Calendars",
      "update",
      (
        _event,
        id: string,
        updates: { title?: string; folderId?: string; order?: number },
      ) => repo.update(id, updates),
    ),
  );

  ipcMain.handle(
    "db:calendars:delete",
    loggedHandler("Calendars", "delete", (_event, id: string) =>
      repo.delete(id),
    ),
  );
}
