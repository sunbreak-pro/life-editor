import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "../cn";
import { Button } from "../Button";
import { EmptyState } from "../EmptyState";
import { Input } from "../Input";
import { SegmentedToggle } from "../SegmentedToggle";
import { SkeletonList } from "../SkeletonList";
import { TodoStatusCheckbox, toggledTodoStatus } from "../TodoStatusCheckbox";
import type { StatusLabelSet } from "../todoStatusVisuals";
import type { Goal, GoalDateRange, GoalPeriodKind } from "../../types/goal";
import type { TodoStatus } from "../../types/todoTree";
import { isImeComposing } from "../../utils/imeGuard";
import {
  GOAL_PERIOD_KINDS,
  goalChildKinds,
  goalPeriodBounds,
  goalProgress,
  separateCompleted,
  type GoalTreeModel,
  type GoalTreeNode,
  type GoalTreeTodo,
} from "./buildGoalTreeModel";
import { canDropOn, type GoalTreeDragSource } from "./goalTreeDrag";

/*
 * The Connect "Goals & Todos" tab body (#2108, plan Step 9 — design C1–C6
 * as described in .claude/docs/design/briefs/briefing.md §1.5 / §10.4 / §11).
 *
 * Top to bottom: the add button, which opens the period, title and dates
 * (#2410; no limit per period, and a start and end date that may differ from
 * the period's own — #2366), the year → month →
 * week tree with each goal's linked todos under it, the unconnected goals,
 * and the todos no goal holds. A group with nothing in it is not drawn — no
 * heading over an empty frame — and with no goal at all the tree is replaced
 * by one guidance line whose button opens this week's add field.
 *
 * The host passes the model already sorted and filtered (arrangeGoalTree,
 * #2225). While a filter is on, a line over the tree names it with a reset
 * button, and a filter that leaves nothing says so in one line. A goal with
 * anything under it carries an open / close arrow, all open at first. The
 * loose-todo group's heading has "+ Todo", which creates a todo linked to no
 * goal.
 *
 * Desktop drag (#2226), only when the host passes `drag`: a goal's open /
 * close arrow turns into a grip while the row is hovered — press to fold,
 * grab to drag — and a goal with nothing under it shows the grip on hover
 * alone. The title can be grabbed too (#2283). Year goals have no parent to
 * change, so they keep the arrow and their title only selects. Todo
 * rows get a grip left of the box. While dragging, the goals a drop may land
 * on (goalTreeDrag.ts) get a dashed outline and a "+" square, filled under
 * the pointer. Native HTML5 drag and drop: shared does not carry @dnd-kit,
 * and the target rule is a pure function, so a library would add only the
 * ghost image the browser already draws.
 *
 * The drag reads as carrying the row (#2365): the image under the pointer is
 * a lifted copy of it (liftDragImage), the row it left stays as a dashed
 * hole, and the goal under the pointer turns from a dashed info outline to a
 * solid one (#2607: the "+" square says where, so no words are added).
 *
 * A goal row carries up to three icons on hover or while selected (#2367):
 * "+" adds a todo linked to the goal, or a goal of any shorter period (#2399:
 * a year offers its month and its week); edit swaps
 * the title for a name field in place (the pencil of #2283, folded in) and,
 * when the host passes `onEditGoal`, also opens the goal's panel for the
 * rest; the bin deletes, after the host's confirm. The row stops dragging
 * while its field is open. A goal drawn twice — under its parent and as
 * unconnected — opens a field only on the row whose icon was pressed.
 *
 * A goal row says "This month" as a badge only while that is true of the goal
 * (#2410, showsPeriodBadge); otherwise it keeps the plain "Month".
 *
 * Completed items (#2368): an achieved goal, with what is under it, and a
 * done todo leave the tree for a "Completed items" group at the bottom
 * (separateCompleted). Un-ticking or un-achieving puts them back, because
 * the host's next model no longer counts them as completed.
 *
 * A todo row (#2388): the name ticks and un-ticks like the box beside it, the
 * pencil at the right end is the way into the editor, and the bin goes through
 * the host's confirm. A press on the name never starts a drag: the grip does.
 *
 * The todo open in the editor (#2401, `editingTodoId`) wears the accent wash on
 * its row, in every group it is drawn in, so the row being changed stays
 * findable behind the panel. Its pencil carries `aria-current`.
 *
 * Pure presentation (§6.4): the model and every label come from the host
 * (web/src/connect/GoalsTodosScreen.tsx). The state held here — the add
 * fields' drafts, which goals are closed and what is being dragged — is
 * nothing outside needs.
 */

export interface GoalTreeLabels {
  /** "Year" / "Month" / "Week" — a row's spoken name, its text past a period. */
  kinds: Record<GoalPeriodKind, string>;
  /** "This year" / "This month" / "This week" — the add choices, a row's badge. */
  periods: Record<GoalPeriodKind, string>;
  /** "2026" / "October" / "10/4 – 10/10" — beside the period name. */
  periodRanges: Record<GoalPeriodKind, string>;
  addHeading: string;
  addPlaceholder: string;
  /**
   * Appended to the placeholder for a month or week goal only: a goal with no
   * goal above it is a valid start there (#2400). Carries its own separator.
   */
  addNoParentHint: string;
  add: string;
  cancel: string;
  /** The add field's date inputs (#2366). */
  startDate: string;
  endDate: string;
  /** "10/28 – 11/15" — a goal's own range, on its row and in the panel. */
  formatDateRange: (startDate: string, endDate: string) => string;
  treeHeading: string;
  unconnectedHeading: string;
  looseHeading: string;
  empty: string;
  emptyAction: string;
  achieved: string;
  unconnected: string;
  formatProgress: (done: number, total: number) => string;
  status: string;
  statusLabels: StatusLabelSet;
  formatOpenTodo: (title: string) => string;
  /** "Mark as done: Long run" — a todo's name, while it is open. */
  formatMarkTodoDone: (title: string) => string;
  /** "Mark as not done: Long run" — a todo's name, once it is done. */
  formatMarkTodoOpen: (title: string) => string;
  /** "Delete todo: Long run" — the bin on a todo row. */
  formatDeleteTodo: (title: string) => string;
  /** "Expand: Run 3 times" / "Collapse: Run 3 times" — the branch arrow. */
  formatExpand: (title: string) => string;
  formatCollapse: (title: string) => string;
  /** "Filtering by" — leads the active-filter line over the tree. */
  filteringBy: string;
  resetFilters: string;
  /** A filter left no goal to draw. */
  noMatch: string;
  /** "Completed items" — the group done todos and achieved goals move to. */
  completedHeading: string;
  /** "Todo" — the loose group's add button, after a plus. */
  addTodo: string;
  /** The add button's and the field's spoken name. */
  addTodoLabel: string;
  addTodoPlaceholder: string;
  /** The grip's tooltip. */
  dragToMove: string;
  /** "Edit goal: Run 3 times" — the edit icon's spoken name. */
  formatEdit: (title: string) => string;
  /**
   * "Rename" — the edit icon's tooltip. The tooltip sits on the row it names,
   * so it carries the action alone, as the prototype does (#2607); the spoken
   * name keeps the title, since a screen reader hears the button out of row.
   */
  editTooltip: string;
  /** The name field the edit icon opens. */
  renameField: string;
  /** "Add under: Run 3 times" — the "+" on a goal row (#2367). */
  formatAddUnder: (title: string) => string;
  /** "Add below" — the "+"'s tooltip (#2607). */
  addUnderTooltip: string;
  /** "Delete goal: Run 3 times" — the bin on a goal row. */
  formatDelete: (title: string) => string;
  /** "Delete" — the bin's tooltip (#2607). */
  deleteTooltip: string;
  /**
   * "This month's goal" — a "+" choice and the add field's badge. Given the
   * period's name (`periods`), since the goal lands in the current period.
   */
  formatChildGoal: (kind: string) => string;
  loading: string;
  /** The first read failed: nothing below would be true, so this replaces it. */
  loadFailed: string;
  retry: string;
}

