// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseGoalsService } from "../src/services/SupabaseGoalsService";

/*
 * SupabaseGoalsService (#2103) against a small in-memory PostgREST fake.
 *
 * What the suite pins:
 *   - every goal write moves items_meta.updated_at (DB-Q2 — goals_payload has
 *     no cursor), and every items_meta write is filtered by role = 'goal';
 *   - the R2 recovery on a failed payload INSERT;
 *   - the period reads (one period / the three periods of a date);
 *   - link / unlink being idempotent over the 0034 partial UNIQUE.
 */

type Row = Record<string, unknown>;
type Filter = { op: "eq" | "in"; col: string; val: unknown };

interface Write {
  table: string;
  op: "insert" | "update" | "delete";
  filters: Filter[];
  patch?: Row;
}

interface FakeOptions {
  failInsertInto?: string;
  /** Runs just before an INSERT into `table` (to stage a concurrent write). */
  beforeInsert?: (table: string, db: Record<string, Row[]>) => void;
}

function makeFake(seed: Record<string, Row[]>, options: FakeOptions = {}) {
  const db: Record<string, Row[]> = {
    items_meta: [],
    goals_payload: [],
    goal_todo_links: [],
    ...seed,
  };
  const writes: Write[] = [];

  class Builder implements PromiseLike<{ data: unknown; error: unknown }> {
    private op: "select" | "insert" | "update" | "delete" = "select";
    private filters: Filter[] = [];
    private patch: Row = {};
    private inserted: Row[] = [];
    private returning = false;
    private singleMode: "one" | "maybe" | null = null;
    private rangeArgs: [number, number] | null = null;

    constructor(private readonly table: string) {}

    select(): this {
      if (this.op !== "select") this.returning = true;
      return this;
    }
    insert(row: Row | Row[]): this {
      this.op = "insert";
      this.inserted = Array.isArray(row) ? row : [row];
      return this;
    }
    update(patch: Row): this {
      this.op = "update";
      this.patch = patch;
      return this;
    }
    delete(): this {
      this.op = "delete";
      return this;
    }
    eq(col: string, val: unknown): this {
      this.filters.push({ op: "eq", col, val });
      return this;
    }
    in(col: string, val: unknown[]): this {
      this.filters.push({ op: "in", col, val });
      return this;
    }
    order(): this {
      return this;
    }
    limit(): this {
      return this;
    }
    range(from: number, to: number): this {
      this.rangeArgs = [from, to];
      return this;
    }
    maybeSingle(): this {
      this.singleMode = "maybe";
      return this;
    }
    single(): this {
      this.singleMode = "one";
      return this;
    }

    private matches(row: Row): boolean {
      return this.filters.every((f) =>
        f.op === "eq"
          ? row[f.col] === f.val
          : (f.val as unknown[]).includes(row[f.col]),
      );
    }

    private run(): { data: unknown; error: unknown } {
      const rows = (db[this.table] ??= []);
      let out: Row[] = [];
      if (this.op === "insert") {
        options.beforeInsert?.(this.table, db);
        if (options.failInsertInto === this.table) {
          return { data: null, error: { message: "boom" } };
        }
        for (const row of this.inserted) {
          if (
            this.table === "goal_todo_links" &&
            rows.some(
              (r) =>
                !r.is_deleted &&
                r.goal_id === row.goal_id &&
                r.todo_id === row.todo_id,
            )
          ) {
            return {
              data: null,
              error: { message: "duplicate key", code: "23505" },
            };
          }
          const full: Row =
            this.table === "goal_todo_links"
              ? { is_deleted: false, deleted_at: null, ...row }
              : this.table === "items_meta"
                ? { created_at: "DEFAULT", updated_at: "DEFAULT", ...row }
                : { ...row };
          rows.push(full);
          out.push(full);
        }
        writes.push({ table: this.table, op: "insert", filters: [] });
      } else if (this.op === "update") {
        out = rows.filter((r) => this.matches(r));
        for (const r of out) Object.assign(r, this.patch);
        writes.push({
          table: this.table,
          op: "update",
          filters: this.filters,
          patch: this.patch,
        });
        if (!this.returning) return { data: null, error: null };
      } else if (this.op === "delete") {
        db[this.table] = rows.filter((r) => !this.matches(r));
        writes.push({ table: this.table, op: "delete", filters: this.filters });
        return { data: null, error: null };
      } else {
        out = rows.filter((r) => this.matches(r));
        if (this.rangeArgs)
          out = out.slice(this.rangeArgs[0], this.rangeArgs[1] + 1);
      }
      if (this.singleMode === "one") {
        return out.length === 1
          ? { data: out[0], error: null }
          : {
              data: null,
              error: { message: `expected 1 row, got ${out.length}` },
            };
      }
      if (this.singleMode === "maybe")
        return { data: out[0] ?? null, error: null };
      return { data: out, error: null };
    }

    then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
      onfulfilled?:
        | ((value: {
            data: unknown;
            error: unknown;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from: (table: string) => new Builder(table),
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
  } as unknown as SupabaseClient;
  return { client, db, writes };
}

function goalRows(
  id: string,
  kind: string,
  key: string,
  extra: { isDeleted?: boolean; sortOrder?: number; role?: string } = {},
): { meta: Row; payload: Row } {
  return {
    meta: {
      id,
      user_id: "u1",
      role: extra.role ?? "goal",
      title: id,
      is_deleted: extra.isDeleted ?? false,
      deleted_at: null,
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-01T00:00:00.000Z",
    },
    payload: {
      item_id: id,
      user_id: "u1",
      period_kind: kind,
      period_key: key,
      sort_order: extra.sortOrder ?? 0,
      parent_goal_id: null,
      manual_achieved_at: null,
      period_end_decision: null,
      decided_at: null,
      carried_from_goal_id: null,
      legacy_key: null,
    },
  };
}

function seed(...goals: Array<{ meta: Row; payload: Row }>) {
  return {
    items_meta: goals.map((g) => g.meta),
    goals_payload: goals.map((g) => g.payload),
  };
}

const metaWrites = (writes: Write[]) =>
  writes.filter((w) => w.table === "items_meta" && w.op !== "insert");

describe("SupabaseGoalsService — reads", () => {
  const year = goalRows("g-year", "year", "2026");
  const month = goalRows("g-month", "month", "2026-10");
  const weekB = goalRows("g-week-b", "week", "2026-10-04", { sortOrder: 1 });
  const weekA = goalRows("g-week-a", "week", "2026-10-04", { sortOrder: 0 });
  const lastWeek = goalRows("g-last", "week", "2026-09-27");
  const trashed = goalRows("g-trash", "week", "2026-10-04", {
    isDeleted: true,
  });

  it("fetchGoalsForDate returns the year, month and Sunday-week goals", async () => {
    const { client } = makeFake(
      seed(year, month, weekB, weekA, lastWeek, trashed),
    );
    const goals = await new SupabaseGoalsService(client).fetchGoalsForDate(
      "2026-10-07",
    );
    expect(goals.map((g) => g.id)).toEqual([
      "g-month",
      "g-week-a",
      "g-year",
      "g-week-b",
    ]);
  });

  it("fetchGoalsInPeriod reads one period and rejects a non-Sunday week", async () => {
    const { client } = makeFake(seed(weekA, lastWeek, trashed));
    const service = new SupabaseGoalsService(client);
    expect(
      (await service.fetchGoalsInPeriod("week", "2026-09-27")).map((g) => g.id),
    ).toEqual(["g-last"]);
    await expect(
      service.fetchGoalsInPeriod("week", "2026-10-05"),
    ).rejects.toThrow(/period key/);
  });

  it("fetchGoals skips trashed goals", async () => {
    const { client } = makeFake(seed(year, trashed));
    const goals = await new SupabaseGoalsService(client).fetchGoals();
    expect(goals.map((g) => g.id)).toEqual(["g-year"]);
  });
});

describe("SupabaseGoalsService — writes", () => {
  it("createGoal writes both rows and checks the parent is one level up", async () => {
    const { client, db } = makeFake(
      seed(
        goalRows("g-year", "year", "2026"),
        goalRows("g-m", "month", "2026-10"),
      ),
    );
    const service = new SupabaseGoalsService(client);
    const goal = await service.createGoal({
      id: "g-new",
      title: "Week goal",
      periodKind: "week",
      periodKey: "2026-10-04",
      parentGoalId: "g-m",
    });
    expect(goal).toMatchObject({ id: "g-new", parentGoalId: "g-m" });
    expect(db.goals_payload.some((p) => p.item_id === "g-new")).toBe(true);

    await expect(
      service.createGoal({
        id: "g-bad",
        title: "Skips a level",
        periodKind: "week",
        periodKey: "2026-10-04",
        parentGoalId: "g-year",
      }),
    ).rejects.toThrow(/expected month/);
    expect(db.items_meta.some((m) => m.id === "g-bad")).toBe(false);
  });

  it("createGoal hard-deletes the meta row when the payload INSERT fails (R2)", async () => {
    const { client, db, writes } = makeFake(
      {},
      { failInsertInto: "goals_payload" },
    );
    await expect(
      new SupabaseGoalsService(client).createGoal({
        id: "g-orphan",
        title: "x",
        periodKind: "year",
        periodKey: "2026",
      }),
    ).rejects.toThrow(/createGoal goals_payload/);
    expect(db.items_meta).toEqual([]);
    expect(metaWrites(writes)[0].filters).toContainEqual({
      op: "eq",
      col: "role",
      val: "goal",
    });
  });

  it("updateGoal bumps items_meta.updated_at even for a payload-only change", async () => {
    const { client, db, writes } = makeFake(
      seed(goalRows("g-1", "week", "2026-10-04")),
    );
    const goal = await new SupabaseGoalsService(client).updateGoal("g-1", {
      sortOrder: 5,
      periodEndDecision: "carried",
    });
    const [bump] = metaWrites(writes);
    expect(bump.patch?.updated_at).toEqual(expect.any(String));
    expect(bump.patch?.updated_at).not.toBe("2026-10-01T00:00:00.000Z");
    expect(bump.filters).toContainEqual({ op: "eq", col: "role", val: "goal" });
    expect(goal).toMatchObject({ sortOrder: 5, periodEndDecision: "carried" });
    expect(goal.decidedAt).toBe(bump.patch?.updated_at);
    expect(goal.updatedAt).toBe(bump.patch?.updated_at);
    expect(db.goals_payload[0].sort_order).toBe(5);
  });

  it("updateGoal refuses an id that is not a goal and leaves its payload alone", async () => {
    const todo = goalRows("task-1", "week", "2026-10-04", { role: "task" });
    const { client, writes } = makeFake(seed(todo));
    await expect(
      new SupabaseGoalsService(client).updateGoal("task-1", { sortOrder: 9 }),
    ).rejects.toThrow(/no goal task-1/);
    expect(writes.some((w) => w.table === "goals_payload")).toBe(false);
  });

  it("softDeleteGoal / restoreGoal bump the cursor with a role filter", async () => {
    const { client, db, writes } = makeFake(
      seed(goalRows("g-1", "year", "2026")),
    );
    const service = new SupabaseGoalsService(client);
    await service.softDeleteGoal("g-1");
    expect(db.items_meta[0]).toMatchObject({ is_deleted: true });
    await service.restoreGoal("g-1");
    expect(db.items_meta[0]).toMatchObject({
      is_deleted: false,
      deleted_at: null,
    });
    for (const w of metaWrites(writes)) {
      expect(w.patch?.updated_at).toEqual(expect.any(String));
      expect(w.filters).toContainEqual({ op: "eq", col: "role", val: "goal" });
    }
  });
});

describe("SupabaseGoalsService — goal ↔ todo links", () => {
  it("link is idempotent, unlink soft-deletes, relink makes a new live row", async () => {
    const { client, db } = makeFake({});
    const service = new SupabaseGoalsService(client);

    const first = await service.linkGoalTodo("g-1", "task-1");
    const again = await service.linkGoalTodo("g-1", "task-1");
    expect(again.id).toBe(first.id);
    expect(first.id).toMatch(/^goallink-/);
    await service.linkGoalTodo("g-2", "task-1");
    expect(
      (await service.fetchGoalTodoLinks(["g-1"])).map((l) => l.todoId),
    ).toEqual(["task-1"]);

    await service.unlinkGoalTodo("g-1", "task-1");
    const dead = db.goal_todo_links.find((r) => r.id === first.id);
    expect(dead).toMatchObject({ is_deleted: true });
    expect(dead?.updated_at).toEqual(expect.any(String));
    expect(await service.fetchGoalTodoLinks(["g-1"])).toEqual([]);

    const relinked = await service.linkGoalTodo("g-1", "task-1");
    expect(relinked.id).not.toBe(first.id);
    expect(await service.fetchGoalTodoLinks(["g-1", "g-2"])).toHaveLength(2);
  });

  it("returns the row another device inserted between the lookup and the INSERT", async () => {
    const { client } = makeFake(
      {},
      {
        beforeInsert: (table, db) => {
          if (table !== "goal_todo_links") return;
          db.goal_todo_links.push({
            id: "goallink-other",
            goal_id: "g-1",
            todo_id: "task-1",
            is_deleted: false,
          });
        },
      },
    );
    const link = await new SupabaseGoalsService(client).linkGoalTodo(
      "g-1",
      "task-1",
    );
    expect(link.id).toBe("goallink-other");
  });
});
