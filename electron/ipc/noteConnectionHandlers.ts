import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { NoteConnectionRepository } from "../database/noteConnectionRepository";

export function registerNoteConnectionHandlers(
  repo: NoteConnectionRepository,
): void {
  ipcMain.handle(
    "db:noteConnections:fetchAll",
    loggedHandler("NoteConnections", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:noteConnections:create",
    loggedHandler(
      "NoteConnections",
      "create",
      (_event, sourceNoteId: string, targetNoteId: string) => {
        return repo.create(sourceNoteId, targetNoteId);
      },
    ),
  );

  ipcMain.handle(
    "db:noteConnections:delete",
    loggedHandler("NoteConnections", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );

  ipcMain.handle(
    "db:noteConnections:deleteByNotePair",
    loggedHandler(
      "NoteConnections",
      "deleteByNotePair",
      (_event, sourceNoteId: string, targetNoteId: string) => {
        repo.deleteByNotePair(sourceNoteId, targetNoteId);
      },
    ),
  );
}
