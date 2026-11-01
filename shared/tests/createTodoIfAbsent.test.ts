// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseTodosService } from "../src/services/SupabaseTodosService";
import { classifySendFailure } from "../src/state/outbox";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #2335 — the outbox's idempotent create, against a small in-memory PostgREST:
 * `ignoreDuplicates` inserts nothing over an existing row, and `.select()` then
 * returns only the rows really inserted.
 */

type Row = Record<string, unknown>;
type Failure = { status: number; error: { message: string; code?: string } };

function fake() {
  const tables: Record<string, Map<string, Row>> = {
    items_meta: new Map(),
    tasks_payload: new Map(),
  };
  const fails: Record<string, Failure | undefined> = {};
  const updates: Array<{ patch: Row; filters: Row }> = [];
  const deletes: Row[] = [];
  const writes = (done: (filters: Row) => void) => {
    const filters: Row = {};
    const chain = {
      eq(column: string, value: unknown) {
        filters[column] = value;
        return chain;
      },
      then(resolve: (v: { error: null; status: number }) => void) {
        done(filters);
        resolve({ error: null, status: 200 });
      },
    };
    return chain;
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
    from: (table: string) => ({
      upsert: (row: Row, opts: { ignoreDuplicates?: boolean }) => ({
        select: async () => {
          const failure = fails[table];
          if (failure) return { data: null, ...failure };
          const key = String(row.id ?? row.item_id);
          const rows = tables[table]!;
          if (rows.has(key) && opts.ignoreDuplicates)
            return { data: [], error: null, status: 201 };
          rows.set(key, row);
          return { data: [row], error: null, status: 201 };
        },
      }),
      update: (patch: Row) =>
        writes((filters) => updates.push({ patch, filters })),
      delete: () =>
        writes((filters) => {
          deletes.push(filters);
          tables[table]!.delete(String(filters.id));
        }),
    }),
  } as unknown as SupabaseClient;
  return {
    service: new SupabaseTodosService(client),
    tables,
    fails,
    updates,
    deletes,
  };
}

const node: TodoNode = {
  id: "task-1",
  type: "task",
  title: "offline",
  parentId: null,
  order: -1,
  createdAt: "2026-11-01T00:00:00.000Z",
};

describe("createTodoIfAbsent (#2335)", () => {
  it("gives one row when sent twice, with the user's created_at", async () => {
    const { service, tables, updates } = fake();
    await service.createTodoIfAbsent(node);
    await service.createTodoIfAbsent(node);
    expect(tables.items_meta!.size).toBe(1);
    expect(tables.tasks_payload!.size).toBe(1);
    expect(tables.items_meta!.get("task-1")?.created_at).toBe(node.createdAt);
    expect(updates).toEqual([]);
  });

  it("does not overwrite or resurrect a row trashed elsewhere", async () => {
    const { service, tables, updates } = fake();
    const trashed = { id: "task-1", title: "edited", is_deleted: true };
    tables.items_meta!.set("task-1", trashed);
    tables.tasks_payload!.set("task-1", { item_id: "task-1", sort_order: 9 });
    await service.createTodoIfAbsent(node);
    expect(tables.items_meta!.get("task-1")).toBe(trashed);
    expect(tables.tasks_payload!.get("task-1")?.sort_order).toBe(9);
    expect(updates).toEqual([]);
  });

  it("keeps the meta on a retryable payload failure, and the next send completes the pair", async () => {
    const { service, tables, fails, deletes } = fake();
    fails.tasks_payload = {
      status: 0,
      error: { message: "TypeError: Failed to fetch", code: "" },
    };
    const error = await service.createTodoIfAbsent(node).catch((e) => e);
    expect(classifySendFailure(error)).toBe("retry");
    expect(deletes).toEqual([]);
    expect(tables.items_meta!.size).toBe(1);

    fails.tasks_payload = undefined;
    await service.createTodoIfAbsent(node);
    expect(tables.tasks_payload!.size).toBe(1);
  });

  it("removes the meta on a refusal, with the role filter, if this send created it", async () => {
    const { service, tables, fails, deletes } = fake();
    fails.tasks_payload = {
      status: 409,
      error: { message: "fk", code: "23503" },
    };
    const error = await service.createTodoIfAbsent(node).catch((e) => e);
    expect(classifySendFailure(error)).toBe("failed");
    expect(deletes).toEqual([{ id: "task-1", role: "task" }]);
    expect(tables.items_meta!.size).toBe(0);
  });

  it("leaves a meta row it did not create on a refusal", async () => {
    const { service, tables, fails, deletes } = fake();
    tables.items_meta!.set("task-1", { id: "task-1" });
    fails.tasks_payload = {
      status: 409,
      error: { message: "fk", code: "23503" },
    };
    await expect(service.createTodoIfAbsent(node)).rejects.toThrow("fk");
    expect(deletes).toEqual([]);
  });

  it("moves the meta row when the payload repairs an orphan", async () => {
    const { service, tables, updates } = fake();
    tables.items_meta!.set("task-1", { id: "task-1" });
    await service.createTodoIfAbsent(node);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.filters).toEqual({ id: "task-1", role: "task" });
    expect(updates[0]?.patch.updated_at).toEqual(expect.any(String));
  });

  it("repeats the move on a retry, which may have lost it the first time", async () => {
    const { service, tables, updates } = fake();
    tables.items_meta!.set("task-1", { id: "task-1" });
    tables.tasks_payload!.set("task-1", { item_id: "task-1" });
    await service.createTodoIfAbsent(node, { retried: true });
    expect(updates).toHaveLength(1);
  });
});