export interface GoalTreeViewProps {
  model: GoalTreeModel;
  isLoading: boolean;
  /**
   * True when the read failed and no data has ever arrived. An empty model
   * would then claim "no goals" when there may be some.
   */
  loadFailed?: boolean;
  onRetry?: () => void;
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  /**
   * Resolves true once the goal exists, so the field can clear. `range` is
   * null when the dates were left at the period's own (#2366).
   */
  onCreateGoal: (
    kind: GoalPeriodKind,
    title: string,
    range: GoalDateRange | null,
  ) => Promise<boolean>;
  /** A todo linked to no goal. Resolves true once it exists. */
  onCreateLooseTodo: (title: string) => Promise<boolean>;
  /** The active filter as phrases; empty or absent when nothing is filtered. */
  activeFilters?: readonly string[];
  onResetFilters?: () => void;
  onSetTodoStatus: (todoId: string, status: TodoStatus) => void;
  onOpenTodo: (todoId: string) => void;
  /** The todo open in the editor, whose row is marked (#2401). */
  editingTodoId?: string | null;
  /** The bin on a todo row. Fires raw: the host asks. Absent, no bin. */
  onDeleteTodo?: (todoId: string) => void;
  /** Desktop only. Absent, no grip is drawn and nothing can be dragged. */
  drag?: GoalTreeDragHandlers;
  /** A new name from a row's edit icon, trimmed and changed. Absent, no icon. */
  onRenameGoal?: (goalId: string, title: string) => void;
  /**
   * Also called by the edit icon, so the panel opens with the goal's other
   * fields (#2367). The host passes it on wide only: on a phone the panel is
   * a sheet that would cover the name field.
   */
  onEditGoal?: (goalId: string) => void;
  /** The "+" and the bin on a goal row (#2367). Absent, neither is drawn. */
  rowActions?: GoalRowActions;
  labels: GoalTreeLabels;
}

export interface GoalRowActions {
  /** A todo linked to the goal. Resolves true once it exists. */
  onAddTodo: (goalId: string, title: string) => Promise<boolean>;
  /**
   * A goal of the chosen shorter `kind`, in the current period, under `parent`.
   * Resolves true once it exists.
   */
  onAddChildGoal: (
    parent: Goal,
    title: string,
    kind: GoalPeriodKind,
  ) => Promise<boolean>;
  /** Fires raw: the host asks before it deletes. */
  onDelete: (goal: Goal) => void;
}

export interface GoalTreeDragHandlers {
  /** A goal dropped on a goal of a longer period. */
  onMoveGoal: (goalId: string, parentGoalId: string) => void;
  /** A todo dropped on a goal; `fromGoalId` is null for a loose todo. */
  onMoveTodo: (
    todoId: string,
    fromGoalId: string | null,
    toGoalId: string,
  ) => void;
}

const ROW_BUTTON_SHAPE = cn(
  "flex min-w-0 flex-1 items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left",
  "transition-colors max-md:min-h-11",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
);

const ROW_BUTTON = cn(ROW_BUTTON_SHAPE, "hover:bg-lumen-hover");

const GROUP_HEADING = "mb-1.5 text-xs font-medium text-lumen-text-tertiary";

/*
 * A button beside a field or a heading keeps its label on one line (#2364).
 * Button has neither rule, and an Input is w-full, so a flex row squeezed
 * the button to one character's width and 「追加」 broke into a column.
 */
const KEEP_LABEL = "shrink-0 whitespace-nowrap";

/*
 * The arrow's width is one CSS variable, set on the view's root, and the
 * hierarchy lines are placed from it (#2282): a line runs through the middle
 * of its parent's arrow at every depth and on both widths. Both sizes are in
 * --spacing (rem), so the root font size setting moves the arrow and the line
 * together; the only px is the half of the 1px line that centres it.
 *
 * Wide is the tap floor itself, not --spacing*6: an arrow button holding one
 * icon (a year's, or any arrow while dragging is off) matches tokens.css's
 * icon-only rule and is lifted to --spacing-lumen-tap-min, so a smaller
 * variable left the line 2.25px off that arrow's centre at an 18px root
 * while the grip-carrying arrows stayed on it. At the floor every arrow is
 * the variable's width. Narrow's --spacing*11 is already above the floor.
 */
const TREE_TOGGLE_SIZE =
  "[--goal-tree-toggle:var(--spacing-lumen-tap-min)] max-md:[--goal-tree-toggle:calc(var(--spacing)*11)]";

/** The arrow's column, kept on rows without one so titles line up. */
const BRANCH_TOGGLE =
  "grid size-(--goal-tree-toggle) shrink-0 place-items-center";

