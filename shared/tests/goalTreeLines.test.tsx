import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  GoalTreeView,
  buildGoalTreeModel,
  type Goal,
  type GoalTreeLabels,
  type GoalTreeModel,
} from "../src";

/*
 * The goal tree's hierarchy lines (#2282). jsdom has no layout, so these pin
 * the structure the browser draws from: the arrow's width and every line's
 * position come from one CSS variable in --spacing units, each list under a
 * goal carries its own full-height line, and a year's line wraps everything
 * down to its weeks' rows. The pixels themselves are chat-main's check.
 */

function goal(over: Partial<Goal> & Pick<Goal, "id" | "title">): Goal {
  return {
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
    ...over,
  };
}

const GOALS: Goal[] = [
  goal({ id: "y1", title: "Run 10 km", periodKind: "year", periodKey: "2026" }),
  goal({
    id: "m1",
    title: "Run weekly",
    periodKind: "month",
    periodKey: "2026-09",
    parentGoalId: "y1",
  }),
  goal({ id: "w1", title: "Run 3 times", parentGoalId: "m1" }),
];

const TODOS = [
  { id: "ty", title: "Pick a race", status: "NOT_STARTED" as const },
  { id: "tm", title: "Buy shoes", status: "NOT_STARTED" as const },
  { id: "tw1", title: "5 km jog", status: "DONE" as const },
  { id: "tw2", title: "Long run", status: "NOT_STARTED" as const },
];

const LINKS = [
  { id: "l1", goalId: "y1", todoId: "ty", isDeleted: false },
  { id: "l2", goalId: "m1", todoId: "tm", isDeleted: false },
  { id: "l3", goalId: "w1", todoId: "tw1", isDeleted: false },
  { id: "l4", goalId: "w1", todoId: "tw2", isDeleted: false },
];

const LABELS: GoalTreeLabels = {
  kinds: { year: "Year", month: "Month", week: "Week" },
  periods: { year: "This year", month: "This month", week: "This week" },
  periodRanges: { year: "2026", month: "September", week: "9/27 – 10/3" },
  addHeading: "Add a goal",
  addPlaceholder: "Goal",
  add: "Add",
  cancel: "Cancel",
  formatLimit: (period) => `${period}: 3 goals already`,
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
  formatOpenTodo: (title) => `Open ${title}`,
  formatExpand: (title) => `Expand: ${title}`,
  formatCollapse: (title) => `Collapse: ${title}`,
  filteringBy: "Filtering by",
  resetFilters: "Reset",
  noMatch: "Nothing matches",
  addTodo: "Todo",
  addTodoLabel: "Add a todo",
  addTodoPlaceholder: "Todo",
  dragToMove: "Drag to move",
  dropHere: "Move here",
  formatRename: (title) => `Rename: ${title}`,
  renameField: "Goal title",
  loading: "Loading",
  loadFailed: "Could not load",
  retry: "Retry",
};

function model(): GoalTreeModel {
  return buildGoalTreeModel({
    goals: GOALS,
    links: LINKS,
    todos: TODOS,
    todayKey: "2026-09-30",
    untitled: "Untitled",
  });
}

function renderTree(): ReturnType<typeof render> {
  return render(
    <GoalTreeView
      model={model()}
      isLoading={false}
      selectedGoalId={null}
      onSelectGoal={vi.fn()}
      onCreateGoal={vi.fn().mockResolvedValue(true)}
      onCreateLooseTodo={vi.fn().mockResolvedValue(true)}
      onSetTodoStatus={vi.fn()}
      onOpenTodo={vi.fn()}
      labels={LABELS}
    />,
  );
}

const TOGGLE_VAR = "--goal-tree-toggle";
const LINE_LEFT = `left-[calc(var(${TOGGLE_VAR})_/_2_-_0.5px)]`;

/** The `<li>` of a goal row, found by its row button. */
function goalItem(kind: string, title: string): HTMLElement {
  const row = screen.getByRole("button", {
    name: new RegExp(`^${kind}: ${title} — `),
  });
  const li = row.closest("li");
  if (!li) throw new Error(`no <li> for ${title}`);
  return li;
}

/** The branch wrapper of a goal's todos or child goals (direct, not nested). */
function branchOf(li: HTMLElement, kind: "todos" | "goals"): HTMLElement {
  const branch = Array.from(li.children).find(
    (el) => el.getAttribute("data-goal-tree-branch") === kind,
  );
  if (!(branch instanceof HTMLElement)) {
    throw new Error(`no ${kind} branch`);
  }
  return branch;
}

function lineOf(branch: HTMLElement): HTMLElement {
  const line = Array.from(branch.children).find((el) =>
    el.hasAttribute("data-goal-tree-line"),
  );
  if (!(line instanceof HTMLElement)) throw new Error("no line");
  return line;
}

