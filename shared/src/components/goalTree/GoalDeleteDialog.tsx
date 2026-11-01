import { useId, useState } from "react";
import { WIDE_QUERY } from "../../constants/breakpoints";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import type { GoalPeriodKind } from "../../types/goal";
import { Button } from "../Button";
import { cn } from "../cn";
import { Modal } from "../Modal";
import { SelectCheckboxMark } from "../SelectCheckbox";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import {
  goalDeleteTreeIsEmpty,
  type GoalDeleteGoalRow,
  type GoalDeleteTodoRow,
} from "./goalDeleteTree";

/*
 * The goal delete question (#2405): the goal's subtree as a tree of ticked
 * boxes, each row independent of the others. Unticked rows stay; the goal
 * asked about has no box and always goes. A goal with nothing under it gets
 * the plain question and no list.
 *
 * Same frame and same order of answers as ConfirmDialog: the message names the
 * dialog, and Cancel comes first in the DOM so the initial focus never lands
 * on the destructive answer. The list is the one part that scrolls, so the
 * question and the answers stay on screen however long the tree is. `Modal`'s
 * `fitViewport` would scroll them away with it.
 *
 * Holds only its boxes (§6.4): the copy comes in translated, the answer goes
 * out as the ids left unticked, and the writes are the host's.
 */

export interface GoalDeleteDialogLabels {
  kinds: Readonly<Record<GoalPeriodKind, string>>;
  /** The question, naming the goal. */
  formatMessage: (title: string) => string;
  /** How the boxes work. Shown with a list only. */
  chooseHint: string;
  /** What keeping an item costs. Shown with a list only. */
  keepNote: string;
  /** Accessible name of the list. */
  listLabel: string;
  /** Beside the goal asked about, in place of a box. */
  alwaysDeleted: string;
  alsoLinked: string;
  formatNestedTodos: (count: number) => string;
  /** A goal box's accessible name. */
  formatGoalRow: (kind: string, title: string) => string;
  /** A todo box's accessible name. */
  formatTodoRow: (title: string) => string;
  /** The goal's kind and period, as the goal panel prints it. */
  formatPeriod: (kind: string, key: string) => string;
  formatDateRange: (startDate: string, endDate: string) => string;
  confirm: string;
  deleting: string;
  cancel: string;
}

export interface GoalDeleteDialogProps {
  tree: GoalDeleteGoalRow;
  /** The writes are running: the boxes freeze and the dialog cannot be left. */
  busy?: boolean;
  /** `keptIds` = the goals and todos left unticked. */
  onConfirm: (keptIds: ReadonlySet<string>) => void;
  onCancel: () => void;
  labels: GoalDeleteDialogLabels;
}

const ROW =
  "flex w-full items-start gap-2 rounded-lumen-sm px-1.5 py-1 text-left text-sm transition-colors hover:bg-lumen-hover max-md:min-h-11 max-md:items-center disabled:cursor-not-allowed disabled:opacity-60";
const ROW_META = "text-xs text-lumen-text-tertiary";

function periodText(
  goal: GoalDeleteGoalRow["goal"],
  labels: GoalDeleteDialogLabels,
): string {
  return labels.formatPeriod(
    labels.kinds[goal.periodKind],
    // A range of its own (#2366) says more than the period's key.
    goal.startDate && goal.endDate
      ? labels.formatDateRange(goal.startDate, goal.endDate)
      : goal.periodKey,
  );
}

