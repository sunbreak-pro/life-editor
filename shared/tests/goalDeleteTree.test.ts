// @vitest-environment node (this suite touches no DOM)
import { describe, expect, it } from "vitest";
import {
  buildGoalDeleteTree,
  planGoalDelete,
  type Goal,
  type GoalDeleteGoalRow,
} from "../src";

/*
 * What deleting a goal takes with it (#2405), as data. The dialog and the
 * screen are covered by goalDeleteDialog.test.tsx and connectGoalsTab.test.tsx;
 * the rules for what stays and in what order the writes run live here.
 */

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

const YEAR = goal({ id: "y", periodKind: "year", periodKey: "2026" });
const MONTH = goal({
  id: "m",
  periodKind: "month",
  periodKey: "2026-09",
  parentGoalId: "y",
});
const WEEK = goal({ id: "w", parentGoalId: "m" });
// A week that is over: not on the drawn tree, still under the month.
const PAST_WEEK = goal({
  id: "pw",
  periodKey: "2026-09-20",
  parentGoalId: "m",
  sortOrder: 1,
});
const ELSEWHERE = goal({ id: "other" });

const link = (goalId: string, todoId: string, isDeleted = false) => ({
  goalId,
  todoId,
  isDeleted,
});

const todo = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: id,
  status: "NOT_STARTED",
  parentId: null,
  ...over,
});

const INPUT = {
  goal: YEAR,
  goals: [YEAR, MONTH, WEEK, PAST_WEEK, ELSEWHERE],
  links: [
    link("y", "ty"),
    link("m", "tm"),
    link("w", "tw"),
    link("pw", "tp"),
    link("other", "tw"),
  ],
  todos: [todo("ty"), todo("tm"), todo("tw"), todo("tp")],
  untitled: "Untitled",
};

const ids = (row: GoalDeleteGoalRow): string[] => [
  row.goal.id,
  ...row.todos.map((t) => t.id),
  ...row.children.flatMap(ids),
];

describe("buildGoalDeleteTree (#2405)", () => {
  it("walks the whole subtree, past periods included, and nothing beside it", () => {
    const tree = buildGoalDeleteTree(INPUT);
    expect(ids(tree)).toEqual(["y", "ty", "m", "tm", "w", "tw", "pw", "tp"]);
    expect(tree.children[0]?.children.map((c) => c.goal.id)).toEqual([
      "w",
      "pw",
    ]);
  });

  it("leaves deleted goals, todos and links out", () => {
    const tree = buildGoalDeleteTree({
      ...INPUT,
      goals: [YEAR, MONTH, { ...WEEK, isDeleted: true }],
      links: [link("y", "ty", true), link("y", "gone"), link("m", "tm")],
      todos: [todo("ty"), todo("tm"), todo("gone", { isDeleted: true })],
    });
    expect(ids(tree)).toEqual(["y", "m", "tm"]);
  });

  it("gives a goal with nothing under it an empty tree", () => {
    const tree = buildGoalDeleteTree({ ...INPUT, goal: ELSEWHERE, links: [] });
    expect(tree.todos).toEqual([]);
    expect(tree.children).toEqual([]);
  });

  it("marks a todo another live goal holds, wherever that goal sits", () => {
    const tree = buildGoalDeleteTree({ ...INPUT, goal: WEEK });
    expect(tree.todos[0]).toMatchObject({ id: "tw", alsoLinked: true });
    const alone = buildGoalDeleteTree({
      ...INPUT,
      goal: PAST_WEEK,
    });
    expect(alone.todos[0]).toMatchObject({ id: "tp", alsoLinked: false });
    // A link to a deleted goal holds nothing any more.
    const stale = buildGoalDeleteTree({
      ...INPUT,
      goal: WEEK,
      goals: [YEAR, MONTH, WEEK, { ...ELSEWHERE, isDeleted: true }],
    });
    expect(stale.todos[0]).toMatchObject({ id: "tw", alsoLinked: false });
  });

  it("draws a todo two goals of the subtree hold once, and remembers both links", () => {
    const tree = buildGoalDeleteTree({
      ...INPUT,
      goal: MONTH,
      links: [link("w", "shared"), link("pw", "shared")],
      todos: [todo("shared")],
    });
    const [week, past] = tree.children;
    expect(week?.todos.map((t) => t.id)).toEqual(["shared"]);
    expect(past?.todos).toEqual([]);
    expect(past?.linkedTodoIds).toEqual(["shared"]);
  });

  it("names an untitled todo", () => {
    const tree = buildGoalDeleteTree({
      ...INPUT,
      goal: ELSEWHERE,
      links: [link("other", "blank")],
      todos: [todo("blank", { title: "" })],
    });
    expect(tree.todos[0]?.title).toBe("Untitled");
  });

  it("carries nested todos on their row, stopping at a todo with a box of its own", () => {
    const tree = buildGoalDeleteTree({
      ...INPUT,
      goal: WEEK,
      links: [link("w", "parent"), link("w", "linkedChild")],
      todos: [
        todo("parent"),
        todo("child", { parentId: "parent" }),
        todo("grandchild", { parentId: "child" }),
        todo("linkedChild", { parentId: "parent" }),
        todo("under-linked", { parentId: "linkedChild" }),
        todo("gone", { parentId: "parent", isDeleted: true }),
      ],
    });
    expect(
      tree.todos.map((t) => [t.id, [...t.nestedTodoIds].sort()]),
    ).toEqual([
      ["parent", ["child", "grandchild"]],
      ["linkedChild", ["under-linked"]],
    ]);
  });

  it("survives a cycle in the goals and in the todos", () => {
    const tree = buildGoalDeleteTree({
      ...INPUT,
      goal: goal({ id: "a", parentGoalId: "b" }),
      goals: [
        goal({ id: "a", parentGoalId: "b" }),
        goal({ id: "b", parentGoalId: "a" }),
      ],
      links: [link("a", "t1")],
      todos: [
        todo("t1", { parentId: "t2" }),
        todo("t2", { parentId: "t1" }),
      ],
    });
    expect(tree.children.map((c) => c.goal.id)).toEqual(["b"]);
    expect(tree.children[0]?.children).toEqual([]);
    expect(tree.todos[0]?.nestedTodoIds).toEqual(["t2"]);
  });
});