const TREE_LINE =
  "absolute inset-y-0 left-[calc(var(--goal-tree-toggle)_/_2_-_0.5px)] w-px bg-lumen-border";

/** Past the line by the old gap, so a child's arrow never sits on it. */
const TREE_INDENT =
  "pl-[calc(var(--goal-tree-toggle)_/_2_+_var(--spacing)_*_3)]";

type StatusLabels = Pick<
  GoalTreeLabels,
  "achieved" | "unconnected" | "formatProgress"
>;

/**
 * "This month" holds only for a goal that follows the current period. One with
 * dates of its own may run past it (#2366), and one drawn as the parent of a
 * current goal may be last month's.
 */
function showsPeriodBadge(
  goal: Goal,
  periodKeys: GoalTreeModel["periodKeys"],
): boolean {
  if (goal.startDate && goal.endDate) return false;
  return goal.periodKey === periodKeys[goal.periodKind];
}

/** What GoalStatus shows, as text — the row's spoken name ends with it. */
function goalStatusText(node: GoalTreeNode, labels: StatusLabels): string {
  if (node.achievement.achieved) return labels.achieved;
  if (!node.achievement.connected) return labels.unconnected;
  const { done, total } = goalProgress(node.achievement);
  return labels.formatProgress(done, total);
}

/** Achieved / unconnected chip, or the n/m count, with or without its bar. */
export function GoalStatus({
  node,
  labels,
  bar = true,
}: {
  node: GoalTreeNode;
  labels: StatusLabels;
  /**
   * The tree's rows show the count alone, as the prototype does (#2606). The
   * detail panel keeps its bar, which that issue left as it is.
   */
  bar?: boolean;
}): React.JSX.Element {
  const { achievement } = node;
  if (achievement.achieved) {
    return (
      <span
        data-goal-achieved
        className="inline-flex shrink-0 items-center rounded-full bg-lumen-success-subtle px-2 py-0.5 text-xs font-medium text-lumen-success"
      >
        {labels.achieved}
      </span>
    );
  }
  if (!achievement.connected) {
    return (
      <span className="shrink-0 rounded-full border border-lumen-border px-2 py-0.5 text-xs text-lumen-text-tertiary">
        {labels.unconnected}
      </span>
    );
  }
  const { done, total } = goalProgress(achievement);
  const count = (
    <span
      data-goal-progress
      className="shrink-0 text-xs tabular-nums text-lumen-text-secondary"
    >
      {labels.formatProgress(done, total)}
    </span>
  );
  if (!bar) return count;
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span
        aria-hidden
        className="h-1.5 w-14 overflow-hidden rounded-full bg-lumen-bg-secondary"
      >
        <span
          className="block h-full rounded-full bg-lumen-accent-secondary"
          style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
        />
      </span>
      {count}
    </span>
  );
}

/** The drag in flight and the row handlers; null when `drag` is not passed. */
interface DragState {
  source: GoalTreeDragSource | null;
  overGoalId: string | null;
  canDrop: (target: Goal) => boolean;
  start: (e: DragEvent, source: GoalTreeDragSource) => void;
  end: () => void;
  over: (e: DragEvent, target: Goal) => void;
  leave: (e: DragEvent, goalId: string) => void;
  drop: (e: DragEvent, target: Goal) => void;
}

const GRIP = "cursor-grab text-lumen-text-tertiary active:cursor-grabbing";

const GOAL_TREE_DRAG_TYPE = "application/x-life-editor-goal-tree";

/** The row a drag starts from: the goal's row, or the todo's item. */
const ROW_ATTR = "data-goal-tree-row";

/** Opaque, shadowed, outlined and tilted: the row held in the hand. */
const DRAG_GHOST = cn(
  "pointer-events-none fixed top-0 -left-[9999px] rotate-1 rounded-lumen-sm",
  "bg-lumen-bg shadow-lumen-lg ring-1 ring-lumen-accent",
);

/** The spot a dragged row leaves: kept, faded, outlined as a hole. */
const DRAG_HOLE =
  "opacity-40 outline-1 -outline-offset-1 outline-dashed outline-lumen-border-strong";

/*
 * The drag image (#2365). The browser's own is a faint snapshot of whatever
 * element was grabbed — a grip, or a title without its row — so a copy of the
 * whole row is lifted instead and handed to setDragImage, at the spot the
 * pointer took it. The copy has to be in the document when the browser takes
 * its picture, so it goes off-screen in <body> and leaves on the next tick.
 * It carries the arrow column's width with it: that variable is set on the
 * view's root, which the copy is outside of.
 */
function liftDragImage(e: DragEvent): void {
  const transfer = e.dataTransfer;
  const row = (e.currentTarget as HTMLElement).closest<HTMLElement>(
    `[${ROW_ATTR}]`,
  );
  if (!transfer || typeof transfer.setDragImage !== "function" || !row) return;
  const rect = row.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;
  ghost.removeAttribute(ROW_ATTR);
  ghost.setAttribute("data-goal-tree-ghost", "");
  ghost.setAttribute("aria-hidden", "true");
  ghost.className = cn(row.className, DRAG_GHOST);
  ghost.style.width = `${rect.width}px`;
  ghost.style.setProperty(
    "--goal-tree-toggle",
    getComputedStyle(row).getPropertyValue("--goal-tree-toggle"),
  );
  document.body.appendChild(ghost);
  transfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
  window.setTimeout(() => ghost.remove(), 0);
}

