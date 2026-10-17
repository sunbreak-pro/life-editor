import type { Goal } from "../../types/goal";
import { goalParentOptions, type GoalTreeModel } from "./buildGoalTreeModel";

/*
 * Where a drag in the Goals & Todos tree may land (#2226). Pure, so the rule
 * is pinned without a drag in jsdom.
 *
 * A goal lands only where the detail panel's parent field would offer it:
 * one level up, in the period that holds it (`goalParentOptions`). The same
 * rule is enforced again by `SupabaseGoalsService.assertParent`; this one only
 * decides which rows light up. Dropping on the parent it already has is not
 * offered, since nothing would change.
 *
 * A todo lands on any shown goal it is not already linked to.
 */

/** What is being dragged. `fromGoalId` is the row's goal; null when loose. */
export type GoalTreeDragSource =
  | { kind: "goal"; goal: Goal }
  | { kind: "todo"; todoId: string; fromGoalId: string | null };

export function canDropGoalOn(dragged: Goal, target: Goal): boolean {
  if (dragged.parentGoalId === target.id) return false;
  return goalParentOptions([target], dragged).length > 0;
}

/** The shown goals a todo is linked to — `byId` is whole whatever the filter. */
export function goalsHoldingTodo(
  model: Pick<GoalTreeModel, "byId">,
  todoId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const node of model.byId.values()) {
    if (node.todos.some((t) => t.id === todoId)) ids.add(node.goal.id);
  }
  return ids;
}

export function canDropOn(
  source: GoalTreeDragSource,
  target: Goal,
  model: Pick<GoalTreeModel, "byId">,
): boolean {
  if (source.kind === "goal") return canDropGoalOn(source.goal, target);
  return !goalsHoldingTodo(model, source.todoId).has(target.id);
}
