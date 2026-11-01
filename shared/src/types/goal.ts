/*
 * Goals linked to Todos (#2101 / #2102) — the domain shape of one goal.
 *
 * Storage is the 2-row split (0034): `items_meta` (role `goal`) holds the
 * title, the soft delete and the LWW cursor; `goals_payload` holds the rest.
 * The DataService and its mapper come with a later Issue (plan Step 3); this
 * file only fixes the vocabulary the pure helpers in
 * `utils/goalAchievement.ts` and the MCP server share.
 *
 * Plan (SSOT): .claude/docs/vision/plans/2026-10-03-briefing-goals-redesign.md
 */

/** year → `YYYY`, month → `YYYY-MM`, week → the week's Sunday `YYYY-MM-DD`. */
export type GoalPeriodKind = "year" | "month" | "week";

/** The answer to the end-of-period review. `achieved` overrides the links. */
export type GoalPeriodEndDecision = "carried" | "dropped" | "achieved";

export interface Goal {
  id: string;
  title: string;
  periodKind: GoalPeriodKind;
  periodKey: string;
  sortOrder: number;
  /** One level up: a week's month, a month's year. Null at the top. */
  parentGoalId: string | null;
  /** Set by hand, and only honoured while the goal is unconnected. */
  manualAchievedAt: string | null;
  periodEndDecision: GoalPeriodEndDecision | null;
  decidedAt: string | null;
  /** The goal this one was carried over from. */
  carriedFromGoalId: string | null;
  /** The `note-goals` section it was migrated from, so it moves only once. */
  legacyKey: string | null;
  /**
   * A date range set by hand (#2366, 0044), both `YYYY-MM-DD` or both null.
   * Null keeps the period's own range. Optional so the rows and fixtures
   * written before 0044 still type.
   */
  startDate?: string | null;
  endDate?: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A goal's own range (#2366): first and last day, both `YYYY-MM-DD`. */
export interface GoalDateRange {
  startDate: string;
  endDate: string;
}

/** One goal ↔ todo edge (`goal_todo_links`). */
export interface GoalTodoLink {
  id: string;
  goalId: string;
  todoId: string;
  isDeleted: boolean;
}
