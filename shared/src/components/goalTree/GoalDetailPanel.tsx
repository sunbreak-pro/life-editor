import { useState } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { Button } from "../Button";
import { Input } from "../Input";
import { TodoStatusCheckbox, toggledTodoStatus } from "../TodoStatusCheckbox";
import type { Goal, GoalPeriodKind } from "../../types/goal";
import type { TodoStatus } from "../../types/todoTree";
import { isImeComposing } from "../../utils/imeGuard";
import { goalProgress, type GoalTreeNode } from "./buildGoalTreeModel";
import { GoalStatus, type GoalTreeLabels } from "./GoalTreeView";

/*
 * The right panel for the goal picked in the tree (#2108 — design C4; on a
 * phone the host puts the same panel in a bottom sheet). Everything a goal
 * can be told from here: its title, the hand mark that only an unconnected
 * goal may carry (brief §1.2), and delete. Its todos and child goals are listed
 * so the progress number can be read back to its parts: the tree only draws
 * this period's children, so the ones from earlier periods (which the progress
 * counts too) are given as a number. A todo's name ticks it and its pencil
 * opens it, as on the tree's todo rows (#2388); no bin here yet.
 *
 * The goal above is a link that picks it (#2410). Changing it is a drag on the
 * tree where the tree can be dragged; where it cannot (a phone, the Briefing
 * goals panel), the host also asks for the old select with `parentSelect`, the
 * only way there.
 *
 * Linking todos FROM the goal is #2109's screen, not this one: the button only
 * tells the host to swap it in (`onLinkTodos`).
 *
 * Pure presentation (§6.4). The host mounts it keyed by the goal's id and
 * title, so the title draft starts over when another goal is picked or the
 * name changes elsewhere (the tree's pencil, #2283).
 */

export interface GoalDetailLabels {
  titleLabel: string;
  parentLabel: string;
  parentNone: string;
  todosHeading: string;
  todosEmpty: string;
  /** The button that opens the linking screen. */
  linkTodos: string;
  childrenHeading: string;
  /** "2 more from earlier periods" — child goals the tree does not draw. */
  formatEarlierChildren: (count: number) => string;
  markAchieved: string;
  unmarkAchieved: string;
  /** Why the hand mark is offered only here (brief §1.2). */
  manualHint: string;
  deleteGoal: string;
  formatPeriod: (kind: string, key: string) => string;
  tree: GoalTreeLabels;
}

export interface GoalParentOption {
  id: string;
  title: string;
  /** Named in the option: a week's parents can be months and years alike. */
  periodKind?: GoalPeriodKind;
}

/** "Week · 2026-09-27"; a range of its own (#2366) says more than the key. */
export function formatGoalPeriod(
  goal: Goal,
  labels: Pick<GoalDetailLabels, "formatPeriod" | "tree">,
): string {
  return labels.formatPeriod(
    labels.tree.kinds[goal.periodKind],
    goal.startDate && goal.endDate
      ? labels.tree.formatDateRange(goal.startDate, goal.endDate)
      : goal.periodKey,
  );
}

export interface GoalDetailPanelProps {
  node: GoalTreeNode;
  /** The longer-period goals this one may hang under; empty for a year. */
  parentOptions: readonly GoalParentOption[];
  /**
   * The goal above, for the link. Apart from `parentOptions`: a goal added
   * under last month's goal keeps a parent that is no longer on offer.
   */
  parentGoal?: GoalParentOption | null;
  /** Also offer the select, where the tree cannot be dragged. */
  parentSelect?: boolean;
  /** Opens the linking screen. Absent, no button is drawn. */
  onLinkTodos?: () => void;
  onRename: (title: string) => void;
  onChangeParent: (parentGoalId: string | null) => void;
  onSetManualAchieved: (achieved: boolean) => void;
  onDelete: () => void;
  onSelectGoal: (goalId: string) => void;
  onSetTodoStatus: (todoId: string, status: TodoStatus) => void;
  onOpenTodo: (todoId: string) => void;
  labels: GoalDetailLabels;
}

const SUB_HEADING = "mb-1.5 text-xs font-medium text-lumen-text-tertiary";

/**
 * A linked todo's pencil, drawn as the tree's todo-row icons are
 * (GoalTreeView's TODO_ROW_ICON): on hover or focus on desktop, always on a
 * phone, with a 44px target there. Copied, not imported, because a component
 * module may export only components (react-refresh).
 */
const TODO_ROW_ICON = cn(
  "ml-0.5 grid shrink-0 place-items-center rounded-lumen-sm text-lumen-text-tertiary transition-[color,background-color,opacity] hover:bg-lumen-hover hover:text-lumen-text",
  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
  "max-md:min-h-11 max-md:min-w-11",
  "opacity-0 group-hover/todo:opacity-100 group-focus-within/todo:opacity-100 max-md:opacity-100",
);

