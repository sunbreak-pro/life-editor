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
 * filed under last month's goal is still drawn under it. A goal with a range
 * of its own (#2366) is also shown on every day inside that range, so one set
 * to run past its period's end stays on the tree until its end date. A shown goal whose
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
  /**
   * Live goals in each current period. There is no limit any more (#2366);
   * a new goal takes the count as its sort order, so it lands last.
   */
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
  /**
   * Only who links whom is read, so the goals snapshot's links (no `id` in
   * their type) fit as well as full rows.
   */
  links: readonly (Pick<GoalTodoLink, "goalId" | "todoId" | "isDeleted"> &
    Partial<Pick<GoalTodoLink, "id">>)[];
  todos: readonly GoalTreeTodoSource[];
  /** `YYYY-MM-DD` — the day whose year / month / week is current. */
  todayKey: string;
  untitled: string;
}

/** The goal has a range of its own and `dayKey` falls inside it. */
function rangeHolds(goal: Goal, dayKey: string): boolean {
  return (
    !!goal.startDate &&
    !!goal.endDate &&
    goal.startDate <= dayKey &&
    dayKey <= goal.endDate
  );
}

/**
 * The first and last day of a period (#2366) — what a goal with no range of
 * its own covers, and what the add field offers before it is changed.
 */
export function goalPeriodBounds(
  kind: GoalPeriodKind,
  periodKey: string,
): { start: string; end: string } {
  if (kind === "week") {
    return { start: periodKey, end: addDaysKey(periodKey, 6) };
  }
  if (kind === "year") {
    return { start: `${periodKey}-01-01`, end: `${periodKey}-12-31` };
  }
  const [y, m] = periodKey.split("-").map(Number);
  // Day 0 of the next month is this month's last day.
  const last = new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
  return {
    start: `${periodKey}-01`,
    end: `${periodKey}-${String(last).padStart(2, "0")}`,
  };
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
    const inCurrentPeriod = goal.periodKey === periodKeys[goal.periodKind];
    if (inCurrentPeriod) periodCounts[goal.periodKind] += 1;
    if (!inCurrentPeriod && !rangeHolds(goal, todayKey)) continue;
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

/*
 * Sort and filter for the drawn tree (#2225). They rearrange a built model and
 * never re-judge it: progress and status are the ones `judgeGoals` already put
 * on each node, so a sorted tree and the Briefing papers still agree.
 */

/** "standard" is the build order: year → month → week, then `sortOrder`. */
export type GoalTreeSort = "standard" | "progress" | "name";

/** A goal's state as the row's chip shows it. */
export type GoalTreeStatus = "inProgress" | "achieved" | "unconnected";

export interface GoalTreeFilter {
  period: GoalPeriodKind | "all";
  status: GoalTreeStatus | "all";
  hideDoneTodos: boolean;
}

export interface GoalTreeArrangement {
  sort: GoalTreeSort;
  filter: GoalTreeFilter;
}

export const DEFAULT_GOAL_TREE_FILTER: GoalTreeFilter = {
  period: "all",
  status: "all",
  hideDoneTodos: false,
};

export const DEFAULT_GOAL_TREE_ARRANGEMENT: GoalTreeArrangement = {
  sort: "standard",
  filter: DEFAULT_GOAL_TREE_FILTER,
};

function goalTreeStatus(node: GoalTreeNode): GoalTreeStatus {
  if (node.achievement.achieved) return "achieved";
  return node.achievement.connected ? "inProgress" : "unconnected";
}

/** Achieved reads as 1 whatever its count says; nothing connected, as -1. */
function progressRatio(node: GoalTreeNode): number {
  if (node.achievement.achieved) return 1;
  const { done, total } = goalProgress(node.achievement);
  return total === 0 ? -1 : done / total;
}

/**
 * The model as drawn under `arrangement`. Sorting applies at every sibling
 * level, ties keeping the standard order. A goal the filter drops gives its
 * place to those of its children that pass, so "Week" lists this week's goals
 * on their own rather than a year → month frame around them. Hiding done
 * todos takes them off every goal and off the loose list; the progress counts
 * still include them. `byId` and the period counts are left whole — the panel
 * and the add limit are about the goals, not about what is drawn.
 */
export function arrangeGoalTree(
  model: GoalTreeModel,
  { sort, filter }: GoalTreeArrangement,
): GoalTreeModel {
  const passes = (node: GoalTreeNode): boolean =>
    (filter.period === "all" || node.goal.periodKind === filter.period) &&
    (filter.status === "all" || goalTreeStatus(node) === filter.status);
  const keepTodo = (todo: GoalTreeTodo): boolean =>
    !filter.hideDoneTodos || todo.status !== "DONE";

  const compare = (a: GoalTreeNode, b: GoalTreeNode): number => {
    if (sort === "progress") {
      const diff = progressRatio(b) - progressRatio(a);
      if (diff !== 0) return diff;
    } else if (sort === "name") {
      const diff = a.goal.title.localeCompare(b.goal.title, undefined, {
        numeric: true,
      });
      if (diff !== 0) return diff;
    }
    return compareGoals(a.goal, b.goal);
  };

  const arrange = (nodes: readonly GoalTreeNode[]): GoalTreeNode[] => {
    const out: GoalTreeNode[] = [];
    for (const node of nodes) {
      const children = arrange(node.children);
      if (passes(node)) {
        out.push({ ...node, todos: node.todos.filter(keepTodo), children });
      } else {
        out.push(...children);
      }
    }
    return out.sort(compare);
  };

  return {
    ...model,
    roots: arrange(model.roots),
    unconnected: arrange(model.unconnected),
    looseTodos: model.looseTodos.filter(keepTodo),
  };
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
