import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { TaskRepository } from "../database/taskRepository";
import type { TaskNode } from "../types";

export function registerTaskHandlers(repo: TaskRepository): void {
  ipcMain.handle(
    "db:tasks:fetchTree",
    loggedHandler("Tasks", "fetchTree", () => repo.fetchTree()),
  );

  ipcMain.handle(
    "db:tasks:fetchDeleted",
    loggedHandler("Tasks", "fetchDeleted", () => repo.fetchDeleted()),
  );

  ipcMain.handle(
    "db:tasks:create",
    loggedHandler("Tasks", "create", (_event, node: TaskNode) =>
      repo.create(node),
    ),
  );

  ipcMain.handle(
    "db:tasks:update",
    loggedHandler(
      "Tasks",
      "update",
      (_event, id: string, updates: Partial<TaskNode>) =>
        repo.update(id, updates),
    ),
  );

  ipcMain.handle(
    "db:tasks:syncTree",
    loggedHandler("Tasks", "syncTree", (_event, nodes: TaskNode[]) =>
      repo.syncTree(nodes),
    ),
  );

  ipcMain.handle(
    "db:tasks:softDelete",
    loggedHandler("Tasks", "softDelete", (_event, id: string) =>
      repo.softDelete(id),
    ),
  );

  ipcMain.handle(
    "db:tasks:restore",
    loggedHandler("Tasks", "restore", (_event, id: string) => repo.restore(id)),
  );

  ipcMain.handle(
    "db:tasks:permanentDelete",
    loggedHandler("Tasks", "permanentDelete", (_event, id: string) =>
      repo.permanentDelete(id),
    ),
  );
}
