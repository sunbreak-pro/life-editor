import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { WikiTagRepository } from "../database/wikiTagRepository";
import type { WikiTag } from "../types";

export function registerWikiTagHandlers(repo: WikiTagRepository): void {
  ipcMain.handle(
    "db:wikiTags:fetchAll",
    loggedHandler("WikiTags", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:wikiTags:search",
    loggedHandler("WikiTags", "search", (_event, query: string) => {
      return repo.search(query);
    }),
  );

  ipcMain.handle(
    "db:wikiTags:create",
    loggedHandler(
      "WikiTags",
      "create",
      (_event, name: string, color: string) => {
        return repo.create(name, color);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:update",
    loggedHandler(
      "WikiTags",
      "update",
      (
        _event,
        id: string,
        updates: Partial<Pick<WikiTag, "name" | "color">>,
      ) => {
        return repo.update(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:delete",
    loggedHandler("WikiTags", "delete", (_event, id: string) => {
      repo.delete(id);
    }),
  );

  ipcMain.handle(
    "db:wikiTags:merge",
    loggedHandler(
      "WikiTags",
      "merge",
      (_event, sourceId: string, targetId: string) => {
        return repo.merge(sourceId, targetId);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:fetchForEntity",
    loggedHandler("WikiTags", "fetchForEntity", (_event, entityId: string) => {
      return repo.fetchTagsForEntity(entityId);
    }),
  );

  ipcMain.handle(
    "db:wikiTags:setForEntity",
    loggedHandler(
      "WikiTags",
      "setForEntity",
      (_event, entityId: string, entityType: string, tagIds: string[]) => {
        repo.setTagsForEntity(entityId, entityType, tagIds);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:syncInline",
    loggedHandler(
      "WikiTags",
      "syncInline",
      (_event, entityId: string, entityType: string, tagNames: string[]) => {
        repo.syncInlineTags(entityId, entityType, tagNames);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:fetchAllAssignments",
    loggedHandler("WikiTags", "fetchAllAssignments", () => {
      return repo.fetchAllAssignments();
    }),
  );
}
