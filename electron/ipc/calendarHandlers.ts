import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { CalendarRepository } from "../database/calendarRepository";
import { broadcastChange } from "../server/broadcast";

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
      (_event, id: string, title: string, folderId: string) => {
        const result = repo.create(id, title, folderId);
        broadcastChange("calendar", "create", id);
        return result;
      },
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
      ) => {
        const result = repo.update(id, updates);
        broadcastChange("calendar", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:calendars:delete",
    loggedHandler("Calendars", "delete", (_event, id: string) => {
      repo.delete(id);
      broadcastChange("calendar", "delete", id);
    }),
  );
}