describe("planGoalDelete (#2405)", () => {
  const tree = buildGoalDeleteTree(INPUT);

  it("takes everything when every box stays ticked, the asked goal last", () => {
    const plan = planGoalDelete(tree, new Set());
    expect(plan.detachGoalIds).toEqual([]);
    expect(plan.unlinks).toEqual([]);
    expect(plan.deleteTodoIds.sort()).toEqual(["tm", "tp", "ty", "tw"].sort());
    expect(plan.deleteGoalIds).toEqual(["w", "pw", "m", "y"]);
  });

  it("detaches a kept goal only when its own parent goes", () => {
    // m is kept: y goes, so m is detached. w and pw go; m is not their reason
    // to stay, because each box is read on its own.
    expect(planGoalDelete(tree, new Set(["m"]))).toMatchObject({
      detachGoalIds: ["m"],
      deleteGoalIds: ["w", "pw", "y"],
    });
    // m and w are kept: w's parent stays, so w keeps it.
    expect(planGoalDelete(tree, new Set(["m", "w"]))).toMatchObject({
      detachGoalIds: ["m"],
      deleteGoalIds: ["pw", "y"],
    });
    // w is kept under a month that goes.
    expect(planGoalDelete(tree, new Set(["w"]))).toMatchObject({
      detachGoalIds: ["w"],
      deleteGoalIds: ["pw", "m", "y"],
    });
  });

  it("takes a kept todo off the goals that go, and off those only", () => {
    const plan = planGoalDelete(tree, new Set(["tw"]));
    expect(plan.unlinks).toEqual([{ goalId: "w", todoId: "tw" }]);
    expect(plan.deleteTodoIds).not.toContain("tw");

    // Its goal stays too, so the link stays with it.
    expect(planGoalDelete(tree, new Set(["w", "tw"])).unlinks).toEqual([]);
  });

  it("follows every link of a kept todo, also those drawn under another goal", () => {
    const shared = buildGoalDeleteTree({
      ...INPUT,
      goal: MONTH,
      links: [link("m", "t"), link("w", "t"), link("pw", "t")],
      todos: [todo("t")],
    });
    expect(planGoalDelete(shared, new Set(["t", "w"])).unlinks).toEqual([
      { goalId: "m", todoId: "t" },
      { goalId: "pw", todoId: "t" },
    ]);
  });

  it("deletes a todo a kept goal holds when its box stays ticked", () => {
    const plan = planGoalDelete(tree, new Set(["w"]));
    expect(plan.deleteTodoIds).toContain("tw");
    expect(plan.unlinks).toEqual([]);
  });

  it("takes nested todos with a ticked row and leaves them with a kept one", () => {
    const nested = buildGoalDeleteTree({
      ...INPUT,
      goal: WEEK,
      links: [link("w", "parent")],
      todos: [todo("parent"), todo("child", { parentId: "parent" })],
    });
    expect(planGoalDelete(nested, new Set()).deleteTodoIds).toEqual([
      "parent",
      "child",
    ]);
    expect(planGoalDelete(nested, new Set(["parent"])).deleteTodoIds).toEqual(
      [],
    );
  });

  it("always deletes the goal asked about", () => {
    expect(planGoalDelete(tree, new Set(["y"])).deleteGoalIds).toContain("y");
    const plain = buildGoalDeleteTree({ ...INPUT, goal: ELSEWHERE, links: [] });
    expect(planGoalDelete(plain, new Set())).toEqual({
      detachGoalIds: [],
      unlinks: [],
      deleteTodoIds: [],
      deleteGoalIds: ["other"],
    });
  });
});
