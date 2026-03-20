import { query, mutation } from "./handlerUtil";
import type { WikiTagRepository } from "../database/wikiTagRepository";
import type { WikiTag } from "../types";

export function registerWikiTagHandlers(repo: WikiTagRepository): void {
  query("db:wikiTags:fetchAll", "WikiTags", "fetchAll", () => {
    return repo.fetchAll();
  });

  query(
    "db:wikiTags:search",
    "WikiTags",
    "search",
    (_event, query_: string) => {
      return repo.search(query_);
    },
  );

  mutation(
    "db:wikiTags:create",
    "WikiTags",
    "create",
    "wikiTag",
    "create",
    (_event, name: string, color: string) => {
      return repo.create(name, color);
    },
    (_args, result) => (result as { id?: string })?.id,
  );

  mutation(
    "db:wikiTags:createWithId",
    "WikiTags",
    "createWithId",
    "wikiTag",
    "create",
    (_event, id: string, name: string, color: string) => {
      return repo.createWithId(id, name, color);
    },
  );

  mutation(
    "db:wikiTags:update",
    "WikiTags",
    "update",
    "wikiTag",
    "update",
    (
      _event,
      id: string,
      updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
    ) => {
      return repo.update(id, updates);
    },
  );

  mutation(
    "db:wikiTags:delete",
    "WikiTags",
    "delete",
    "wikiTag",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  mutation(
    "db:wikiTags:merge",
    "WikiTags",
    "merge",
    "wikiTag",
    "bulk",
    (_event, sourceId: string, targetId: string) => {
      return repo.merge(sourceId, targetId);
    },
    () => undefined,
  );

  query(
    "db:wikiTags:fetchForEntity",
    "WikiTags",
    "fetchForEntity",
    (_event, entityId: string) => {
      return repo.fetchTagsForEntity(entityId);
    },
  );

  mutation(
    "db:wikiTags:setForEntity",
    "WikiTags",
    "setForEntity",
    "wikiTagAssignment",
    "bulk",
    (_event, entityId: string, entityType: string, tagIds: string[]) => {
      repo.setTagsForEntity(entityId, entityType, tagIds);
    },
  );

  mutation(
    "db:wikiTags:syncInline",
    "WikiTags",
    "syncInline",
    "wikiTagAssignment",
    "bulk",
    (_event, entityId: string, entityType: string, tagNames: string[]) => {
      repo.syncInlineTags(entityId, entityType, tagNames);
    },
  );

  query(
    "db:wikiTags:fetchAllAssignments",
    "WikiTags",
    "fetchAllAssignments",
    () => {
      return repo.fetchAllAssignments();
    },
  );

  mutation(
    "db:wikiTags:restoreAssignment",
    "WikiTags",
    "restoreAssignment",
    "wikiTagAssignment",
    "create",
    (
      _event,
      tagId: string,
      entityId: string,
      entityType: string,
      source: string,
    ) => {
      repo.restoreAssignment(tagId, entityId, entityType, source);
    },
    (args) => args[2] as string,
  );
}
