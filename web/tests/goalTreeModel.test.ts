import { describe, expect, it } from "vitest";
import {
  arrangeGoalTree,
  buildGoalTreeModel,
  DEFAULT_GOAL_TREE_FILTER,
  goalParentOptions,
  goalPeriodBounds,
  type Goal,
  type GoalTreeArrangement,
} from "@life-editor/shared";

/*
 * The pure half of Connect's Goals & Todos tab (#2108): which goals are drawn
 * where, and which goals a goal may hang under. The screen suite
 * (connectGoalsTab.test.tsx) walks the brief's sample; these are the branches
 * that sample does not reach. Today is Wednesday 2026-09-30, so the week is
 * 9/27 – 10/3 (Sunday start — D-20260816-briefing-1) and straddles two months.
 */

const TODAY = "2026-09-30";

function goal(over: Partial<Goal> & Pick<Goal, "id">): Goal {
  return {
    title: over.id,
    periodKind: "week",
    periodKey: "2026-09-27",
    sortOrder: 0,
    parentGoalId: null,
    manualAchievedAt: null,
    periodEndDecision: null,
    decidedAt: null,
    carriedFromGoalId: null,
    legacyKey: null,
    isDeleted: false,
    createdAt: "2026-09-27T00:00:00Z",
    updatedAt: "2026-09-27T00:00:00Z",
    ...over,
  };
}

const build = (goals: Goal[]) =>
  buildGoalTreeModel({
    goals,
    links: [],
    todos: [],
    todayKey: TODAY,
    untitled: "Untitled",
  });

describe("buildGoalTreeModel (#2108)", () => {
  it("lists an unconnected goal in the group even when it hangs under a parent", () => {
    const model = build([
      goal({ id: "m", periodKind: "month", periodKey: "2026-09" }),
      goal({ id: "w", parentGoalId: "m" }),
    ]);
    const m = model.byId.get("m");
    expect(m?.children.map((n) => n.goal.id)).toEqual(["w"]);
    expect(model.unconnected.map((n) => n.goal.id)).toEqual(["w"]);
    // The month has a child, so it is connected and a root.
    expect(model.roots.map((n) => n.goal.id)).toEqual(["m"]);
  });

  it("draws a past-period parent so this week's goal stays under it", () => {
    const model = build([
      goal({ id: "aug", periodKind: "month", periodKey: "2026-08" }),
      goal({ id: "w", parentGoalId: "aug" }),
    ]);
    expect(model.roots.map((n) => n.goal.id)).toEqual(["aug"]);
    expect(model.byId.get("aug")?.children.map((n) => n.goal.id)).toEqual([
      "w",
    ]);
    // Only the current periods count toward the add limit.
    expect(model.periodCounts).toEqual({ year: 0, month: 0, week: 1 });
  });

  it("survives a parent cycle in bad data", () => {
    const model = build([
      goal({
        id: "a",
        periodKind: "month",
        periodKey: "2026-09",
        parentGoalId: "b",
      }),
      goal({
        id: "b",
        periodKind: "month",
        periodKey: "2026-09",
        parentGoalId: "a",
      }),
    ]);
    expect(model.byId.size).toBe(2);
  });
});

/*
 * Sort and filter (#2225). The year holds the month, which holds two weeks:
 * "Beta week" half done (1/2) and "Alpha week" achieved (1/1). "Gamma week"
 * has nothing linked. One loose todo is open, one was done this week.
 */
function arrangedFixture() {
  const goals = [
    goal({
      id: "y",
      title: "Zeta year",
      periodKind: "year",
      periodKey: "2026",
    }),
    goal({
      id: "m",
      title: "Alpha month",
      periodKind: "month",
      periodKey: "2026-09",
      parentGoalId: "y",
    }),
    goal({ id: "w1", title: "Beta week", parentGoalId: "m" }),
    goal({ id: "w2", title: "Alpha week", parentGoalId: "m", sortOrder: 1 }),
    goal({ id: "w3", title: "Gamma week", sortOrder: 2 }),
  ];
  const link = (goalId: string, todoId: string) => ({
    id: `${goalId}-${todoId}`,
    goalId,
    todoId,
    isDeleted: false,
  });
  return buildGoalTreeModel({
    goals,
    links: [link("w1", "t1"), link("w1", "t2"), link("w2", "t3")],
    todos: [
      { id: "t1", title: "t1", status: "DONE" },
      { id: "t2", title: "t2", status: "NOT_STARTED" },
      { id: "t3", title: "t3", status: "DONE" },
      { id: "l1", title: "l1", status: "NOT_STARTED" },
      {
        id: "l2",
        title: "l2",
        status: "DONE",
        completedAt: "2026-09-29T03:00:00Z",
      },
    ],
    todayKey: TODAY,
    untitled: "Untitled",
  });
}

const ids = (nodes: readonly { goal: Goal }[]) => nodes.map((n) => n.goal.id);
const arrange = (
  sort: GoalTreeArrangement["sort"],
  filter: Partial<GoalTreeArrangement["filter"]> = {},
) =>
  arrangeGoalTree(arrangedFixture(), {
    sort,
    filter: { ...DEFAULT_GOAL_TREE_FILTER, ...filter },
  });

