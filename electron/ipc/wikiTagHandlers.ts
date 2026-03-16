import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
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
        const result = repo.create(name, color);
        broadcastChange("wikiTag", "create", result?.id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:createWithId",
    loggedHandler(
      "WikiTags",
      "createWithId",
      (_event, id: string, name: string, color: string) => {
        const result = repo.createWithId(id, name, color);
        broadcastChange("wikiTag", "create", id);
        return result;
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
        updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
      ) => {
        const result = repo.update(id, updates);
        broadcastChange("wikiTag", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:delete",
    loggedHandler("WikiTags", "delete", (_event, id: string) => {
      repo.delete(id);
      broadcastChange("wikiTag", "delete", id);
    }),
  );

  ipcMain.handle(
    "db:wikiTags:merge",
    loggedHandler(
      "WikiTags",
      "merge",
      (_event, sourceId: string, targetId: string) => {
        const result = repo.merge(sourceId, targetId);
        broadcastChange("wikiTag", "bulk");
        return result;
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
        broadcastChange("wikiTagAssignment", "bulk", entityId);
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
        broadcastChange("wikiTagAssignment", "bulk", entityId);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTags:fetchAllAssignments",
    loggedHandler("WikiTags", "fetchAllAssignments", () => {
      return repo.fetchAllAssignments();
    }),
  );

  ipcMain.handle(
    "db:wikiTags:restoreAssignment",
    loggedHandler(
      "WikiTags",
      "restoreAssignment",
      (
        _event,
        tagId: string,
        entityId: string,
        entityType: string,
        source: string,
      ) => {
        repo.restoreAssignment(tagId, entityId, entityType, source);
        broadcastChange("wikiTagAssignment", "create", entityId);
      },
    ),
  );
}
