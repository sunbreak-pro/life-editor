import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  GoalTreeView,
  buildGoalTreeModel,
  type Goal,
  type GoalRowActions,
  type GoalTreeDragHandlers,
  type GoalTreeLabels,
  type TodoStatus,
} from "../src";

/*
 * The goal tree's title drag and in-place rename (#2283). jsdom has no
 * layout and no drag threshold, so these pin the wiring: the title carries
 * the same drag as the arrow, the pencil swaps the title for a field that
 * saves on Enter and drops the edit on Esc, and an edited row is not
 * draggable. Hover and the browser's own drag start are chat-main's check.
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
  goal({
    id: "m2",
    title: "Stretch daily",
    periodKind: "month",
    periodKey: "2026-09",
    parentGoalId: "y1",
    sortOrder: 1,
  }),
  goal({ id: "w1", title: "Run 3 times", parentGoalId: "m1" }),
];

// Every goal holds a todo, so none is drawn again under Unconnected.
const TODOS = [
  { id: "t1", title: "Pick a race", status: "NOT_STARTED" as const },
  { id: "t2", title: "Stretch", status: "NOT_STARTED" as const },
  { id: "t3", title: "5 km jog", status: "NOT_STARTED" as const },
  { id: "t4", title: "Buy shoes", status: "NOT_STARTED" as const },
];

const LINKS = [
  { id: "l1", goalId: "y1", todoId: "t1", isDeleted: false },
  { id: "l2", goalId: "m2", todoId: "t2", isDeleted: false },
  { id: "l3", goalId: "w1", todoId: "t3", isDeleted: false },
  { id: "l4", goalId: "m1", todoId: "t4", isDeleted: false },
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

function renderTree(
  over: {
    selectedGoalId?: string | null;
    onRenameGoal?: (goalId: string, title: string) => void;
    onEditGoal?: (goalId: string) => void;
    rowActions?: GoalRowActions;
    drag?: GoalTreeDragHandlers;
    onSelectGoal?: (goalId: string) => void;
    goals?: Goal[];
    todos?: typeof TODOS;
    onSetTodoStatus?: (todoId: string, status: TodoStatus) => void;
    onOpenTodo?: (todoId: string) => void;
    onDeleteTodo?: (todoId: string) => void;
  } = {},
): ReturnType<typeof render> {
  return render(
    <GoalTreeView
      model={buildGoalTreeModel({
        goals: over.goals ?? GOALS,
        links: LINKS,
        todos: over.todos ?? TODOS,
        todayKey: "2026-09-30",
        untitled: "Untitled",
      })}
      isLoading={false}
      selectedGoalId={over.selectedGoalId ?? null}
      onSelectGoal={over.onSelectGoal ?? vi.fn()}
      onCreateGoal={vi.fn().mockResolvedValue(true)}
      onCreateLooseTodo={vi.fn().mockResolvedValue(true)}
      onSetTodoStatus={over.onSetTodoStatus ?? vi.fn()}
      onOpenTodo={over.onOpenTodo ?? vi.fn()}
      onDeleteTodo={over.onDeleteTodo}
      onRenameGoal={over.onRenameGoal}
      onEditGoal={over.onEditGoal}
      rowActions={over.rowActions}
      drag={over.drag}
      labels={LABELS}
    />,
  );
}

/** A goal's select button — the title. */
const titleOf = (title: string): HTMLElement =>
  screen.getByRole("button", { name: new RegExp(`^\\w+: ${title} — `) });
const rowOf = (title: string): HTMLElement =>
  titleOf(title).parentElement as HTMLElement;
/** jsdom has no DataTransfer; the tree only writes to it. */
const transfer = () => ({
  setData: vi.fn(),
  effectAllowed: "",
  dropEffect: "",
});

function dragHandlers(): GoalTreeDragHandlers {
  return { onMoveGoal: vi.fn(), onMoveTodo: vi.fn() };
}

describe("GoalTreeView — grab a goal by its title (#2283)", () => {
  it("makes the title draggable, except a year's", () => {
    renderTree({ drag: dragHandlers() });
    const week = titleOf("Run 3 times");
    expect(week.getAttribute("draggable")).toBe("true");
    expect(week.getAttribute("data-goal-drag")).toBe("w1");
    expect(titleOf("Run weekly").getAttribute("draggable")).toBe("true");
    // A year has no parent to go under.
    expect(titleOf("Run 10 km").hasAttribute("draggable")).toBe(false);
  });

  it("re-parents a goal dragged from its title, under the same rule", async () => {
    const drag = dragHandlers();
    renderTree({ drag });
    fireEvent.dragStart(titleOf("Run 3 times"), { dataTransfer: transfer() });
    // The paint follows a tick after dragstart.
    await vi.waitFor(() =>
      expect(
        rowOf("Stretch daily").querySelector("[data-drop-target]"),
      ).not.toBeNull(),
    );
    // Its own month is not offered.
    expect(rowOf("Run weekly").querySelector("[data-drop-target]")).toBeNull();
    fireEvent.dragOver(rowOf("Stretch daily"), { dataTransfer: transfer() });
    fireEvent.drop(rowOf("Stretch daily"), { dataTransfer: transfer() });
    expect(drag.onMoveGoal).toHaveBeenCalledWith("w1", "m2");
  });

  it("still selects the goal on a click", () => {
    const onSelectGoal = vi.fn();
    renderTree({ drag: dragHandlers(), onSelectGoal });
    fireEvent.click(titleOf("Run 3 times"));
    expect(onSelectGoal).toHaveBeenCalledWith("w1");
  });

  it("leaves the title undraggable without drag (a phone)", () => {
    renderTree();
    expect(titleOf("Run 3 times").hasAttribute("draggable")).toBe(false);
  });
});

