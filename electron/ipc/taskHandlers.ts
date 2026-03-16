import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
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
    loggedHandler("Tasks", "create", (_event, node: TaskNode) => {
      const result = repo.create(node);
      broadcastChange("task", "create", node.id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:tasks:update",
    loggedHandler(
      "Tasks",
      "update",
      (_event, id: string, updates: Partial<TaskNode>) => {
        const result = repo.update(id, updates);
        broadcastChange("task", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:tasks:syncTree",
    loggedHandler("Tasks", "syncTree", (_event, nodes: TaskNode[]) => {
      const result = repo.syncTree(nodes);
      broadcastChange("task", "bulk");
      return result;
    }),
  );

  ipcMain.handle(
    "db:tasks:softDelete",
    loggedHandler("Tasks", "softDelete", (_event, id: string) => {
      const result = repo.softDelete(id);
      broadcastChange("task", "delete", id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:tasks:restore",
    loggedHandler("Tasks", "restore", (_event, id: string) => {
      const result = repo.restore(id);
      broadcastChange("task", "update", id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:tasks:permanentDelete",
    loggedHandler("Tasks", "permanentDelete", (_event, id: string) => {
      const result = repo.permanentDelete(id);
      broadcastChange("task", "delete", id);
      return result;
    }),
  );
}
