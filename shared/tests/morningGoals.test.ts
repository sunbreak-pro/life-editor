import { describe, it, expect } from "vitest";
import type { Goal } from "../src/types/goal";
import { judgeGoals } from "../src/utils/goalAchievement";
import {
  goalProgressOf,
  type GoalLinkState,
} from "../src/components/briefing/goalLinkPreview";
import {
  buildMorningGoals,
  carryPlan,
  goalMarkTitles,
  periodEndQueue,
  periodStartDateKey,
} from "../src/components/briefing/morningGoals";
import { goal, sampleState } from "./fixtures/goalLinkState";

/*
 * #2106 — what the morning paper reads off the goals. The sample day is
 * Wednesday 2026-09-30: this week is 09-27, this month 2026-09, this year
 * 2026 (fixtures/goalLinkState.ts). Every verdict must be `judgeGoals`'s, so
 * the progress is checked against it rather than against numbers typed here.
 */

const TODAY = "2026-09-30";

const withGoals = (
  state: GoalLinkState,
  extra: Goal[],
  links: Array<[string, string, boolean?]> = [],
  todos: Array<[string, boolean]> = [],
): GoalLinkState => ({
  goals: [...state.goals, ...extra],
  links: [
    ...state.links,
    ...links.map(([goalId, todoId, isDeleted]) => ({
      goalId,
      todoId,
      isDeleted: isDeleted === true,
    })),
  ],
  todos: [
    ...state.todos,
    ...todos.map(([id, done]) => ({ id, done, isDeleted: false })),
  ],
});

const ordered = (g: Goal, sortOrder: number): Goal => ({ ...g, sortOrder });

describe("buildMorningGoals", () => {
  it("picks the current week, month and year only", () => {
    const state = withGoals(sampleState(), [
      {
        ...goal("w-gone", "消した目標", "week", "2026-09-27"),
        isDeleted: true,
      },
      goal("m-old", "先月の目標", "month", "2026-08"),
      goal("y-old", "去年の目標", "year", "2025"),
    ]);
    const goals = buildMorningGoals(state, TODAY);
    expect(goals.periodKeys).toEqual({
      week: "2026-09-27",
      month: "2026-09",
      year: "2026",
    });
    expect(goals.week.map((l) => l.id)).toEqual(["w-run", "w-plan", "w-book"]);
    expect(goals.month.map((l) => l.id)).toEqual(["m-run", "m-deal"]);
    expect(goals.year.map((l) => l.id)).toEqual(["y-run"]);
  });

  it("orders a period by sortOrder", () => {
    const state = sampleState();
    const goals = buildMorningGoals(
      {
        ...state,
        goals: state.goals.map((g) =>
          g.id === "w-run"
            ? ordered(g, 2)
            : g.id === "w-plan"
              ? ordered(g, 0)
              : g.id === "w-book"
                ? ordered(g, 1)
                : g,
        ),
      },
      TODAY,
    );
    expect(goals.week.map((l) => l.id)).toEqual(["w-plan", "w-book", "w-run"]);
  });

  it("carries judgeGoals' verdicts: achieved, not yet, unconnected", () => {
    const state = withGoals(sampleState(), [
      {
        ...goal("w-hand", "手で達成にした", "week", "2026-09-27"),
        periodEndDecision: "achieved",
      },
    ]);
    const judged = judgeGoals(state);
    const goals = buildMorningGoals(state, TODAY);
    for (const line of goals.week) {
      expect(line.progress).toEqual(goalProgressOf(judged[line.id]!));
    }
    const byId = Object.fromEntries(goals.week.map((l) => [l.id, l.progress]));
    expect(byId["w-run"]).toMatchObject({ done: 2, total: 2, achieved: true });
    expect(byId["w-plan"]).toMatchObject({
      done: 2,
      total: 4,
      achieved: false,
    });
    expect(byId["w-book"]).toMatchObject({ connected: false, achieved: false });
    expect(byId["w-hand"]).toMatchObject({ achieved: true });
  });
});