describe("GoalTreeView — rename in place from the edit icon (#2283 / #2367)", () => {
  it("draws no edit icon when the host cannot rename", () => {
    renderTree();
    expect(screen.queryByRole("button", { name: /^Edit goal: / })).toBeNull();
  });

  it("shows the edit icon on hover and keeps it shown on the selected row", () => {
    renderTree({ onRenameGoal: vi.fn(), selectedGoalId: "m1" });
    const idle = screen.getByRole("button", { name: "Edit goal: Run 3 times" });
    expect(idle.className).toContain("opacity-0");
    expect(idle.className).toContain("group-hover/row:opacity-100");
    // Reachable by keyboard while hidden.
    expect(idle.className).toContain("focus-visible:opacity-100");
    const picked = screen.getByRole("button", {
      name: "Edit goal: Run weekly",
    });
    expect(picked.className).not.toContain("opacity-0");
  });

  it("saves the trimmed name on Enter", () => {
    const onRenameGoal = vi.fn();
    renderTree({ onRenameGoal });
    fireEvent.click(
      screen.getByRole("button", { name: "Edit goal: Run 3 times" }),
    );
    const field = screen.getByRole("textbox", { name: "Goal title" });
    expect((field as HTMLInputElement).value).toBe("Run 3 times");
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "  Run 4 times " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRenameGoal).toHaveBeenCalledTimes(1);
    expect(onRenameGoal).toHaveBeenCalledWith("w1", "Run 4 times");
    expect(screen.queryByRole("textbox", { name: "Goal title" })).toBeNull();
    titleOf("Run 3 times");
  });

  it("drops the edit on Esc, writing nothing", () => {
    const onRenameGoal = vi.fn();
    renderTree({ onRenameGoal });
    fireEvent.click(
      screen.getByRole("button", { name: "Edit goal: Run 3 times" }),
    );
    const field = screen.getByRole("textbox", { name: "Goal title" });
    fireEvent.change(field, { target: { value: "Run 4 times" } });
    fireEvent.keyDown(field, { key: "Escape" });
    // The field leaving focus as it goes is not a save.
    fireEvent.blur(field);
    expect(onRenameGoal).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Goal title" })).toBeNull();
  });

  it("writes nothing for an empty or unchanged name", () => {
    const onRenameGoal = vi.fn();
    renderTree({ onRenameGoal });
    const pencil = () =>
      screen.getByRole("button", { name: "Edit goal: Run 3 times" });
    fireEvent.click(pencil());
    fireEvent.change(screen.getByRole("textbox", { name: "Goal title" }), {
      target: { value: "   " },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Goal title" }), {
      key: "Enter",
    });
    fireEvent.click(pencil());
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Goal title" }), {
      key: "Enter",
    });
    expect(onRenameGoal).not.toHaveBeenCalled();
  });

  it("does not save on the Enter that confirms an IME conversion", () => {
    const onRenameGoal = vi.fn();
    renderTree({ onRenameGoal });
    fireEvent.click(
      screen.getByRole("button", { name: "Edit goal: Run 3 times" }),
    );
    const field = screen.getByRole("textbox", { name: "Goal title" });
    fireEvent.change(field, { target: { value: "週 4 回走る" } });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onRenameGoal).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Goal title" })).toBe(field);
  });

  it("opens one field for a goal listed both in the tree and under Unconnected", () => {
    const onRenameGoal = vi.fn();
    // Nothing connected and a parent: drawn under "Run weekly" and again in
    // the Unconnected group.
    renderTree({
      onRenameGoal,
      goals: [
        ...GOALS,
        goal({ id: "w2", title: "Swim once", parentGoalId: "m1" }),
      ],
    });
    const tree = screen.getByRole("region", { name: "Goals" });
    const loose = screen.getByRole("region", { name: "Unconnected" });
    const inTree = within(tree).getByRole("button", {
      name: "Edit goal: Swim once",
    });
    within(loose).getByRole("button", { name: "Edit goal: Swim once" });

    fireEvent.click(inTree);
    const fields = screen.getAllByRole("textbox", { name: "Goal title" });
    expect(fields).toHaveLength(1);
    expect(tree.contains(fields[0])).toBe(true);
    expect(document.activeElement).toBe(fields[0]);
    // The other row keeps its title and pencil.
    within(loose).getByRole("button", { name: "Edit goal: Swim once" });

    fireEvent.change(fields[0], { target: { value: "Swim twice" } });
    fireEvent.keyDown(fields[0], { key: "Enter" });
    expect(onRenameGoal).toHaveBeenCalledTimes(1);
    expect(onRenameGoal).toHaveBeenCalledWith("w2", "Swim twice");
  });

  it("opens the field on the Unconnected row when that pencil is pressed", () => {
    renderTree({
      onRenameGoal: vi.fn(),
      goals: [
        ...GOALS,
        goal({ id: "w2", title: "Swim once", parentGoalId: "m1" }),
      ],
    });
    const tree = screen.getByRole("region", { name: "Goals" });
    const loose = screen.getByRole("region", { name: "Unconnected" });
    fireEvent.click(
      within(loose).getByRole("button", { name: "Edit goal: Swim once" }),
    );
    const fields = screen.getAllByRole("textbox", { name: "Goal title" });
    expect(fields).toHaveLength(1);
    expect(loose.contains(fields[0])).toBe(true);
    expect(document.activeElement).toBe(fields[0]);
    within(tree).getByRole("button", { name: "Edit goal: Swim once" });
  });

  it("does not drag the row while its name is being edited", () => {
    renderTree({ onRenameGoal: vi.fn(), drag: dragHandlers() });
    fireEvent.click(
      screen.getByRole("button", { name: "Edit goal: Run weekly" }),
    );
    const field = screen.getByRole("textbox", { name: "Goal title" });
    const row = field.parentElement as HTMLElement;
    expect(row.querySelector("[draggable]")).toBeNull();
    expect(row.querySelector("[data-goal-drag]")).toBeNull();
    // Other rows keep theirs.
    expect(titleOf("Run 3 times").getAttribute("draggable")).toBe("true");
    within(row).getByRole("button", { name: "Collapse: Run weekly" });
  });
});

