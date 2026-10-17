import { describe, expect, it } from "vitest";
import {
  buildGoalTreeModel,
  canDropGoalOn,
  canDropOn,
  type Goal,
} from "@life-editor/shared";

/*
 * Where a drag in Connect's Goals & Todos tree may land (#2226). A goal goes
 * only under a goal one period up, in the period that holds it — the rule
 * SupabaseGoalsService.assertParent enforces, left unchanged. Today is
 * Wednesday 2026-09-30, so the week 9/27 – 10/3 straddles two months.
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

const year = goal({ id: "y", periodKind: "year", periodKey: "2026" });
const lastYear = goal({ id: "y0", periodKind: "year", periodKey: "2025" });
const sept = goal({ id: "m9", periodKind: "month", periodKey: "2026-09" });
const oct = goal({ id: "m10", periodKind: "month", periodKey: "2026-10" });
const aug = goal({ id: "m8", periodKind: "month", periodKey: "2026-08" });
const week = goal({ id: "w" });
const otherWeek = goal({ id: "w2" });

describe("canDropGoalOn (#2226)", () => {
  it("lets a week go under a month that holds it, either one when it straddles two", () => {
    expect(canDropGoalOn(week, sept)).toBe(true);
    expect(canDropGoalOn(week, oct)).toBe(true);
    expect(canDropGoalOn(week, aug)).toBe(false);
  });

  it("refuses the same period, a shorter one and two periods up", () => {
    expect(canDropGoalOn(week, otherWeek)).toBe(false);
    expect(canDropGoalOn(week, year)).toBe(false);
    expect(canDropGoalOn(sept, week)).toBe(false);
    expect(canDropGoalOn(sept, oct)).toBe(false);
    expect(canDropGoalOn(year, sept)).toBe(false);
    expect(canDropGoalOn(year, lastYear)).toBe(false);
  });

  it("lets a month go under its own year only", () => {
    expect(canDropGoalOn(sept, year)).toBe(true);
    expect(canDropGoalOn(sept, lastYear)).toBe(false);
  });

  it("does not offer the parent it already has, nor the goal itself", () => {
    expect(canDropGoalOn({ ...week, parentGoalId: "m9" }, sept)).toBe(false);
    expect(canDropGoalOn({ ...week, parentGoalId: "m9" }, oct)).toBe(true);
    expect(canDropGoalOn(sept, sept)).toBe(false);
  });
});

describe("canDropOn for a todo (#2226)", () => {
  const model = buildGoalTreeModel({
    goals: [year, sept, week, otherWeek],
    links: [{ id: "l", goalId: "w", todoId: "t", isDeleted: false }],
    todos: [{ id: "t", title: "Run", status: "NOT_STARTED" }],
    todayKey: "2026-09-30",
    untitled: "Untitled",
  });

  it("lands on any goal it is not linked to yet, whatever the period", () => {
    const source = { kind: "todo", todoId: "t", fromGoalId: "w" } as const;
    expect(canDropOn(source, week, model)).toBe(false);
    expect(canDropOn(source, otherWeek, model)).toBe(true);
    expect(canDropOn(source, sept, model)).toBe(true);
    expect(canDropOn(source, year, model)).toBe(true);
  });
});
