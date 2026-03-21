import { query, mutation } from "./handlerUtil";
import type { RoutineGroupRepository } from "../database/routineGroupRepository";
import type { RoutineGroup } from "../types";

export function registerRoutineGroupHandlers(
  repo: RoutineGroupRepository,
): void {
  query("db:routineGroups:fetchAll", "RoutineGroups", "fetchAll", () => {
    return repo.fetchAll();
  });

  mutation(
    "db:routineGroups:create",
    "RoutineGroups",
    "create",
    "routineGroup",
    "create",
    (_event, id: string, name: string, color: string) => {
      return repo.create(id, name, color);
    },
  );

  mutation(
    "db:routineGroups:update",
    "RoutineGroups",
    "update",
    "routineGroup",
    "update",
    (
      _event,
      id: string,
      updates: Partial<Pick<RoutineGroup, "name" | "color" | "order">>,
    ) => {
      return repo.update(id, updates);
    },
  );

  mutation(
    "db:routineGroups:delete",
    "RoutineGroups",
    "delete",
    "routineGroup",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  query(
    "db:routineGroups:fetchAllTagAssignments",
    "RoutineGroups",
    "fetchAllTagAssignments",
    () => {
      return repo.fetchAllTagAssignments();
    },
  );

  mutation(
    "db:routineGroups:setTagsForGroup",
    "RoutineGroups",
    "setTagsForGroup",
    "routineGroup",
    "bulk",
    (_event, groupId: string, tagIds: number[]) => {
      repo.setTagsForGroup(groupId, tagIds);
    },
  );
}
