import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
import type { NoteRepository } from "../database/noteRepository";

export function registerNoteHandlers(repo: NoteRepository): void {
  ipcMain.handle(
    "db:notes:fetchAll",
    loggedHandler("Notes", "fetchAll", () => repo.fetchAll()),
  );

  ipcMain.handle(
    "db:notes:fetchDeleted",
    loggedHandler("Notes", "fetchDeleted", () => repo.fetchDeleted()),
  );

  ipcMain.handle(
    "db:notes:create",
    loggedHandler("Notes", "create", (_event, id: string, title: string) => {
      const result = repo.create(id, title);
      broadcastChange("note", "create", id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:notes:update",
    loggedHandler(
      "Notes",
      "update",
      (
        _event,
        id: string,
        updates: {
          title?: string;
          content?: string;
          isPinned?: boolean;
          color?: string;
        },
      ) => {
        const result = repo.update(id, updates);
        broadcastChange("note", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:notes:softDelete",
    loggedHandler("Notes", "softDelete", (_event, id: string) => {
      const result = repo.softDelete(id);
      broadcastChange("note", "delete", id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:notes:restore",
    loggedHandler("Notes", "restore", (_event, id: string) => {
      const result = repo.restore(id);
      broadcastChange("note", "update", id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:notes:permanentDelete",
    loggedHandler("Notes", "permanentDelete", (_event, id: string) => {
      const result = repo.permanentDelete(id);
      broadcastChange("note", "delete", id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:notes:search",
    loggedHandler("Notes", "search", (_event, query: string) =>
      repo.search(query),
    ),
  );

  // Note tag handlers moved to tagHandlers.ts (db:noteTags:*)
}
