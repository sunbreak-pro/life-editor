import { query, mutation } from "./handlerUtil";
import type { WikiTagConnectionRepository } from "../database/wikiTagConnectionRepository";

export function registerWikiTagConnectionHandlers(
  repo: WikiTagConnectionRepository,
): void {
  query(
    "db:wikiTagConnections:fetchAll",
    "WikiTagConnections",
    "fetchAll",
    () => repo.fetchAll(),
  );

  mutation(
    "db:wikiTagConnections:create",
    "WikiTagConnections",
    "create",
    "wikiTagConnection",
    "create",
    (_event, sourceTagId: string, targetTagId: string) =>
      repo.create(sourceTagId, targetTagId),
    (_args, result) => (result as { id?: string })?.id,
  );

  mutation(
    "db:wikiTagConnections:delete",
    "WikiTagConnections",
    "delete",
    "wikiTagConnection",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  mutation(
    "db:wikiTagConnections:deleteByTagPair",
    "WikiTagConnections",
    "deleteByTagPair",
    "wikiTagConnection",
    "delete",
    (_event, sourceTagId: string, targetTagId: string) => {
      repo.deleteByTagPair(sourceTagId, targetTagId);
    },
    () => undefined,
  );
}
