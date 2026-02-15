import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
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
    loggedHandler("Memo", "upsert", (_event, date: string, content: string) =>
      repo.upsert(date, content),
    ),
  );

  ipcMain.handle(
    "db:memo:delete",
    loggedHandler("Memo", "delete", (_event, date: string) =>
      repo.delete(date),
    ),
  );
}
