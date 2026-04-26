import type { TaskNode } from "../../types/taskTree";
import { tauriInvoke } from "../bridge";

export const tasksApi = {
  fetchTaskTree(): Promise<TaskNode[]> {
    return tauriInvoke("db_tasks_fetch_tree");
  },
  fetchDeletedTasks(): Promise<TaskNode[]> {
    return tauriInvoke("db_tasks_fetch_deleted");
  },
  createTask(node: TaskNode): Promise<TaskNode> {
    return tauriInvoke("db_tasks_create", { node });
  },
  updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    return tauriInvoke("db_tasks_update", { id, updates });
  },
  syncTaskTree(nodes: TaskNode[]): Promise<void> {
    return tauriInvoke("db_tasks_sync_tree", { nodes });
  },
  softDeleteTask(id: string): Promise<void> {
    return tauriInvoke("db_tasks_soft_delete", { id });
  },
  restoreTask(id: string): Promise<void> {
    return tauriInvoke("db_tasks_restore", { id });
  },
  permanentDeleteTask(id: string): Promise<void> {
    return tauriInvoke("db_tasks_permanent_delete", { id });
  },
  migrateTasksToBackend(nodes: TaskNode[]): Promise<void> {
    return tauriInvoke("app_migrate_from_local_storage", { tasks: nodes });
  },
};
