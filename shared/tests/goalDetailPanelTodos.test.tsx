import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  GoalDetailPanel,
  buildGoalTreeModel,
  type Goal,
  type GoalDetailLabels,
  type GoalTreeLabels,
  type TodoStatus,
} from "../src";

/*
 * The goal panel's "Linked todos" rows (#2388, D-20261102-connect-5 = B):
 * the name ticks the todo with the same press the tree's rows use, and the
 * pencil at the row's end is the way into the editor. The pencil's hover
 * reveal is CSS and is chat-main's browser check.
 */

const GOAL: Goal = {
  id: "w1",
  title: "Run 3 times",
  periodKind: "week",
  periodKey: "2026-09-27",
  sortOrder: 0,
  parentGoalId: null,
  manualAchievedAt: null,
  periodEndDecision: null,
  decidedAt: null,
  carriedFromGoalId: null,
  legacyKey: null,
  isDeleted: false,
  createdAt: "2026-09-27T00:00:00Z",
  updatedAt: "2026-09-27T00:00:00Z",
};

const TODOS = [
  { id: "t1", title: "5 km jog", status: "NOT_STARTED" as const },
  { id: "t2", title: "Long run", status: "DONE" as const },
];

const LINKS = TODOS.map((t, i) => ({
  id: `l${i}`,
  goalId: "w1",
  todoId: t.id,
  isDeleted: false,
}));

const TREE: GoalTreeLabels = {
  kinds: { year: "Year", month: "Month", week: "Week" },
  periods: { year: "This year", month: "This month", week: "This week" },
  periodRanges: { year: "2026", month: "September", week: "9/27 – 10/3" },
  addHeading: "Add a goal",
  addPlaceholder: "Goal",
  addNoParentHint: " (no parent needed)",
  add: "Add",
  cancel: "Cancel",
  startDate: "From",
  endDate: "To",
  formatDateRange: (start, end) => `${start} – ${end}`,
  treeHeading: "Goals",
  unconnectedHeading: "Unconnected",
  looseHeading: "Todos without a goal",
  empty: "No goals",
  emptyAction: "Add this week's goal",
  achieved: "Achieved",
  unconnected: "Unconnected",
  formatProgress: (done, total) => `${done}/${total}`,
  status: "Status",
  statusLabels: { statusNotStarted: "Not started", statusDone: "Done" },
  formatOpenTodo: (title) => `Edit: ${title}`,
  formatMarkTodoDone: (title) => `Mark as done: ${title}`,
  formatMarkTodoOpen: (title) => `Mark as not done: ${title}`,
  formatDeleteTodo: (title) => `Delete todo: ${title}`,
  formatExpand: (title) => `Expand: ${title}`,
  formatCollapse: (title) => `Collapse: ${title}`,
  filteringBy: "Filtering by",
  resetFilters: "Reset",
  noMatch: "Nothing matches",
  completedHeading: "Completed items",
  addTodo: "Todo",
  addTodoLabel: "Add a todo",
  addTodoPlaceholder: "Todo",
  dragToMove: "Drag to move",
  addUnderTooltip: "Add below",
  editTooltip: "Rename",
  deleteTooltip: "Delete",
  formatEdit: (title) => `Edit goal: ${title}`,
  formatAddUnder: (title) => `Add under: ${title}`,
  formatDelete: (title) => `Delete goal: ${title}`,
  formatChildGoal: (kind) => `${kind} goal`,
  renameField: "Goal title",
  loading: "Loading",
  loadFailed: "Could not load",
  retry: "Retry",
};

const LABELS: GoalDetailLabels = {
  titleLabel: "Goal title",
  parentLabel: "Goal above",
  parentNone: "None",
  unlinkParent: "Remove",
  formatUnlinkParent: (title) => `Remove from the goal above: ${title}`,
  todosHeading: "Linked todos",
  todosEmpty: "No todos yet",
  linkTodos: "Link todos",
  childrenHeading: "Child goals",
  formatEarlierChildren: (count) => `${count} more`,
  markAchieved: "Mark as achieved",
  unmarkAchieved: "Unmark",
  manualHint: "Hint",
  deleteGoal: "Delete goal",
  formatPeriod: (kind, key) => `${kind} · ${key}`,
  tree: TREE,
};

function renderPanel(over: {
  onSetTodoStatus?: (todoId: string, status: TodoStatus) => void;
  onOpenTodo?: (todoId: string) => void;
}) {
  const model = buildGoalTreeModel({
    goals: [GOAL],
    links: LINKS,
    todos: TODOS,
    todayKey: "2026-09-30",
    untitled: "Untitled",
  });
  const node = model.byId.get("w1");
  if (!node) throw new Error("the goal is not in the model");
  render(
    <GoalDetailPanel
      node={node}
      parentOptions={[]}
      onRename={vi.fn()}
      onChangeParent={vi.fn()}
      onSetManualAchieved={vi.fn()}
      onDelete={vi.fn()}
      onSelectGoal={vi.fn()}
      onSetTodoStatus={over.onSetTodoStatus ?? vi.fn()}
      onOpenTodo={over.onOpenTodo ?? vi.fn()}
      labels={LABELS}
    />,
  );
  return within(screen.getByRole("region", { name: "Linked todos" }));
}

describe("GoalDetailPanel — a linked todo's name and pencil (#2388)", () => {
  it("ticks an open todo from its name, and does not open the editor", () => {
    const onSetTodoStatus = vi.fn();
    const onOpenTodo = vi.fn();
    const todos = renderPanel({ onSetTodoStatus, onOpenTodo });
    fireEvent.click(
      todos.getByRole("button", { name: "Mark as done: 5 km jog" }),
    );
    expect(onSetTodoStatus).toHaveBeenCalledWith("t1", "DONE");
    expect(onOpenTodo).not.toHaveBeenCalled();
  });

  it("un-ticks a done todo from its name, which is struck through", () => {
    const onSetTodoStatus = vi.fn();
    const todos = renderPanel({ onSetTodoStatus });
    const name = todos.getByRole("button", {
      name: "Mark as not done: Long run",
    });
    expect(name.className).toContain("line-through");
    fireEvent.click(name);
    expect(onSetTodoStatus).toHaveBeenCalledWith("t2", "NOT_STARTED");
  });

  it("opens the editor from the pencil, and only there", () => {
    const onSetTodoStatus = vi.fn();
    const onOpenTodo = vi.fn();
    const todos = renderPanel({ onSetTodoStatus, onOpenTodo });
    const pencil = todos.getByRole("button", { name: "Edit: 5 km jog" });
    expect(pencil.getAttribute("title")).toBe("Edit: 5 km jog");
    fireEvent.click(pencil);
    expect(onOpenTodo).toHaveBeenCalledWith("t1");
    expect(onSetTodoStatus).not.toHaveBeenCalled();
  });

  it("keeps the checkbox and draws no bin", () => {
    const todos = renderPanel({});
    expect(todos.getAllByRole("checkbox")).toHaveLength(2);
    expect(todos.queryByRole("button", { name: /^Delete todo: / })).toBeNull();
  });
});
