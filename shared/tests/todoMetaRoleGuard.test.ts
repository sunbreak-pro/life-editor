// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
// Imported from its own module, not the SupabaseDataService barrel: that
// barrel re-exports only the two schedule services as values (the Todos
// class is an internal import there), so a barrel import resolves to
// undefined at runtime.
import { SupabaseTodosService } from "../src/services/SupabaseTodosService";

/*
 * #1099 — every items_meta UPDATE in the Todos path is filtered by role.
 *
 * THE OTHER SIDE OF #996
 * ======================
 * #625 converts an item between Todo and Event while KEEPING its id
 * (D-20260810-sched-2), so `items_meta.id` alone stopped being a safe address
 * in BOTH directions. #996 (PR #1080) closed the Event/Routine side; the Todo
 * side stayed open, which means a stale undo entry, a queued toast action or a
 * detail panel still holding the id could fire a Todo write at a row that is
 * now an Event.
 *
 * Watch the literal: the role value is "task", not "todo". The domain was
 * renamed but the discriminator was left alone (#831), so a guard written from
 * the domain name would filter on a value no row ever carries — every write
 * would miss, including the legitimate ones. The control rows below are what
 * catch that: a filter matching NOTHING would satisfy the "converted row
 * untouched" assertion for entirely the wrong reason.
 *
 * WHAT "SAFE" LOOKS LIKE, TWICE
 * =============================
 * The void write paths (softDeleteTodo / restoreTodo) end at a MISS, not an
 * error: PostgREST reports zero matched rows as a success, so the stale
 * operation evaporates and the caller's `if (error)` never fires. updateTodo
 * goes further because it reads the row back — it REJECTS, so the caller
 * learns the item moved rather than receiving a stale TodoNode.
 *
 * Mock style mirrors scheduleMetaRoleGuard.test.ts: single-use thenable
 * PostgREST builders over in-memory rows that actually APPLY the filters,
 * because "0 rows updated" is the contract under test.
 */

interface Row {
  [col: string]: unknown;
}

interface Filter {
  op: "eq" | "in";
  col: string;
  val: unknown;
}

/** Every UPDATE the service issued, for the "did it even run?" assertions. */
interface UpdateRecord {
  table: string;
  filters: Filter[];
  matched: number;
}

