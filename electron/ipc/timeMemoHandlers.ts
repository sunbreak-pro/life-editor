import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { TimeMemoRepository } from "../database/timeMemoRepository";

export function registerTimeMemoHandlers(repo: TimeMemoRepository): void {
  ipcMain.handle(
    "db:timeMemos:fetchByDate",
    loggedHandler("TimeMemos", "fetchByDate", (_event, date: string) => {
      return repo.fetchByDate(date);
    }),
  );

  ipcMain.handle(
    "db:timeMemos:upsert",
    loggedHandler(
      "TimeMemos",
      "upsert",
      (_event, id: string, date: string, hour: number, content: string) => {
        return repo.upsert(id, date, hour, content);
      },
    ),
  );

  ipcMain.handle(
    "db:timeMemos:delete",
    loggedHandler("TimeMemos", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );
}
