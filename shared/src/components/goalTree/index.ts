/*
 * Goal tree sub-barrel (#2108, sort and filter #2225) — the Connect "Goals &
 * Todos" tab. Pure and
 * injection-only; the host is web/src/connect/GoalsTodosScreen.tsx.
 *
 * The goal types ride along because the web host names them and the root
 * barrel does not export them yet (the goal groundwork, #2101–#2103, kept
 * them package-internal).
 */
export type { Goal, GoalPeriodKind, GoalTodoLink } from "../../types/goal";
export {
  arrangeGoalTree,
  buildGoalTreeModel,
  goalProgress,
  goalParentOptions,
  DEFAULT_GOAL_TREE_ARRANGEMENT,
  DEFAULT_GOAL_TREE_FILTER,
  GOAL_PERIOD_KINDS,
  GOALS_PER_PERIOD,
  type BuildGoalTreeModelInput,
  type GoalTreeArrangement,
  type GoalTreeFilter,
  type GoalTreeModel,
  type GoalTreeNode,
  type GoalTreeSort,
  type GoalTreeStatus,
  type GoalTreeTodo,
} from "./buildGoalTreeModel";
export {
  describeGoalTreeFilter,
  GoalTreeArrangePanel,
  type GoalTreeArrangeLabels,
  type GoalTreeArrangePanelProps,
} from "./GoalTreeArrangePanel";
export {
  GoalTreeView,
  type GoalTreeDragHandlers,
  type GoalTreeLabels,
  type GoalTreeViewProps,
} from "./GoalTreeView";
export {
  canDropGoalOn,
  canDropOn,
  type GoalTreeDragSource,
} from "./goalTreeDrag";
export {
  GoalDetailPanel,
  type GoalDetailLabels,
  type GoalDetailPanelProps,
  type GoalParentOption,
} from "./GoalDetailPanel";
