import type { Goal, GoalPeriodKind } from "../../src/types/goal";
import type { GoalLinkState } from "../../src/components/briefing/goalLinkPreview";

/*
 * #2109 — the brief's sample week (2026-09-30, a Wednesday; the week starts
 * on Sunday 09-27), cut down to what the linking screens need:
 *
 *   year  y-run    「10 km を 60 分以内で走る」
 *     month m-run  「週 3 回走る習慣をつける」
 *       week w-run 「3 回走る」        t-run1 ✓  t-run2 ✓   → achieved 2/2
 *   month m-deal   「秋の新規案件を受注する」
 *     week w-plan  「企画書を通す」    t-plan1 ✓ t-plan2 ✓ t-plan3 t-plan4 → 2/4
 *   week  w-book   「本を 1 冊読み切る」 (未接続)
 *   week  w-old    「部屋の模様替えを決める」 (last week)
 *
 * So linking an open todo to w-run takes the achievement off w-run, m-run
 * and y-run at once — the S1 / S2 case.
 */

export function goal(
  id: string,
  title: string,
  periodKind: GoalPeriodKind,
  periodKey: string,
  parentGoalId: string | null = null,
): Goal {
  return {
    id,
    title,
    periodKind,
    periodKey,
    sortOrder: 0,
    parentGoalId,
    manualAchievedAt: null,
    periodEndDecision: null,
    decidedAt: null,
    carriedFromGoalId: null,
    legacyKey: null,
    isDeleted: false,
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
  };
}

export const SAMPLE_GOALS: Goal[] = [
  goal("y-run", "10 km を 60 分以内で走る", "year", "2026"),
  goal("m-run", "週 3 回走る習慣をつける", "month", "2026-09", "y-run"),
  goal("m-deal", "秋の新規案件を受注する", "month", "2026-09"),
  goal("w-run", "3 回走る", "week", "2026-09-27", "m-run"),
  goal("w-plan", "企画書を通す", "week", "2026-09-27", "m-deal"),
  goal("w-book", "本を 1 冊読み切る", "week", "2026-09-27"),
  goal("w-old", "部屋の模様替えを決める", "week", "2026-09-20"),
];

const link = (goalId: string, todoId: string) => ({
  goalId,
  todoId,
  isDeleted: false,
});

export function sampleState(): GoalLinkState {
  return {
    goals: SAMPLE_GOALS,
    todos: [
      { id: "t-run1", done: true, isDeleted: false },
      { id: "t-run2", done: true, isDeleted: false },
      { id: "t-plan1", done: true, isDeleted: false },
      { id: "t-plan2", done: true, isDeleted: false },
      { id: "t-plan3", done: false, isDeleted: false },
      { id: "t-plan4", done: false, isDeleted: false },
      { id: "t-free", done: false, isDeleted: false },
      { id: "t-freedone", done: true, isDeleted: false },
    ],
    links: [
      link("w-run", "t-run1"),
      link("w-run", "t-run2"),
      link("w-plan", "t-plan1"),
      link("w-plan", "t-plan2"),
      link("w-plan", "t-plan3"),
      link("w-plan", "t-plan4"),
    ],
  };
}
