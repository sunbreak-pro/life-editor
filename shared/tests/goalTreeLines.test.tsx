import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
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
 * position come from one CSS variable, each list under a goal carries its own
 * full-height line, and a year's line wraps everything down to its weeks'
 * rows. The pixels themselves are chat-main's check.
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
    // Defined once on the root, so the arrow and the line move together.
    // Wide is the icon-only tap floor, which a one-icon arrow is lifted to
    // anyway: below it, that arrow outgrows the variable and its line misses
    // the centre (2.25px at an 18px root).
    expect(root.className).toContain(
      `[${TOGGLE_VAR}:var(--spacing-lumen-tap-min)]`,
    );
    expect(root.className).not.toContain(
      `[${TOGGLE_VAR}:calc(var(--spacing)*6)]`,
    );
    // Narrow reads the phone's icon-only floor (#2672, one token since #2673).
    expect(root.className).toContain(
      `max-md:[${TOGGLE_VAR}:var(--spacing-lumen-tap-touch)]`,
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

  it("lets a press through the line, which crosses a phone's child arrows (#2672)", () => {
    const { container } = renderTree();
    const lines = container.querySelectorAll("[data-goal-tree-line]");
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line.className).toContain("pointer-events-none");
    }
  });

  it("indents each list past the line on desktop, and 17px on a phone (#2672)", () => {
    const { container } = renderTree();
    const lists = container.querySelectorAll("[data-goal-tree-branch] > ul");
    expect(lists).toHaveLength(5);
    for (const list of lists) {
      expect(list.className).toContain(
        `pl-[calc(var(${TOGGLE_VAR})_/_2_+_var(--spacing)_*_3)]`,
      );
      expect(list.className.split(/\s+/)).toContain("max-md:pl-[17px]");
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
   * jsdom has no layout, so the sizes are pinned as the classes that set them:
   * the arrow's own size on the "…" and the row (#2672), the same token on the
   * checkbox (#2673), and the 44px min-h-11 on every chip.
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
    expect(classesOf(more)).toContain(`size-(${TOGGLE_VAR})`);
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
    expect(classesOf(more)).toContain(`size-(${TOGGLE_VAR})`);
    fireEvent.click(more);
    expect(screen.queryByRole("group", { name: "Run weekly" })).toBeNull();
    const chips = within(
      screen.getByRole("group", { name: "5 km jog" }),
    ).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["Edit", "Delete"]);
    for (const chip of chips) expect(classesOf(chip)).toContain("min-h-11");
    expect(classesOf(chips[1] as HTMLElement)).toContain("text-lumen-danger");
  });

  it("draws a phone's rows at the arrow's size, not the 2.75rem floor (#2672)", () => {
    setNarrow();
    renderWithActions();
    const floor = `max-md:min-h-(${TOGGLE_VAR})`;
    for (const name of [/^Week: Run 3 times — /, "Done: 5 km jog"]) {
      const row = classesOf(screen.getByRole("button", { name }));
      expect(row).toContain(floor);
      expect(row).not.toContain("max-md:min-h-11");
    }
    // The shared checkbox brings the same token itself (#2673), below 768px
    // only, so it never holds the row up.
    const box = classesOf(screen.getByRole("checkbox", { name: /^5 km jog/ }));
    expect(box).toContain("max-md:min-h-lumen-tap-touch");
    expect(box).toContain("max-md:min-w-lumen-tap-touch");
    expect(box).toContain("min-h-11");
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

describe("GoalTreeView — the add-below row names its kind with an icon (#2609)", () => {
  function renderWithAdd(labels: GoalTreeLabels = LABELS): void {
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
        rowActions={{
          onAddTodo: vi.fn().mockResolvedValue(true),
          onAddChildGoal: vi.fn().mockResolvedValue(true),
          onDelete: vi.fn(),
        }}
        labels={labels}
      />,
    );
  }

  const PROMPT_LABELS: GoalTreeLabels = {
    ...LABELS,
    addUnderPrompt: "What do you want to add?",
    addChildGoalPlaceholder: "Write the goal, then Enter",
  };

  const addUnderYear = (): HTMLElement =>
    screen.getByRole("button", { name: "Add under: Run 10 km" });

  /** The badge of the open add-below field. */
  const badge = (): HTMLElement => {
    const row = screen.getByRole("textbox", { name: /^Add under/ })
      .parentElement as HTMLElement;
    const found = row.querySelector("[data-goal-add-badge]");
    if (!(found instanceof HTMLElement)) throw new Error("no badge");
    return found;
  };

  it("leads the choices with the question, each choice carrying its kind's icon", () => {
    renderWithAdd(PROMPT_LABELS);
    fireEvent.click(addUnderYear());
    const choices = within(
      screen.getByRole("group", { name: "What do you want to add?" }),
    );
    const todo = choices.getByRole("button", { name: "Todo" });
    const month = choices.getByRole("button", { name: "This month goal" });
    const week = choices.getByRole("button", { name: "This week goal" });
    // A box for the todo, a target for a goal; no "+" on either any more.
    expect(todo.querySelector("svg")?.getAttribute("class")).not.toContain(
      "lucide-target",
    );
    expect(todo.querySelector("svg")?.getAttribute("class")).not.toContain(
      "lucide-plus",
    );
    for (const goal of [month, week]) {
      expect(goal.querySelector("svg")?.getAttribute("class")).toContain(
        "lucide-target",
      );
    }
    choices.getByRole("button", { name: "Cancel" });
  });

  it("puts the kind's icon in the field's badge, hidden from screen readers", () => {
    renderWithAdd(PROMPT_LABELS);
    fireEvent.click(addUnderYear());
    fireEvent.click(screen.getByRole("button", { name: "Todo" }));
    const todoIcon = badge().querySelector("svg");
    expect(todoIcon).not.toBeNull();
    expect(todoIcon?.getAttribute("aria-hidden")).toBe("true");
    expect(todoIcon?.getAttribute("class")).not.toContain("lucide-target");
    expect(badge().textContent).toBe("Todo");
    fireEvent.keyDown(screen.getByRole("textbox", { name: /^Add under/ }), {
      key: "Escape",
    });

    fireEvent.click(addUnderYear());
    fireEvent.click(screen.getByRole("button", { name: "This week goal" }));
    expect(badge().querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-target",
    );
    expect(badge().textContent).toBe("This week goal");
    expect(
      screen
        .getByRole("textbox", { name: /^Add under/ })
        .getAttribute("placeholder"),
    ).toBe("Write the goal, then Enter");
  });

  it("keeps the choices bare, and the add card's placeholder, for a host without the copy", () => {
    renderWithAdd();
    fireEvent.click(addUnderYear());
    expect(document.querySelector("[data-goal-add-prompt]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "This week goal" }));
    expect(
      screen
        .getByRole("textbox", { name: /^Add under/ })
        .getAttribute("placeholder"),
    ).toBe(LABELS.addPlaceholder);
  });
});

describe("GoalTreeView — the loose todos' empty line (#2851)", () => {
  const LOOSE_LABELS: GoalTreeLabels = {
    ...LABELS,
    looseEmpty: "No todos are outside a goal",
  };

  function renderLoose(
    todos: { id: string; title: string; status: "NOT_STARTED" | "DONE" }[],
    activeFilters?: string[],
  ): void {
    render(
      <GoalTreeView
        model={buildGoalTreeModel({
          goals: GOALS,
          links: [],
          todos: todos.map((t) => ({
            ...t,
            completedAt:
              t.status === "DONE" ? "2026-09-29T00:00:00Z" : undefined,
          })),
          todayKey: "2026-09-30",
          untitled: "Untitled",
        })}
        isLoading={false}
        selectedGoalId={null}
        onSelectGoal={vi.fn()}
        onCreateGoal={vi.fn().mockResolvedValue(true)}
        onCreateLooseTodo={vi.fn().mockResolvedValue(true)}
        onSetTodoStatus={vi.fn()}
        onOpenTodo={vi.fn()}
        activeFilters={activeFilters}
        labels={LOOSE_LABELS}
      />,
    );
  }

  it("says there are none when no loose todo exists", () => {
    renderLoose([]);
    expect(screen.queryByText("No todos are outside a goal")).not.toBeNull();
  });

  it("stays silent when every loose todo is done and listed under Completed items", () => {
    renderLoose([{ id: "d1", title: "Done loose", status: "DONE" }]);
    expect(screen.queryByText("No todos are outside a goal")).toBeNull();
    expect(screen.queryByText("Done loose")).not.toBeNull();
  });

  it("stays silent while a filter is on, since it may be what hid them", () => {
    renderLoose([], ["Tag"]);
    expect(screen.queryByText("No todos are outside a goal")).toBeNull();
  });
});

describe("GoalTreeView — a failed read and no goals (#2614)", () => {
  function renderState(
    over: Partial<ComponentProps<typeof GoalTreeView>>,
  ): void {
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
        labels={LABELS}
        {...over}
      />,
    );
  }

  it("shows the danger card with Retry, which calls onRetry", () => {
    const onRetry = vi.fn();
    renderState({ loadFailed: true, onRetry });

    const card = screen.getByRole("alert");
    within(card).getByText("Could not load");
    expect(card.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["border-lumen-danger", "bg-lumen-danger-subtle"]),
    );
    expect(screen.queryByRole("region", { name: "Goals" })).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps a plain line, with no dead button, for a host without a retry", () => {
    renderState({ loadFailed: true });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Could not load");
    expect(within(alert).queryByRole("button")).toBeNull();
  });

  it("shows the guidance and a bordered Target button that opens this week's field", () => {
    renderState({ model: model([]) });

    const empty = screen.getByText("No goals").closest("[data-goals-empty]");
    if (!(empty instanceof HTMLElement)) throw new Error("no empty state");
    const button = within(empty).getByRole("button", {
      name: "Add this week's goal",
    });
    const classes = button.className.split(/\s+/);
    // A border, not the accent fill the shared EmptyState would give it.
    expect(classes).toEqual(
      expect.arrayContaining(["border", "border-lumen-border"]),
    );
    expect(classes).not.toContain("bg-lumen-accent");
    // The goal's own glyph leads the label, hidden from screen readers.
    expect(button.querySelector("svg.lucide-target")).not.toBeNull();

    fireEvent.click(button);
    screen.getByRole("textbox", { name: /This week/ });
    // The field is open, so the guidance's button steps aside.
    expect(
      screen.queryByRole("button", { name: "Add this week's goal" }),
    ).toBeNull();
  });
});