describe("GoalTreeView — completed items move to their own list (#2368)", () => {
  const withStatus = (id: string, status: TodoStatus): typeof TODOS =>
    TODOS.map((t) => (t.id === id ? { ...t, status } : t)) as typeof TODOS;
  const region = (name: string) => within(screen.getByRole("region", { name }));

  it("moves a done todo to Completed items, and back when un-ticked", () => {
    const onSetTodoStatus = vi.fn();
    const { rerender } = renderTree({
      todos: withStatus("t4", "DONE"),
      onSetTodoStatus,
    });
    expect(
      region("Goals").queryByRole("button", { name: "Open Buy shoes" }),
    ).toBeNull();
    const done = region("Completed items");
    done.getByRole("button", { name: "Open Buy shoes" });
    // Its goal is not achieved (its week is still open), so it stays put.
    region("Goals").getByRole("button", { name: /^Month: Run weekly — / });
    fireEvent.click(done.getByRole("checkbox"));
    expect(onSetTodoStatus).toHaveBeenCalledWith("t4", expect.any(String));

    // The host's next model has it open again.
    rerender(<></>);
    renderTree({ todos: TODOS });
    region("Goals").getByRole("button", { name: "Open Buy shoes" });
    expect(
      screen.queryByRole("region", { name: "Completed items" }),
    ).toBeNull();
  });

  it("moves an achieved goal with what is under it", () => {
    renderTree({ todos: withStatus("t2", "DONE") });
    const done = region("Completed items");
    done.getByRole("button", { name: /^Month: Stretch daily — Achieved$/ });
    done.getByRole("button", { name: "Open Stretch" });
    expect(
      region("Goals").queryByRole("button", { name: /Stretch daily/ }),
    ).toBeNull();
    // The year above still counts it.
    region("Goals").getByRole("button", { name: /^Year: Run 10 km — / });
  });
});