describe("goalMarkTitles", () => {
  it("names the live goals a todo serves, week → month → year", () => {
    const state = withGoals(
      sampleState(),
      [
        {
          ...goal("w-gone", "消した目標", "week", "2026-09-27"),
          isDeleted: true,
        },
      ],
      [
        ["y-run", "t-free"],
        ["m-deal", "t-free"],
        ["w-plan", "t-free"],
        ["w-book", "t-free", true],
        ["w-gone", "t-free"],
      ],
    );
    expect(goalMarkTitles(state, "t-free")).toEqual([
      "企画書を通す",
      "秋の新規案件を受注する",
      "10 km を 60 分以内で走る",
    ]);
  });

  it("drops a goal the period-end review has answered, keeps one still open", () => {
    const state = withGoals(
      sampleState(),
      [
        {
          ...goal("w-dropped", "やめた目標", "week", "2026-09-20"),
          periodEndDecision: "dropped",
        },
        {
          ...goal("w-carried", "持ち越した元", "week", "2026-09-20"),
          periodEndDecision: "carried",
        },
        goal("w-open", "まだ聞いていない", "week", "2026-09-20"),
      ],
      [
        ["w-dropped", "t-free"],
        ["w-carried", "t-free"],
        ["w-open", "t-free"],
      ],
    );
    expect(goalMarkTitles(state, "t-free")).toEqual(["まだ聞いていない"]);
  });

  it("is empty for a todo no goal holds", () => {
    expect(goalMarkTitles(sampleState(), "t-freedone")).toEqual([]);
  });
});

describe("periodEndQueue", () => {
  it("asks about past, unanswered, unachieved goals only", () => {
    const state = withGoals(
      sampleState(),
      [
        {
          ...goal("w-dropped", "答えた", "week", "2026-09-20"),
          periodEndDecision: "dropped",
        },
        goal("w-done", "全部終わった", "week", "2026-09-20"),
        { ...goal("w-trash", "消した", "week", "2026-09-13"), isDeleted: true },
        goal("w-older", "2 週前", "week", "2026-09-13"),
        goal("m-old", "先月", "month", "2026-08"),
        goal("y-old", "去年", "year", "2025"),
      ],
      [["w-done", "t-past"]],
      [["t-past", true]],
    );
    expect(periodEndQueue(state, TODAY).map((i) => i.goal.id)).toEqual([
      "w-older",
      "w-old",
      "m-old",
      "y-old",
    ]);
  });

  it("orders one period by sortOrder and reports its progress", () => {
    const state = withGoals(
      sampleState(),
      [ordered(goal("w-first", "先", "week", "2026-09-20"), -1)],
      [["w-old", "t-plan3"]],
    );
    const queue = periodEndQueue(state, TODAY);
    expect(queue.map((i) => i.goal.id)).toEqual(["w-first", "w-old"]);
    expect(queue[1]!.progress).toMatchObject({
      done: 0,
      total: 1,
      connected: true,
    });
  });
});

describe("carryPlan", () => {
  const old = (): Goal =>
    sampleState().goals.find((g) => g.id === "w-old") as Goal;

  it("reports a full week: no room, the next sort slot", () => {
    const plan = carryPlan(sampleState(), old(), TODAY);
    expect(plan).toEqual({
      periodKey: "2026-09-27",
      existingId: null,
      hasRoom: false,
      sortOrder: 3,
      parentGoalId: null,
    });
  });

  it("has room once a current goal is gone", () => {
    const state = sampleState();
    const plan = carryPlan(
      {
        ...state,
        goals: state.goals.map((g) =>
          g.id === "w-book" ? { ...g, isDeleted: true } : g,
        ),
      },
      old(),
      TODAY,
    );
    expect(plan.hasRoom).toBe(true);
    expect(plan.sortOrder).toBe(2);
  });

  it("finds a copy carried earlier", () => {
    const state = withGoals(sampleState(), [
      {
        ...goal("w-copy", "部屋の模様替えを決める", "week", "2026-09-27"),
        carriedFromGoalId: "w-old",
      },
    ]);
    expect(carryPlan(state, old(), TODAY).existingId).toBe("w-copy");
  });

  it("keeps the parent only while it is in its current period", () => {
    const current = goal("w-a", "今月の親", "week", "2026-09-20", "m-run");
    const past = goal("w-b", "先月の親", "week", "2026-08-30", "m-old");
    const state = withGoals(sampleState(), [
      current,
      past,
      goal("m-old", "先月", "month", "2026-08"),
    ]);
    expect(carryPlan(state, current, TODAY).parentGoalId).toBe("m-run");
    expect(carryPlan(state, past, TODAY).parentGoalId).toBeNull();
  });
});

describe("periodStartDateKey", () => {
  it("gives a day inside each kind of period", () => {
    expect(periodStartDateKey("week", "2026-09-20")).toBe("2026-09-20");
    expect(periodStartDateKey("month", "2026-08")).toBe("2026-08-01");
    expect(periodStartDateKey("year", "2025")).toBe("2025-01-01");
  });
});
