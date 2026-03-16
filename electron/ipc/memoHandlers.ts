import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
import type { MemoRepository } from "../database/memoRepository";

export function registerMemoHandlers(repo: MemoRepository): void {
  ipcMain.handle(
    "db:memo:fetchAll",
    loggedHandler("Memo", "fetchAll", () => repo.fetchAll()),
  );

  ipcMain.handle(
    "db:memo:fetchByDate",
    loggedHandler("Memo", "fetchByDate", (_event, date: string) =>
      repo.fetchByDate(date),
    ),
  );

  ipcMain.handle(
    "db:memo:upsert",
    loggedHandler("Memo", "upsert", (_event, date: string, content: string) => {
      const result = repo.upsert(date, content);
      broadcastChange("memo", "update", date);
      return result;
    }),
  );

  ipcMain.handle(
    "db:memo:delete",
    loggedHandler("Memo", "delete", (_event, date: string) => {
      const result = repo.delete(date);
      broadcastChange("memo", "delete", date);
      return result;
    }),
  );

  ipcMain.handle(
    "db:memo:fetchDeleted",
    loggedHandler("Memo", "fetchDeleted", () => repo.fetchDeleted()),
  );

  ipcMain.handle(
    "db:memo:restore",
    loggedHandler("Memo", "restore", (_event, date: string) => {
      const result = repo.restore(date);
      broadcastChange("memo", "update", date);
      return result;
    }),
  );

  ipcMain.handle(
    "db:memo:permanentDelete",
    loggedHandler("Memo", "permanentDelete", (_event, date: string) => {
      const result = repo.permanentDelete(date);
      broadcastChange("memo", "delete", date);
      return result;
    }),
  );

  ipcMain.handle(
    "db:memo:togglePin",
    loggedHandler("Memo", "togglePin", (_event, date: string) => {
      const result = repo.togglePin(date);
      broadcastChange("memo", "update", date);
      return result;
    }),
  );
}
