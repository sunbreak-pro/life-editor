import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseStub,
  fromTables,
  type StubRow,
  type SupabaseStub,
} from "./supabaseStub.js";
import type {
  GoalAchievement,
  GoalAchievementInput,
} from "../src/utils/goalAchievement.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const {
  createGoal,
  deleteGoal,
  linkGoalTodo,
  listGoals,
  unlinkGoalTodo,
  updateGoal,
} = await import("../src/handlers/goalHandlers.js");

/*
 * The goal tools (#2104). The rule itself is pinned by goalAchievement.test.ts;
 * what this suite adds is the READ around it — that the handler loads every
 * row the rule needs (descendants in other periods, links, the linked todos'
 * liveness and status) and hands back what shared would answer for the same
 * rows. Hence the first block replays shared's fixture through the DB stub.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    resolve(here, "../../shared/tests/fixtures/goalAchievement.json"),
    "utf8",
  ),
) as {
  achievement: (GoalAchievementInput & {
    name: string;
    expected: Record<string, GoalAchievement>;
  })[];
};

/** 2026-10-06 is a Tuesday; its week starts on Sunday 2026-10-04. */
const DATE = "2026-10-06";
const KEY = { year: "2026", month: "2026-10", week: "2026-10-04" } as const;

interface GoalSpec {
  id: string;
  kind?: keyof typeof KEY;
  /** Default: the period of `kind` that DATE falls in. */
  key?: string;
  parent?: string | null;
  manual?: string | null;
  decision?: string | null;
  deleted?: boolean;
  sort?: number;
}

function goalRows(goals: GoalSpec[]): { meta: StubRow[]; payload: StubRow[] } {
  return {
    meta: goals.map((g) => ({
      id: g.id,
      role: "goal",
      title: `title:${g.id}`,
      is_deleted: g.deleted ?? false,
    })),
    payload: goals.map((g) => ({
      item_id: g.id,
      period_kind: g.kind ?? "week",
      period_key: g.key ?? KEY[g.kind ?? "week"],
      sort_order: g.sort ?? 0,
      parent_goal_id: g.parent ?? null,
      manual_achieved_at: g.manual ?? null,
      period_end_decision: g.decision ?? null,
      decided_at: g.decision ? "2026-10-05T00:00:00Z" : null,
      carried_from_goal_id: null,
    })),
  };
}

function install(
  goals: GoalSpec[],
  todos: { id: string; done: boolean; deleted?: boolean }[] = [],
  links: { goalId: string; todoId: string; deleted?: boolean }[] = [],
): void {
  const { meta, payload } = goalRows(goals);
  stub = createSupabaseStub(
    fromTables({
      items_meta: [
        ...meta,
        ...todos.map((t) => ({
          id: t.id,
          role: "task",
          title: `title:${t.id}`,
          is_deleted: t.deleted ?? false,
        })),
      ],
      goals_payload: payload,
      tasks_payload: todos.map((t) => ({
        item_id: t.id,
        status: t.done ? "DONE" : "NOT_STARTED",
      })),
      goal_todo_links: links.map((l, i) => ({
        id: `goallink-${i}`,
        goal_id: l.goalId,
        todo_id: l.todoId,
        is_deleted: l.deleted ?? false,
      })),
    }),
  );
}

describe("list_goals answers like shared (fixture #2102)", () => {
  it.each(fixture.achievement)(
    "$name",
    async ({ goals, todos, links, expected }) => {
      // Every fixture goal goes into the period of its kind that DATE falls in,
      // so one list_goals call sees all of them.
      install(
        goals.map((g) => ({
          id: g.id,
          kind: g.periodKind,
          parent: g.parentGoalId,
          manual: g.manualAchievedAt,
          decision: g.periodEndDecision,
          deleted: g.isDeleted,
        })),
        todos.map((t) => ({ id: t.id, done: t.done, deleted: t.isDeleted })),
        links.map((l) => ({ ...l, deleted: l.isDeleted })),
      );

      const { periods } = await listGoals({ date: DATE });

      const answered = Object.fromEntries(
        periods.flatMap((p) => p.goals).map((g) => [g.id, g.achievement]),
      );
      expect(answered).toEqual(expected);
    },
  );
});

