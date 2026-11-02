import type { Goal, GoalTodoLink } from "../../types/goal";
import { compareGoals } from "./buildGoalTreeModel";

/*
 * What deleting a goal can take with it (#2405), as data: the goal's subtree
 * for the dialog to draw, and the writes the dialog's answer comes down to.
 *
 * Read from the host's raw lists, not from the tree's model: the model holds
 * the shown goals, and a year goal's subtree also holds past weeks that are
 * not drawn but would otherwise be left pointing at a deleted parent.
 *
 * Pure: no React, no I/O.
 */

export interface GoalDeleteTodoRow {
  id: string;
  title: string;
  done: boolean;
  /**
   * Deleting it reaches a goal outside this choice: it is linked to more than
   * one live goal, or a nested todo that goes with it is linked to one. Worked
   * out over every live goal, not only this subtree.
   */
  alsoLinked: boolean;
  /**
   * Live todos nested under it that are not rows themselves. They go with it,
   * as with the Todo list's own delete (useTodoTreeDeletion): `softDeleteTodo`
   * flips one row only, which alone would strand them under a deleted parent.
   * The UI can no longer create these (#418); old data can still hold them.
   */
  nestedTodoIds: readonly string[];
}

export interface GoalDeleteGoalRow {
  goal: Goal;
  /** Each todo is a row once, under the first goal of the walk that holds it. */
  todos: readonly GoalDeleteTodoRow[];
  /** Every live todo linked to this goal, the rows drawn elsewhere included. */
  linkedTodoIds: readonly string[];
  children: readonly GoalDeleteGoalRow[];
}

export interface GoalDeletePlan {
  /** Kept goals whose parent is going: `parentGoalId` becomes null. */
  detachGoalIds: string[];
  /** Links from a kept todo to a goal that is going. */
  unlinks: { goalId: string; todoId: string }[];
  deleteTodoIds: string[];
  /** Children before parents, so the goal asked about is always the last. */
  deleteGoalIds: string[];
}

export interface BuildGoalDeleteTreeInput {
  goal: Goal;
  goals: readonly Goal[];
  links: readonly Pick<GoalTodoLink, "goalId" | "todoId" | "isDeleted">[];
  todos: readonly {
    id: string;
    title: string;
    status?: string;
    parentId?: string | null;
    isDeleted?: boolean;
  }[];
  untitled: string;
}

