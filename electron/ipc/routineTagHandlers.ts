import { query, mutation } from "./handlerUtil";
import type { RoutineTagRepository } from "../database/routineTagRepository";
import type { RoutineTag } from "../types";

export function registerRoutineTagHandlers(repo: RoutineTagRepository): void {
  query("db:routineTags:fetchAll", "RoutineTags", "fetchAll", () => {
    return repo.fetchAll();
  });

  mutation(
    "db:routineTags:create",
    "RoutineTags",
    "create",
    "routineTag",
    "create",
    (_event, name: string, color: string) => {
      return repo.create(name, color);
    },
    (_args, result) => (result as { id?: number })?.id,
  );

  mutation(
    "db:routineTags:update",
    "RoutineTags",
    "update",
    "routineTag",
    "update",
    (
      _event,
      id: number,
      updates: Partial<
        Pick<RoutineTag, "name" | "color" | "textColor" | "order">
      >,
    ) => {
      return repo.update(id, updates);
    },
  );

  mutation(
    "db:routineTags:delete",
    "RoutineTags",
    "delete",
    "routineTag",
    "delete",
    (_event, id: number) => {
      repo.delete(id);
    },
  );

  query(
    "db:routineTags:fetchTagsForRoutine",
    "RoutineTags",
    "fetchTagsForRoutine",
    (_event, routineId: string) => {
      return repo.fetchTagsForRoutine(routineId);
    },
  );

  mutation(
    "db:routineTags:setTagsForRoutine",
    "RoutineTags",
    "setTagsForRoutine",
    "routineTag",
    "bulk",
    (_event, routineId: string, tagIds: number[]) => {
      repo.setTagsForRoutine(routineId, tagIds);
    },
  );

  query(
    "db:routineTags:fetchAllAssignments",
    "RoutineTags",
    "fetchAllAssignments",
    () => {
      return repo.fetchAllAssignments();
    },
  );
}
