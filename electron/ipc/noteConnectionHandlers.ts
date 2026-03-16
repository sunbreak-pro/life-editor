import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
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
        const result = repo.create(sourceNoteId, targetNoteId);
        broadcastChange("noteConnection", "create", result?.id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:noteConnections:delete",
    loggedHandler("NoteConnections", "delete", (_event, id: string) => {
      repo.delete(id);
      broadcastChange("noteConnection", "delete", id);
    }),
  );

  ipcMain.handle(
    "db:noteConnections:deleteByNotePair",
    loggedHandler(
      "NoteConnections",
      "deleteByNotePair",
      (_event, sourceNoteId: string, targetNoteId: string) => {
        repo.deleteByNotePair(sourceNoteId, targetNoteId);
        broadcastChange("noteConnection", "delete");
      },
    ),
  );
}