export function buildGoalDeleteTree({
  goal,
  goals,
  links,
  todos,
  untitled,
}: BuildGoalDeleteTreeInput): GoalDeleteGoalRow {
  const liveGoals = goals.filter((g) => !g.isDeleted);
  const liveGoalIds = new Set(liveGoals.map((g) => g.id));
  const liveTodos = todos.filter((t) => !t.isDeleted);
  const todoById = new Map(liveTodos.map((t) => [t.id, t]));

  const childGoals = new Map<string, Goal[]>();
  for (const g of liveGoals) {
    if (!g.parentGoalId) continue;
    const list = childGoals.get(g.parentGoalId) ?? [];
    list.push(g);
    childGoals.set(g.parentGoalId, list);
  }

  const nestedTodos = new Map<string, string[]>();
  for (const t of liveTodos) {
    if (!t.parentId) continue;
    const list = nestedTodos.get(t.parentId) ?? [];
    list.push(t.id);
    nestedTodos.set(t.parentId, list);
  }

  const todosOfGoal = new Map<string, string[]>();
  const goalsOfTodo = new Map<string, Set<string>>();
  for (const link of links) {
    if (link.isDeleted) continue;
    if (!liveGoalIds.has(link.goalId) || !todoById.has(link.todoId)) continue;
    const held = goalsOfTodo.get(link.todoId) ?? new Set<string>();
    if (held.has(link.goalId)) continue;
    held.add(link.goalId);
    goalsOfTodo.set(link.todoId, held);
    const list = todosOfGoal.get(link.goalId) ?? [];
    list.push(link.todoId);
    todosOfGoal.set(link.goalId, list);
  }

  // Guards a (bad-data) cycle in the goals, as the tree's own walk does.
  const seenGoals = new Set<string>();
  const collectGoals = (id: string): void => {
    if (seenGoals.has(id)) return;
    seenGoals.add(id);
    for (const child of childGoals.get(id) ?? []) collectGoals(child.id);
  };
  collectGoals(goal.id);

  // Known before any row is built: a nested todo that is linked to a goal here
  // keeps a box of its own rather than going with its parent unasked.
  const rowTodoIds = new Set<string>();
  for (const id of seenGoals) {
    for (const todoId of todosOfGoal.get(id) ?? []) rowTodoIds.add(todoId);
  }

  const nestedUnder = (rowId: string): string[] => {
    const out: string[] = [];
    const visited = new Set<string>([rowId]);
    const stack = [...(nestedTodos.get(rowId) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (visited.has(id) || rowTodoIds.has(id)) continue;
      visited.add(id);
      out.push(id);
      stack.push(...(nestedTodos.get(id) ?? []));
    }
    return out;
  };

  const drawnTodos = new Set<string>();
  const visitedGoals = new Set<string>();
  const buildRow = (current: Goal): GoalDeleteGoalRow => {
    visitedGoals.add(current.id);
    const linkedTodoIds = todosOfGoal.get(current.id) ?? [];
    const rows: GoalDeleteTodoRow[] = [];
    for (const todoId of linkedTodoIds) {
      if (drawnTodos.has(todoId)) continue;
      drawnTodos.add(todoId);
      const todo = todoById.get(todoId);
      if (!todo) continue;
      const nestedTodoIds = nestedUnder(todoId);
      rows.push({
        id: todo.id,
        title: todo.title || untitled,
        done: todo.status === "DONE",
        alsoLinked:
          (goalsOfTodo.get(todoId)?.size ?? 0) > 1 ||
          // A nested todo linked to a goal here has a row of its own, so any
          // live link one of these holds is to a goal outside the subtree.
          nestedTodoIds.some((id) => goalsOfTodo.has(id)),
        nestedTodoIds,
      });
    }
    const children = (childGoals.get(current.id) ?? [])
      .filter((child) => !visitedGoals.has(child.id))
      .sort(compareGoals)
      .map(buildRow);
    return { goal: current, todos: rows, linkedTodoIds, children };
  };
  return buildRow(goal);
}

/** Nothing under the goal, so the dialog has no list to offer. */
export function goalDeleteTreeIsEmpty(tree: GoalDeleteGoalRow): boolean {
  return tree.todos.length === 0 && tree.children.length === 0;
}

/**
 * The dialog's answer as writes. `keptIds` holds the goals and todos that were
 * unticked; ids are unique across roles (CLAUDE.md §4), so one set serves both.
 *
 * A box is read on its own: a kept goal does not keep what is under it, and a
 * goal that goes does not take a kept child with it.
 */
export function planGoalDelete(
  tree: GoalDeleteGoalRow,
  keptIds: ReadonlySet<string>,
): GoalDeletePlan {
  const plan: GoalDeletePlan = {
    detachGoalIds: [],
    unlinks: [],
    deleteTodoIds: [],
    deleteGoalIds: [],
  };
  const deleteTodos = new Set<string>();
  const walk = (row: GoalDeleteGoalRow, goes: boolean): void => {
    for (const todo of row.todos) {
      if (keptIds.has(todo.id)) continue;
      deleteTodos.add(todo.id);
      for (const id of todo.nestedTodoIds) deleteTodos.add(id);
    }
    if (goes) {
      for (const todoId of row.linkedTodoIds) {
        if (keptIds.has(todoId)) {
          plan.unlinks.push({ goalId: row.goal.id, todoId });
        }
      }
    }
    for (const child of row.children) {
      const childGoes = !keptIds.has(child.goal.id);
      if (!childGoes && goes) plan.detachGoalIds.push(child.goal.id);
      walk(child, childGoes);
    }
    if (goes) plan.deleteGoalIds.push(row.goal.id);
  };
  // The goal asked about has no box and always goes, whatever the set says.
  walk(tree, true);
  plan.deleteTodoIds = [...deleteTodos];
  return plan;
}
