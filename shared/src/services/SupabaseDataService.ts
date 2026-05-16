import { type SupabaseClient } from "@supabase/supabase-js";
import type { TaskNode } from "../types/taskTree";
import type { DailyNode } from "../types/daily";
import type { DataService } from "./DataService";
import { getSupabaseClient } from "./supabaseClient";
import {
  TASK_COLUMNS,
  rowToTaskNode,
  taskNodeToRow,
  taskUpdatesToPatch,
  type TaskRow,
} from "./taskMapper";
import {
  DAILY_SELECT_COLUMNS,
  rowToDailyNode,
  type DailyRow,
} from "./dailyMapper";

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

/*
 * Daily domain (S2). Single-table UPSERT-on-`date` model, `daily-<date>`
 * text id, soft-delete, versioned. Pure mapping lives in dailyMapper.ts;
 * this is the I/O layer only. The password column is mutated/compared
 * verbatim (Tauri contract, src-tauri/.../daily_repository.rs) — the raw
 * hash is NEVER selected back (DAILY_SELECT_COLUMNS projects only the
 * boolean `has_password`). `version` is bumped on every mutation,
 * mirroring the SQLite `version = version + 1`.
 */
class SupabaseDailyService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchAllDailies(): Promise<DailyNode[]> {
    const { data, error } = await this.client
      .from("dailies")
      .select(DAILY_SELECT_COLUMNS)
      .eq("is_deleted", false)
      .order("date", { ascending: false });
    if (error) throw new Error(`fetchAllDailies failed: ${error.message}`);
    return (data as unknown as DailyRow[]).map(rowToDailyNode);
  }

  async fetchDailyByDate(date: string): Promise<DailyNode | null> {
    const { data, error } = await this.client
      .from("dailies")
      .select(DAILY_SELECT_COLUMNS)
      .eq("date", date)
      .maybeSingle();
    if (error) throw new Error(`fetchDailyByDate failed: ${error.message}`);
    return data ? rowToDailyNode(data as unknown as DailyRow) : null;
  }

  async fetchDeletedDailies(): Promise<DailyNode[]> {
    const { data, error } = await this.client
      .from("dailies")
      .select(DAILY_SELECT_COLUMNS)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(`fetchDeletedDailies failed: ${error.message}`);
    return (data as unknown as DailyRow[]).map(rowToDailyNode);
  }

  /**
   * UPSERT on the natural `date` key (the SQLite source did
   * `ON CONFLICT(date) DO UPDATE SET content=?, version=version+1`).
   * `version` cannot be a relative `version + 1` in a single PostgREST
   * upsert, so it is read-then-written: fetch the current row, compute
   * the next version, and upsert the full row. The `daily-<date>` id is
   * client-generated (CLAUDE.md §4.3). `user_id` is RLS-derived and
   * never sent.
   */
  async upsertDaily(date: string, content: string): Promise<DailyNode> {
    const { data: existing, error: readErr } = await this.client
      .from("dailies")
      .select("version, created_at")
      .eq("date", date)
      .maybeSingle();
    if (readErr) throw new Error(`upsertDaily failed: ${readErr.message}`);

    const now = new Date().toISOString();
    const existingRow = existing as {
      version: number;
      created_at: string;
    } | null;
    const payload = {
      id: `daily-${date}`,
      date,
      content,
      created_at: existingRow?.created_at ?? now,
      updated_at: now,
      version: (existingRow?.version ?? 0) + 1,
    };

    const { data, error } = await this.client
      .from("dailies")
      .upsert(payload, { onConflict: "date" })
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`upsertDaily failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  async deleteDaily(date: string): Promise<void> {
    const { error } = await this.client
      .from("dailies")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("date", date);
    if (error) throw new Error(`deleteDaily failed: ${error.message}`);
  }

  async restoreDaily(date: string): Promise<void> {
    const { error } = await this.client
      .from("dailies")
      .update({ is_deleted: false, deleted_at: null })
      .eq("date", date);
    if (error) throw new Error(`restoreDaily failed: ${error.message}`);
  }

  async permanentDeleteDaily(date: string): Promise<void> {
    const { error } = await this.client
      .from("dailies")
      .delete()
      .eq("date", date);
    if (error) throw new Error(`permanentDeleteDaily failed: ${error.message}`);
  }

  /** Read-modify-write toggle (mirrors the SQLite CASE flip + version bump). */
  async toggleDailyPin(date: string): Promise<DailyNode> {
    return this.toggleBoolean(date, "is_pinned", "toggleDailyPin");
  }

  async toggleDailyEditLock(date: string): Promise<DailyNode> {
    return this.toggleBoolean(date, "is_edit_locked", "toggleDailyEditLock");
  }

  private async toggleBoolean(
    date: string,
    column: "is_pinned" | "is_edit_locked",
    label: string,
  ): Promise<DailyNode> {
    const { data: cur, error: readErr } = await this.client
      .from("dailies")
      .select(`${column}, version`)
      .eq("date", date)
      .single();
    if (readErr) throw new Error(`${label} failed: ${readErr.message}`);
    const row = cur as Record<string, unknown>;
    const next = !(row[column] as boolean);
    const { data, error } = await this.client
      .from("dailies")
      .update({
        [column]: next,
        version: (row.version as number) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("date", date)
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  /**
   * Store the password verbatim into `password_hash` (Tauri contract:
   * the backend stored/compared the value as-is — see
   * daily_repository.rs `set_password`/`verify_password`). RLS already
   * prevents any cross-user read; the raw value is never projected back
   * (DAILY_SELECT_COLUMNS). NOTE: plaintext-equality is a pre-existing
   * weakness carried over 1:1, not introduced here — flagged for
   * security review (S2 mandates parity, not a crypto redesign).
   */
  async setDailyPassword(date: string, password: string): Promise<DailyNode> {
    const { data, error } = await this.client
      .from("dailies")
      .update({ password_hash: password, updated_at: new Date().toISOString() })
      .eq("date", date)
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`setDailyPassword failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  /**
   * Verify `currentPassword` first, then NULL the hash (mirrors the
   * Tauri command layer which rejected a wrong current password before
   * `remove_password`).
   */
  async removeDailyPassword(
    date: string,
    currentPassword: string,
  ): Promise<DailyNode> {
    const valid = await this.verifyDailyPassword(date, currentPassword);
    if (!valid) throw new Error("Invalid password");
    const { data, error } = await this.client
      .from("dailies")
      .update({ password_hash: null, updated_at: new Date().toISOString() })
      .eq("date", date)
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`removeDailyPassword failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  /**
   * Plaintext-equality compare (Tauri parity). Reads `password_hash`
   * ONLY here, server-filtered to the owner's row by RLS, and never
   * returns it — the boolean result is all the client sees.
   */
  async verifyDailyPassword(date: string, password: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("dailies")
      .select("password_hash")
      .eq("date", date)
      .maybeSingle();
    if (error) throw new Error(`verifyDailyPassword failed: ${error.message}`);
    const hash = (data as { password_hash: string | null } | null)
      ?.password_hash;
    return hash != null && hash === password;
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

const PHASE2_DAILY_METHODS = new Set<string>([
  "fetchAllDailies",
  "fetchDailyByDate",
  "fetchDeletedDailies",
  "upsertDaily",
  "deleteDaily",
  "restoreDaily",
  "permanentDeleteDaily",
  "toggleDailyPin",
  "toggleDailyEditLock",
  "setDailyPassword",
  "removeDailyPassword",
  "verifyDailyPassword",
]);

/**
 * Create a Phase 2 Supabase-backed DataService.
 *
 * Implemented: the full tasks domain (9 methods) + the full daily domain
 * (12 methods — fetch all/by-date/deleted, upsert, soft delete / restore
 * / permanent delete, pin & edit-lock toggles, password set/remove/
 * verify). Everything else throws "not implemented in phase 2".
 *
 * Each domain is its own class; a single Proxy routes a property to the
 * service that owns it (allow-set lookup) and binds the call to that
 * instance so `this.client` resolves on the real target.
 *
 * Credentials are read from Vite env (`VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY`), validated lazily so importing this module
 * does not crash builds before the Supabase project exists.
 */
export function createSupabaseDataService(): DataService {
  const client = getSupabaseClient();
  const tasksService = new SupabaseTasksService(client);
  const dailyService = new SupabaseDailyService(client);

  // Dispatch table: method name -> the instance that implements it. The
  // Proxy's target is arbitrary (an empty object); routing is entirely
  // by this map so adding a domain is one entry, no target juggling.
  const route = (prop: string): object | null => {
    if (PHASE2_TASKS_METHODS.has(prop)) return tasksService;
    if (PHASE2_DAILY_METHODS.has(prop)) return dailyService;
    return null;
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") {
          return () => {
            throw new Error(`${String(prop)}: not implemented in phase 2`);
          };
        }
        const owner = route(prop);
        if (owner) {
          // Bind to the owning instance so `this.client` resolves on the
          // real target, not back through this trap.
          const value = Reflect.get(owner, prop) as (
            ...args: unknown[]
          ) => unknown;
          return value.bind(owner);
        }
        return () => {
          throw new Error(`${prop}: not implemented in phase 2`);
        };
      },
    },
  ) as unknown as DataService;
}

// Re-exported for round-trip unit testing + host convenience.
export { rowToTaskNode, taskNodeToRow, taskUpdatesToPatch } from "./taskMapper";
export type { TaskRow, TaskWriteRow } from "./taskMapper";
export { rowToDailyNode, dailyNodeToRow } from "./dailyMapper";
export type { DailyRow, DailyWriteRow } from "./dailyMapper";