function TodoRow({
  todo,
  fromGoalId,
  drag,
  editing,
  onSetTodoStatus,
  onOpenTodo,
  onDeleteTodo,
  labels,
}: {
  todo: GoalTreeTodo;
  /** The goal row this todo hangs under; null in the loose group. */
  fromGoalId: string | null;
  drag: DragState | null;
  editing: boolean;
  onSetTodoStatus: (todoId: string, status: TodoStatus) => void;
  onOpenTodo: (todoId: string) => void;
  onDeleteTodo?: (todoId: string) => void;
  labels: GoalTreeLabels;
}): React.JSX.Element {
  const done = todo.status === "DONE";
  const dragged =
    drag?.source?.kind === "todo" &&
    drag.source.todoId === todo.id &&
    drag.source.fromGoalId === fromGoalId;
  return (
    <li
      data-goal-tree-row=""
      className={cn(
        "group/todo flex items-center gap-1 rounded-lumen-sm transition-colors hover:bg-lumen-hover",
        editing && "bg-lumen-accent-subtle",
        dragged && DRAG_HOLE,
      )}
    >
      {drag && (
        // Mouse only, so hidden from the accessibility tree; the todo's
        // goals can also be changed from the todo's own detail.
        <span
          aria-hidden
          draggable
          data-todo-drag={todo.id}
          title={labels.dragToMove}
          onDragStart={(e) =>
            drag.start(e, { kind: "todo", todoId: todo.id, fromGoalId })
          }
          onDragEnd={drag.end}
          className={cn(
            GRIP,
            "grid w-4 shrink-0 place-items-center self-stretch opacity-0 transition-opacity group-hover/todo:opacity-100",
          )}
        >
          <GripVertical size={12} />
        </span>
      )}
      <TodoStatusCheckbox
        status={todo.status}
        onChange={(next) => onSetTodoStatus(todo.id, next)}
        labels={labels.statusLabels}
        label={labels.status}
        itemName={todo.title}
      />
      <button
        type="button"
        onClick={() => onSetTodoStatus(todo.id, toggledTodoStatus(todo.status))}
        aria-label={(done
          ? labels.formatMarkTodoOpen
          : labels.formatMarkTodoDone)(todo.title)}
        // The whole row carries the hover, so the name adds none of its own.
        className={cn(ROW_BUTTON_SHAPE, "cursor-pointer")}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            done ? "text-lumen-text-tertiary line-through" : "text-lumen-text",
          )}
        >
          {todo.title}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onOpenTodo(todo.id)}
        aria-label={labels.formatOpenTodo(todo.title)}
        title={labels.formatOpenTodo(todo.title)}
        aria-current={editing ? "true" : undefined}
        className={TODO_ROW_ICON}
      >
        <Pencil size={14} aria-hidden />
      </button>
      {onDeleteTodo && (
        <button
          type="button"
          onClick={() => onDeleteTodo(todo.id)}
          aria-label={labels.formatDeleteTodo(todo.title)}
          title={labels.formatDeleteTodo(todo.title)}
          className={TODO_ROW_ICON}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </li>
  );
}

interface BranchState {
  collapsed: ReadonlySet<string>;
  onToggle: (goalId: string) => void;
  drag: DragState | null;
  /** The row whose name is open in a field; one at a time. */
  editing: EditingRow | null;
  onEdit: (row: EditingRow | null) => void;
  /** The row whose "+" is open, and at which step; one at a time. */
  addingUnder: AddingUnder | null;
  onAddUnder: (row: AddingUnder | null) => void;
  /** Open a goal something was just added under, if it was closed. */
  onExpand: (goalId: string) => void;
}

interface AddingUnder extends EditingRow {
  /**
   * "choose" while a todo and a child goal are on offer; then the field, for a
   * todo or for a goal of that kind.
   */
  step: "choose" | "todo" | GoalPeriodKind;
}

/**
 * The icons at a goal row's right end: on hover, on focus, or selected on
 * desktop, and always on a phone.
 */
const ROW_ICON = cn(
  "ml-0.5 grid shrink-0 place-items-center rounded-lumen-sm text-lumen-text-tertiary transition-[color,background-color,opacity] hover:bg-lumen-hover hover:text-lumen-text",
  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
  "max-md:min-h-11 max-md:min-w-11",
);

/*
 * Below 768px a goal row's three icons take a line of their own (#2487). On
 * one line at 390px they held 150px and the badge and the count took the
 * rest, so the title's span was 0px wide. Desktop keeps its one line: there
 * the box is display: contents, and the icons sit in the row as before.
 */
const GOAL_ROW_ICONS =
  "md:contents max-md:flex max-md:basis-full max-md:justify-end";

/** Below 768px the title keeps room for a few characters before it ellipses. */
const GOAL_TITLE_FLOOR = "max-md:min-w-20";

/** A todo row's icons: on hover or focus on desktop, always on a phone. */
const TODO_ROW_ICON = cn(
  ROW_ICON,
  "opacity-0 group-hover/todo:opacity-100 group-focus-within/todo:opacity-100 max-md:opacity-100",
);

/**
 * Which group a row is in. A goal with a parent and nothing connected is
 * drawn twice — under its parent and in the unconnected group — so the edit
 * is held per row, not per goal.
 */
type GoalRowPlace = "tree" | "unconnected" | "completed";

interface EditingRow {
  goalId: string;
  place: GoalRowPlace;
}

/*
 * The name field that stands in for a goal's title (#2283). Enter saves, Esc
 * drops the edit, and leaving the field saves as the detail panel's does.
 * One outcome per edit: Esc unmounts the field, and a blur fired on the way
 * out must not save what Esc threw away.
 */
function GoalTitleEditor({
  goal,
  label,
  onDone,
}: {
  goal: Goal;
  label: string;
  /** The trimmed new name, or null when nothing should be written. */
  onDone: (title: string | null) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(goal.title);
  const settled = useRef(false);
  const finish = (save: boolean): void => {
    if (settled.current) return;
    settled.current = true;
    const next = draft.trim();
    onDone(save && next && next !== goal.title ? next : null);
  };
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (isImeComposing(e)) return;
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      aria-label={label}
      className="min-w-0 flex-1 font-medium max-md:text-base"
    />
  );
}

/*
 * What a goal row's "+" opens (#2367, #2399): a choice between a todo and a
 * goal of each shorter period (a week offers only the todo, so it skips the
 * choice), then one field with a badge saying what it adds. Enter or the
 * button adds and closes, opening the goal if it was closed; Esc or the × closes.
 */