describe("GoalTreeView hierarchy lines (#2282)", () => {
  it("sizes every arrow and places every line from one variable", () => {
    const { container } = renderTree();
    const root = container.firstElementChild as HTMLElement;
    // Defined once on the root, in --spacing (rem) at both widths, so the
    // root font size setting scales the arrow and the line together.
    // Wide is the icon-only tap floor, which a one-icon arrow is lifted to
    // anyway: below it, that arrow outgrows the variable and its line misses
    // the centre (2.25px at an 18px root).
    expect(root.className).toContain(
      `[${TOGGLE_VAR}:var(--spacing-lumen-tap-min)]`,
    );
    expect(root.className).not.toContain(
      `[${TOGGLE_VAR}:calc(var(--spacing)*6)]`,
    );
    expect(root.className).toContain(
      `max-md:[${TOGGLE_VAR}:calc(var(--spacing)*11)]`,
    );

    const toggles = screen.getAllByRole("button", { name: /^Collapse: / });
    expect(toggles).toHaveLength(3);
    for (const toggle of toggles) {
      expect(toggle.className).toContain(`size-(${TOGGLE_VAR})`);
      // No fixed per-width size left to drift from the line.
      expect(toggle.className).not.toMatch(/\bsize-6\b|size-11/);
    }

    const lines = container.querySelectorAll("[data-goal-tree-line]");
    // y1: todos + goals, m1: todos + goals, w1: todos.
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line.getAttribute("aria-hidden")).toBe("true");
      expect(line.className).toContain(LINE_LEFT);
      expect(line.className).toContain("inset-y-0");
      expect(line.className).toContain("w-px");
    }
    // The old fixed offsets are gone.
    expect(container.querySelector(".ml-3.border-l")).toBeNull();
  });

  it("indents each list past the line, from the same variable", () => {
    const { container } = renderTree();
    const lists = container.querySelectorAll("[data-goal-tree-branch] > ul");
    expect(lists).toHaveLength(5);
    for (const list of lists) {
      expect(list.className).toContain(
        `pl-[calc(var(${TOGGLE_VAR})_/_2_+_var(--spacing)_*_3)]`,
      );
    }
  });

  it("runs the year's line, unbroken, down to the week's rows", () => {
    renderTree();
    const year = goalItem("Year", "Run 10 km");
    const yearGoals = branchOf(year, "goals");
    const yearLine = lineOf(yearGoals);
    // One element the full height of the list, not one piece per row.
    expect(yearLine.className).toContain("inset-y-0");
    expect(
      yearGoals.querySelectorAll(":scope > [data-goal-tree-line]"),
    ).toHaveLength(1);
    // Its list holds the month, the week and the week's todos.
    const inside = within(yearGoals);
    inside.getByRole("button", { name: /^Month: Run weekly — / });
    inside.getByRole("button", { name: /^Week: Run 3 times — / });
    inside.getByRole("button", { name: "Open 5 km jog" });
    inside.getByRole("button", { name: "Open Long run" });
    // And the last row drawn is the week's last todo: nothing below it
    // falls outside the year's line.
    const rows = within(year).getAllByRole("button", { name: /^Open / });
    expect(rows.at(-1)?.getAttribute("aria-label")).toBe("Open Long run");
    expect(yearGoals.contains(rows.at(-1) ?? null)).toBe(true);
  });

  it("gives the todo list under a goal a line of its own", () => {
    renderTree();
    for (const [kind, title] of [
      ["Year", "Run 10 km"],
      ["Month", "Run weekly"],
      ["Week", "Run 3 times"],
    ] as const) {
      const todos = branchOf(goalItem(kind, title), "todos");
      lineOf(todos);
      // The list keeps the goal's title as its name.
      expect(within(todos).getByRole("list").getAttribute("aria-label")).toBe(
        title,
      );
    }
  });

  it("stacks a goal's todo line and goal line flush, so they read as one", () => {
    renderTree();
    const month = goalItem("Month", "Run weekly");
    const todos = branchOf(month, "todos");
    const goals = branchOf(month, "goals");
    expect(todos.nextElementSibling).toBe(goals);
    // No margin or gap between them to break the line.
    for (const el of [todos, goals]) {
      expect(el.className).toBe("relative");
    }
  });

  it("keeps the year's line through a closed week", () => {
    renderTree();
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse: Run 3 times" }),
    );
    const year = goalItem("Year", "Run 10 km");
    const yearGoals = branchOf(year, "goals");
    lineOf(yearGoals);
    within(yearGoals).getByRole("button", { name: /^Week: Run 3 times — / });
    expect(screen.queryByRole("button", { name: "Open Long run" })).toBeNull();
  });
});
