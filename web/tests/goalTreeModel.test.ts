import { describe, expect, it } from "vitest";
import {
  buildGoalTreeModel,
  goalParentOptions,
  type Goal,
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