describe("GoalTreeView — +, edit and delete on a goal row (#2367)", () => {
  const actions = (): GoalRowActions => ({
    onAddTodo: vi.fn().mockResolvedValue(true),
    onAddChildGoal: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn(),
  });

  it("draws the three icons in order, shown on hover or when selected", () => {
    renderTree({ onRenameGoal: vi.fn(), rowActions: actions() });
    const row = rowOf("Run 3 times");
    const names = within(row)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"))
      .filter((n) => n && /^(Add under|Edit goal|Delete goal): /.test(n));
    expect(names).toEqual([
      "Add under: Run 3 times",
      "Edit goal: Run 3 times",
      "Delete goal: Run 3 times",
    ]);
    for (const name of names) {
      const icon = within(row).getByRole("button", { name: name as string });
      expect(icon.className).toContain("opacity-0");
      expect(icon.className).toContain("focus-visible:opacity-100");
    }
  });

  it("titles the icons with the action alone, keeping the title in the spoken name (#2607)", () => {
    renderTree({ onRenameGoal: vi.fn(), rowActions: actions() });
    const row = rowOf("Run 3 times");
    const tooltip = (name: string): string | null =>
      within(row).getByRole("button", { name }).getAttribute("title");
    expect(tooltip("Add under: Run 3 times")).toBe("Add below");
    expect(tooltip("Edit goal: Run 3 times")).toBe("Rename");
    expect(tooltip("Delete goal: Run 3 times")).toBe("Delete");
    // The edit icon is the pencil the todo rows already use.
    const edit = within(row).getByRole("button", {
      name: "Edit goal: Run 3 times",
    });
    expect(edit.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-pencil",
    );
  });

  it("always shows the three icons of an unselected row on a phone (#2488)", () => {
    renderTree({
      onRenameGoal: vi.fn(),
      rowActions: actions(),
      selectedGoalId: "m1",
    });
    const row = rowOf("Run 3 times");
    for (const verb of ["Add under", "Edit goal", "Delete goal"]) {
      const { className } = within(row).getByRole("button", {
        name: `${verb}: Run 3 times`,
      });
      // Desktop: hidden until hover, focus or selection.
      expect(className).toContain("opacity-0");
      expect(className).toContain("group-hover/row:opacity-100");
      expect(className).toContain("focus-visible:opacity-100");
      // A phone has no hover: shown, with a 44px target.
      expect(className).toContain("max-md:opacity-100");
      expect(className).toContain("max-md:min-h-11");
      expect(className).toContain("max-md:min-w-11");
    }
  });

  /** The choices a goal's + opens, in order, without the way out. */
  const choicesOf = (title: string): string[] => {
    fireEvent.click(
      screen.getByRole("button", { name: `Add under: ${title}` }),
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    return within(cancel.parentElement as HTMLElement)
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((text) => text !== "Cancel");
  };

  it("offers a todo or this week's goal from a month's +", async () => {
    const rowActions = actions();
    renderTree({ rowActions });
    expect(choicesOf("Run weekly")).toEqual(["Todo", "This week goal"]);
    fireEvent.click(screen.getByRole("button", { name: "This week goal" }));
    const field = screen.getByRole("textbox", {
      name: "Add under: Run weekly — This week goal",
    });
    fireEvent.change(field, { target: { value: " Long run " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(rowActions.onAddChildGoal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "m1" }),
      "Long run",
      "week",
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole("textbox", { name: /^Add under/ })).toBeNull(),
    );
  });

  it("offers a todo, this month's goal or this week's goal from a year's + (#2399)", () => {
    const rowActions = actions();
    renderTree({ rowActions });
    expect(choicesOf("Run 10 km")).toEqual([
      "Todo",
      "This month goal",
      "This week goal",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "This week goal" }));
    const field = screen.getByRole("textbox", {
      name: "Add under: Run 10 km — This week goal",
    });
    fireEvent.change(field, { target: { value: "Long run" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(rowActions.onAddChildGoal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "y1" }),
      "Long run",
      "week",
    );
  });

  it("adds a month from a year's + with its own kind", () => {
    const rowActions = actions();
    renderTree({ rowActions });
    choicesOf("Run 10 km");
    fireEvent.click(screen.getByRole("button", { name: "This month goal" }));
    const field = screen.getByRole("textbox", {
      name: "Add under: Run 10 km — This month goal",
    });
    fireEvent.change(field, { target: { value: "Run weekly" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(rowActions.onAddChildGoal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "y1" }),
      "Run weekly",
      "month",
    );
  });

  it("names what the field adds, and keeps its add button whole beside it", () => {
    renderTree({ rowActions: actions() });
    choicesOf("Run 10 km");
    fireEvent.click(screen.getByRole("button", { name: "This week goal" }));
    const row = screen.getByRole("textbox", { name: /^Add under/ })
      .parentElement as HTMLElement;
    const badge = row.querySelector("[data-goal-add-badge]") as HTMLElement;
    expect(badge.textContent).toBe("This week goal");
    expect(badge.className).toContain("shrink-0");
    const add = within(row).getByRole("button", { name: "Add" });
    expect(add.className).toContain("shrink-0");
    expect(add.className).toContain("whitespace-nowrap");
  });

  it("gives the field its own line below 768px, and only there (#2399)", () => {
    /*
     * jsdom has no layout, so this cannot measure the field's width. It pins
     * the classes that give it one: on one line at 375px the badge and the
     * buttons left the field about 40px. Every wrap class carries max-md:, so
     * Desktop keeps its one line, and the phone's 44px targets stay.
     */
    renderTree({ rowActions: actions() });
    choicesOf("Run 10 km");
    fireEvent.click(screen.getByRole("button", { name: "This month goal" }));
    const field = screen.getByRole("textbox", { name: /^Add under/ });
    const row = field.parentElement as HTMLElement;
    const classesOf = (el: Element): string[] => el.className.split(/\s+/);

    expect(classesOf(row)).toContain("max-md:flex-wrap");
    expect(classesOf(row)).not.toContain("flex-wrap");
    expect(classesOf(field)).toContain("max-md:basis-full");
    expect(classesOf(field)).not.toContain("basis-full");

    // The badge and the buttons stay whole on the lines around it.
    const badge = row.querySelector("[data-goal-add-badge]") as HTMLElement;
    const add = within(row).getByRole("button", { name: "Add" });
    const close = within(row).getByRole("button", { name: "Cancel" });
    expect(classesOf(badge)).toEqual(
      expect.arrayContaining(["shrink-0", "whitespace-nowrap"]),
    );
    expect(classesOf(add)).toEqual(
      expect.arrayContaining([
        "shrink-0",
        "whitespace-nowrap",
        "max-md:min-h-11",
      ]),
    );
    expect(classesOf(close)).toEqual(
      expect.arrayContaining([
        "shrink-0",
        "max-md:min-h-11",
        "max-md:min-w-11",
      ]),
    );
  });

  it("drops the field on Esc or the ×, adding nothing", () => {
    const rowActions = actions();
    renderTree({ rowActions });
    const plus = screen.getByRole("button", { name: "Add under: Run 3 times" });
    fireEvent.click(plus);
    const field = screen.getByRole("textbox", { name: /^Add under/ });
    fireEvent.change(field, { target: { value: "Buy gels" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: /^Add under/ })).toBeNull();

    fireEvent.click(plus);
    // The × is an icon, so it needs a name; it has a tap target on a phone.
    const close = screen.getByRole("button", { name: "Cancel" });
    expect(close.className).toContain("max-md:min-h-11");
    expect(close.className).toContain("max-md:min-w-11");
    fireEvent.click(close);
    expect(screen.queryByRole("textbox", { name: /^Add under/ })).toBeNull();
    expect(rowActions.onAddTodo).not.toHaveBeenCalled();
  });

  it("opens a closed goal when something is added under it (#2399)", async () => {
    const rowActions = actions();
    renderTree({ rowActions });
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse: Run 10 km" }),
    );
    expect(screen.queryByText("Run weekly")).toBeNull();

    choicesOf("Run 10 km");
    fireEvent.click(screen.getByRole("button", { name: "Todo" }));
    const field = screen.getByRole("textbox", {
      name: "Add under: Run 10 km — Todo",
    });
    fireEvent.change(field, { target: { value: "Sign up" } });
    // Still closed while the field is open: only the add opens it.
    expect(
      screen.getByRole("button", { name: "Expand: Run 10 km" }),
    ).toBeTruthy();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(rowActions.onAddTodo).toHaveBeenCalledWith("y1", "Sign up");
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Collapse: Run 10 km" }),
      ).toBeTruthy(),
    );
    titleOf("Run weekly");
  });

  it("keeps a closed goal closed, and the field open, when the add fails", async () => {
    const rowActions: GoalRowActions = {
      ...actions(),
      onAddTodo: vi.fn().mockResolvedValue(false),
    };
    renderTree({ rowActions });
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse: Run 10 km" }),
    );
    choicesOf("Run 10 km");
    fireEvent.click(screen.getByRole("button", { name: "Todo" }));
    const field = screen.getByRole("textbox", { name: /^Add under/ });
    fireEvent.change(field, { target: { value: "Sign up" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await vi.waitFor(() =>
      expect(rowActions.onAddTodo).toHaveBeenCalledTimes(1),
    );
    // Let the rejected add settle before reading the row.
    await vi.waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    expect(screen.getByRole("textbox", { name: /^Add under/ })).toBe(field);
    screen.getByRole("button", { name: "Expand: Run 10 km" });
  });

  it("goes straight to the todo field under a week, and not on an IME Enter", () => {
    const rowActions = actions();
    renderTree({ rowActions });
    fireEvent.click(
      screen.getByRole("button", { name: "Add under: Run 3 times" }),
    );
    const field = screen.getByRole("textbox", {
      name: "Add under: Run 3 times — Todo",
    });
    fireEvent.change(field, { target: { value: "Buy gels" } });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(rowActions.onAddTodo).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(rowActions.onAddTodo).toHaveBeenCalledWith("w1", "Buy gels");
  });

  it("opens the name field and the panel from edit, and deletes from the bin", () => {
    const rowActions = actions();
    const onEditGoal = vi.fn();
    renderTree({ onRenameGoal: vi.fn(), onEditGoal, rowActions });
    fireEvent.click(
      screen.getByRole("button", { name: "Edit goal: Run 3 times" }),
    );
    expect(screen.getByRole("textbox", { name: "Goal title" })).toBeTruthy();
    expect(onEditGoal).toHaveBeenCalledWith("w1");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Goal title" }), {
      key: "Escape",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete goal: Run 3 times" }),
    );
    expect(rowActions.onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "w1" }),
    );
  });

  it("draws no + or bin without row actions", () => {
    renderTree({ onRenameGoal: vi.fn() });
    expect(screen.queryByRole("button", { name: /^Add under: / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete goal: / })).toBeNull();
  });
});