function AddUnderGoal({
  goal,
  step,
  actions,
  labels,
  onStep,
  onAdded,
  onClose,
}: {
  goal: Goal;
  step: AddingUnder["step"];
  actions: GoalRowActions;
  labels: GoalTreeLabels;
  onStep: (step: "todo" | GoalPeriodKind) => void;
  onAdded: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const childLabel = (kind: GoalPeriodKind): string =>
    labels.formatChildGoal(labels.periods[kind]);
  if (step === "choose") {
    return (
      <div className="flex flex-wrap items-center gap-2 py-1 pl-(--goal-tree-toggle)">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onStep("todo")}
          leadingIcon={<Plus size={14} aria-hidden />}
          className="shrink-0 whitespace-nowrap max-md:min-h-11"
        >
          {labels.addTodo}
        </Button>
        {goalChildKinds(goal.periodKind).map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant="secondary"
            onClick={() => onStep(kind)}
            leadingIcon={<Plus size={14} aria-hidden />}
            className="shrink-0 whitespace-nowrap max-md:min-h-11"
          >
            {childLabel(kind)}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="shrink-0 whitespace-nowrap max-md:min-h-11"
        >
          {labels.cancel}
        </Button>
      </div>
    );
  }
  const placeholder =
    step === "todo" ? labels.addTodoPlaceholder : labels.addPlaceholder;
  const badge = step === "todo" ? labels.addTodo : childLabel(step);
  const submit = (): void => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    const run =
      step === "todo"
        ? actions.onAddTodo(goal.id, title)
        : actions.onAddChildGoal(goal, title, step);
    void run.then((ok) => {
      setBusy(false);
      if (!ok) return;
      onAdded();
      onClose();
    });
  };
  return (
    <div className="flex items-center gap-2 py-1 pl-(--goal-tree-toggle) max-md:flex-wrap">
      <span
        data-goal-add-badge
        className="shrink-0 whitespace-nowrap rounded-full border border-lumen-border px-2 py-0.5 text-xs text-lumen-briefing-kohaku"
      >
        {badge}
      </span>
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (isImeComposing(e)) return;
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onClose();
        }}
        placeholder={placeholder}
        aria-label={`${labels.formatAddUnder(goal.title)} — ${badge}`}
        className="min-w-0 max-md:basis-full max-md:text-base"
      />
      <Button
        size="sm"
        onClick={submit}
        disabled={!draft.trim()}
        busy={busy}
        busyLabel={labels.add}
        className="shrink-0 whitespace-nowrap max-md:min-h-11"
      >
        {labels.add}
      </Button>
      <button
        type="button"
        onClick={onClose}
        aria-label={labels.cancel}
        title={labels.cancel}
        className={ROW_ICON}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