describe("list_goals", () => {
  it("judges a month by its weeks even when they sit in another period", async () => {
    // The month is listed alone; its child week is outside the asked period
    // but must still be loaded for the month's answer.
    install(
      [
        { id: "m", kind: "month" },
        { id: "w", kind: "week", parent: "m" },
      ],
      [{ id: "t1", done: true }],
      [{ goalId: "w", todoId: "t1" }],
    );

    const { periods } = await listGoals({
      period_kind: "month",
      period_key: "2026-10",
    });

    expect(periods).toHaveLength(1);
    expect(periods[0].goals.map((g) => g.id)).toEqual(["m"]);
    expect(periods[0].goals[0].achievement).toMatchObject({
      achieved: true,
      children: { achieved: 1, total: 1 },
    });
  });

  it("lists each goal's live linked todos with their state", async () => {
    install(
      [{ id: "w" }],
      [
        { id: "t1", done: true },
        { id: "t2", done: false },
        { id: "t-trashed", done: false, deleted: true },
      ],
      [
        { goalId: "w", todoId: "t1" },
        { goalId: "w", todoId: "t2" },
        { goalId: "w", todoId: "t-trashed" },
      ],
    );

    const { periods } = await listGoals({ date: DATE, period_kind: "week" });

    expect(periods[0].goals[0].todos).toEqual([
      { id: "t1", title: "title:t1", done: true },
      { id: "t2", title: "title:t2", done: false },
    ]);
    expect(periods[0].goals[0].achievement.todos).toEqual({
      done: 1,
      total: 2,
    });
  });

  it("refuses a week key that is not a Sunday", async () => {
    install([]);
    await expect(
      listGoals({ period_kind: "week", period_key: "2026-10-05" }),
    ).rejects.toThrow(/not a week period key/);
  });
});

describe("create_goal", () => {
  it("writes the meta and payload rows, at the end of the period", async () => {
    install([
      { id: "m", kind: "month" },
      { id: "w1", sort: 4 },
    ]);

    const goal = await createGoal({
      title: "  three runs ",
      period_kind: "week",
      date: DATE,
      parent_id: "m",
    });

    expect(goal).toMatchObject({
      title: "three runs",
      periodKind: "week",
      periodKey: "2026-10-04",
      sortOrder: 5,
      parentGoalId: "m",
      achievement: { achieved: false, connected: false },
    });
    const [meta, payload] = stub.writes();
    expect(meta).toMatchObject({
      table: "items_meta",
      op: "insert",
      values: { id: goal.id, role: "goal", title: "three runs" },
    });
    expect(payload).toMatchObject({
      table: "goals_payload",
      op: "insert",
      values: {
        item_id: goal.id,
        period_kind: "week",
        period_key: "2026-10-04",
        parent_goal_id: "m",
      },
    });
    expect(goal.id).toMatch(/^goal-/);
  });

  it("refuses a fourth live goal in a period; a trashed one does not count", async () => {
    install([{ id: "w1" }, { id: "w2" }, { id: "w-trashed", deleted: true }]);
    await expect(
      createGoal({ title: "third", period_kind: "week", date: DATE }),
    ).resolves.toMatchObject({ periodKey: "2026-10-04" });

    install([{ id: "w1" }, { id: "w2" }, { id: "w3" }]);
    await expect(
      createGoal({ title: "fourth", period_kind: "week", date: DATE }),
    ).rejects.toThrow(/week 2026-10-04 already has 3 goals/);
    expect(stub.writes()).toEqual([]);
  });

  it("only takes a parent one level up", async () => {
    install([{ id: "y", kind: "year" }]);
    await expect(
      createGoal({ title: "x", period_kind: "week", parent_id: "y" }),
    ).rejects.toThrow(/a week goal takes a month goal as its parent/);

    install([{ id: "m", kind: "month" }]);
    await expect(
      createGoal({ title: "x", period_kind: "year", parent_id: "m" }),
    ).rejects.toThrow(/a year goal has no parent/);
    expect(stub.writes()).toEqual([]);
  });
});