describe("GoalTreeView — a todo row's name, pencil and bin (#2388)", () => {
  const withStatus = (id: string, status: TodoStatus): typeof TODOS =>
    TODOS.map((t) => (t.id === id ? { ...t, status } : t)) as typeof TODOS;
  const region = (name: string) => within(screen.getByRole("region", { name }));

  it("ticks an open todo from its name, and does not open the editor", () => {
    const onSetTodoStatus = vi.fn();
    const onOpenTodo = vi.fn();
    renderTree({ onSetTodoStatus, onOpenTodo });
    fireEvent.click(screen.getByRole("button", { name: "Done: 5 km jog" }));
    expect(onSetTodoStatus).toHaveBeenCalledWith("t3", "DONE");
    expect(onOpenTodo).not.toHaveBeenCalled();
  });

  it("un-ticks a done todo from its name in Completed items", () => {
    const onSetTodoStatus = vi.fn();
    renderTree({ todos: withStatus("t4", "DONE"), onSetTodoStatus });
    fireEvent.click(
      region("Completed items").getByRole("button", {
        name: "Not done: Buy shoes",
      }),
    );
    expect(onSetTodoStatus).toHaveBeenCalledWith("t4", "NOT_STARTED");
  });

  it("opens the editor from the pencil, and only there", () => {
    const onSetTodoStatus = vi.fn();
    const onOpenTodo = vi.fn();
    renderTree({ onSetTodoStatus, onOpenTodo });
    fireEvent.click(screen.getByRole("button", { name: "Open 5 km jog" }));
    expect(onOpenTodo).toHaveBeenCalledWith("t3");
    expect(onSetTodoStatus).not.toHaveBeenCalled();
  });

  it("fires the bin raw, and draws none when the host passes no handler", () => {
    const onDeleteTodo = vi.fn();
    const { unmount } = renderTree({ onDeleteTodo });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete todo: 5 km jog" }),
    );
    expect(onDeleteTodo).toHaveBeenCalledWith("t3");
    unmount();

    renderTree();
    expect(screen.queryByRole("button", { name: /^Delete todo: / })).toBeNull();
    screen.getByRole("button", { name: "Open 5 km jog" });
  });

  it("offers all three on a tree row and in Completed items", () => {
    renderTree({ todos: withStatus("t4", "DONE"), onDeleteTodo: vi.fn() });
    for (const [where, name, verb] of [
      ["Goals", "5 km jog", "Done"],
      ["Completed items", "Buy shoes", "Not done"],
    ] as const) {
      const scope = region(where);
      scope.getByRole("button", { name: `${verb}: ${name}` });
      scope.getByRole("button", { name: `Open ${name}` });
      scope.getByRole("button", { name: `Delete todo: ${name}` });
    }
  });

  it("offers all three in the group of todos no goal holds", () => {
    renderTree({
      todos: [
        ...TODOS,
        { id: "t9", title: "Call home", status: "NOT_STARTED" as const },
      ],
      onDeleteTodo: vi.fn(),
    });
    const loose = region("Todos without a goal");
    loose.getByRole("button", { name: "Done: Call home" });
    loose.getByRole("button", { name: "Open Call home" });
    loose.getByRole("button", { name: "Delete todo: Call home" });
  });

  it("reaches the box, name, pencil and bin by keyboard, in that order", () => {
    renderTree({ onDeleteTodo: vi.fn() });
    const name = screen.getByRole("button", { name: "Done: 5 km jog" });
    const row = name.closest("[data-goal-tree-row]") as HTMLElement;
    const stops = Array.from(row.querySelectorAll("button"));
    expect(stops.map((el) => el.getAttribute("aria-label"))).toEqual([
      "5 km jog — Status: Not started",
      "Done: 5 km jog",
      "Open 5 km jog",
      "Delete todo: 5 km jog",
    ]);
    // Hidden by opacity only, so a Tab still lands on them.
    for (const stop of stops) expect(stop.tabIndex).toBe(0);
  });

  it("shows the icons on hover or focus on desktop, and always on a phone", () => {
    renderTree({ onDeleteTodo: vi.fn() });
    for (const name of ["Open 5 km jog", "Delete todo: 5 km jog"]) {
      const { className } = screen.getByRole("button", { name });
      expect(className).toContain("opacity-0");
      expect(className).toContain("group-hover/todo:opacity-100");
      expect(className).toContain("group-focus-within/todo:opacity-100");
      expect(className).toContain("max-md:opacity-100");
      expect(className).toContain("max-md:min-h-11");
      expect(className).toContain("max-md:min-w-11");
    }
  });

  it("paints the hover on the row, with the colour of a goal's title", () => {
    renderTree();
    const name = screen.getByRole("button", { name: "Done: 5 km jog" });
    const row = name.closest("[data-goal-tree-row]") as HTMLElement;
    expect(row.className).toContain("hover:bg-lumen-hover");
    expect(titleOf("Run 3 times").className).toContain("hover:bg-lumen-hover");
    // On the row alone, so the colour is not laid twice over the name.
    expect(name.className).not.toContain("hover:bg-lumen-hover");
    expect(name.className).toContain("cursor-pointer");
  });

  it("drags from the grip with the icons on the row, not from the name", () => {
    const onSetTodoStatus = vi.fn();
    renderTree({
      drag: dragHandlers(),
      onDeleteTodo: vi.fn(),
      onSetTodoStatus,
    });
    const name = screen.getByRole("button", { name: "Done: 5 km jog" });
    expect(name.hasAttribute("draggable")).toBe(false);
    const grip = document.querySelector('[data-todo-drag="t3"]') as HTMLElement;
    expect(grip.getAttribute("draggable")).toBe("true");
    fireEvent.dragStart(grip, { dataTransfer: transfer() });
    fireEvent.dragEnd(grip);
    expect(onSetTodoStatus).not.toHaveBeenCalled();
  });
});