export function GoalDeleteDialog({
  tree,
  busy = false,
  onConfirm,
  onCancel,
  labels,
}: GoalDeleteDialogProps): React.JSX.Element {
  const messageId = useId();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const [keptIds, setKeptIds] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string): void =>
    setKeptIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const renderTodo = (todo: GoalDeleteTodoRow): React.JSX.Element => {
    const notes = [
      ...(todo.alsoLinked ? [labels.alsoLinked] : []),
      ...(todo.nestedTodoIds.length > 0
        ? [labels.formatNestedTodos(todo.nestedTodoIds.length)]
        : []),
    ];
    return (
      <li key={todo.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={!keptIds.has(todo.id)}
          // Spoken with its notes: the row's aria-label replaces its text.
          aria-label={[labels.formatTodoRow(todo.title), ...notes].join(" — ")}
          disabled={busy}
          onClick={() => toggle(todo.id)}
          className={cn(ROW, FOCUS_RING_TIGHT)}
        >
          <SelectCheckboxMark
            checked={!keptIds.has(todo.id)}
            className="mt-0.5 max-md:mt-0"
          />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block break-words",
                todo.done
                  ? "text-lumen-text-secondary line-through"
                  : "text-lumen-text",
              )}
            >
              {todo.title}
            </span>
            {notes.map((note) => (
              <span key={note} className={cn("block", ROW_META)}>
                {note}
              </span>
            ))}
          </span>
        </button>
      </li>
    );
  };

  const renderChildren = (row: GoalDeleteGoalRow): React.JSX.Element | null =>
    row.todos.length + row.children.length === 0 ? null : (
      <ul className="ml-2 flex flex-col gap-0.5 border-l border-lumen-border pl-2">
        {row.todos.map(renderTodo)}
        {row.children.map((child) => {
          const period = periodText(child.goal, labels);
          return (
            <li key={child.goal.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={!keptIds.has(child.goal.id)}
                aria-label={labels.formatGoalRow(
                  labels.kinds[child.goal.periodKind],
                  child.goal.title,
                )}
                disabled={busy}
                onClick={() => toggle(child.goal.id)}
                className={cn(ROW, FOCUS_RING_TIGHT)}
              >
                <SelectCheckboxMark
                  checked={!keptIds.has(child.goal.id)}
                  className="mt-0.5 max-md:mt-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium text-lumen-text">
                    {child.goal.title}
                  </span>
                  <span className={cn("block", ROW_META)}>{period}</span>
                </span>
              </button>
              {renderChildren(child)}
            </li>
          );
        })}
      </ul>
    );

  const hasList = !goalDeleteTreeIsEmpty(tree);

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onCancel();
      }}
      labelledBy={messageId}
      // Full width on a phone: `full` keeps only the backdrop's gutter.
      size={isWide ? "lg" : "full"}
      className="flex max-h-[calc(100dvh-2rem)] flex-col"
    >
      <p
        id={messageId}
        className="whitespace-pre-line text-sm leading-relaxed text-lumen-text"
      >
        {labels.formatMessage(tree.goal.title)}
      </p>
      {hasList && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-lumen-text-secondary">
            {labels.chooseHint}
          </p>
          <div
            role="group"
            aria-label={labels.listLabel}
            // The one scroller. `min-h-0`: a flex item's floor is its content,
            // so without it the list would push the answers off the panel.
            className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lumen-md border border-lumen-border p-2"
          >
            <div className="px-1.5 py-1 text-sm">
              <span className="block break-words font-medium text-lumen-text">
                {tree.goal.title}
              </span>
              <span className={cn("block", ROW_META)}>
                {periodText(tree.goal, labels)} · {labels.alwaysDeleted}
              </span>
            </div>
            {renderChildren(tree)}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-lumen-text-secondary">
            {labels.keepNote}
          </p>
        </>
      )}
      {/* `max-md:min-h-11`: the 44px touch floor, as on ConfirmDialog. */}
      <div className="mt-4 flex shrink-0 justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="max-md:min-h-11"
          disabled={busy}
          onClick={onCancel}
        >
          {labels.cancel}
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="max-md:min-h-11"
          busy={busy}
          busyLabel={labels.deleting}
          onClick={() => onConfirm(keptIds)}
        >
          {labels.confirm}
        </Button>
      </div>
    </Modal>
  );
}
