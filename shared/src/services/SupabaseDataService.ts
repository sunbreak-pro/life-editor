import { type SupabaseClient } from "@supabase/supabase-js";
import type { TaskNode } from "../types/taskTree";
import type { DataService } from "./DataService";
import { getSupabaseClient } from "./supabaseClient";
import {
  TASK_COLUMNS,
  rowToTaskNode,
  taskNodeToRow,
  taskUpdatesToPatch,
  type TaskRow,
} from "./taskMapper";

/*
 * Phase 2 S1 Supabase implementation.
 *
 * The `tasks` domain is fully implemented (full-column round-trip against
 * the 0003_tasks_full_schema.sql shape: hierarchy / soft-delete /
 * scheduling / versioning). Pure mapping lives in `taskMapper.ts`; this
 * file is the I/O layer only. Every other DataService method is still
 * unimplemented and throws at call time ("not implemented in phase 2");
 * later S-steps port the remaining domains.
 *
 * The full `DataService` interface has ~200 members; enumerating throwing
 * stubs by hand for all of them is noise. The implemented tasks methods
 * live on a real class and a Proxy fills the rest with a throwing
 * fallback, asserted to `DataService` so consumers keep static typing.
 */

class SupabaseTasksService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchTaskTree(): Promise<TaskNode[]> {
    const { data, error } = await this.client
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("is_deleted", false)
      .order("order", { ascending: true });
    if (error) throw new Error(`fetchTaskTree failed: ${error.message}`);
    return (data as unknown as TaskRow[]).map(rowToTaskNode);
  }

  async fetchDeletedTasks(): Promise<TaskNode[]> {
    const { data, error } = await this.client
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(`fetchDeletedTasks failed: ${error.message}`);
    return (data as unknown as TaskRow[]).map(rowToTaskNode);
  }

  async createTask(node: TaskNode): Promise<TaskNode> {
    const { data, error } = await this.client
      .from("tasks")
      .insert(taskNodeToRow(node))
      .select(TASK_COLUMNS)
      .single();
    if (error) throw new Error(`createTask failed: ${error.message}`);
    return rowToTaskNode(data as unknown as TaskRow);
  }

  async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    const { data, error } = await this.client
      .from("tasks")
      .update(taskUpdatesToPatch(updates))
      .eq("id", id)
      .select(TASK_COLUMNS)
      .single();
    if (error) throw new Error(`updateTask failed: ${error.message}`);
    return rowToTaskNode(data as unknown as TaskRow);
  }

  async syncTaskTree(nodes: TaskNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const rows = nodes.map(taskNodeToRow);
    const { error } = await this.client
      .from("tasks")
      .upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`syncTaskTree failed: ${error.message}`);
  }

  async softDeleteTask(id: string): Promise<void> {
    const { error } = await this.client
      .from("tasks")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`softDeleteTask failed: ${error.message}`);
  }

  async restoreTask(id: string): Promise<void> {
    const { error } = await this.client
      .from("tasks")
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", id);
    if (error) throw new Error(`restoreTask failed: ${error.message}`);
  }

  async permanentDeleteTask(id: string): Promise<void> {
    const { error } = await this.client.from("tasks").delete().eq("id", id);
    if (error) throw new Error(`permanentDeleteTask failed: ${error.message}`);
  }

  /**
   * Web no-op stub (user-confirmed). On Tauri this migrated local SQLite
   * tasks into the cloud backend; the web build is Supabase-native so
   * there is nothing to migrate. Kept to satisfy the DataService
   * interface and any caller that invokes it unconditionally.
   */
  async migrateTasksToBackend(_nodes: TaskNode[]): Promise<void> {
    void _nodes;
  }
}

const PHASE2_TASKS_METHODS = new Set<string>([
  "fetchTaskTree",
  "fetchDeletedTasks",
  "createTask",
  "updateTask",
  "syncTaskTree",
  "softDeleteTask",
  "restoreTask",
  "permanentDeleteTask",
  "migrateTasksToBackend",
]);

/**
 * Create a Phase 2 Supabase-backed DataService.
 *
 * Implemented: the full tasks domain (9 methods — fetch tree / fetch
 * deleted / create / update / bulk sync / soft delete / restore /
 * permanent delete / migrate stub). Everything else throws
 * "not implemented in phase 2" when called.
 *
 * Credentials are read from Vite env (`VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY`), validated lazily so importing this module
 * does not crash builds before the Supabase project exists.
 */
export function createSupabaseDataService(): DataService {
  const client = getSupabaseClient();
  const tasksService = new SupabaseTasksService(client);

  return new Proxy(tasksService, {
    get(target, prop) {
      if (typeof prop === "string" && PHASE2_TASKS_METHODS.has(prop)) {
        // Bind to the real instance so `this.client` resolves on the
        // target, not back through this trap.
        const value = Reflect.get(target, prop) as (
          ...args: unknown[]
        ) => unknown;
        return value.bind(target);
      }
      return () => {
        throw new Error(`${String(prop)}: not implemented in phase 2`);
      };
    },
  }) as unknown as DataService;
}

// Re-exported for round-trip unit testing + host convenience.
export { rowToTaskNode, taskNodeToRow, taskUpdatesToPatch } from "./taskMapper";
export type { TaskRow, TaskWriteRow } from "./taskMapper";