describe("GoalTreeView — button labels stay on one line (#2364)", () => {
  /*
   * jsdom has no layout, so this pins the two rules that keep a label whole:
   * the button does not shrink, and its text does not wrap. Without them a
   * w-full field beside it squeezed 「追加」 into a one-character column.
   */
  const keepsLabel = (el: HTMLElement): void => {
    expect(el.className).toContain("shrink-0");
    expect(el.className).toContain("whitespace-nowrap");
  };

  it("keeps the add-goal row's buttons whole beside the field", () => {
    renderTree();
    const open = screen.getByRole("button", { name: "Add a goal" });
    keepsLabel(open);
    fireEvent.click(open);
    const field = screen.getByRole("textbox", { name: "This week: Goal" });
    expect(field.className).toContain("min-w-0");
    keepsLabel(screen.getByRole("button", { name: "Add" }));
    keepsLabel(screen.getByRole("button", { name: "Cancel" }));
  });

  it("keeps the loose group's add buttons whole", () => {
    renderTree();
    const open = screen.getByRole("button", { name: "Add a todo" });
    keepsLabel(open);
    fireEvent.click(open);
    expect(
      screen.getByRole("textbox", { name: "Add a todo" }).className,
    ).toContain("min-w-0");
    keepsLabel(screen.getByRole("button", { name: "Add" }));
  });
});

