import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { WikiTagConnectionRepository } from "../database/wikiTagConnectionRepository";

export function registerWikiTagConnectionHandlers(
  repo: WikiTagConnectionRepository,
): void {
  ipcMain.handle(
    "db:wikiTagConnections:fetchAll",
    loggedHandler("WikiTagConnections", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:wikiTagConnections:create",
    loggedHandler(
      "WikiTagConnections",
      "create",
      (_event, sourceTagId: string, targetTagId: string) => {
        return repo.create(sourceTagId, targetTagId);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagConnections:delete",
    loggedHandler("WikiTagConnections", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );

  ipcMain.handle(
    "db:wikiTagConnections:deleteByTagPair",
    loggedHandler(
      "WikiTagConnections",
      "deleteByTagPair",
      (_event, sourceTagId: string, targetTagId: string) => {
        repo.deleteByTagPair(sourceTagId, targetTagId);
      },
    ),
  );
}
