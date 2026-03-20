import { query, mutation } from "./handlerUtil";
import type { RoutineRepository } from "../database/routineRepository";
import type { RoutineNode } from "../types";

export function registerRoutineHandlers(repo: RoutineRepository): void {
  query("db:routines:fetchAll", "Routines", "fetchAll", () => {
    return repo.fetchAll();
  });

  mutation(
    "db:routines:create",
    "Routines",
    "create",
    "routine",
    "create",
    (
      _event,
      id: string,
      title: string,
      startTime?: string,
      endTime?: string,
    ) => {
      return repo.create(id, title, startTime, endTime);
    },
  );

  mutation(
    "db:routines:update",
    "Routines",
    "update",
    "routine",
    "update",
    (
      _event,
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          "title" | "startTime" | "endTime" | "isArchived" | "order"
        >
      >,
    ) => {
      return repo.update(id, updates);
    },
  );

  mutation(
    "db:routines:delete",
    "Routines",
    "delete",
    "routine",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  query("db:routines:fetchDeleted", "Routines", "fetchDeleted", () => {
    return repo.fetchDeleted();
  });

  mutation(
    "db:routines:softDelete",
    "Routines",
    "softDelete",
    "routine",
    "delete",
    (_event, id: string) => {
      repo.softDelete(id);
    },
  );

  mutation(
    "db:routines:restore",
    "Routines",
    "restore",
    "routine",
    "update",
    (_event, id: string) => {
      repo.restore(id);
    },
  );

  mutation(
    "db:routines:permanentDelete",
    "Routines",
    "permanentDelete",
    "routine",
    "delete",
    (_event, id: string) => {
      repo.permanentDelete(id);
    },
  );
}