describe("GoalTreeView — the add-goal form on a phone (#2490)", () => {
  /*
   * jsdom has no layout, so this pins the structure and the classes that
   * place things. At 390px the end label sat at the end of one line and its
   * date field fell to the next, because both were loose children of one
   * flex-wrap row. Every phone-only class carries max-md:, so Desktop keeps
   * its one line.
   */
  const classesOf = (el: Element): string[] => el.className.split(/\s+/);

  function openForm(): void {
    renderTree();
    fireEvent.click(screen.getByRole("button", { name: "Add a goal" }));
  }

  it("keeps each date label in one pair with its own field", () => {
    openForm();
    for (const name of ["From", "To"]) {
      const field = screen.getByLabelText(name);
      const pair = field.closest("[data-goal-range-pair]") as HTMLElement;
      expect(pair).not.toBeNull();
      const label = within(pair).getByText(name);
      expect(label.tagName).toBe("LABEL");
      expect(label.parentElement).toBe(pair);
      expect(classesOf(label)).toEqual(
        expect.arrayContaining(["shrink-0", "whitespace-nowrap"]),
      );
    }
    const pairs = document.querySelectorAll("[data-goal-range-pair]");
    expect(pairs).toHaveLength(2);
    // The row wraps pair by pair, and stacks them below 768px only.
    const row = pairs[0]?.parentElement as HTMLElement;
    expect(pairs[1]?.parentElement).toBe(row);
    expect(classesOf(row)).toEqual(
      expect.arrayContaining(["flex-wrap", "max-md:flex-col"]),
    );
    expect(classesOf(row)).not.toContain("flex-col");
  });

  it("gives the title and date fields 44px on a phone, and the title its own line", () => {
    openForm();
    const title = screen.getByRole("textbox", { name: "This week: Goal" });
    expect(classesOf(title)).toEqual(
      expect.arrayContaining(["max-md:min-h-11", "max-md:basis-full"]),
    );
    expect(classesOf(title)).not.toContain("basis-full");
    expect(classesOf(title.parentElement as HTMLElement)).toContain(
      "max-md:flex-wrap",
    );
    expect(classesOf(title.parentElement as HTMLElement)).not.toContain(
      "flex-wrap",
    );
    for (const name of ["From", "To"]) {
      const field = screen.getByLabelText(name);
      expect(classesOf(field)).toContain("max-md:min-h-11");
      // The field fills the pair on a phone and keeps its 10rem on Desktop.
      const box = field.parentElement as HTMLElement;
      expect(classesOf(box)).toEqual(
        expect.arrayContaining(["w-40", "max-md:flex-1", "max-md:w-auto"]),
      );
    }
  });
});

