import { query, mutation } from "./handlerUtil";
import type { TemplateRepository } from "../database/templateRepository";

export function registerTemplateHandlers(repo: TemplateRepository): void {
  query("db:templates:fetchAll", "Templates", "fetchAll", () =>
    repo.fetchAll(),
  );

  query(
    "db:templates:fetchById",
    "Templates",
    "fetchById",
    (_event, id: string) => repo.fetchById(id),
  );

  mutation(
    "db:templates:create",
    "Templates",
    "create",
    "template",
    "create",
    (_event, id: string, name: string) => repo.create(id, name),
  );

  mutation(
    "db:templates:update",
    "Templates",
    "update",
    "template",
    "update",
    (_event, id: string, updates: { name?: string; content?: string }) =>
      repo.update(id, updates),
  );

  mutation(
    "db:templates:softDelete",
    "Templates",
    "softDelete",
    "template",
    "delete",
    (_event, id: string) => repo.softDelete(id),
  );

  mutation(
    "db:templates:permanentDelete",
    "Templates",
    "permanentDelete",
    "template",
    "delete",
    (_event, id: string) => repo.permanentDelete(id),
  );
}
