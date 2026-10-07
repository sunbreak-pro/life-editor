import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "../cn";
import { Button } from "../Button";
import { Input } from "../Input";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { TodoStatus } from "../../types/todoTree";
import { isImeComposing } from "../../utils/imeGuard";
import { goalProgress, type GoalTreeNode } from "./buildGoalTreeModel";
import { GoalStatus, type GoalTreeLabels } from "./GoalTreeView";

/*
 * The right panel for the goal picked in the tree (#2108 — design C4; on a
 * phone the host puts the same panel in a bottom sheet). Everything a goal
 * can be told from here: its title, its place in the tree (the parent one
 * level up — how the tree is rearranged, brief §1.5), the hand mark that only
 * an unconnected goal may carry (brief §1.2), and delete. Its todos and child
 * goals are listed so the progress number can be read back to its parts: the
 * tree only draws this period's children, so the ones from earlier periods
 * (which the progress counts too) are given as a number.
 *
 * Linking todos FROM the goal is #2109's screen, not this one.
 *
 * Pure presentation (§6.4). The host mounts it with `key={goal.id}` so the
 * title draft starts over when another goal is picked.
 */

export interface GoalDetailLabels {
  titleLabel: string;
  parentLabel: string;
  parentNone: string;
  todosHeading: string;
  todosEmpty: string;
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
}

export interface GoalDetailPanelProps {
  node: GoalTreeNode;
  /** The goals one level up this one may hang under; empty for a year. */
  parentOptions: readonly GoalParentOption[];
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

export function GoalDetailPanel({
  node,
  parentOptions,
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
          {labels.formatPeriod(
            labels.tree.kinds[goal.periodKind],
            goal.periodKey,
          )}
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

      {parentOptions.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-lumen-text-tertiary">
            {labels.parentLabel}
          </span>
          <select
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
                {option.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <section aria-label={labels.todosHeading}>
        <h3 className={SUB_HEADING}>{labels.todosHeading}</h3>
        {node.todos.length === 0 ? (
          <p className="text-xs text-lumen-text-secondary">
            {labels.todosEmpty}
          </p>
        ) : (
          <ul className="flex flex-col">
            {node.todos.map((todo) => (
              <li key={todo.id} className="flex items-center gap-1">
                <TodoStatusCheckbox
                  status={todo.status}
                  onChange={(next) => onSetTodoStatus(todo.id, next)}
                  labels={labels.tree.statusLabels}
                  label={labels.tree.status}
                  itemName={todo.title}
                />
                <button
                  type="button"
                  onClick={() => onOpenTodo(todo.id)}
                  aria-label={labels.tree.formatOpenTodo(todo.title)}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-lumen-sm px-2 py-1.5 text-left text-[13px] hover:bg-lumen-hover max-md:min-h-11",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                    todo.status === "DONE"
                      ? "text-lumen-text-tertiary line-through"
                      : "text-lumen-text",
                  )}
                >
                  {todo.title}
                </button>
              </li>
            ))}
          </ul>
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
