import { useId, useMemo, useState } from "react";
import { SquareCheck, Target, X } from "lucide-react";
import { WIDE_QUERY } from "../../constants/breakpoints";
import { DIALOG_AUTOFOCUS_SKIP } from "../../hooks/useDialogA11y";
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
 * The frame is the prototype's (#2612): a heading and a corner ×, the question
 * as its explanation, a kind icon and kind name on every row, a "keep" note on
 * an unticked one, one switch to untick or tick every row, a summary of what
 * goes, and the count on the destructive answer. Cancel comes before that
 * answer in the DOM, as on ConfirmDialog.
 *
 * Initial focus: with no list, Cancel. With a list, the first box, and Enter
 * there only flips that box. The × and the switch sit above the boxes, so they
 * opt out of the initial focus: opening on "Close" or on "Untick all" would
 * announce the chrome instead of the choice. The list is the one part that
 * scrolls, so the question and the answers stay on screen however long the
 * tree is. `Modal`'s `fitViewport` would scroll them away with it.
 *
 * Holds only its boxes (§6.4): the copy comes in translated, the answer goes
 * out as the ids left unticked, and the writes are the host's.
 */

export interface GoalDeleteDialogLabels {
  kinds: Readonly<Record<GoalPeriodKind, string>>;
  /** "Delete goal" — the heading that names the dialog. */
  title: string;
  /** The corner ×'s spoken name. */
  close: string;
  /** The question, naming the goal. Drawn under the heading. */
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
  /** "Week goal" — a goal row's kind name, given `kinds[periodKind]`. */
  formatGoalKind: (kind: string) => string;
  /** "Todo" — a todo row's kind name. */
  todoKind: string;
  /** "Keep" — on a row left unticked. */
  kept: string;
  /** The switch while any row is ticked. */
  untickAll: string;
  /** The switch once every row is unticked. */
  tickAll: string;
  /** What the answer deletes; the goal asked about is among `goals`. */
  formatSummary: (goals: number, todos: number) => string;
  /** "Delete (3)" — the destructive answer, with the rows it takes. */
  formatConfirm: (count: number) => string;
  /** The goal's kind and period, as the goal panel prints it. */
  formatPeriod: (kind: string, key: string) => string;
  formatDateRange: (startDate: string, endDate: string) => string;
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
const KIND_ICON = "mt-0.5 shrink-0 text-lumen-text-tertiary max-md:mt-0";

function periodText(
  goal: GoalDeleteGoalRow["goal"],
  labels: GoalDeleteDialogLabels,
): string {
  return labels.formatPeriod(
    labels.formatGoalKind(labels.kinds[goal.periodKind]),
    // A range of its own (#2366) says more than the period's key.
    goal.startDate && goal.endDate
      ? labels.formatDateRange(goal.startDate, goal.endDate)
      : goal.periodKey,
  );
}

/** Every box in the tree, goals and todos, the goal asked about left out. */
function rowIds(tree: GoalDeleteGoalRow): {
  goals: string[];
  todos: string[];
} {
  const goals: string[] = [];
  const todos: string[] = [];
  const walk = (row: GoalDeleteGoalRow): void => {
    for (const todo of row.todos) todos.push(todo.id);
    for (const child of row.children) {
      goals.push(child.goal.id);
      walk(child);
    }
  };
  walk(tree);
  return { goals, todos };
}

export function GoalDeleteDialog({
  tree,
  busy = false,
  onConfirm,
  onCancel,
  labels,
}: GoalDeleteDialogProps): React.JSX.Element {
  const headingId = useId();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const [keptIds, setKeptIds] = useState<ReadonlySet<string>>(new Set());
  const ids = useMemo(() => rowIds(tree), [tree]);
  const toggle = (id: string): void =>
    setKeptIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const allIds = [...ids.goals, ...ids.todos];
  const allKept = allIds.every((id) => keptIds.has(id));
  // The goal asked about always goes, so it counts among the goals.
  const goalCount = 1 + ids.goals.filter((id) => !keptIds.has(id)).length;
  const todoCount = ids.todos.filter((id) => !keptIds.has(id)).length;

  const keptNote = (id: string): React.JSX.Element | null =>
    keptIds.has(id) ? (
      <span
        data-goal-delete-kept=""
        className="ml-1 font-medium text-lumen-text-secondary"
      >
        · {labels.kept}
      </span>
    ) : null;

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
          <SquareCheck
            size={14}
            aria-hidden
            data-goal-delete-kind="todo"
            className={KIND_ICON}
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
            <span className={cn("block", ROW_META)}>
              {labels.todoKind}
              {keptNote(todo.id)}
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
                <Target
                  size={14}
                  aria-hidden
                  data-goal-delete-kind="goal"
                  className={KIND_ICON}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium text-lumen-text">
                    {child.goal.title}
                  </span>
                  <span className={cn("block", ROW_META)}>
                    {period}
                    {keptNote(child.goal.id)}
                  </span>
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
      labelledBy={headingId}
      // Full width on a phone: `full` keeps only the backdrop's gutter.
      size={isWide ? "lg" : "full"}
      className="relative flex max-h-[calc(100dvh-2rem)] flex-col"
    >
      {/* Not Modal's own × : that one takes the initial focus (see above). */}
      <button
        type="button"
        {...DIALOG_AUTOFOCUS_SKIP}
        onClick={onCancel}
        disabled={busy}
        aria-label={labels.close}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent disabled:cursor-not-allowed disabled:opacity-60 max-md:size-11"
      >
        <X aria-hidden className="size-4" />
      </button>
      <h2
        id={headingId}
        className="mb-2 shrink-0 pr-10 text-base font-semibold text-lumen-text max-md:pr-12"
      >
        {labels.title}
      </h2>
      <p className="shrink-0 whitespace-pre-line text-sm leading-relaxed text-lumen-text">
        {labels.formatMessage(tree.goal.title)}
      </p>
      {hasList && (
        <>
          <p className="mt-2 shrink-0 text-xs leading-relaxed text-lumen-text-secondary">
            {labels.chooseHint}
          </p>
          <div className="mt-3 flex shrink-0 justify-end">
            <Button
              variant="ghost"
              size="sm"
              {...DIALOG_AUTOFOCUS_SKIP}
              className="max-md:min-h-11"
              disabled={busy}
              onClick={() => setKeptIds(allKept ? new Set() : new Set(allIds))}
            >
              {allKept ? labels.tickAll : labels.untickAll}
            </Button>
          </div>
          <div
            role="group"
            aria-label={labels.listLabel}
            // The one scroller. `min-h-0`: a flex item's floor is its content,
            // so without it the list would push the answers off the panel.
            className="mt-1 min-h-0 flex-1 overflow-y-auto rounded-lumen-md border border-lumen-border p-2"
          >
            <div className="flex items-start gap-2 px-1.5 py-1 text-sm">
              <Target
                size={14}
                aria-hidden
                data-goal-delete-kind="goal"
                className={KIND_ICON}
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium text-lumen-text">
                  {tree.goal.title}
                </span>
                <span className={cn("block", ROW_META)}>
                  {periodText(tree.goal, labels)} · {labels.alwaysDeleted}
                </span>
              </span>
            </div>
            {renderChildren(tree)}
          </div>
          <p
            data-goal-delete-summary=""
            className="mt-3 shrink-0 text-sm leading-relaxed text-lumen-text"
          >
            {labels.formatSummary(goalCount, todoCount)}
          </p>
          <p className="mt-1 shrink-0 text-xs leading-relaxed text-lumen-text-secondary">
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
          {labels.formatConfirm(goalCount + todoCount)}
        </Button>
      </div>
    </Modal>
  );
}
