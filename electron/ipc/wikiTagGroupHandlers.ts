import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
import type { WikiTagGroupRepository } from "../database/wikiTagGroupRepository";

export function registerWikiTagGroupHandlers(
  repo: WikiTagGroupRepository,
): void {
  ipcMain.handle(
    "db:wikiTagGroups:fetchAll",
    loggedHandler("WikiTagGroups", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:wikiTagGroups:create",
    loggedHandler(
      "WikiTagGroups",
      "create",
      (_event, name: string, noteIds: string[], filterTags?: string[]) => {
        const result = repo.create(name, noteIds, filterTags);
        broadcastChange("wikiTagGroup", "create", result?.id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:update",
    loggedHandler(
      "WikiTagGroups",
      "update",
      (
        _event,
        id: string,
        updates: { name?: string; filterTags?: string[] },
      ) => {
        const result = repo.update(id, updates);
        broadcastChange("wikiTagGroup", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:delete",
    loggedHandler("WikiTagGroups", "delete", (_event, id: string) => {
      repo.delete(id);
      broadcastChange("wikiTagGroup", "delete", id);
    }),
  );

  ipcMain.handle(
    "db:wikiTagGroups:fetchAllMembers",
    loggedHandler("WikiTagGroups", "fetchAllMembers", () => {
      return repo.fetchAllMembers();
    }),
  );

  ipcMain.handle(
    "db:wikiTagGroups:setMembers",
    loggedHandler(
      "WikiTagGroups",
      "setMembers",
      (_event, groupId: string, noteIds: string[]) => {
        repo.setMembers(groupId, noteIds);
        broadcastChange("wikiTagGroup", "update", groupId);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:addMember",
    loggedHandler(
      "WikiTagGroups",
      "addMember",
      (_event, groupId: string, noteId: string) => {
        repo.addMember(groupId, noteId);
        broadcastChange("wikiTagGroup", "update", groupId);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:removeMember",
    loggedHandler(
      "WikiTagGroups",
      "removeMember",
      (_event, groupId: string, noteId: string) => {
        repo.removeMember(groupId, noteId);
        broadcastChange("wikiTagGroup", "update", groupId);
      },
    ),
  );
}
