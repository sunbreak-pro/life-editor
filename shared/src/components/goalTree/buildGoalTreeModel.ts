import type { Goal, GoalPeriodKind, GoalTodoLink } from "../../types/goal";
import type { TodoStatus } from "../../types/todoTree";
import {
  goalPeriodKey,
  judgeGoals,
  type GoalAchievement,
} from "../../utils/goalAchievement";
import { dateKeyOfInstant } from "../../utils/dateKey";
import { addDaysKey } from "../../utils/scheduleGridLayout";

/*
 * The Connect "Goals & Todos" tab as data (#2108, plan Step 9): the year →
 * month → week tree of the CURRENT periods, each goal carrying its judged
 * achievement and the todos linked to it.
 *
 * Achievement is `judgeGoals` over EVERY live goal and link, not just the
 * shown ones — a month goal's progress counts its earlier weeks too, and the
 * answer must match the Briefing papers and the MCP tools (plan §達成の判定).
 *
 * What is shown is narrower: the goals of this year, this month and this week
 * (Sunday start — D-20260816-briefing-1), plus their ancestors, so a week goal
 * filed under last month's goal is still drawn under it. A shown goal whose
 * parent is not shown is a root. Every shown goal with nothing connected is
 * listed in the "unconnected" group (brief §1.5 — 未接続 is a classification);
 * one that has a shown parent also stays under it, where the parent's
 * progress already counts it, while a parentless one is only in the group.
 *
 * A todo is "loose" when it is linked to no SHOWN goal: one held only by a
 * past period's goal would otherwise be drawn nowhere until that goal's
 * period-end decision. Loose todos are the open ones plus those completed
 * this week, done-styled (the brief's §11 sample lists a completed one).
 *
 * Pure: no React, no clock (the host passes `todayKey`), no I/O.
 */

export const GOAL_PERIOD_KINDS: readonly GoalPeriodKind[] = [
  "year",
  "month",
  "week",
];

/** Three goals per period at most (brief §1.2). */
export const GOALS_PER_PERIOD = 3;

export interface GoalTreeTodo {
  id: string;
  title: string;
  status: TodoStatus;
}

export interface GoalTreeNode {
  goal: Goal;
  achievement: GoalAchievement;
  todos: GoalTreeTodo[];
  children: GoalTreeNode[];
}

export interface GoalTreeModel {
  roots: GoalTreeNode[];
  unconnected: GoalTreeNode[];
  /** Live todos linked to no shown goal: open, or completed this week. */
  looseTodos: GoalTreeTodo[];
  /** Every shown goal by id — the panel's lookup. */
  byId: ReadonlyMap<string, GoalTreeNode>;
  periodKeys: Readonly<Record<GoalPeriodKind, string>>;
  /** Live goals in each current period — the add buttons' limit. */
  periodCounts: Readonly<Record<GoalPeriodKind, number>>;
}

/** The slice of a TodoNode the tree reads. */
export interface GoalTreeTodoSource {
  id: string;
  title: string;
  status?: TodoStatus;
  completedAt?: string;
  isDeleted?: boolean;
}

export interface BuildGoalTreeModelInput {
  goals: readonly Goal[];
  links: readonly GoalTodoLink[];
  todos: readonly GoalTreeTodoSource[];
  /** `YYYY-MM-DD` — the day whose year / month / week is current. */
  todayKey: string;
  untitled: string;
}

const KIND_RANK: Record<GoalPeriodKind, number> = {
  year: 0,
  month: 1,
  week: 2,
};

function compareGoals(a: Goal, b: Goal): number {
  return (
    KIND_RANK[a.periodKind] - KIND_RANK[b.periodKind] ||
    a.sortOrder - b.sortOrder ||
    a.id.localeCompare(b.id)
  );
}

