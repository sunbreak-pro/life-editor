import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
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
      (_event, name: string, tagIds: string[]) => {
        return repo.create(name, tagIds);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:update",
    loggedHandler(
      "WikiTagGroups",
      "update",
      (_event, id: string, updates: { name: string }) => {
        return repo.update(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:delete",
    loggedHandler("WikiTagGroups", "delete", (_event, id: string) => {
      repo.delete(id);
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
      (_event, groupId: string, tagIds: string[]) => {
        repo.setMembers(groupId, tagIds);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:addMember",
    loggedHandler(
      "WikiTagGroups",
      "addMember",
      (_event, groupId: string, tagId: string) => {
        repo.addMember(groupId, tagId);
      },
    ),
  );

  ipcMain.handle(
    "db:wikiTagGroups:removeMember",
    loggedHandler(
      "WikiTagGroups",
      "removeMember",
      (_event, groupId: string, tagId: string) => {
        repo.removeMember(groupId, tagId);
      },
    ),
  );
}
