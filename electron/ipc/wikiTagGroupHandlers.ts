import { query, mutation } from "./handlerUtil";
import type { WikiTagGroupRepository } from "../database/wikiTagGroupRepository";

export function registerWikiTagGroupHandlers(
  repo: WikiTagGroupRepository,
): void {
  query("db:wikiTagGroups:fetchAll", "WikiTagGroups", "fetchAll", () => {
    return repo.fetchAll();
  });

  mutation(
    "db:wikiTagGroups:create",
    "WikiTagGroups",
    "create",
    "wikiTagGroup",
    "create",
    (_event, name: string, noteIds: string[], filterTags?: string[]) => {
      return repo.create(name, noteIds, filterTags);
    },
    (_args, result) => (result as { id?: string })?.id,
  );

  mutation(
    "db:wikiTagGroups:update",
    "WikiTagGroups",
    "update",
    "wikiTagGroup",
    "update",
    (_event, id: string, updates: { name?: string; filterTags?: string[] }) => {
      return repo.update(id, updates);
    },
  );

  mutation(
    "db:wikiTagGroups:delete",
    "WikiTagGroups",
    "delete",
    "wikiTagGroup",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  query(
    "db:wikiTagGroups:fetchAllMembers",
    "WikiTagGroups",
    "fetchAllMembers",
    () => {
      return repo.fetchAllMembers();
    },
  );

  mutation(
    "db:wikiTagGroups:setMembers",
    "WikiTagGroups",
    "setMembers",
    "wikiTagGroup",
    "update",
    (_event, groupId: string, noteIds: string[]) => {
      repo.setMembers(groupId, noteIds);
    },
  );

  mutation(
    "db:wikiTagGroups:addMember",
    "WikiTagGroups",
    "addMember",
    "wikiTagGroup",
    "update",
    (_event, groupId: string, noteId: string) => {
      repo.addMember(groupId, noteId);
    },
  );

  mutation(
    "db:wikiTagGroups:removeMember",
    "WikiTagGroups",
    "removeMember",
    "wikiTagGroup",
    "update",
    (_event, groupId: string, noteId: string) => {
      repo.removeMember(groupId, noteId);
    },
  );
}