class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  private mode: "select" | "update" | "insert" | "delete" | null = null;
  private patch: Row = {};
  private filters: Filter[] = [];
  private singleRow = false;

  constructor(
    private readonly table: string,
    private readonly db: Record<string, Row[]>,
    private readonly updates: UpdateRecord[],
  ) {}

  select(): this {
    if (this.mode === null) this.mode = "select";
    return this;
  }
  update(patch: Row): this {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  insert(): this {
    this.mode = "insert";
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  in(col: string, val: unknown): this {
    this.filters.push({ op: "in", col, val });
    return this;
  }
  order(): this {
    return this;
  }
  range(): this {
    return this;
  }
  maybeSingle(): this {
    this.singleRow = true;
    return this;
  }
  single(): this {
    this.singleRow = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq") return row[f.col] === f.val;
      return (f.val as unknown[]).includes(row[f.col]);
    });
  }

  then<R1 = { data?: unknown; error: unknown }, R2 = never>(
    onFulfilled?:
      ((v: { data?: unknown; error: unknown }) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const rows = this.db[this.table] ?? [];
    const hit = rows.filter((r) => this.matches(r));

    if (this.mode === "update") {
      for (const row of hit) Object.assign(row, this.patch);
      this.updates.push({
        table: this.table,
        filters: this.filters,
        matched: hit.length,
      });
      return Promise.resolve({ data: hit, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    if (this.mode === "delete") {
      this.db[this.table] = rows.filter((r) => !this.matches(r));
      return Promise.resolve({ data: null, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    // `.single()` over zero rows is an ERROR in PostgREST (PGRST116), not a
    // null row. Reproducing that matters here: after a clean conversion the
    // tasks_payload row is gone, and it is this error — not a mapper crash on
    // a null row — that makes updateTodo reject.
    if (this.singleRow) {
      const row = hit[0];
      return Promise.resolve(
        row
          ? { data: row, error: null }
          : {
              data: null,
              error: {
                message:
                  "JSON object requested, multiple (or no) rows returned",
              },
            },
      ).then(onFulfilled, onRejected);
    }
    return Promise.resolve({ data: hit, error: null }).then(
      onFulfilled,
      onRejected,
    );
  }
}

function makeClient(db: Record<string, Row[]>, updates: UpdateRecord[]) {
  return {
    from: (table: string) => new Builder(table, db, updates),
    // The mapper-driven writes stamp user_id, so they ask who is signed in.
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as unknown as SupabaseClient;
}

/** The role filter the site under test is supposed to carry. */
function roleFilters(updates: UpdateRecord[]): Filter[] {
  return updates
    .filter((u) => u.table === "items_meta")
    .flatMap((u) => u.filters.filter((f) => f.col === "role"));
}

/**
 * One converted row (id kept, role moved to "event") plus one live Todo
 * control row. Both start with the same mutable columns so "unchanged" and
 * "changed" are decidable against the snapshot.
 */
function seed() {
  const converted: Row = {
    id: "converted-1",
    role: "event", // #625 moved it; the caller still holds the old id
    title: "converted",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
  const control: Row = {
    id: "control-1",
    role: "task",
    title: "control",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
  return { converted, control, snapshot: { ...converted } };
}

const taskPayload = (itemId: string, extra: Row = {}): Row => ({
  item_id: itemId,
  user_id: "user-1",
  parent_item_id: null,
  parent_item_role: "task",
  task_type: "task",
  sort_order: 0,
  is_expanded: false,
  is_all_day: false,
  reminder_enabled: false,
  reminder_offset: null,
  scheduled_at: null,
  scheduled_end_at: null,
  completed_at: null,
  work_duration_minutes: null,
  time_memo: null,
  status: null,
  priority: null,
  content: null,
  ...extra,
});

describe("#1099 Todos items_meta UPDATE is role-guarded", () => {
  /*
   * The two void write paths. Both used to address the row by id alone, and
   * both are exactly what a stale undo entry replays.
   */
  const voidCases: Array<{
    name: string;
    deletedBefore: boolean;
    run: (svc: SupabaseTodosService, id: string) => Promise<void>;
    changed: (row: Row) => boolean;
  }> = [
    {
      name: "softDeleteTodo",
      deletedBefore: false,
      run: (svc, id) => svc.softDeleteTodo(id),
      changed: (row) => row.is_deleted === true,
    },
    {
      name: "restoreTodo",
      deletedBefore: true,
      run: (svc, id) => svc.restoreTodo(id),
      changed: (row) => row.is_deleted === false,
    },
  ];

  for (const c of voidCases) {
    it(`${c.name} leaves a converted row untouched`, async () => {
      const { converted, control, snapshot } = seed();
      converted.is_deleted = c.deletedBefore;
      snapshot.is_deleted = c.deletedBefore;
      const updates: UpdateRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        tasks_payload: [taskPayload("control-1")],
      };
      const svc = new SupabaseTodosService(makeClient(db, updates));

      // No throw: a zero-row UPDATE is a success in PostgREST, which is the
      // outcome we want — the stale operation evaporates.
      await c.run(svc, "converted-1");

      expect(converted).toEqual(snapshot);
      expect(roleFilters(updates)).toEqual([
        { op: "eq", col: "role", val: "task" },
      ]);
      expect(
        updates.filter((u) => u.table === "items_meta").map((u) => u.matched),
      ).toEqual([0]);
    });

    it(`${c.name} still writes a live todo`, async () => {
      const { converted, control } = seed();
      control.is_deleted = c.deletedBefore;
      const updates: UpdateRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        tasks_payload: [taskPayload("control-1")],
      };
      const svc = new SupabaseTodosService(makeClient(db, updates));

      await c.run(svc, "control-1");

      expect(c.changed(control)).toBe(true);
      expect(control.updated_at).not.toBe("2026-01-01T00:00:00.000Z");
      expect(
        updates.filter((u) => u.table === "items_meta").map((u) => u.matched),
      ).toEqual([1]);
    });
  }

  /*
   * updateTodo reads the row back, so it ends louder than a miss. Two shapes,
   * because conversion's payload cleanup is best-effort:
   *   - clean conversion (tasks_payload dropped) -> the read-back of the
   *     payload finds nothing and the call rejects there;
   *   - stray payload row left behind -> both reads return, and the mapper's
   *     assertItemsMetaPair refuses to decode an "event" meta row as a task.
   * Either way the meta row is untouched and the caller is told.
   */
  it("updateTodo refuses a converted row and writes nothing (payload dropped)", async () => {
    const { converted, control, snapshot } = seed();
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      tasks_payload: [taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, updates));

    await expect(
      svc.updateTodo("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/updateTodo read tasks_payload/);

    expect(converted).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "task" },
    ]);
    expect(
      updates.filter((u) => u.table === "items_meta").map((u) => u.matched),
    ).toEqual([0]);
  });

  it("updateTodo refuses a converted row whose payload row was left behind", async () => {
    const { converted, control, snapshot } = seed();
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      // The §10.5 orphan: conversion's best-effort drop failed.
      tasks_payload: [taskPayload("converted-1"), taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, updates));

    await expect(
      svc.updateTodo("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/items_meta\.role expected "task" but got "event"/);

    expect(converted).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "task" },
    ]);
  });

  it("updateTodo still writes a live todo", async () => {
    const { converted, control } = seed();
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      tasks_payload: [taskPayload("control-1")],
    };
    const svc = new SupabaseTodosService(makeClient(db, updates));

    const node = await svc.updateTodo("control-1", { title: "renamed" });

    expect(node.title).toBe("renamed");
    expect(control.title).toBe("renamed");
    expect(control.updated_at).not.toBe("2026-01-01T00:00:00.000Z");
    expect(converted.title).toBe("converted");
    expect(
      updates.filter((u) => u.table === "items_meta").map((u) => u.matched),
    ).toEqual([1]);
  });
});

/*
 * Count, do not sample.
 *
 * The behavioural cases above can only reach the write paths that are public
 * and reachable from a test — bumpItemsMetaUpdatedAt is private and currently
 * has no caller (it is kept as the canonical helper for future single-column
 * writes). A future method added without the filter would also slip past them
 * silently. So the DoD ("all four sites guarded") is pinned by reading the
 * source and asserting the count, the way #996 recorded its grep.
 */
describe("#1099 count: every items_meta UPDATE in SupabaseTodosService", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(
    resolve(here, "../src/services/SupabaseTodosService.ts"),
    "utf8",
  );

  /**
   * Each `.from("items_meta")` chain up to its terminating semicolon. Written
   * against the file's actual shape: every such chain in this service is a
   * single statement, and prettier keeps one call per line.
   */
  const chains = source
    .split('.from("items_meta")')
    .slice(1)
    .map((tail) => tail.slice(0, tail.indexOf(";")));

  const updateChains = chains.filter((c) => /^\s*\.update\(/.test(c));

  it("finds exactly the four UPDATE sites the Issue names", () => {
    expect(updateChains).toHaveLength(4);
  });

  it("guards every one of them with role='task'", () => {
    const unguarded = updateChains.filter(
      (c) => !c.includes('.eq("role", "task")'),
    );
    expect(unguarded).toEqual([]);
  });

  it("does not confuse the UPSERT and DELETE sites for UPDATEs", () => {
    // The non-UPDATE items_meta writes: syncTodoTree upserts (role travels in
    // the row body, not a filter) and two DELETEs — createTodo's R2 orphan
    // cleanup and permanentDeleteTodo's descendants-first purge. All three are
    // out of scope for #1099 and all three are present, so a regex that swept
    // them into `updateChains` would show up above as a count mismatch.
    expect(chains.filter((c) => /^\s*\.upsert\(/.test(c))).toHaveLength(1);
    expect(chains.filter((c) => /^\s*\.delete\(/.test(c))).toHaveLength(2);
  });
});