describe("arrangeGoalTree (#2225)", () => {
  it("keeps the build order under the standard sort", () => {
    const model = arrange("standard");
    expect(ids(model.roots)).toEqual(["y"]);
    expect(ids(model.roots[0].children[0].children)).toEqual(["w1", "w2"]);
    expect(ids(model.unconnected)).toEqual(["w3"]);
  });

  it("puts the further-along sibling first under the progress sort", () => {
    const month = arrange("progress").roots[0].children[0];
    // Achieved (1/1) before half done (1/2).
    expect(ids(month.children)).toEqual(["w2", "w1"]);
  });

  it("orders siblings by title under the name sort", () => {
    const month = arrange("name").roots[0].children[0];
    expect(ids(month.children)).toEqual(["w2", "w1"]);
  });

  it("lifts a period's goals out of the frame the filter drops", () => {
    const model = arrange("standard", { period: "week" });
    expect(ids(model.roots)).toEqual(["w1", "w2"]);
    expect(ids(model.unconnected)).toEqual(["w3"]);
    expect(ids(arrange("standard", { period: "year" }).roots)).toEqual(["y"]);
  });

  it("keeps only the goals in the picked state", () => {
    const achieved = arrange("standard", { status: "achieved" });
    expect(ids(achieved.roots)).toEqual(["w2"]);
    expect(achieved.unconnected).toEqual([]);

    const unconnected = arrange("standard", { status: "unconnected" });
    expect(unconnected.roots).toEqual([]);
    expect(ids(unconnected.unconnected)).toEqual(["w3"]);

    // In progress: the year and the month are not achieved either.
    const inProgress = arrange("standard", { status: "inProgress" });
    expect(ids(inProgress.roots)).toEqual(["y"]);
    expect(ids(inProgress.roots[0].children[0].children)).toEqual(["w1"]);
  });

  it("hides done todos without touching the progress or the panel's lookup", () => {
    const model = arrange("standard", { hideDoneTodos: true });
    const week = model.roots[0].children[0].children[0];
    expect(week.todos.map((t) => t.id)).toEqual(["t2"]);
    expect(week.achievement.todos).toEqual({ done: 1, total: 2 });
    expect(model.looseTodos.map((t) => t.id)).toEqual(["l1"]);
    expect(model.byId.get("w1")?.todos.map((t) => t.id)).toEqual(["t1", "t2"]);
  });
});

describe("goalParentOptions (#2108)", () => {
  it("offers both months to a week that straddles them", () => {
    const sep = goal({ id: "sep", periodKind: "month", periodKey: "2026-09" });
    const oct = goal({ id: "oct", periodKind: "month", periodKey: "2026-10" });
    const nov = goal({ id: "nov", periodKind: "month", periodKey: "2026-11" });
    const week = goal({ id: "w" });
    expect(
      goalParentOptions([sep, oct, nov, week], week).map((g) => g.id),
    ).toEqual(["oct", "sep"].sort());
  });

  it("offers a month its year, and a year nothing", () => {
    const year = goal({ id: "y", periodKind: "year", periodKey: "2026" });
    const last = goal({ id: "y0", periodKind: "year", periodKey: "2025" });
    const month = goal({ id: "m", periodKind: "month", periodKey: "2026-09" });
    expect(
      goalParentOptions([year, last, month], month).map((g) => g.id),
    ).toEqual(["y"]);
    expect(goalParentOptions([year, last, month], year)).toEqual([]);
  });
});

describe("a goal's own date range (#2366)", () => {
  it("keeps a goal on the tree past its period while its range holds", () => {
    const model = build([
      // Last week's goal, set to run to 10/5.
      goal({
        id: "ranged",
        periodKey: "2026-09-20",
        startDate: "2026-09-20",
        endDate: "2026-10-05",
      }),
      // Last week's goal with the week's own range: gone, as before.
      goal({ id: "plain", periodKey: "2026-09-20" }),
      // A range that ended yesterday.
      goal({
        id: "ended",
        periodKey: "2026-09-20",
        startDate: "2026-09-20",
        endDate: "2026-09-29",
      }),
    ]);
    expect([...model.byId.keys()]).toEqual(["ranged"]);
    // The count orders new goals; a carried-in range is not this week's.
    expect(model.periodCounts.week).toBe(0);
  });

  it("still shows a goal of the current period whose range starts later", () => {
    const model = build([
      goal({ id: "later", startDate: "2026-10-10", endDate: "2026-10-20" }),
    ]);
    expect(model.byId.has("later")).toBe(true);
  });

  it("gives each period's own first and last day", () => {
    expect(goalPeriodBounds("week", "2026-09-27")).toEqual({
      start: "2026-09-27",
      end: "2026-10-03",
    });
    expect(goalPeriodBounds("month", "2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(goalPeriodBounds("month", "2028-02").end).toBe("2028-02-29");
    expect(goalPeriodBounds("year", "2026")).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });
});
