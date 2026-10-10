/*
 * Goal tree sub-barrel (#2108) — the Connect "Goals & Todos" tab. Pure and
 * injection-only; the host is web/src/connect/GoalsTodosScreen.tsx.
 *
 * The goal types ride along because the web host names them and the root
 * barrel does not export them yet (the goal groundwork, #2101–#2103, kept
 * them package-internal).
 */
export type { Goal, GoalPeriodKind, GoalTodoLink } from "../../types/goal";
export {
  buildGoalTreeModel,
  goalProgress,
  goalParentOptions,
  GOAL_PERIOD_KINDS,
  GOALS_PER_PERIOD,
  type BuildGoalTreeModelInput,
  type GoalTreeModel,
  type GoalTreeNode,
  type GoalTreeTodo,
} from "./buildGoalTreeModel";
export {
  GoalTreeView,
  type GoalTreeLabels,
  type GoalTreeViewProps,
} from "./GoalTreeView";
export {
  GoalDetailPanel,
  type GoalDetailLabels,
  type GoalDetailPanelProps,
  type GoalParentOption,
} from "./GoalDetailPanel";