describe("update_goal", () => {
  // "Has the period ended?" is asked of today, so today is pinned to DATE.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${DATE}T12:00:00`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const payloadWrite = () =>
    stub.writes().find((w) => w.table === "goals_payload");
  const metaWrite = () => stub.writes().find((w) => w.table === "items_meta");

  it("refuses the hand mark on a connected goal", async () => {
    install(
      [{ id: "w" }],
      [{ id: "t1", done: false }],
      [{ goalId: "w", todoId: "t1" }],
    );

    await expect(
      updateGoal({ id: "w", manual_achieved: true }),
    ).rejects.toThrow(/connected to todos or goals/);
    expect(stub.writes()).toEqual([]);
  });

  it("sets the hand mark on an unconnected goal and bumps updated_at", async () => {
    install([{ id: "w" }]);

    await updateGoal({ id: "w", manual_achieved: true });

    expect(payloadWrite()?.values?.manual_achieved_at).toEqual(
      expect.any(String),
    );
    expect(metaWrite()?.filters).toEqual({ id: "w", role: "goal" });
    expect(metaWrite()?.values).toHaveProperty("updated_at");
  });

  it("stamps decided_at with a period-end answer and clears it with null", async () => {
    install([{ id: "w", key: "2026-09-27" }]); // last week: it has ended
    await updateGoal({ id: "w", period_end_decision: "carried" });
    expect(payloadWrite()?.values).toMatchObject({
      period_end_decision: "carried",
      decided_at: expect.any(String),
    });

    install([{ id: "w", decision: "carried" }]);
    await updateGoal({ id: "w", period_end_decision: null, parent_id: null });
    expect(payloadWrite()?.values).toEqual({
      period_end_decision: null,
      decided_at: null,
      parent_goal_id: null,
    });
  });

  it("refuses a period-end answer while the period is still running", async () => {
    // A connected goal mid-period: 'achieved' would skip its open todo.
    install(
      [{ id: "w" }],
      [{ id: "t1", done: false }],
      [{ goalId: "w", todoId: "t1" }],
    );
    await expect(
      updateGoal({ id: "w", period_end_decision: "achieved" }),
    ).rejects.toThrow(/week 2026-10-04 of w has not ended yet/);

    install([{ id: "m", kind: "month" }]);
    await expect(
      updateGoal({ id: "m", period_end_decision: "dropped" }),
    ).rejects.toThrow(/has not ended yet/);
    expect(stub.writes()).toEqual([]);

    // Clearing a decision is never a review answer, so it is always allowed.
    install([{ id: "w", decision: "carried" }]);
    await updateGoal({ id: "w", period_end_decision: null });
    expect(payloadWrite()?.values).toEqual({
      period_end_decision: null,
      decided_at: null,
    });
  });

  it("closes a connected goal of an ended period as achieved", async () => {
    install(
      [{ id: "w", key: "2026-09-27" }],
      [{ id: "t1", done: false }],
      [{ goalId: "w", todoId: "t1" }],
    );
    const goal = await updateGoal({ id: "w", period_end_decision: "achieved" });
    expect(payloadWrite()?.values).toMatchObject({
      period_end_decision: "achieved",
    });
    // The stub does not apply writes, so the read-back is the old row.
    expect(goal.periodKey).toBe("2026-09-27");
  });

  it("treats a null title or sort_order as not supplied", async () => {
    install([{ id: "w", sort: 2 }]);
    await updateGoal({ id: "w", title: null, sort_order: null });
    expect(stub.writes()).toEqual([]);
  });

  it("writes nothing when nothing changed", async () => {
    install([{ id: "w" }]);
    await updateGoal({ id: "w" });
    expect(stub.writes()).toEqual([]);
  });
});

