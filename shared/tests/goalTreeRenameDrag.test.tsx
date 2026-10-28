import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  GoalTreeView,
  buildGoalTreeModel,
  type Goal,
  type GoalTreeDragHandlers,
  type GoalTreeLabels,
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

function renderTree(
  over: {
    selectedGoalId?: string | null;
    onRenameGoal?: (goalId: string, title: string) => void;
    drag?: GoalTreeDragHandlers;
    onSelectGoal?: (goalId: string) => void;
    goals?: Goal[];
  } = {},
): ReturnType<typeof render> {
  return render(
    <GoalTreeView
      model={buildGoalTreeModel({
        goals: over.goals ?? GOALS,
        links: LINKS,
        todos: TODOS,
        todayKey: "2026-09-30",
        untitled: "Untitled",
      })}
      isLoading={false}
      selectedGoalId={over.selectedGoalId ?? null}
      onSelectGoal={over.onSelectGoal ?? vi.fn()}
      onCreateGoal={vi.fn().mockResolvedValue(true)}
      onCreateLooseTodo={vi.fn().mockResolvedValue(true)}
      onSetTodoStatus={vi.fn()}
      onOpenTodo={vi.fn()}
      onRenameGoal={over.onRenameGoal}
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

describe("GoalTreeView — rename in place from the pencil (#2283)", () => {
  it("draws no pencil when the host cannot rename", () => {
    renderTree();
    expect(screen.queryByRole("button", { name: /^Rename: / })).toBeNull();
  });

  it("shows the pencil on hover and keeps it shown on the selected row", () => {
    renderTree({ onRenameGoal: vi.fn(), selectedGoalId: "m1" });
    const idle = screen.getByRole("button", { name: "Rename: Run 3 times" });
    expect(idle.className).toContain("opacity-0");
    expect(idle.className).toContain("group-hover/row:opacity-100");
    // Reachable by keyboard while hidden.
    expect(idle.className).toContain("focus-visible:opacity-100");
    const picked = screen.getByRole("button", { name: "Rename: Run weekly" });
    expect(picked.className).not.toContain("opacity-0");
  });

  it("saves the trimmed name on Enter", () => {
    const onRenameGoal = vi.fn();
    renderTree({ onRenameGoal });
    fireEvent.click(
      screen.getByRole("button", { name: "Rename: Run 3 times" }),
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
      screen.getByRole("button", { name: "Rename: Run 3 times" }),
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
      screen.getByRole("button", { name: "Rename: Run 3 times" });
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
      screen.getByRole("button", { name: "Rename: Run 3 times" }),
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
      name: "Rename: Swim once",
    });
    within(loose).getByRole("button", { name: "Rename: Swim once" });

    fireEvent.click(inTree);
    const fields = screen.getAllByRole("textbox", { name: "Goal title" });
    expect(fields).toHaveLength(1);
    expect(tree.contains(fields[0])).toBe(true);
    expect(document.activeElement).toBe(fields[0]);
    // The other row keeps its title and pencil.
    within(loose).getByRole("button", { name: "Rename: Swim once" });

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
      within(loose).getByRole("button", { name: "Rename: Swim once" }),
    );
    const fields = screen.getAllByRole("textbox", { name: "Goal title" });
    expect(fields).toHaveLength(1);
    expect(loose.contains(fields[0])).toBe(true);
    expect(document.activeElement).toBe(fields[0]);
    within(tree).getByRole("button", { name: "Rename: Swim once" });
  });

  it("does not drag the row while its name is being edited", () => {
    renderTree({ onRenameGoal: vi.fn(), drag: dragHandlers() });
    fireEvent.click(screen.getByRole("button", { name: "Rename: Run weekly" }));
    const field = screen.getByRole("textbox", { name: "Goal title" });
    const row = field.parentElement as HTMLElement;
    expect(row.querySelector("[draggable]")).toBeNull();
    expect(row.querySelector("[data-goal-drag]")).toBeNull();
    // Other rows keep theirs.
    expect(titleOf("Run 3 times").getAttribute("draggable")).toBe("true");
    within(row).getByRole("button", { name: "Collapse: Run weekly" });
  });
});

describe("GoalTreeView — the drag reads as carrying the row (#2365)", () => {
  /*
   * jsdom draws nothing, so these pin what the browser is handed and what
   * the rows say: a lifted copy of the whole row as the drag image, a dashed
   * hole where the row was, and a "Move here" pill on the target underneath.
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
    // The row, not just the grabbed title: the kind chip comes along.
    expect(ghost.textContent).toContain("Week");
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

  it("leaves a dashed hole and names the target under the pointer", async () => {
    renderTree({ drag: dragHandlers() });
    fireEvent.dragStart(titleOf("Run 3 times"), { dataTransfer: carrying() });
    await vi.waitFor(() =>
      expect(rowOf("Run 3 times").className).toContain("outline-dashed"),
    );
    const target = rowOf("Stretch daily");
    expect(target.textContent).not.toContain("Move here");
    fireEvent.dragOver(target, { dataTransfer: transfer() });
    await vi.waitFor(() =>
      expect(target.querySelector("[data-drop-target]")?.textContent).toContain(
        "Move here",
      ),
    );
    expect(target.className).toContain("outline-2");
  });
});
