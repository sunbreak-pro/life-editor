import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  GoalTreeView,
  buildGoalTreeModel,
  type Goal,
  type GoalTreeLabels,
  type GoalTreeModel,
} from "../src";
import { GoalStatus } from "../src/components/goalTree/GoalTreeView";
import { separateCompleted } from "../src/components/goalTree/buildGoalTreeModel";

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
  // Open: a done todo leaves the tree for Completed items (#2368).
  { id: "tw1", title: "5 km jog", status: "NOT_STARTED" as const },
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
  formatOpenTodo: (title) => `Open ${title}`,
  formatMarkTodoDone: (title) => `Done: ${title}`,
  formatMarkTodoOpen: (title) => `Not done: ${title}`,
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

function model(goals: Goal[] = GOALS): GoalTreeModel {
  return buildGoalTreeModel({
    goals,
    links: LINKS,
    todos: TODOS,
    todayKey: "2026-09-30",
    untitled: "Untitled",
  });
}

function renderTree(goals?: Goal[]): ReturnType<typeof render> {
  return render(
    <GoalTreeView
      model={model(goals)}
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

  it("draws a week straight under a year one step in, on the year's line (#2399)", () => {
    renderTree([
      ...GOALS,
      goal({ id: "w2", title: "Swim once", parentGoalId: "y1" }),
    ]);
    const yearGoals = branchOf(goalItem("Year", "Run 10 km"), "goals");
    // Nothing connected, so it is listed under Unconnected as well.
    const week = within(yearGoals)
      .getByRole("button", { name: /^Week: Swim once — / })
      .closest("li") as HTMLElement;
    // Its list is the year's own, beside the month, with no branch between.
    expect(week.closest("[data-goal-tree-branch]")).toBe(yearGoals);
    expect(goalItem("Month", "Run weekly").parentElement).toBe(
      week.parentElement,
    );
    expect(
      yearGoals.querySelectorAll(":scope > [data-goal-tree-line]"),
    ).toHaveLength(1);
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

describe("GoalTreeView progress (#2606)", () => {
  it("shows each open goal's progress as bare n/m text, without a bar, on every level", () => {
    renderTree();
    for (const [kind, title, count] of [
      ["Year", "Run 10 km", "0/2"],
      ["Month", "Run weekly", "0/2"],
      ["Week", "Run 3 times", "0/2"],
    ] as const) {
      const row = screen.getByRole("button", {
        name: `${kind}: ${title} — ${count}`,
      });
      const progress = row.querySelector("[data-goal-progress]");
      expect(progress?.textContent).toBe(count);
      // The count is the row's last part and nothing is drawn beside it.
      expect(progress?.parentElement).toBe(row);
      expect(row.querySelector(".bg-lumen-accent-secondary")).toBeNull();
      expect(row.querySelector("[style]")).toBeNull();
    }
  });

  it("draws the period badge as a borderless soft box and the title in semibold (#2607)", () => {
    renderTree();
    const row = screen.getByRole("button", { name: /^Week: Run 3 times — / });
    const badge = row.querySelector("[data-goal-period-badge]") as HTMLElement;
    expect(badge.textContent).toBe("This week");
    expect(badge.className).toContain("bg-lumen-bg-secondary");
    expect(badge.className).toContain("rounded-lumen-sm");
    expect(badge.className).toContain("text-lumen-text-secondary");
    expect(badge.className).not.toMatch(/\bborder\b/);
    expect(badge.className).not.toContain("rounded-full");
    const title = row.querySelector("[data-goal-title]") as HTMLElement;
    expect(title.className).toContain("font-semibold");
    expect(title.className).not.toContain("font-medium");
  });

  it("marks an achieved goal with a success pill holding the word alone (#2607)", () => {
    // An achieved goal leaves the drawn tree (#2368), so the chip is rendered
    // on its own from the goal's node.
    const achieved = separateCompleted(
      model([
        ...GOALS.slice(0, 2),
        goal({
          id: "w1",
          title: "Run 3 times",
          parentGoalId: "m1",
          periodEndDecision: "achieved",
        }),
      ]),
    ).completed.goals[0];
    if (!achieved) throw new Error("no achieved goal");
    const { container } = render(
      <GoalStatus node={achieved} labels={LABELS} bar={false} />,
    );
    const pill = container.querySelector("[data-goal-achieved]") as HTMLElement;
    expect(pill.textContent).toBe("Achieved");
    expect(pill.className).toContain("bg-lumen-success-subtle");
    expect(pill.querySelector("svg")).toBeNull();
  });

  it("draws no visible tree heading or period legend, but keeps the tree's spoken name", () => {
    renderTree();
    const tree = screen.getByRole("region", { name: "Goals" });
    expect(within(tree).queryByRole("heading")).toBeNull();
    expect(screen.queryByText(/This year 2026/)).toBeNull();
    expect(screen.queryByText(/9\/27 – 10\/3/)).toBeNull();
  });
});

describe("GoalTreeView — a phone row's … opens its chips (#2611)", () => {
  /*
   * jsdom has no layout, so the 44px is pinned as the class that sets it:
   * size-11 on the "…" and min-h-11 on every chip, at Tailwind's 4px step.
   */
  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
  });

  function setNarrow(): void {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  const PHONE_LABELS: GoalTreeLabels = {
    ...LABELS,
    formatMoreActions: (title) => `More actions: ${title}`,
    editTodoChip: "Edit",
  };

  function renderWithActions(): void {
    render(
      <GoalTreeView
        model={model()}
        isLoading={false}
        selectedGoalId={null}
        onSelectGoal={vi.fn()}
        onCreateGoal={vi.fn().mockResolvedValue(true)}
        onCreateLooseTodo={vi.fn().mockResolvedValue(true)}
        onSetTodoStatus={vi.fn()}
        onOpenTodo={vi.fn()}
        onDeleteTodo={vi.fn()}
        onRenameGoal={vi.fn()}
        rowActions={{
          onAddTodo: vi.fn().mockResolvedValue(true),
          onAddChildGoal: vi.fn().mockResolvedValue(true),
          onDelete: vi.fn(),
        }}
        labels={PHONE_LABELS}
      />,
    );
  }

  const classesOf = (el: Element): string[] => el.className.split(/\s+/);

  it("opens a goal's chips under its row at a tappable 44px, the delete in red", () => {
    setNarrow();
    renderWithActions();
    const more = screen.getByRole("button", {
      name: "More actions: Run 3 times",
    });
    expect(classesOf(more)).toContain("size-11");
    expect(screen.queryByRole("group", { name: "Run 3 times" })).toBeNull();

    fireEvent.click(more);
    const chips = within(
      screen.getByRole("group", { name: "Run 3 times" }),
    ).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual([
      "Add below",
      "Rename",
      "Delete",
    ]);
    for (const chip of chips) expect(classesOf(chip)).toContain("min-h-11");
    expect(classesOf(chips[2] as HTMLElement)).toContain("text-lumen-danger");
    expect(classesOf(chips[0] as HTMLElement)).not.toContain(
      "text-lumen-danger",
    );

    // A second press closes them.
    fireEvent.click(more);
    expect(screen.queryByRole("group", { name: "Run 3 times" })).toBeNull();
  });

  it("opens a todo's Edit and Delete, closing any other row's chips", () => {
    setNarrow();
    renderWithActions();
    fireEvent.click(
      screen.getByRole("button", { name: "More actions: Run weekly" }),
    );
    const more = screen.getByRole("button", { name: "More actions: 5 km jog" });
    expect(classesOf(more)).toContain("size-11");
    fireEvent.click(more);
    expect(screen.queryByRole("group", { name: "Run weekly" })).toBeNull();
    const chips = within(
      screen.getByRole("group", { name: "5 km jog" }),
    ).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["Edit", "Delete"]);
    for (const chip of chips) expect(classesOf(chip)).toContain("min-h-11");
    expect(classesOf(chips[1] as HTMLElement)).toContain("text-lumen-danger");
  });

  it("closes the chips on Esc", () => {
    setNarrow();
    renderWithActions();
    fireEvent.click(
      screen.getByRole("button", { name: "More actions: Run 3 times" }),
    );
    const group = screen.getByRole("group", { name: "Run 3 times" });
    fireEvent.keyDown(within(group).getByRole("button", { name: "Rename" }), {
      key: "Escape",
    });
    expect(screen.queryByRole("group", { name: "Run 3 times" })).toBeNull();
  });

  // #2703: a press leaves focus on the "…", and a chip's Esc unmounts the chip.
  it("closes a goal's chips on Esc while the … holds focus, and keeps focus there", () => {
    setNarrow();
    renderWithActions();
    const more = screen.getByRole("button", {
      name: "More actions: Run 3 times",
    });
    fireEvent.click(more);
    more.focus();
    fireEvent.keyDown(more, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Run 3 times" })).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it("closes a todo's chips on Esc from the … and from a chip, focus back on the …", () => {
    setNarrow();
    renderWithActions();
    const more = screen.getByRole("button", { name: "More actions: 5 km jog" });
    fireEvent.click(more);
    more.focus();
    fireEvent.keyDown(more, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "5 km jog" })).toBeNull();
    expect(document.activeElement).toBe(more);

    fireEvent.click(more);
    const edit = within(
      screen.getByRole("group", { name: "5 km jog" }),
    ).getByRole("button", { name: "Edit" });
    edit.focus();
    fireEvent.keyDown(edit, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "5 km jog" })).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it("returns focus to a goal's … after Esc on one of its chips", () => {
    setNarrow();
    renderWithActions();
    const more = screen.getByRole("button", {
      name: "More actions: Run 3 times",
    });
    fireEvent.click(more);
    const rename = within(
      screen.getByRole("group", { name: "Run 3 times" }),
    ).getByRole("button", { name: "Rename" });
    rename.focus();
    fireEvent.keyDown(rename, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Run 3 times" })).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it("draws no … on desktop, where the rows keep their hover icons", () => {
    renderWithActions();
    expect(document.querySelector("[data-goal-row-more]")).toBeNull();
    screen.getByRole("button", { name: "Add under: Run 3 times" });
    screen.getByRole("button", { name: "Open 5 km jog" });
  });
});
