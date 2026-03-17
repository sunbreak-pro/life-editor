import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { TimeMemoRepository } from "../database/timeMemoRepository";
import { broadcastChange } from "../server/broadcast";

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
        const result = repo.upsert(id, date, hour, content);
        broadcastChange("timeMemo", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:timeMemos:delete",
    loggedHandler("TimeMemos", "delete", (_event, id: string) => {
      repo.delete(id);
      broadcastChange("timeMemo", "delete", id);
    }),
  );
}
