import type { Goal, GoalPeriodKind } from "../../types/goal";
import { goalPeriodKey, judgeGoals } from "../../utils/goalAchievement";
import {
  goalProgressOf,
  linkedGoalIds,
  type GoalLinkState,
  type GoalProgress,
} from "./goalLinkPreview";
import { GOALS_PER_PERIOD_LIMIT } from "./goalNoteMigration";

/*
 * What the morning paper reads off the goals (#2106, plan Step 7) — pure, so
 * the block, the todo rows' marks and the period-end review all come from one
 * place and are tested without a screen.
 *
 * Achievement is never decided here: every verdict is `judgeGoals` (the rule
 * the MCP tools share), read through `goalProgressOf` like the linking
 * screens do, so the paper cannot disagree with Connect or with Claude.
 */

/* Week first: it is the period a todo usually serves (goalLinkPreview.ts). */
const KIND_RANK: Readonly<Record<GoalPeriodKind, number>> = {
  week: 0,
  month: 1,
  year: 2,
};

const byOrder = (a: Goal, b: Goal): number =>
  a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);

export interface MorningGoalLine {
  id: string;
  title: string;
  progress: GoalProgress;
}

export interface MorningGoals {
  /** The current period key of each kind, for the day the paper shows. */
  periodKeys: Record<GoalPeriodKind, string>;
  year: MorningGoalLine[];
  month: MorningGoalLine[];
  week: MorningGoalLine[];
}

function periodKeysOf(todayKey: string): Record<GoalPeriodKind, string> {
  return {
    week: goalPeriodKey("week", todayKey),
    month: goalPeriodKey("month", todayKey),
    year: goalPeriodKey("year", todayKey),
  };
}

const NOT_JUDGED: GoalProgress = {
  done: 0,
  total: 0,
  achieved: false,
  connected: false,
};

/**
 * The current week / month / year goals with their progress. Not cut to the
 * limit: the limit is kept where goals are made, and cutting here would only
 * hide a fourth goal another device managed to write.
 */
export function buildMorningGoals(
  state: GoalLinkState,
  todayKey: string,
): MorningGoals {
  const periodKeys = periodKeysOf(todayKey);
  const judged = judgeGoals(state);
  const linesOf = (kind: GoalPeriodKind): MorningGoalLine[] =>
    state.goals
      .filter(
        (g) =>
          !g.isDeleted &&
          g.periodKind === kind &&
          g.periodKey === periodKeys[kind],
      )
      .sort(byOrder)
      .map((g) => {
        const j = judged[g.id];
        return {
          id: g.id,
          title: g.title,
          progress: j ? goalProgressOf(j) : NOT_JUDGED,
        };
      });
  return {
    periodKeys,
    year: linesOf("year"),
    month: linesOf("month"),
    week: linesOf("week"),
  };
}

/**
 * Titles of the goals `todoId` still serves — week → month → year. A goal
 * the period-end review has answered is over: dropped, achieved, or carried
 * (the copy starts with no links), so its title would otherwise sit on
 * today's row as if the todo still counted toward it.
 */
export function goalMarkTitles(state: GoalLinkState, todoId: string): string[] {
  const ids = new Set(linkedGoalIds(state.links, todoId));
  if (ids.size === 0) return [];
  return state.goals
    .filter(
      (g) => !g.isDeleted && g.periodEndDecision === null && ids.has(g.id),
    )
    .sort(
      (a, b) =>
        KIND_RANK[a.periodKind] - KIND_RANK[b.periodKind] || byOrder(a, b),
    )
    .map((g) => g.title);
}

export interface PeriodEndItem {
  goal: Goal;
  progress: GoalProgress;
}

/**
 * The goals the period-end review still has to ask about (P1 / P2): live,
 * from a period before the current one of their kind, unanswered and not
 * achieved. Week → month → year, oldest period first, then `sortOrder`.
 *
 * Every past period, not only the one just ended: a week the app was never
 * opened in would otherwise never be asked about. Keys of one kind sort as
 * plain strings (`YYYY` / `YYYY-MM` / the week's Sunday), so "before" is a
 * string comparison.
 */
export function periodEndQueue(
  state: GoalLinkState,
  todayKey: string,
): PeriodEndItem[] {
  const periodKeys = periodKeysOf(todayKey);
  const judged = judgeGoals(state);
  return state.goals
    .filter(
      (g) =>
        !g.isDeleted &&
        g.periodKey < periodKeys[g.periodKind] &&
        g.periodEndDecision === null &&
        judged[g.id]?.achieved !== true,
    )
    .sort(
      (a, b) =>
        KIND_RANK[a.periodKind] - KIND_RANK[b.periodKind] ||
        a.periodKey.localeCompare(b.periodKey) ||
        byOrder(a, b),
    )
    .map((goal) => {
      const j = judged[goal.id];
      return { goal, progress: j ? goalProgressOf(j) : NOT_JUDGED };
    });
}

export interface CarryPlan {
  /** The current period key of the goal's kind. */
  periodKey: string;
  /** A live goal already carried from this one — re-used, not made twice. */
  existingId: string | null;
  /** The current period still has room under the limit. */
  hasRoom: boolean;
  /** Where a new goal goes: after the current period's live goals. */
  sortOrder: number;
  /** The parent, kept only when it is live and in ITS current period. */
  parentGoalId: string | null;
}

/**
 * How「持ち越す」lands. A goal carried earlier (whose decision write then
 * failed) is found by `carriedFromGoalId` and re-used, so answering again
 * writes the decision without making a second copy.
 */
export function carryPlan(
  state: GoalLinkState,
  goal: Goal,
  todayKey: string,
): CarryPlan {
  const periodKeys = periodKeysOf(todayKey);
  const periodKey = periodKeys[goal.periodKind];
  const current = state.goals.filter(
    (g) =>
      !g.isDeleted &&
      g.periodKind === goal.periodKind &&
      g.periodKey === periodKey,
  );
  const existing = current.find((g) => g.carriedFromGoalId === goal.id);
  const parent =
    goal.parentGoalId === null
      ? undefined
      : state.goals.find((g) => g.id === goal.parentGoalId && !g.isDeleted);
  return {
    periodKey,
    existingId: existing?.id ?? null,
    hasRoom: current.length < GOALS_PER_PERIOD_LIMIT,
    sortOrder: current.length,
    parentGoalId:
      parent && parent.periodKey === periodKeys[parent.periodKind]
        ? parent.id
        : null,
  };
}

/**
 * A day inside the period `key` names, for the host's range label of a past
 * period: the week key is its own Sunday, a month its 1st, a year its 1 Jan.
 */
export function periodStartDateKey(kind: GoalPeriodKind, key: string): string {
  switch (kind) {
    case "week":
      return key;
    case "month":
      return `${key}-01`;
    case "year":
      return `${key}-01-01`;
  }
}