export function buildGoalTreeModel({
  goals,
  links,
  todos,
  todayKey,
  untitled,
}: BuildGoalTreeModelInput): GoalTreeModel {
  const liveGoals = goals.filter((g) => !g.isDeleted);
  const liveTodos = todos.filter((t) => !t.isDeleted);
  const achievement = judgeGoals({
    goals: liveGoals,
    todos: liveTodos.map((t) => ({
      id: t.id,
      done: t.status === "DONE",
      isDeleted: false,
    })),
    links,
  });

  const periodKeys = {
    year: goalPeriodKey("year", todayKey),
    month: goalPeriodKey("month", todayKey),
    week: goalPeriodKey("week", todayKey),
  };
  const periodCounts = { year: 0, month: 0, week: 0 };
  const goalById = new Map(liveGoals.map((g) => [g.id, g]));
  const shown = new Set<string>();
  for (const goal of liveGoals) {
    if (goal.periodKey !== periodKeys[goal.periodKind]) continue;
    periodCounts[goal.periodKind] += 1;
    // The goal and its ancestors; the guard stops on a (bad-data) cycle.
    let cursor: Goal | undefined = goal;
    while (cursor && !shown.has(cursor.id)) {
      shown.add(cursor.id);
      cursor = cursor.parentGoalId
        ? goalById.get(cursor.parentGoalId)
        : undefined;
    }
  }

  const todoById = new Map(liveTodos.map((t) => [t.id, t]));
  const todosByGoal = new Map<string, GoalTreeTodo[]>();
  const linkedTodoIds = new Set<string>();
  for (const link of links) {
    if (link.isDeleted || !goalById.has(link.goalId)) continue;
    const todo = todoById.get(link.todoId);
    if (!todo) continue;
    if (shown.has(link.goalId)) linkedTodoIds.add(todo.id);
    const list = todosByGoal.get(link.goalId) ?? [];
    if (list.some((t) => t.id === todo.id)) continue;
    list.push({
      id: todo.id,
      title: todo.title || untitled,
      status: todo.status ?? "NOT_STARTED",
    });
    todosByGoal.set(link.goalId, list);
  }

  const byId = new Map<string, GoalTreeNode>();
  const ordered = liveGoals.filter((g) => shown.has(g.id)).sort(compareGoals);
  for (const goal of ordered) {
    const judged = achievement[goal.id];
    if (!judged) continue;
    byId.set(goal.id, {
      goal,
      achievement: judged,
      todos: todosByGoal.get(goal.id) ?? [],
      children: [],
    });
  }

  const roots: GoalTreeNode[] = [];
  const unconnected: GoalTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.goal.parentGoalId;
    const parent = parentId ? byId.get(parentId) : undefined;
    // A week never has children (the hierarchy stops there — judgeGoals).
    const underParent =
      parent !== undefined && parent.goal.periodKind !== "week";
    if (underParent) parent.children.push(node);
    if (!node.achievement.connected) unconnected.push(node);
    else if (!underParent) roots.push(node);
  }

  const doneThisWeek = (t: GoalTreeTodoSource): boolean => {
    const day = dateKeyOfInstant(t.completedAt);
    return day !== null && day >= periodKeys.week && day <= todayKey;
  };
  const looseTodos: GoalTreeTodo[] = liveTodos
    .filter(
      (t) =>
        !linkedTodoIds.has(t.id) && (t.status !== "DONE" || doneThisWeek(t)),
    )
    .map((t) => ({
      id: t.id,
      title: t.title || untitled,
      status: t.status ?? "NOT_STARTED",
    }));

  return { roots, unconnected, looseTodos, byId, periodKeys, periodCounts };
}

/** Progress as one fraction: child goals and direct todos count alike. */
export function goalProgress(achievement: GoalAchievement): {
  done: number;
  total: number;
} {
  return {
    done: achievement.children.achieved + achievement.todos.done,
    total: achievement.children.total + achievement.todos.total,
  };
}

/**
 * The goals `goal` may hang under: one level up, in the period that holds it
 * — a month's year; a week's month, or either month when the week straddles
 * two (a week is filed under its Sunday's month, but its Saturday may already
 * be in the next). Empty for a year, which is the top.
 */
export function goalParentOptions(goals: readonly Goal[], goal: Goal): Goal[] {
  if (goal.periodKind === "year") return [];
  const parentKind: GoalPeriodKind =
    goal.periodKind === "week" ? "month" : "year";
  const keys =
    goal.periodKind === "week"
      ? [goal.periodKey.slice(0, 7), addDaysKey(goal.periodKey, 6).slice(0, 7)]
      : [goal.periodKey.slice(0, 4)];
  return goals
    .filter(
      (g) =>
        !g.isDeleted &&
        g.id !== goal.id &&
        g.periodKind === parentKind &&
        keys.includes(g.periodKey),
    )
    .sort(compareGoals);
}
