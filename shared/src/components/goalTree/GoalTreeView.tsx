import { useId, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
import type { GoalPeriodKind } from "../../types/goal";
import type { TodoStatus } from "../../types/todoTree";
import { isImeComposing } from "../../utils/imeGuard";
import {
  GOAL_PERIOD_KINDS,
  GOALS_PER_PERIOD,
  goalProgress,
  type GoalTreeModel,
  type GoalTreeNode,
  type GoalTreeTodo,
} from "./buildGoalTreeModel";

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
 * Pure presentation (§6.4): the model and every label come from the host
 * (web/src/connect/GoalsTodosScreen.tsx). The state held here — the add
 * fields' drafts and which goals are closed — is nothing outside needs.
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
  /** "Todo" — the loose group's add button, after a plus. */
  addTodo: string;
  /** The add button's and the field's spoken name. */
  addTodoLabel: string;
  addTodoPlaceholder: string;
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
  labels: GoalTreeLabels;
}

const ROW_BUTTON = cn(
  "flex min-w-0 flex-1 items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left",
  "transition-colors hover:bg-lumen-hover max-md:min-h-11",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
);

const GROUP_HEADING = "mb-1.5 text-xs font-medium text-lumen-text-tertiary";

/** The arrow's column, kept on rows without one so titles line up. */
const BRANCH_TOGGLE = "grid size-6 shrink-0 place-items-center max-md:size-11";

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

function TodoRow({
  todo,
  onSetTodoStatus,
  onOpenTodo,
  labels,
}: {
  todo: GoalTreeTodo;
  onSetTodoStatus: (todoId: string, status: TodoStatus) => void;
  onOpenTodo: (todoId: string) => void;
  labels: GoalTreeLabels;
}): React.JSX.Element {
  const done = todo.status === "DONE";
  return (
    <li className="flex items-center gap-1">
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
}

function GoalBranch({
  node,
  props,
  branch,
}: {
  node: GoalTreeNode;
  props: GoalTreeViewProps;
  branch: BranchState;
}): React.JSX.Element {
  const { labels } = props;
  const selected = node.goal.id === props.selectedGoalId;
  const hasBelow = node.todos.length > 0 || node.children.length > 0;
  const open = hasBelow && !branch.collapsed.has(node.goal.id);
  return (
    <li>
      <div className="flex items-center">
        {hasBelow ? (
          <button
            type="button"
            onClick={() => branch.onToggle(node.goal.id)}
            aria-expanded={open}
            aria-label={(open ? labels.formatCollapse : labels.formatExpand)(
              node.goal.title,
            )}
            className={cn(
              BRANCH_TOGGLE,
              "rounded-lumen-sm text-lumen-text-tertiary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            {open ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
          </button>
        ) : (
          <span aria-hidden className={BRANCH_TOGGLE} />
        )}
        <button
          type="button"
          onClick={() => props.onSelectGoal(node.goal.id)}
          aria-current={selected ? "true" : undefined}
          // "Week: Run 3 times — 1/3". Spelled out because the chip, the title
          // and the count are separate spans that a name read off the text
          // would run together.
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
      </div>
      {open && (
        <div className="ml-3 border-l border-lumen-border pl-3">
          {node.todos.length > 0 && (
            <ul aria-label={node.goal.title}>
              {node.todos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onSetTodoStatus={props.onSetTodoStatus}
                  onOpenTodo={props.onOpenTodo}
                  labels={labels}
                />
              ))}
            </ul>
          )}
          {node.children.length > 0 && (
            <ul>
              {node.children.map((child) => (
                <GoalBranch
                  key={child.goal.id}
                  node={child}
                  props={props}
                  branch={branch}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
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
  const { model, isLoading, labels } = props;
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

  const branch: BranchState = {
    collapsed,
    onToggle: (goalId) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (!next.delete(goalId)) next.add(goalId);
        return next;
      }),
  };

  // `byId` holds every shown goal whatever the filter; roots and unconnected
  // are what the filter left.
  const hasGoals = model.byId.size > 0;
  const activeFilters = props.activeFilters ?? [];
  const nothingMatches =
    model.roots.length === 0 && model.unconnected.length === 0;
  // Said in text under the buttons, not only in a disabled button's title:
  // a disabled button takes no focus, so the title never reaches a keyboard
  // or screen-reader user.
  const fullKinds = GOAL_PERIOD_KINDS.filter(
    (kind) => model.periodCounts[kind] >= GOALS_PER_PERIOD,
  );

  return (
    <div className="flex flex-col gap-6">
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
                onSetTodoStatus={props.onSetTodoStatus}
                onOpenTodo={props.onOpenTodo}
                labels={labels}
              />
            ))}
          </ul>
        </Group>
      )}
    </div>
  );
}
