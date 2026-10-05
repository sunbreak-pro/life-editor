/*
 * Goal achievement and period keys (#2102) — the rule the Briefing screen and
 * the MCP tools must agree on, as pure functions (no I/O, no clock, no zone).
 *
 * The MCP server does not depend on shared (mcp-server/package.json), so the
 * same code also lives at mcp-server/src/utils/goalAchievement.ts. Two guards
 * keep the copies honest: both suites run the cases in
 * shared/tests/fixtures/goalAchievement.json, and the MCP suite compares the
 * two files' text below the marker. Edit both, or neither.
 *
 * Plan (SSOT): .claude/docs/vision/plans/2026-10-03-briefing-goals-redesign.md
 */

import type { GoalPeriodEndDecision, GoalPeriodKind } from "../types/goal";

// ── IDENTICAL BELOW THIS LINE in shared/src/utils/goalAchievement.ts and
// ── mcp-server/src/utils/goalAchievement.ts (mcp-server/tests/goalAchievement
// ── .test.ts compares the two texts from this marker down).

/*
 * Period keys. A goal belongs to exactly one period, written as a plain,
 * sortable key: the year (`2026`), the month (`2026-10`), or the week's FIRST
 * day (`2026-10-04`). The week starts on Sunday (D-20260816-briefing-1) — the
 * app-wide `WEEK_STARTS_ON`, which is also what the Briefing's old goal
 * headings used (`components/briefing/goalPeriods.ts`).
 *
 * The date arithmetic runs on UTC midnights of the calendar date, so the
 * answer depends only on the `YYYY-MM-DD` string and never on the time zone
 * of the machine (the Remote MCP Worker runs in UTC — CLAUDE.md §5).
 */

const PERIOD_KEY_SHAPE: Readonly<Record<GoalPeriodKind, RegExp>> = {
  year: /^\d{4}$/,
  month: /^\d{4}-(0[1-9]|1[0-2])$/,
  week: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
};

