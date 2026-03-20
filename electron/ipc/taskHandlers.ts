import { query, mutation } from "./handlerUtil";
import type { TaskRepository } from "../database/taskRepository";
import type { TaskNode } from "../types";

export function registerTaskHandlers(repo: TaskRepository): void {
  query("db:tasks:fetchTree", "Tasks", "fetchTree", () => repo.fetchTree());

  query("db:tasks:fetchDeleted", "Tasks", "fetchDeleted", () =>
    repo.fetchDeleted(),
  );

  mutation(
    "db:tasks:create",
    "Tasks",
    "create",
    "task",
    "create",
    (_event, node: TaskNode) => repo.create(node),
    (args) => (args[1] as TaskNode)?.id,
  );

  mutation(
    "db:tasks:update",
    "Tasks",
    "update",
    "task",
    "update",
    (_event, id: string, updates: Partial<TaskNode>) =>
      repo.update(id, updates),
  );

  mutation(
    "db:tasks:syncTree",
    "Tasks",
    "syncTree",
    "task",
    "bulk",
    (_event, nodes: TaskNode[]) => repo.syncTree(nodes),
    () => undefined,
  );

  mutation(
    "db:tasks:softDelete",
    "Tasks",
    "softDelete",
    "task",
    "delete",
    (_event, id: string) => repo.softDelete(id),
  );

  mutation(
    "db:tasks:restore",
    "Tasks",
    "restore",
    "task",
    "update",
    (_event, id: string) => repo.restore(id),
  );

  mutation(
    "db:tasks:permanentDelete",
    "Tasks",
    "permanentDelete",
    "task",
    "delete",
    (_event, id: string) => repo.permanentDelete(id),
  );
}