describe("GoalTreeView — the drag reads as carrying the row (#2365)", () => {
  /*
   * jsdom draws nothing, so these pin what the browser is handed and what
   * the rows say: a lifted copy of the whole row as the drag image, a dashed
   * hole where the row was, and an info-coloured outline on each place to
   * drop that turns solid under the pointer (#2607).
   */
  const carrying = () => ({ ...transfer(), setDragImage: vi.fn() });

  it("hands the browser a lifted copy of the whole row, then drops it", async () => {
    renderTree({ drag: dragHandlers() });
    const dataTransfer = carrying();
    fireEvent.dragStart(titleOf("Run 3 times"), { dataTransfer });
    expect(dataTransfer.setDragImage).toHaveBeenCalledTimes(1);
    const ghost = dataTransfer.setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost.hasAttribute("data-goal-tree-ghost")).toBe(true);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(ghost.className).toContain("shadow-lumen-lg");
    expect(ghost.className).toContain("bg-lumen-bg");
    // The row, not just the grabbed title: the period badge comes along.
    expect(ghost.textContent).toContain("This week");
    expect(ghost.textContent).toContain("Run 3 times");
    await vi.waitFor(() =>
      expect(document.querySelector("[data-goal-tree-ghost]")).toBeNull(),
    );
  });

  it("lifts a todo by its whole row too", () => {
    renderTree({ drag: dragHandlers() });
    const dataTransfer = carrying();
    const grip = document.querySelector('[data-todo-drag="t3"]') as HTMLElement;
    fireEvent.dragStart(grip, { dataTransfer });
    const ghost = dataTransfer.setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost.textContent).toContain("5 km jog");
  });

  it("leaves a dashed hole and outlines the places to drop in info", async () => {
    renderTree({ drag: dragHandlers() });
    fireEvent.dragStart(titleOf("Run 3 times"), { dataTransfer: carrying() });
    await vi.waitFor(() =>
      expect(rowOf("Run 3 times").className).toContain("outline-dashed"),
    );
    const target = rowOf("Stretch daily");
    expect(target.className).toContain("outline-dashed");
    expect(target.className).toContain("outline-lumen-info");
    expect(target.className).not.toContain("outline-lumen-accent");
    const box = target.querySelector("[data-drop-target]") as HTMLElement;
    expect(box.className).toContain("border-lumen-info");
    expect(box.className).toContain("border-dashed");
    fireEvent.dragOver(target, { dataTransfer: transfer() });
    await vi.waitFor(() => expect(target.className).toContain("outline-solid"));
    expect(target.className).toContain("outline-2");
    expect(target.className).toContain("bg-lumen-info-subtle");
    expect(target.className).not.toContain("outline-dashed");
    // The square alone marks the spot: no "Move here" words (#2607).
    const over = target.querySelector("[data-drop-target]") as HTMLElement;
    expect(over.textContent).toBe("");
    expect(over.className).not.toContain("border-dashed");
  });
});

describe("GoalTreeView — a goal's title keeps its room on a phone (#2487)", () => {
  /*
   * jsdom has no layout, so this cannot measure the title. It pins the
   * classes that give it room: at 390px the three icons took 150px of the
   * row and the badge and the count took the rest, leaving the title 0px.
   * Every class here carries max-md: (or md: for Desktop's own), so the
   * wide row stays on one line as it was.
   */
  const classesOf = (el: Element): string[] => el.className.split(/\s+/);
  const actions = (): GoalRowActions => ({
    onAddTodo: vi.fn().mockResolvedValue(true),
    onAddChildGoal: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn(),
  });

  it("gives the title a floor and lets the badge and count wrap below it", () => {
    renderTree({ onRenameGoal: vi.fn(), rowActions: actions() });
    const button = titleOf("Run 3 times");
    const title = button.querySelector("[data-goal-title]") as HTMLElement;
    expect(title.textContent).toBe("Run 3 times");
    expect(classesOf(title)).toContain("max-md:min-w-20");
    expect(classesOf(title)).toContain("truncate");
    expect(classesOf(button)).toContain("max-md:flex-wrap");
    expect(classesOf(button)).not.toContain("flex-wrap");
  });

  it("puts the three icons on a line of their own below 768px only", () => {
    renderTree({ onRenameGoal: vi.fn(), rowActions: actions() });
    const row = rowOf("Run 3 times");
    expect(classesOf(row)).toContain("max-md:flex-wrap");
    expect(classesOf(row)).not.toContain("flex-wrap");

    const icons = row.querySelector("[data-goal-row-icons]") as HTMLElement;
    expect(
      within(icons)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Add under: Run 3 times",
      "Edit goal: Run 3 times",
      "Delete goal: Run 3 times",
    ]);
    // Desktop: the box is not drawn, so the icons stay in the row's line.
    expect(classesOf(icons)).toContain("md:contents");
    expect(classesOf(icons)).toContain("max-md:basis-full");
    expect(classesOf(icons)).not.toContain("basis-full");
    // The title is not on the icons' line.
    expect(icons.contains(titleOf("Run 3 times"))).toBe(false);
    // The tap floor stays 44px.
    for (const icon of within(icons).getAllByRole("button")) {
      expect(classesOf(icon)).toContain("max-md:min-h-11");
      expect(classesOf(icon)).toContain("max-md:min-w-11");
    }
  });

  it("draws no icon line on a row whose name is being typed", () => {
    renderTree({ onRenameGoal: vi.fn(), rowActions: actions() });
    fireEvent.click(
      screen.getByRole("button", { name: "Edit goal: Run weekly" }),
    );
    const field = screen.getByRole("textbox", { name: "Goal title" });
    const row = field.parentElement as HTMLElement;
    expect(row.querySelector("[data-goal-row-icons]")).toBeNull();
  });
});
