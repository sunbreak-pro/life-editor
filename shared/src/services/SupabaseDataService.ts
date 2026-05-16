import { type SupabaseClient } from "@supabase/supabase-js";
import type { TaskNode } from "../types/taskTree";
import type { DataService } from "./DataService";
import { getSupabaseClient } from "./supabaseClient";

/*
 * Phase 1 Supabase implementation.
 *
 * Only the `tasks` methods of `DataService` are implemented. Every other
 * method is intentionally unimplemented and throws at call time
 * ("not implemented in phase 1"). Phase 2 ports the remaining domains.
 *
 * The full `DataService` interface has ~200 members; enumerating throwing
 * stubs by hand for all of them is noise and a maintenance hazard. Instead
 * the implemented tasks methods live on a real class, and a Proxy fills the
 * rest with a throwing fallback. The Proxy result is asserted to
 * `DataService` so consumers keep full static typing.
 */

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  status: string | null;
  created_at: string;
}

function rowToTaskNode(row: TaskRow): TaskNode {
  // Phase 1 tasks table is intentionally minimal (id / user_id / title /
  // status / created_at). Fields not yet stored are filled with safe
  // defaults so the TaskNode shape stays valid. The full mapping lands in
  // Phase 1 step 10 (0002_full_schema.sql) / Phase 2.
  return {
    id: row.id,
    type: "task",
    title: row.title,
    parentId: null,
    order: 0,
    status: (row.status as TaskNode["status"]) ?? "NOT_STARTED",
    createdAt: row.created_at,
  };
}

class SupabaseTasksService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchTaskTree(): Promise<TaskNode[]> {
    const { data, error } = await this.client
      .from("tasks")
      .select("id, user_id, title, status, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`fetchTaskTree failed: ${error.message}`);
    return (data as TaskRow[]).map(rowToTaskNode);
  }

  async createTask(node: TaskNode): Promise<TaskNode> {
    const { data, error } = await this.client
      .from("tasks")
      .insert({ title: node.title, status: node.status ?? null })
      .select("id, user_id, title, status, created_at")
      .single();
    if (error) throw new Error(`createTask failed: ${error.message}`);
    return rowToTaskNode(data as TaskRow);
  }

  async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    const patch: Partial<Pick<TaskRow, "title" | "status">> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.status !== undefined) patch.status = updates.status ?? null;
    const { data, error } = await this.client
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select("id, user_id, title, status, created_at")
      .single();
    if (error) throw new Error(`updateTask failed: ${error.message}`);
    return rowToTaskNode(data as TaskRow);
  }

  async permanentDeleteTask(id: string): Promise<void> {
    const { error } = await this.client.from("tasks").delete().eq("id", id);
    if (error) throw new Error(`permanentDeleteTask failed: ${error.message}`);
  }
}

const PHASE1_TASKS_METHODS = new Set<string>([
  "fetchTaskTree",
  "createTask",
  "updateTask",
  "permanentDeleteTask",
]);

/**
 * Create a Phase 1 Supabase-backed DataService.
 *
 * Implemented: tasks (fetch tree / create / update / permanent delete).
 * Everything else throws "not implemented in phase 1" when called.
 *
 * Credentials are read from Vite env (`VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY`). They are validated lazily so importing this
 * module does not crash builds before the Supabase project exists.
 */
export function createSupabaseDataService(): DataService {
  const client = getSupabaseClient();
  const tasksService = new SupabaseTasksService(client);

  return new Proxy(tasksService, {
    get(target, prop) {
      if (typeof prop === "string" && PHASE1_TASKS_METHODS.has(prop)) {
        // Bind to the real instance so `this.client` resolves on the
        // target, not back through this trap (which would otherwise
        // return the throwing fallback for the `client` field).
        const value = Reflect.get(target, prop) as (
          ...args: unknown[]
        ) => unknown;
        return value.bind(target);
      }
      return () => {
        throw new Error(`${String(prop)}: not implemented in phase 1`);
      };
    },
  }) as unknown as DataService;
}