function GoalBranch({
  node,
  place,
  props,
  branch,
}: {
  node: GoalTreeNode;
  place: GoalRowPlace;
  props: GoalTreeViewProps;
  branch: BranchState;
}): React.JSX.Element {
  const { labels } = props;
  const { drag } = branch;
  const { goal } = node;
  const selected = goal.id === props.selectedGoalId;
  const hasBelow = node.todos.length > 0 || node.children.length > 0;
  const open = hasBelow && !branch.collapsed.has(goal.id);
  // Only this row: two autofocused fields would steal focus from each other,
  // and the first one's blur would close both.
  const editing =
    branch.editing?.goalId === goal.id && branch.editing.place === place;
  const onRenameGoal = props.onRenameGoal;
  const rowActions = props.rowActions;
  const addingHere =
    branch.addingUnder?.goalId === goal.id && branch.addingUnder.place === place
      ? branch.addingUnder
      : null;
  // A phone has no hover, so the icons stay shown there, as on a todo row.
  const iconClass = cn(
    ROW_ICON,
    !selected && "opacity-0 group-hover/row:opacity-100 max-md:opacity-100",
  );
  // A year goal is the top: there is no parent to drag it under. A row whose
  // name is being typed holds still, so a press in the field stays in it.
  const draggable = drag !== null && goal.periodKind !== "year" && !editing;
  const dragged =
    drag?.source?.kind === "goal" && drag.source.goal.id === goal.id;
  const placeable = drag?.source != null && drag.canDrop(goal);
  const isOver = placeable && drag.overGoalId === goal.id;
  const dragProps = draggable
    ? {
        draggable: true,
        "data-goal-drag": goal.id,
        onDragStart: (e: DragEvent) => drag.start(e, { kind: "goal", goal }),
        onDragEnd: drag.end,
      }
    : {};
  // Hovering the row swaps the arrow for the grip in the same spot.
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <li>
      <div
        data-goal-tree-row=""
        className={cn(
          "group/row flex items-center rounded-lumen-sm transition-colors max-md:flex-wrap",
          dragged && DRAG_HOLE,
          // Info, not accent: accent already marks the selected row, and a
          // place to drop is a different thing to say (#2607).
          placeable &&
            !isOver &&
            "outline-[1.5px] -outline-offset-1 outline-dashed outline-lumen-info",
          isOver &&
            "bg-lumen-info-subtle outline-2 -outline-offset-2 outline-solid outline-lumen-info",
        )}
        onDragOver={drag ? (e) => drag.over(e, goal) : undefined}
        onDragLeave={drag ? (e) => drag.leave(e, goal.id) : undefined}
        onDrop={drag ? (e) => drag.drop(e, goal) : undefined}
      >
        {hasBelow ? (
          // One spot for both: press to fold, grab to drag (#2226).
          <button
            type="button"
            {...dragProps}
            onClick={() => branch.onToggle(goal.id)}
            aria-expanded={open}
            aria-label={(open ? labels.formatCollapse : labels.formatExpand)(
              goal.title,
            )}
            className={cn(
              BRANCH_TOGGLE,
              "rounded-lumen-sm text-lumen-text-tertiary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              draggable && "cursor-grab active:cursor-grabbing",
            )}
          >
            <Chevron
              size={14}
              aria-hidden
              className={cn(draggable && "group-hover/row:hidden")}
            />
            {draggable && (
              <GripVertical
                size={14}
                aria-hidden
                className="hidden group-hover/row:block"
              />
            )}
          </button>
        ) : draggable ? (
          <span
            aria-hidden
            {...dragProps}
            title={labels.dragToMove}
            className={cn(
              BRANCH_TOGGLE,
              GRIP,
              "opacity-0 transition-opacity group-hover/row:opacity-100",
            )}
          >
            <GripVertical size={14} />
          </span>
        ) : (
          <span aria-hidden className={BRANCH_TOGGLE} />
        )}
        {editing && onRenameGoal ? (
          <GoalTitleEditor
            goal={goal}
            label={labels.renameField}
            onDone={(title) => {
              branch.onEdit(null);
              if (title !== null) onRenameGoal(goal.id, title);
            }}
          />
        ) : (
          <button
            type="button"
            // The title is a grip too (#2283). A press without a move is
            // still a click that selects: the browser starts a drag only
            // once the pointer has travelled a few pixels.
            {...dragProps}
            onClick={() => props.onSelectGoal(node.goal.id)}
            aria-current={selected ? "true" : undefined}
            // "Week: Run 3 times — 1/3". Spelled out because the chip, the
            // title and the count are separate spans that a name read off the
            // text would run together.
            aria-label={`${labels.kinds[node.goal.periodKind]}: ${node.goal.title} — ${goalStatusText(node, labels)}`}
            className={cn(
              ROW_BUTTON,
              // A badge, a range and a count that leave no room for the title
              // wrap below it rather than squeeze it (#2487).
              "max-md:flex-wrap",
              selected && "bg-lumen-accent-subtle hover:bg-lumen-accent-subtle",
            )}
          >
            {showsPeriodBadge(goal, props.model.periodKeys) ? (
              <span
                data-goal-period-badge
                className="shrink-0 whitespace-nowrap rounded-lumen-sm bg-lumen-bg-secondary px-1.5 py-0.5 text-xs text-lumen-text-secondary"
              >
                {labels.periods[goal.periodKind]}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-lumen-briefing-kohaku">
                {labels.kinds[goal.periodKind]}
              </span>
            )}
            <span
              data-goal-title
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-semibold text-lumen-text",
                GOAL_TITLE_FLOOR,
              )}
            >
              {node.goal.title}
            </span>
            {goal.startDate && goal.endDate && (
              <span
                data-goal-range
                className="shrink-0 whitespace-nowrap text-xs tabular-nums text-lumen-text-tertiary"
              >
                {labels.formatDateRange(goal.startDate, goal.endDate)}
              </span>
            )}
            <GoalStatus node={node} labels={labels} bar={false} />
          </button>
        )}
        {/* On the hovered or the selected row; a keyboard reaches them while
            hidden, and each shows once focused. */}
        {(rowActions || onRenameGoal) && !editing && (
          <div data-goal-row-icons="" className={GOAL_ROW_ICONS}>
            {rowActions && (
              <button
                type="button"
                onClick={() =>
                  branch.onAddUnder(
                    addingHere
                      ? null
                      : {
                          goalId: goal.id,
                          place,
                          step:
                            goalChildKinds(goal.periodKind).length > 0
                              ? "choose"
                              : "todo",
                        },
                  )
                }
                aria-expanded={addingHere !== null}
                aria-label={labels.formatAddUnder(goal.title)}
                title={labels.addUnderTooltip}
                className={iconClass}
              >
                <Plus size={14} aria-hidden />
              </button>
            )}
            {onRenameGoal && (
              <button
                type="button"
                onClick={() => {
                  branch.onAddUnder(null);
                  branch.onEdit({ goalId: goal.id, place });
                  props.onEditGoal?.(goal.id);
                }}
                aria-label={labels.formatEdit(goal.title)}
                title={labels.editTooltip}
                className={iconClass}
              >
                <Pencil size={14} aria-hidden />
              </button>
            )}
            {rowActions && (
              <button
                type="button"
                onClick={() => rowActions.onDelete(goal)}
                aria-label={labels.formatDelete(goal.title)}
                title={labels.deleteTooltip}
                className={iconClass}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            )}
          </div>
        )}
        {placeable && (
          <span
            aria-hidden
            data-drop-target={goal.id}
            className={cn(
              "mx-1 inline-flex size-5 shrink-0 items-center justify-center rounded-[3px] border border-lumen-info text-lumen-info transition-colors",
              isOver ? "bg-lumen-info-subtle" : "border-dashed",
            )}
          >
            <Plus size={12} strokeWidth={3} />
          </span>
        )}
      </div>
      {addingHere && rowActions && (
        <AddUnderGoal
          goal={goal}
          step={addingHere.step}
          actions={rowActions}
          labels={labels}
          onStep={(step) => branch.onAddUnder({ ...addingHere, step })}
          onAdded={() => branch.onExpand(goal.id)}
          onClose={() => branch.onAddUnder(null)}
        />
      )}
      {open && (
        <>
          {node.todos.length > 0 && (
            <BranchList kind="todos" label={node.goal.title}>
              {node.todos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  fromGoalId={goal.id}
                  drag={drag}
                  editing={todo.id === props.editingTodoId}
                  onSetTodoStatus={props.onSetTodoStatus}
                  onOpenTodo={props.onOpenTodo}
                  onDeleteTodo={props.onDeleteTodo}
                  labels={labels}
                />
              ))}
            </BranchList>
          )}
          {node.children.length > 0 && (
            <BranchList kind="goals">
              {node.children.map((child) => (
                <GoalBranch
                  key={child.goal.id}
                  node={child}
                  place={place}
                  props={props}
                  branch={branch}
                />
              ))}
            </BranchList>
          )}
        </>
      )}
    </li>
  );
}

/**
 * One list under a goal — its todos or its child goals — with its own line
 * (#2282). The line is the list's full height, so a year's runs on past its
 * months and their open weeks to the last row drawn under it; the todo list
 * and the goal list sit flush, so a goal with both reads as one line.
 */
function BranchList({
  kind,
  label,
  children,
}: {
  kind: "todos" | "goals";
  label?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="relative" data-goal-tree-branch={kind}>
      <span aria-hidden data-goal-tree-line className={TREE_LINE} />
      <ul aria-label={label} className={TREE_INDENT}>
        {children}
      </ul>
    </div>
  );
}

function Group({
  heading,
  action,
  children,
}: {
  heading: string;
  /** Sits at the heading's right end. */
  action?: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <section aria-label={heading}>
      {action ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-lumen-text-tertiary">
            {heading}
          </h3>
          {action}
        </div>
      ) : (
        <h3 className={GROUP_HEADING}>{heading}</h3>
      )}
      {children}
    </section>
  );
}