/** `YYYY-MM-DD` → its UTC midnight, or null for a malformed / impossible date. */
function calendarDate(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Date.UTC rolls 2026-02-31 over into March; the round trip catches it.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function dateKeyOf(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The key of the `kind` period the day `dateKey` (`YYYY-MM-DD`) falls in. */
export function goalPeriodKey(kind: GoalPeriodKind, dateKey: string): string {
  const date = calendarDate(dateKey);
  if (!date) {
    throw new Error(`goalPeriodKey: not a YYYY-MM-DD date: ${dateKey}`);
  }
  switch (kind) {
    case "year":
      return dateKey.slice(0, 4);
    case "month":
      return dateKey.slice(0, 7);
    case "week":
      date.setUTCDate(date.getUTCDate() - date.getUTCDay());
      return dateKeyOf(date);
  }
}

/**
 * True when `key` is a well-formed key for `kind`. Stricter than the DB CHECK
 * (0034), which can only see the shape: a week key must also be a real date
 * and a Sunday.
 */
export function isGoalPeriodKey(kind: GoalPeriodKind, key: string): boolean {
  if (!PERIOD_KEY_SHAPE[kind].test(key)) return false;
  if (kind !== "week") return true;
  const date = calendarDate(key);
  return date !== null && date.getUTCDay() === 0;
}

/*
 * Achievement (plan §達成の判定). The screen and the MCP tools must give the
 * same answer, so the rule lives here, as data in → data out:
 *
 *   - week:         at least one live linked todo, and all of them done.
 *   - month / year: the live child goals plus the live linked todos number at
 *                   least one; every child goal is achieved and every todo is
 *                   done. (A week's child goals, if bad data ever gave it any,
 *                   are not counted — the hierarchy stops at the week.)
 *   - unconnected:  nothing to count at all. Achieved only by hand
 *                   (`manualAchievedAt`), and the hand mark is ignored once
 *                   something is connected — the links decide from then on.
 *   - period end:   `periodEndDecision = "achieved"` is achieved, whatever
 *                   the links say.
 *   - only DIRECTLY linked todos count. A linked todo's subtasks are not
 *     followed (the UI cannot create them — #418), so an undone subtask never
 *     holds a goal back.
 *
 * "Live" means not soft-deleted: a deleted todo, a deleted link and a deleted
 * child goal all drop out of the count. A link to a todo the caller did not
 * pass in is treated the same way, so a partial todo list errs towards "not
 * counted" rather than towards a phantom undone todo.
 */

export interface GoalAchievementGoal {
  id: string;
  periodKind: GoalPeriodKind;
  parentGoalId: string | null;
  manualAchievedAt: string | null;
  periodEndDecision: GoalPeriodEndDecision | null;
  isDeleted: boolean;
}

export interface GoalAchievementTodo {
  id: string;
  done: boolean;
  isDeleted: boolean;
}

export interface GoalAchievementLink {
  goalId: string;
  todoId: string;
  isDeleted: boolean;
}

export interface GoalAchievementInput {
  goals: readonly GoalAchievementGoal[];
  todos: readonly GoalAchievementTodo[];
  links: readonly GoalAchievementLink[];
}

/** Why a goal counts as achieved: by its links, by hand, or at period end. */
export type GoalAchievedVia = "links" | "manual" | "period_end";

export interface GoalAchievement {
  achieved: boolean;
  /** Null exactly when `achieved` is false. */
  via: GoalAchievedVia | null;
  /** False when there is no live child goal and no live linked todo. */
  connected: boolean;
  todos: { done: number; total: number };
  children: { achieved: number; total: number };
}

/**
 * Judge every live goal in `input.goals`. Soft-deleted goals get no entry.
 * Child goals are judged first (memoised), so a year sees its months' answers
 * and a month its weeks'. A parent cycle — impossible through the app, but
 * nothing in the DB forbids it — counts the goal on the cycle as not achieved
 * instead of recursing forever.
 */
export function judgeGoals(
  input: GoalAchievementInput,
): Record<string, GoalAchievement> {
  const todoById = new Map<string, GoalAchievementTodo>();
  for (const todo of input.todos) todoById.set(todo.id, todo);

  const todoIdsByGoal = new Map<string, Set<string>>();
  for (const link of input.links) {
    if (link.isDeleted) continue;
    const todo = todoById.get(link.todoId);
    if (!todo || todo.isDeleted) continue;
    let ids = todoIdsByGoal.get(link.goalId);
    if (!ids) {
      ids = new Set<string>();
      todoIdsByGoal.set(link.goalId, ids);
    }
    ids.add(todo.id);
  }

  const liveGoals = input.goals.filter((g) => !g.isDeleted);
  const childrenByGoal = new Map<string, GoalAchievementGoal[]>();
  for (const goal of liveGoals) {
    if (goal.parentGoalId === null) continue;
    const siblings = childrenByGoal.get(goal.parentGoalId) ?? [];
    siblings.push(goal);
    childrenByGoal.set(goal.parentGoalId, siblings);
  }

  const result: Record<string, GoalAchievement> = {};
  const inProgress = new Set<string>();

  const judge = (goal: GoalAchievementGoal): GoalAchievement => {
    const known = result[goal.id];
    if (known) return known;
    inProgress.add(goal.id);

    const todoIds = [...(todoIdsByGoal.get(goal.id) ?? [])];
    const todosDone = todoIds.filter((id) => todoById.get(id)?.done).length;

    const children =
      goal.periodKind === "week" ? [] : (childrenByGoal.get(goal.id) ?? []);
    const childrenAchieved = children.filter(
      (child) => !inProgress.has(child.id) && judge(child).achieved,
    ).length;

    const connected = todoIds.length + children.length > 0;
    let via: GoalAchievedVia | null;
    if (goal.periodEndDecision === "achieved") {
      via = "period_end";
    } else if (!connected) {
      via = goal.manualAchievedAt !== null ? "manual" : null;
    } else {
      via =
        todosDone === todoIds.length && childrenAchieved === children.length
          ? "links"
          : null;
    }

    const judged: GoalAchievement = {
      achieved: via !== null,
      via,
      connected,
      todos: { done: todosDone, total: todoIds.length },
      children: { achieved: childrenAchieved, total: children.length },
    };
    inProgress.delete(goal.id);
    result[goal.id] = judged;
    return judged;
  };

  for (const goal of liveGoals) judge(goal);
  return result;
}