describe("links and delete", () => {
  it("links a todo once, and refuses a non-todo", async () => {
    install([{ id: "w" }], [{ id: "t1", done: false }]);
    const linked = await linkGoalTodo({ goal_id: "w", todo_id: "t1" });
    expect(linked.created).toBe(true);
    expect(stub.writes()[0]).toMatchObject({
      table: "goal_todo_links",
      op: "insert",
      values: { goal_id: "w", todo_id: "t1", is_deleted: false },
    });
    expect(linked.linkId).toMatch(/^goallink-/);

    install(
      [{ id: "w" }],
      [{ id: "t1", done: false }],
      [{ goalId: "w", todoId: "t1" }],
    );
    const again = await linkGoalTodo({ goal_id: "w", todo_id: "t1" });
    expect(again).toMatchObject({ created: false, linkId: "goallink-0" });
    expect(stub.writes()).toEqual([]);

    await expect(linkGoalTodo({ goal_id: "w", todo_id: "w" })).rejects.toThrow(
      /Todo not found: w/,
    );
  });

  it("treats a link another device made mid-call as already linked", async () => {
    // The lookup finds nothing, then the insert hits the partial UNIQUE
    // because the pair was linked in between (Postgres 23505).
    install([{ id: "w" }], [{ id: "t1", done: false }]);
    const base = stub;
    const linkRows: StubRow[] = [];
    const links = createSupabaseStub(fromTables({ goal_todo_links: linkRows }));
    const fromOf = (s: SupabaseStub) =>
      (s.client as unknown as { from: (t: string) => object }).from;
    stub = {
      ...base,
      client: {
        from: (table: string) =>
          table !== "goal_todo_links"
            ? fromOf(base)(table)
            : {
                ...fromOf(links)(table),
                insert: async () => {
                  linkRows.push({
                    id: "goallink-other",
                    goal_id: "w",
                    todo_id: "t1",
                    is_deleted: false,
                  });
                  return {
                    data: null,
                    error: { code: "23505", message: "duplicate key" },
                  };
                },
              },
      } as never,
    };

    const linked = await linkGoalTodo({ goal_id: "w", todo_id: "t1" });

    expect(linked).toMatchObject({ created: false, linkId: "goallink-other" });
    expect(linked.goal.todos.map((t) => t.id)).toEqual(["t1"]);
  });

  it("refuses to unlink from a trashed goal before writing", async () => {
    install(
      [{ id: "w", deleted: true }],
      [{ id: "t1", done: false }],
      [{ goalId: "w", todoId: "t1" }],
    );
    await expect(
      unlinkGoalTodo({ goal_id: "w", todo_id: "t1" }),
    ).rejects.toThrow(/Goal not found: w/);
    expect(stub.writes()).toEqual([]);
  });

  it("unlinks by soft delete, and an absent link is a no-op", async () => {
    install(
      [{ id: "w" }],
      [{ id: "t1", done: false }],
      [{ goalId: "w", todoId: "t1" }],
    );
    expect(await unlinkGoalTodo({ goal_id: "w", todo_id: "t1" })).toMatchObject(
      { removed: true },
    );
    expect(stub.writes()[0]).toMatchObject({
      table: "goal_todo_links",
      op: "update",
      values: { is_deleted: true },
      filters: { id: "goallink-0" },
    });

    install([{ id: "w" }]);
    expect(await unlinkGoalTodo({ goal_id: "w", todo_id: "t1" })).toMatchObject(
      { removed: false },
    );
    expect(stub.writes()).toEqual([]);
  });

  it("deletes a goal softly, under its own role", async () => {
    install([{ id: "w" }]);
    await deleteGoal({ id: "w" });
    expect(stub.writes()).toHaveLength(1);
    expect(stub.writes()[0]).toMatchObject({
      table: "items_meta",
      op: "update",
      values: { is_deleted: true },
      filters: { id: "w", role: "goal" },
    });
  });
});