export function GoalTreeView(props: GoalTreeViewProps): React.JSX.Element {
  const { isLoading, labels } = props;
  // The tree without its completed items; those are drawn last (#2368).
  // The drop rule still reads the whole model.
  const { model, completed } = separateCompleted(props.model);
  const [adding, setAdding] = useState<GoalPeriodKind | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // The add field's range, seeded with the period's own when it opens.
  const [range, setRange] = useState({ start: "", end: "" });
  const rangeStartId = useId();
  const rangeEndId = useId();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [addingTodo, setAddingTodo] = useState(false);
  const [todoDraft, setTodoDraft] = useState("");
  const [todoBusy, setTodoBusy] = useState(false);
  /*
   * The source lives in a ref for the event handlers and in state for the
   * paint. The state is set a tick late: Chromium may cancel a drag whose
   * dragstart re-renders the page under the pointer.
   */
  const dragSource = useRef<GoalTreeDragSource | null>(null);
  const [shownSource, setShownSource] = useState<GoalTreeDragSource | null>(
    null,
  );
  const [overGoalId, setOverGoalId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const [addingUnder, setAddingUnder] = useState<AddingUnder | null>(null);

  if (isLoading) {
    return (
      <div role="status" aria-label={labels.loading}>
        <SkeletonList rows={6} rowHeight={36} />
      </div>
    );
  }

  if (props.loadFailed) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 px-6 py-12 text-center"
      >
        <p className="text-[12.5px] text-lumen-text-secondary">
          {labels.loadFailed}
        </p>
        {props.onRetry && (
          <Button
            size="sm"
            variant="secondary"
            onClick={props.onRetry}
            className="max-md:min-h-11"
          >
            {labels.retry}
          </Button>
        )}
      </div>
    );
  }

  const openAdd = (kind: GoalPeriodKind | null): void => {
    setAdding(kind);
    if (kind) setRange(goalPeriodBounds(kind, model.periodKeys[kind]));
  };
  const rangeValid = !!range.start && !!range.end && range.start <= range.end;

  const submit = (): void => {
    const title = draft.trim();
    if (!adding || !title || busy || !rangeValid) return;
    // Left at the period's own, nothing is stored: the goal follows its period.
    const own = goalPeriodBounds(adding, model.periodKeys[adding]);
    const picked =
      range.start === own.start && range.end === own.end
        ? null
        : { startDate: range.start, endDate: range.end };
    setBusy(true);
    void props.onCreateGoal(adding, title, picked).then((ok) => {
      setBusy(false);
      if (ok) {
        setDraft("");
        setAdding(null);
      }
    });
  };

  const submitTodo = (): void => {
    const title = todoDraft.trim();
    if (!title || todoBusy) return;
    setTodoBusy(true);
    // The field stays open for the next one; only the draft clears.
    void props.onCreateLooseTodo(title).then((ok) => {
      setTodoBusy(false);
      if (ok) setTodoDraft("");
    });
  };

  const endDrag = (): void => {
    dragSource.current = null;
    setShownSource(null);
    setOverGoalId(null);
  };
  const handlers = props.drag;
  const drag: DragState | null = handlers
    ? {
        source: shownSource,
        overGoalId,
        canDrop: (target) =>
          shownSource !== null && canDropOn(shownSource, target, model),
        start: (e, source) => {
          // Firefox starts no drag without data. Not text/plain: dropped on
          // a text field, that would type the id into a goal's title.
          e.dataTransfer?.setData(
            GOAL_TREE_DRAG_TYPE,
            source.kind === "goal" ? source.goal.id : source.todoId,
          );
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
          liftDragImage(e);
          dragSource.current = source;
          window.setTimeout(() => {
            if (dragSource.current === source) setShownSource(source);
          }, 0);
        },
        end: endDrag,
        over: (e, target) => {
          const source = dragSource.current;
          if (!source || !canDropOn(source, target, model)) return;
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          if (overGoalId !== target.id) setOverGoalId(target.id);
        },
        leave: (e, goalId) => {
          // Moving onto a child of the row is not leaving it.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setOverGoalId((prev) => (prev === goalId ? null : prev));
        },
        drop: (e, target) => {
          const source = dragSource.current;
          e.preventDefault();
          // Also here: a re-read may unmount the source before dragend.
          endDrag();
          if (!source || !canDropOn(source, target, model)) return;
          if (source.kind === "goal") {
            handlers.onMoveGoal(source.goal.id, target.id);
          } else {
            handlers.onMoveTodo(source.todoId, source.fromGoalId, target.id);
          }
        },
      }
    : null;

  const branch: BranchState = {
    collapsed,
    onToggle: (goalId) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (!next.delete(goalId)) next.add(goalId);
        return next;
      }),
    drag,
    editing,
    onEdit: setEditing,
    addingUnder,
    onAddUnder: setAddingUnder,
    onExpand: (goalId) =>
      setCollapsed((prev) => {
        if (!prev.has(goalId)) return prev;
        const next = new Set(prev);
        next.delete(goalId);
        return next;
      }),
  };

  // `byId` holds every shown goal whatever the filter; roots and unconnected
  // are what the filter left. A goal that only moved to the completed list
  // still matched, so the check reads the model as passed in.
  const hasGoals = model.byId.size > 0;
  const activeFilters = props.activeFilters ?? [];
  const nothingMatches =
    props.model.roots.length === 0 && props.model.unconnected.length === 0;
  const hasCompleted = completed.goals.length > 0 || completed.todos.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", TREE_TOGGLE_SIZE)}>
      <section aria-label={labels.addHeading}>
        <Button
          variant={adding ? "primary" : "secondary"}
          size="sm"
          // Opens on this week, the period the empty state's button sets too.
          onClick={() => openAdd(adding ? null : "week")}
          aria-expanded={adding !== null}
          leadingIcon={<Plus size={14} aria-hidden />}
          className={cn(KEEP_LABEL, "max-md:min-h-11")}
        >
          {labels.addHeading}
        </Button>
        {adding && (
          <SegmentedToggle
            options={GOAL_PERIOD_KINDS.map((kind) => ({
              value: kind,
              label: labels.periods[kind],
            }))}
            value={adding}
            onChange={openAdd}
            label={labels.addHeading}
            className="mt-2 max-w-sm"
          />
        )}
        {adding && (
          // Below 768px the field takes its own line, so the placeholder is
          // not cut down to a few characters beside the two buttons (#2490).
          <div className="mt-2 flex items-center gap-2 max-md:flex-wrap">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (isImeComposing(e)) return;
                if (e.key === "Enter") submit();
                if (e.key === "Escape") openAdd(null);
              }}
              placeholder={`${labels.periods[adding]} ${labels.periodRanges[adding]}: ${labels.addPlaceholder}${
                adding === "month" || adding === "week"
                  ? labels.addNoParentHint
                  : ""
              }`}
              aria-label={`${labels.periods[adding]}: ${labels.addPlaceholder}`}
              className="min-w-0 max-md:min-h-11 max-md:basis-full max-md:text-base"
            />
            <Button
              size="sm"
              onClick={submit}
              disabled={!draft.trim() || !rangeValid}
              busy={busy}
              busyLabel={labels.add}
              className={cn(KEEP_LABEL, "max-md:min-h-11")}
            >
              {labels.add}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openAdd(null)}
              className={cn(KEEP_LABEL, "max-md:min-h-11")}
            >
              {labels.cancel}
            </Button>
          </div>
        )}
        {adding && (
          // Each label and its date field form one pair, so a wrap never
          // leaves a label at the end of one line and its field on the next.
          // Below 768px the pairs stack and the fields fill the width (#2490).
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-lumen-text-secondary max-md:flex-col max-md:items-stretch">
            <div data-goal-range-pair className="flex items-center gap-2">
              <label
                htmlFor={rangeStartId}
                className="shrink-0 whitespace-nowrap"
              >
                {labels.startDate}
              </label>
              <span className="w-40 shrink-0 max-md:w-auto max-md:min-w-0 max-md:flex-1">
                <Input
                  id={rangeStartId}
                  type="date"
                  value={range.start}
                  invalid={!rangeValid}
                  onChange={(e) =>
                    setRange({ ...range, start: e.target.value })
                  }
                  className="max-md:min-h-11 max-md:text-base"
                />
              </span>
            </div>
            <div data-goal-range-pair className="flex items-center gap-2">
              <label
                htmlFor={rangeEndId}
                className="shrink-0 whitespace-nowrap"
              >
                {labels.endDate}
              </label>
              <span className="w-40 shrink-0 max-md:w-auto max-md:min-w-0 max-md:flex-1">
                <Input
                  id={rangeEndId}
                  type="date"
                  value={range.end}
                  min={range.start || undefined}
                  invalid={!rangeValid}
                  onChange={(e) => setRange({ ...range, end: e.target.value })}
                  className="max-md:min-h-11 max-md:text-base"
                />
              </span>
            </div>
          </div>
        )}
      </section>

      {!hasGoals ? (
        <EmptyState
          icon={<Target />}
          message={labels.empty}
          cta={
            adding
              ? undefined
              : { label: labels.emptyAction, onClick: () => openAdd("week") }
          }
        />
      ) : (
        <>
          {activeFilters.length > 0 && (
            <div
              role="status"
              className="-mb-3 flex flex-wrap items-center gap-2 rounded-lumen-sm bg-lumen-bg-secondary px-3 py-1.5 text-xs text-lumen-text-secondary"
            >
              <span className="min-w-0 flex-1">
                {labels.filteringBy}: {activeFilters.join(" · ")}
              </span>
              {props.onResetFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={props.onResetFilters}
                  className={cn(KEEP_LABEL, "max-md:min-h-11")}
                >
                  {labels.resetFilters}
                </Button>
              )}
            </div>
          )}
          {nothingMatches && (
            <p className="text-xs text-lumen-text-secondary">
              {labels.noMatch}
            </p>
          )}
          {model.roots.length > 0 && (
            // No visible heading or period legend: the tree starts right under
            // the add field, as in the prototype (#2606). The name stays for
            // screen readers, which still need the region told apart.
            <section aria-label={labels.treeHeading}>
              <ul>
                {model.roots.map((node) => (
                  <GoalBranch
                    key={node.goal.id}
                    node={node}
                    place="tree"
                    props={props}
                    branch={branch}
                  />
                ))}
              </ul>
            </section>
          )}
          {model.unconnected.length > 0 && (
            <Group heading={labels.unconnectedHeading}>
              <ul>
                {model.unconnected.map((node) => (
                  <GoalBranch
                    key={node.goal.id}
                    node={node}
                    place="unconnected"
                    props={props}
                    branch={branch}
                  />
                ))}
              </ul>
            </Group>
          )}
        </>
      )}

      {/* With goals on screen the group stays, so "+ Todo" stays reachable. */}
      {(model.looseTodos.length > 0 || hasGoals) && (
        <Group
          heading={labels.looseHeading}
          action={
            <Button
              size="sm"
              variant={addingTodo ? "primary" : "ghost"}
              onClick={() => setAddingTodo(!addingTodo)}
              aria-expanded={addingTodo}
              aria-label={labels.addTodoLabel}
              leadingIcon={<Plus size={14} aria-hidden />}
              className={cn(KEEP_LABEL, "max-md:min-h-11")}
            >
              {labels.addTodo}
            </Button>
          }
        >
          {addingTodo && (
            <div className="mb-1 flex items-center gap-2">
              <Input
                autoFocus
                value={todoDraft}
                onChange={(e) => setTodoDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (isImeComposing(e)) return;
                  if (e.key === "Enter") submitTodo();
                  if (e.key === "Escape") setAddingTodo(false);
                }}
                placeholder={labels.addTodoPlaceholder}
                aria-label={labels.addTodoLabel}
                className="min-w-0 max-md:text-base"
              />
              <Button
                size="sm"
                onClick={submitTodo}
                disabled={!todoDraft.trim()}
                busy={todoBusy}
                busyLabel={labels.add}
                className={cn(KEEP_LABEL, "max-md:min-h-11")}
              >
                {labels.add}
              </Button>
            </div>
          )}
          <ul>
            {model.looseTodos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                fromGoalId={null}
                drag={drag}
                editing={todo.id === props.editingTodoId}
                onSetTodoStatus={props.onSetTodoStatus}
                onOpenTodo={props.onOpenTodo}
                onDeleteTodo={props.onDeleteTodo}
                labels={labels}
              />
            ))}
          </ul>
        </Group>
      )}

      {hasCompleted && (
        <Group heading={labels.completedHeading}>
          {completed.goals.length > 0 && (
            <ul>
              {completed.goals.map((node) => (
                <GoalBranch
                  key={node.goal.id}
                  node={node}
                  place="completed"
                  props={props}
                  branch={branch}
                />
              ))}
            </ul>
          )}
          {completed.todos.length > 0 && (
            <ul>
              {completed.todos.map(({ todo, fromGoalId }) => (
                <TodoRow
                  key={`${fromGoalId ?? ""}:${todo.id}`}
                  todo={todo}
                  fromGoalId={fromGoalId}
                  drag={drag}
                  editing={todo.id === props.editingTodoId}
                  onSetTodoStatus={props.onSetTodoStatus}
                  onOpenTodo={props.onOpenTodo}
                  onDeleteTodo={props.onDeleteTodo}
                  labels={labels}
                />
              ))}
            </ul>
          )}
        </Group>
      )}
    </div>
  );
}
