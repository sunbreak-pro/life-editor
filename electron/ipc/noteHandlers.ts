import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
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
    loggedHandler("Notes", "create", (_event, id: string, title: string) =>
      repo.create(id, title),
    ),
  );

  ipcMain.handle(
    "db:notes:update",
    loggedHandler(
      "Notes",
      "update",
      (
        _event,
        id: string,
        updates: { title?: string; content?: string; isPinned?: boolean },
      ) => repo.update(id, updates),
    ),
  );

  ipcMain.handle(
    "db:notes:softDelete",
    loggedHandler("Notes", "softDelete", (_event, id: string) =>
      repo.softDelete(id),
    ),
  );

  ipcMain.handle(
    "db:notes:restore",
    loggedHandler("Notes", "restore", (_event, id: string) => repo.restore(id)),
  );

  ipcMain.handle(
    "db:notes:permanentDelete",
    loggedHandler("Notes", "permanentDelete", (_event, id: string) =>
      repo.permanentDelete(id),
    ),
  );

  ipcMain.handle(
    "db:notes:search",
    loggedHandler("Notes", "search", (_event, query: string) =>
      repo.search(query),
    ),
  );

  // Note tag handlers moved to tagHandlers.ts (db:noteTags:*)
}