export function GoalDetailPanel({
  node,
  parentOptions,
  parentGoal = null,
  parentSelect = false,
  onLinkTodos,
  onRename,
  onChangeParent,
  onSetManualAchieved,
  onDelete,
  onSelectGoal,
  onSetTodoStatus,
  onOpenTodo,
  labels,
}: GoalDetailPanelProps): React.JSX.Element {
  const { goal, achievement } = node;
  const [title, setTitle] = useState(goal.title);
  const commitTitle = (): void => {
    const next = title.trim();
    if (next && next !== goal.title) onRename(next);
    else setTitle(goal.title);
  };
  const { done, total } = goalProgress(achievement);
  // Progress counts every live child; the node holds only the shown ones.
  const earlierChildren = Math.max(
    0,
    achievement.children.total - node.children.length,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-xs text-lumen-briefing-kohaku">
          {formatGoalPeriod(goal, labels)}
        </span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (isImeComposing(e)) return;
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label={labels.titleLabel}
          className="font-medium max-md:text-base"
        />
        <div className="flex items-center gap-2">
          <GoalStatus node={node} labels={labels.tree} />
          {achievement.connected && achievement.achieved && (
            <span className="text-xs tabular-nums text-lumen-text-tertiary">
              {labels.tree.formatProgress(done, total)}
            </span>
          )}
        </div>
      </div>

      {(parentGoal !== null || parentOptions.length > 0) && (
        <div className="flex flex-col items-start gap-1.5">
          <span className="text-xs font-medium text-lumen-text-tertiary">
            {labels.parentLabel}
          </span>
          {parentGoal !== null ? (
            <button
              type="button"
              onClick={() => onSelectGoal(parentGoal.id)}
              className={cn(
                "max-w-full truncate rounded-lumen-sm text-left text-[13px] text-lumen-accent hover:underline max-md:min-h-11",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              )}
            >
              {parentGoal.title}
            </button>
          ) : (
            !parentSelect && (
              <span className="text-[13px] text-lumen-text-secondary">
                {labels.parentNone}
              </span>
            )
          )}
          {parentSelect && parentOptions.length > 0 && (
            <select
              aria-label={labels.parentLabel}
              value={goal.parentGoalId ?? ""}
              onChange={(e) => onChangeParent(e.target.value || null)}
              className={cn(
                "h-9 w-full rounded-md border border-lumen-border bg-lumen-bg px-2 text-sm text-lumen-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:text-base",
              )}
            >
              <option value="">{labels.parentNone}</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.periodKind
                    ? `${labels.tree.kinds[option.periodKind]}: ${option.title}`
                    : option.title}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <section aria-label={labels.todosHeading}>
        <h3 className={SUB_HEADING}>
          {labels.todosHeading}{" "}
          <span data-goal-todo-count className="tabular-nums">
            {node.todos.length}
          </span>
        </h3>
        {node.todos.length === 0 ? (
          <p className="text-xs text-lumen-text-secondary">
            {labels.todosEmpty}
          </p>
        ) : (
          <ul className="flex flex-col">
            {node.todos.map((todo) => (
              <li
                key={todo.id}
                className="group/todo flex items-center gap-1 rounded-lumen-sm transition-colors hover:bg-lumen-hover"
              >
                <TodoStatusCheckbox
                  status={todo.status}
                  onChange={(next) => onSetTodoStatus(todo.id, next)}
                  labels={labels.tree.statusLabels}
                  label={labels.tree.status}
                  itemName={todo.title}
                />
                {/* The name ticks the todo, as on the tree's rows (#2388). */}
                <button
                  type="button"
                  onClick={() =>
                    onSetTodoStatus(todo.id, toggledTodoStatus(todo.status))
                  }
                  aria-label={(todo.status === "DONE"
                    ? labels.tree.formatMarkTodoOpen
                    : labels.tree.formatMarkTodoDone)(todo.title)}
                  // The whole row carries the hover, so the name adds none.
                  className={cn(
                    "min-w-0 flex-1 cursor-pointer truncate rounded-lumen-sm px-2 py-1.5 text-left text-[13px] max-md:min-h-11",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                    todo.status === "DONE"
                      ? "text-lumen-text-tertiary line-through"
                      : "text-lumen-text",
                  )}
                >
                  {todo.title}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTodo(todo.id)}
                  aria-label={labels.tree.formatOpenTodo(todo.title)}
                  title={labels.tree.formatOpenTodo(todo.title)}
                  className={TODO_ROW_ICON}
                >
                  <Pencil size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {onLinkTodos && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onLinkTodos}
            leadingIcon={<Link2 size={14} aria-hidden />}
            className="mt-2 max-md:min-h-11"
          >
            {labels.linkTodos}
          </Button>
        )}
      </section>

      {(node.children.length > 0 || earlierChildren > 0) && (
        <section aria-label={labels.childrenHeading}>
          <h3 className={SUB_HEADING}>{labels.childrenHeading}</h3>
          {earlierChildren > 0 && (
            <p className="mb-1 text-xs text-lumen-text-secondary">
              {labels.formatEarlierChildren(earlierChildren)}
            </p>
          )}
          <ul className="flex flex-col">
            {node.children.map((child) => (
              <li key={child.goal.id}>
                <button
                  type="button"
                  onClick={() => onSelectGoal(child.goal.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left hover:bg-lumen-hover max-md:min-h-11",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-lumen-text">
                    {child.goal.title}
                  </span>
                  <GoalStatus node={child} labels={labels.tree} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col items-start gap-2 border-t border-lumen-border pt-4">
        {!achievement.connected && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                onSetManualAchieved(goal.manualAchievedAt === null)
              }
              className="max-md:min-h-11"
            >
              {goal.manualAchievedAt === null
                ? labels.markAchieved
                : labels.unmarkAchieved}
            </Button>
            <p className="text-xs text-lumen-text-tertiary">
              {labels.manualHint}
            </p>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Trash2 size={14} aria-hidden />}
          onClick={onDelete}
          className="text-lumen-danger max-md:min-h-11"
        >
          {labels.deleteGoal}
        </Button>
      </div>
    </div>
  );
}
