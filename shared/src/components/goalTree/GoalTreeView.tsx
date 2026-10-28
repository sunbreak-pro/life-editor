import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Target,
} from "lucide-react";
import { cn } from "../cn";
import { Button } from "../Button";
import { EmptyState } from "../EmptyState";
import { Input } from "../Input";
import { SkeletonList } from "../SkeletonList";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { StatusLabelSet } from "../todoStatusVisuals";
import type { Goal, GoalPeriodKind } from "../../types/goal";
import type { TodoStatus } from "../../types/todoTree";
import { isImeComposing } from "../../utils/imeGuard";
import {
  GOAL_PERIOD_KINDS,
  GOALS_PER_PERIOD,
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
 * Top to bottom: the add row (three goals per period), the year → month →
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
 * With `onRenameGoal`, a pencil on the hovered or selected row swaps the
 * title for a name field in place (#2283); the row stops dragging until the
 * field closes. A goal drawn twice — under its parent and as unconnected —
 * opens the field only on the row whose pencil was pressed.
 *
 * Completed items (#2368): an achieved goal, with what is under it, and a
 * done todo leave the tree for a "Completed items" group at the bottom
 * (separateCompleted). Un-ticking or un-achieving puts them back, because
 * the host's next model no longer counts them as completed.
 *
 * Pure presentation (§6.4): the model and every label come from the host
 * (web/src/connect/GoalsTodosScreen.tsx). The state held here — the add
 * fields' drafts, which goals are closed and what is being dragged — is
 * nothing outside needs.
 */

export interface GoalTreeLabels {
  /** "Year" / "Month" / "Week" — the chip on every goal row. */
  kinds: Record<GoalPeriodKind, string>;
  /** "This year" / "This month" / "This week" — the add buttons. */
  periods: Record<GoalPeriodKind, string>;
  /** "2026" / "October" / "10/4 – 10/10" — beside the period name. */
  periodRanges: Record<GoalPeriodKind, string>;
  addHeading: string;
  addPlaceholder: string;
  add: string;
  cancel: string;
  /** "This week: 3 goals already" — the add button's reason when disabled. */
  formatLimit: (period: string) => string;
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
  /** "Rename: Run 3 times" — the pencil's spoken name and tooltip. */
  formatRename: (title: string) => string;
  /** The name field the pencil opens. */
  renameField: string;
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
   * would then claim "no goals" and lift the three-per-period limit, which
   * only this screen enforces (0034_goals.sql leaves it out of the DB).
   */
  loadFailed?: boolean;
  onRetry?: () => void;
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  /** Resolves true once the goal exists, so the field can clear. */
  onCreateGoal: (kind: GoalPeriodKind, title: string) => Promise<boolean>;
  /** A todo linked to no goal. Resolves true once it exists. */
  onCreateLooseTodo: (title: string) => Promise<boolean>;
  /** The active filter as phrases; empty or absent when nothing is filtered. */
  activeFilters?: readonly string[];
  onResetFilters?: () => void;
  onSetTodoStatus: (todoId: string, status: TodoStatus) => void;
  onOpenTodo: (todoId: string) => void;
  /** Desktop only. Absent, no grip is drawn and nothing can be dragged. */
  drag?: GoalTreeDragHandlers;
  /** A new name from a row's pencil, trimmed and changed. Absent, no pencil. */
  onRenameGoal?: (goalId: string, title: string) => void;
  labels: GoalTreeLabels;
}

export interface GoalTreeDragHandlers {
  /** A goal dropped on a goal one period up. */
  onMoveGoal: (goalId: string, parentGoalId: string) => void;
  /** A todo dropped on a goal; `fromGoalId` is null for a loose todo. */
  onMoveTodo: (
    todoId: string,
    fromGoalId: string | null,
    toGoalId: string,
  ) => void;
}

const ROW_BUTTON = cn(
  "flex min-w-0 flex-1 items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left",
  "transition-colors hover:bg-lumen-hover max-md:min-h-11",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
);

const GROUP_HEADING = "mb-1.5 text-xs font-medium text-lumen-text-tertiary";

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

/** What GoalStatus shows, as text — the row's spoken name ends with it. */
function goalStatusText(node: GoalTreeNode, labels: StatusLabels): string {
  if (node.achievement.achieved) return labels.achieved;
  if (!node.achievement.connected) return labels.unconnected;
  const { done, total } = goalProgress(node.achievement);
  return labels.formatProgress(done, total);
}

/** Achieved / unconnected chip, or the n/m count with its bar. */
export function GoalStatus({
  node,
  labels,
}: {
  node: GoalTreeNode;
  labels: StatusLabels;
}): React.JSX.Element {
  const { achievement } = node;
  if (achievement.achieved) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lumen-chip-mint-bg px-2 py-0.5 text-xs font-medium text-lumen-chip-mint-fg">
        <CheckCircle2 size={12} aria-hidden />
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
      <span className="text-xs tabular-nums text-lumen-text-secondary">
        {labels.formatProgress(done, total)}
      </span>
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

function TodoRow({
  todo,
  fromGoalId,
  drag,
  onSetTodoStatus,
  onOpenTodo,
  labels,
}: {
  todo: GoalTreeTodo;
  /** The goal row this todo hangs under; null in the loose group. */
  fromGoalId: string | null;
  drag: DragState | null;
  onSetTodoStatus: (todoId: string, status: TodoStatus) => void;
  onOpenTodo: (todoId: string) => void;
  labels: GoalTreeLabels;
}): React.JSX.Element {
  const done = todo.status === "DONE";
  const dragged =
    drag?.source?.kind === "todo" &&
    drag.source.todoId === todo.id &&
    drag.source.fromGoalId === fromGoalId;
  return (
    <li
      className={cn(
        "group/todo flex items-center gap-1",
        dragged && "opacity-50",
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
        onClick={() => onOpenTodo(todo.id)}
        aria-label={labels.formatOpenTodo(todo.title)}
        className={cn(ROW_BUTTON, "group")}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            done ? "text-lumen-text-tertiary line-through" : "text-lumen-text",
          )}
        >
          {todo.title}
        </span>
        <ChevronRight
          size={14}
          aria-hidden
          className="shrink-0 text-lumen-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
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
}

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
        className={cn(
          "group/row flex items-center rounded-lumen-sm",
          dragged && "opacity-50",
          placeable &&
            "outline-1 -outline-offset-1 outline-dashed outline-lumen-accent",
          isOver && "bg-lumen-accent-subtle",
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
              selected && "bg-lumen-accent-subtle hover:bg-lumen-accent-subtle",
            )}
          >
            <span className="shrink-0 text-xs text-lumen-briefing-kohaku">
              {labels.kinds[node.goal.periodKind]}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-lumen-text">
              {node.goal.title}
            </span>
            <GoalStatus node={node} labels={labels} />
          </button>
        )}
        {onRenameGoal && !editing && (
          // On the hovered or the selected row; a keyboard reaches it while
          // hidden, and it shows once focused.
          <button
            type="button"
            onClick={() => branch.onEdit({ goalId: goal.id, place })}
            aria-label={labels.formatRename(goal.title)}
            title={labels.formatRename(goal.title)}
            className={cn(
              "ml-0.5 shrink-0 rounded-lumen-sm text-lumen-text-tertiary transition-[color,background-color,opacity] hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              "max-md:min-h-11 max-md:min-w-11",
              !selected && "opacity-0 group-hover/row:opacity-100",
            )}
          >
            <Pencil size={14} aria-hidden />
          </button>
        )}
        {placeable && (
          <span
            aria-hidden
            data-drop-target={goal.id}
            className={cn(
              "mx-1 grid size-5 shrink-0 place-items-center rounded-lumen-sm border border-lumen-accent transition-colors",
              isOver
                ? "bg-lumen-accent text-lumen-on-accent"
                : "border-dashed text-lumen-accent",
            )}
          >
            <Plus size={12} />
          </span>
        )}
      </div>
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
                  onSetTodoStatus={props.onSetTodoStatus}
                  onOpenTodo={props.onOpenTodo}
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
  const limitId = useId();
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

  const submit = (): void => {
    const title = draft.trim();
    if (!adding || !title || busy) return;
    setBusy(true);
    void props.onCreateGoal(adding, title).then((ok) => {
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
  };

  // `byId` holds every shown goal whatever the filter; roots and unconnected
  // are what the filter left. A goal that only moved to the completed list
  // still matched, so the check reads the model as passed in.
  const hasGoals = model.byId.size > 0;
  const activeFilters = props.activeFilters ?? [];
  const nothingMatches =
    props.model.roots.length === 0 && props.model.unconnected.length === 0;
  const hasCompleted = completed.goals.length > 0 || completed.todos.length > 0;
  // Said in text under the buttons, not only in a disabled button's title:
  // a disabled button takes no focus, so the title never reaches a keyboard
  // or screen-reader user.
  const fullKinds = GOAL_PERIOD_KINDS.filter(
    (kind) => model.periodCounts[kind] >= GOALS_PER_PERIOD,
  );

  return (
    <div className={cn("flex flex-col gap-6", TREE_TOGGLE_SIZE)}>
      <section aria-label={labels.addHeading}>
        <h3 className={GROUP_HEADING}>{labels.addHeading}</h3>
        <div className="flex flex-wrap gap-2">
          {GOAL_PERIOD_KINDS.map((kind) => {
            const full = fullKinds.includes(kind);
            return (
              <Button
                key={kind}
                variant={adding === kind ? "primary" : "secondary"}
                size="sm"
                disabled={full}
                aria-describedby={full ? limitId : undefined}
                onClick={() => setAdding(adding === kind ? null : kind)}
                leadingIcon={<Plus size={14} aria-hidden />}
                className="max-md:min-h-11"
              >
                {labels.periods[kind]}
                <span className="tabular-nums text-xs opacity-80">
                  {model.periodCounts[kind]}/{GOALS_PER_PERIOD}
                </span>
              </Button>
            );
          })}
        </div>
        {fullKinds.length > 0 && (
          <p id={limitId} className="mt-1.5 text-xs text-lumen-text-tertiary">
            {fullKinds
              .map((kind) => labels.formatLimit(labels.periods[kind]))
              .join(" ")}
          </p>
        )}
        {adding && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (isImeComposing(e)) return;
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setAdding(null);
              }}
              placeholder={`${labels.periods[adding]} ${labels.periodRanges[adding]}: ${labels.addPlaceholder}`}
              aria-label={`${labels.periods[adding]}: ${labels.addPlaceholder}`}
              className="max-md:text-base"
            />
            <Button
              size="sm"
              onClick={submit}
              disabled={!draft.trim()}
              busy={busy}
              busyLabel={labels.add}
              className="max-md:min-h-11"
            >
              {labels.add}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAdding(null)}
              className="max-md:min-h-11"
            >
              {labels.cancel}
            </Button>
          </div>
        )}
      </section>

      {!hasGoals ? (
        <EmptyState
          icon={<Target />}
          message={labels.empty}
          cta={
            adding === "week"
              ? undefined
              : { label: labels.emptyAction, onClick: () => setAdding("week") }
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
                  className="max-md:min-h-11"
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
            <Group heading={labels.treeHeading}>
              <p className="mb-1 text-xs text-lumen-text-tertiary">
                {GOAL_PERIOD_KINDS.map(
                  (kind) =>
                    `${labels.periods[kind]} ${labels.periodRanges[kind]}`,
                ).join(" · ")}
              </p>
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
            </Group>
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
              className="max-md:min-h-11"
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
                className="max-md:text-base"
              />
              <Button
                size="sm"
                onClick={submitTodo}
                disabled={!todoDraft.trim()}
                busy={todoBusy}
                busyLabel={labels.add}
                className="max-md:min-h-11"
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
                onSetTodoStatus={props.onSetTodoStatus}
                onOpenTodo={props.onOpenTodo}
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
                  onSetTodoStatus={props.onSetTodoStatus}
                  onOpenTodo={props.onOpenTodo}
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
