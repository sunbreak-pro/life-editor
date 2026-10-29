import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect, useRef } from "react";
import {
  ItemPanelProvider,
  RightSidebarProvider,
  useItemPanelContext,
  useRightSidebarContext,
  type DataService,
  type Goal,
} from "@life-editor/shared";
import { GoalsTodosScreen } from "../src/connect/GoalsTodosScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * Connect's Goals & Todos tab (#2108, plan Step 9). The fixture is the brief's
 * sample (§11), in English, on Wednesday 2026-09-30: the week is 9/27 – 10/3
 * (Sunday start — D-20260816-briefing-1).
 *
 * Only Date is faked, so waitFor and the promise chain run on real timers.
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
  goal({
    id: "y1",
    title: "Run 10 km in 60 min",
    periodKind: "year",
    periodKey: "2026",
  }),
  goal({
    id: "y2",
    title: "Speak up in English",
    periodKind: "year",
    periodKey: "2026",
    sortOrder: 1,
  }),
  goal({
    id: "m1",
    title: "Win an autumn project",
    periodKind: "month",
    periodKey: "2026-09",
  }),
  goal({
    id: "m2",
    title: "Run three times a week",
    periodKind: "month",
    periodKey: "2026-09",
    parentGoalId: "y1",
    sortOrder: 1,
  }),
  goal({ id: "w1", title: "Get the proposal approved", parentGoalId: "m1" }),
  goal({ id: "w2", title: "Run 3 times", parentGoalId: "m2", sortOrder: 1 }),
  goal({ id: "w3", title: "Finish one book", sortOrder: 2 }),
  // Last week's, still awaiting its period-end decision (brief §11). Not
  // drawn, but its month's progress counts it.
  goal({
    id: "pw1",
    title: "Decide the room layout",
    periodKey: "2026-09-20",
    parentGoalId: "m1",
  }),
];

const todo = (
  id: string,
  title: string,
  done = false,
  completedAt?: string,
) => ({
  id,
  title,
  status: done ? "DONE" : "NOT_STARTED",
  completedAt,
});

const TODOS = [
  todo("t1", "Draft the proposal", true),
  todo("t2", "Send the proposal", true),
  todo("t3", "Write the estimate"),
  todo("t4", "Book the review"),
  todo("t5", "5 km jog", true),
  todo("t6", "Interval run"),
  todo("t7", "Long run"),
  todo("l1", "Pick up the residence certificate"),
  // Done on Tuesday of this week: still listed, done-styled (brief §11).
  todo("l2", "Submit expenses", true, "2026-09-29T03:00:00Z"),
  // Done last month: gone from the list.
  todo("l3", "Renew the passport", true, "2026-08-10T03:00:00Z"),
  todo("p1", "Measure the room", true),
  todo("p2", "Pick the curtains"),
];

const link = (goalId: string, todoId: string) => ({
  id: `link-${goalId}-${todoId}`,
  goalId,
  todoId,
  isDeleted: false,
});

const LINKS = [
  link("w1", "t1"),
  link("w1", "t2"),
  link("w1", "t3"),
  link("w1", "t4"),
  link("w2", "t5"),
  link("w2", "t6"),
  link("w2", "t7"),
  link("pw1", "p1"),
  link("pw1", "p2"),
];

function makeDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  return stubDataService({
    fetchGoals: vi.fn().mockResolvedValue(GOALS),
    fetchTodoTree: vi.fn().mockResolvedValue(TODOS),
    fetchGoalTodoLinks: vi.fn().mockResolvedValue(LINKS),
    createGoal: vi.fn().mockResolvedValue(GOALS[0]),
    updateGoal: vi.fn().mockResolvedValue(GOALS[0]),
    softDeleteGoal: vi.fn().mockResolvedValue(undefined),
    updateTodo: vi.fn().mockResolvedValue(TODOS[0]),
    ...over,
  });
}

/** The shell's right panel, as connectScreen.test.tsx stands it in. */
function PanelWell() {
  const { setPortalTarget } = useRightSidebarContext();
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(ref.current);
    return () => setPortalTarget(null);
  }, [setPortalTarget]);
  return <aside aria-label="Details" ref={ref} />;
}

/** Prints the item panel's open request and closes it, as the shell's host would. */
function PanelRequestProbe() {
  const { request, close } = useItemPanelContext();
  return (
    <>
      <output aria-label="Panel request">
        {request?.mode === "edit" ? JSON.stringify(request.target) : ""}
      </output>
      <button type="button" onClick={close}>
        Close panel
      </button>
    </>
  );
}

async function renderTab(
  ds: DataService = makeDS(),
  ready: string | (() => unknown) = "Goal tree",
  { itemPanel = false }: { itemPanel?: boolean } = {},
) {
  const onNavigateToItem = vi.fn();
  const { wrapper: SyncWrapper, sync } = createBumpableSync();
  const tab = (
    <RightSidebarProvider>
      <GoalsTodosScreen dataService={ds} onNavigateToItem={onNavigateToItem} />
      <PanelWell />
    </RightSidebarProvider>
  );
  render(
    <SyncWrapper>
      {itemPanel ? (
        <ItemPanelProvider>
          {tab}
          <PanelRequestProbe />
        </ItemPanelProvider>
      ) : (
        tab
      )}
    </SyncWrapper>,
  );
  await waitFor(
    typeof ready === "string"
      ? () => screen.getByRole("region", { name: ready })
      : ready,
  );
  const panel = () =>
    within(screen.getByRole("complementary", { name: "Details" }));
  return { onNavigateToItem, panel, sync };
}

/** A goal row by its spoken name, "Week: Run 3 times — 1/3". */
const goalRow = (title: string, status?: string) =>
  screen.getByRole("button", {
    name: (name) =>
      new RegExp(`^\\w+: ${title} — `).test(name) &&
      (status === undefined || name.endsWith(status)),
  });

function setNarrow() {
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("Connect Goals & Todos tab (#2108)", () => {
  it("draws the year → month → week tree with judged progress and linked todos", async () => {
    await renderTab();
    const tree = within(screen.getByRole("region", { name: "Goal tree" }));

    // The year goal holds its month, which holds its week (1 of 3 done).
    const yearBranch = within(
      goalRow("Run 10 km in 60 min").closest("li") as HTMLElement,
    );
    yearBranch.getByRole("button", {
      name: "Month: Run three times a week — 0/1",
    });
    yearBranch.getByRole("button", { name: "Week: Run 3 times — 1/3" });
    // A month goal with no year parent is a root of its own.
    // Its progress also counts last week's goal, which is not drawn.
    tree.getByRole("button", { name: "Month: Win an autumn project — 0/2" });
    expect(screen.queryByText("Decide the room layout")).toBeNull();
    tree.getByRole("button", { name: "Week: Get the proposal approved — 2/4" });
    // Linked todos hang under their goal.
    within(
      tree.getByRole("list", { name: "Get the proposal approved" }),
    ).getByRole("button", { name: "Edit: Write the estimate" });
  });

  it("files nothing-connected goals under Unconnected, and lists the todos no shown goal holds", async () => {
    await renderTab();
    const unconnected = within(
      screen.getByRole("region", { name: "Unconnected goals" }),
    );
    unconnected.getByRole("button", {
      name: "Year: Speak up in English — Unconnected",
    });
    unconnected.getByRole("button", {
      name: "Week: Finish one book — Unconnected",
    });

    const loose = within(
      screen.getByRole("region", { name: "Todos not linked to a goal" }),
    );
    loose.getByRole("button", {
      name: "Edit: Pick up the residence certificate",
    });
    // Completed this week: moved to Completed items, done-styled (#2368).
    expect(loose.queryByText("Submit expenses")).toBeNull();
    const done = within(
      screen.getByRole("region", { name: "Completed items" }),
    );
    expect(done.getByText("Submit expenses").className).toContain(
      "line-through",
    );
    done.getByRole("checkbox", { name: "Submit expenses — Status: Done" });
    // Completed long ago: not listed anywhere.
    expect(screen.queryByText("Renew the passport")).toBeNull();
    // Held only by last week's (undrawn) goal: listed here rather than lost.
    loose.getByRole("button", { name: "Edit: Pick the curtains" });
    expect(loose.queryByText("Measure the room")).toBeNull();
  });

  it("says the read failed, with a retry, instead of claiming there are no goals", async () => {
    const fetchGoals = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(GOALS);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderTab(makeDS({ fetchGoals }), () => screen.getByRole("alert"));
    expect(screen.queryByText(/No goals yet/)).toBeNull();
    // No add row: an empty model would read every period as 0/3.
    expect(screen.queryByRole("button", { name: /This week/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => screen.getByRole("region", { name: "Goal tree" }));
  });

  it("says in text why an add button is held", async () => {
    await renderTab();
    const week = screen.getByRole("button", { name: /This week/ });
    const reasonId = week.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId as string)?.textContent).toBe(
      "This week already has 3 goals.",
    );
  });

  it("shows only the guidance when there are no goals — no empty group frames", async () => {
    await renderTab(
      makeDS({
        fetchGoals: vi.fn().mockResolvedValue([]),
        fetchTodoTree: vi.fn().mockResolvedValue([]),
      }),
      "Set a goal",
    );
    screen.getByText(/No goals yet/);
    expect(screen.queryByRole("region", { name: "Goal tree" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Unconnected goals" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Todos not linked to a goal" }),
    ).toBeNull();

    // The guidance's button opens this week's add field.
    fireEvent.click(
      screen.getByRole("button", { name: "Set this week's goals" }),
    );
    screen.getByRole("textbox", { name: /This week/ });
  });

  it("creates a goal in the current period from the add row", async () => {
    const ds = makeDS();
    await renderTab(ds);
    fireEvent.click(screen.getByRole("button", { name: /This month/ }));
    const field = screen.getByRole("textbox", { name: /This month/ });
    fireEvent.change(field, { target: { value: "Ship the redesign" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(ds.createGoal).toHaveBeenCalledTimes(1));
    expect(ds.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ship the redesign",
        periodKind: "month",
        periodKey: "2026-09",
        sortOrder: 2,
      }),
    );
  });

  it("holds the add button at three goals per period", async () => {
    await renderTab();
    const week = screen.getByRole("button", { name: /This week/ });
    expect((week as HTMLButtonElement).disabled).toBe(true);
  });

  it("ticking the last open todo flips the week goal to Achieved and writes the todo", async () => {
    const ds = makeDS({
      fetchGoalTodoLinks: vi
        .fn()
        .mockResolvedValue([link("w2", "t5"), link("w2", "t6")]),
    });
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Interval run — Status: Not started",
      }),
    );
    goalRow("Run 3 times", "Achieved");
    await waitFor(() =>
      expect(ds.updateTodo).toHaveBeenCalledWith(
        "t6",
        expect.objectContaining({ status: "DONE" }),
      ),
    );
  });

  it("holds a tick over a re-read that lands before its write does", async () => {
    let finishWrite: () => void = () => undefined;
    const ds = makeDS({
      fetchGoalTodoLinks: vi
        .fn()
        .mockResolvedValue([link("w2", "t5"), link("w2", "t6")]),
      updateTodo: vi.fn(
        () =>
          new Promise((resolve) => {
            finishWrite = () => resolve(TODOS[0]);
          }),
      ),
    });
    const { sync } = await renderTab(ds);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Interval run — Status: Not started",
      }),
    );
    goalRow("Run 3 times", "Achieved");

    // The write's own Realtime echo: a read that still sees the old status.
    act(() => sync.bump("todos"));
    await waitFor(() => expect(ds.fetchTodoTree).toHaveBeenCalledTimes(2));
    await act(async () => undefined);
    goalRow("Run 3 times", "Achieved");

    await act(async () => finishWrite());
    await waitFor(() => expect(ds.fetchTodoTree).toHaveBeenCalledTimes(3));
  });

  it("explains a month's progress that counts goals the tree does not draw", async () => {
    const { panel } = await renderTab();
    fireEvent.click(goalRow("Win an autumn project"));
    panel().getByText(
      "1 more from an earlier period also counts toward the progress.",
    );
    panel().getByRole("button", { name: /Get the proposal approved/ });
  });

  it("opens the picked goal in the right panel, where it can be renamed, re-parented and deleted", async () => {
    const ds = makeDS();
    const { panel } = await renderTab(ds);
    fireEvent.click(goalRow("Get the proposal approved"));

    const title = panel().getByRole("textbox", { name: "Goal title" });
    fireEvent.change(title, { target: { value: "Get the proposal signed" } });
    fireEvent.blur(title);
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w1", {
        title: "Get the proposal signed",
      }),
    );

    // A week's parents are its month's goals.
    const parent = panel().getByRole("combobox", { name: "Goal one level up" });
    fireEvent.change(parent, { target: { value: "m2" } });
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w1", { parentGoalId: "m2" }),
    );

    panel().getByRole("button", { name: "Edit: Book the review" });

    fireEvent.click(panel().getByRole("button", { name: "Delete goal" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete goal",
      }),
    );
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w1"));
  });

  it("renames a goal from the tree's pencil with the panel's write (#2283)", async () => {
    const ds = makeDS();
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Rename: Get the proposal approved" }),
    );
    const field = screen.getByRole("textbox", { name: "Goal title" });
    fireEvent.change(field, { target: { value: "Get the proposal signed" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w1", {
        title: "Get the proposal signed",
      }),
    );
    expect(ds.updateGoal).toHaveBeenCalledTimes(1);
  });

  it("refills the open panel's title after a rename from the pencil", async () => {
    let goals = GOALS;
    const ds = makeDS({ fetchGoals: vi.fn(async () => goals) });
    const { panel, sync } = await renderTab(ds);
    fireEvent.click(goalRow("Get the proposal approved"));
    const before = panel().getByRole("textbox", { name: "Goal title" });
    expect((before as HTMLInputElement).value).toBe(
      "Get the proposal approved",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Rename: Get the proposal approved" }),
    );
    const field = within(
      screen.getByRole("region", { name: "Goal tree" }),
    ).getByRole("textbox", { name: "Goal title" });
    fireEvent.change(field, { target: { value: "Get the proposal signed" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(ds.updateGoal).toHaveBeenCalledTimes(1));

    // The write's Realtime echo re-reads the new name.
    goals = GOALS.map((g) =>
      g.id === "w1" ? { ...g, title: "Get the proposal signed" } : g,
    );
    act(() => sync.bump("goals"));
    await waitFor(() =>
      expect(
        (
          panel().getByRole("textbox", {
            name: "Goal title",
          }) as HTMLInputElement
        ).value,
      ).toBe("Get the proposal signed"),
    );
    // Leaving the panel's field writes nothing back.
    fireEvent.blur(panel().getByRole("textbox", { name: "Goal title" }));
    expect(ds.updateGoal).toHaveBeenCalledTimes(1);
  });

  it("offers the hand mark only on an unconnected goal", async () => {
    const ds = makeDS();
    const { panel } = await renderTab(ds);
    fireEvent.click(goalRow("Finish one book"));
    fireEvent.click(panel().getByRole("button", { name: "Mark as achieved" }));
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w3", {
        manualAchievedAt: expect.any(String),
      }),
    );

    fireEvent.click(goalRow("Run 3 times"));
    expect(
      panel().queryByRole("button", { name: "Mark as achieved" }),
    ).toBeNull();
  });

  it("edits a todo over the tab instead of leaving for Schedule (#2362)", async () => {
    const ds = makeDS();
    const { onNavigateToItem } = await renderTab(ds, "Goal tree", {
      itemPanel: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit: Long run" }));
    expect(screen.getByLabelText("Panel request").textContent).toBe(
      JSON.stringify({ role: "task", id: "t7" }),
    );
    expect(onNavigateToItem).not.toHaveBeenCalled();
    // The tab stays and re-reads once the panel shuts.
    const reads = vi.mocked(ds.fetchTodoTree).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    await waitFor(() =>
      expect(vi.mocked(ds.fetchTodoTree).mock.calls.length).toBeGreaterThan(
        reads,
      ),
    );
    expect(screen.getByRole("region", { name: "Goal tree" })).toBeTruthy();
  });

  it("falls back to Schedule without an item panel", async () => {
    const { onNavigateToItem } = await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Edit: Long run" }));
    expect(onNavigateToItem).toHaveBeenCalledWith({ id: "t7", role: "task" });
  });

  it("filters the tree from the right panel, says so over the tree, and resets", async () => {
    const { panel } = await renderTab();
    // The controls are there before any goal is picked.
    const period = within(panel().getByRole("tablist", { name: "Period" }));
    fireEvent.click(period.getByRole("tab", { name: "Week" }));

    const line = screen.getByRole("status");
    expect(line.textContent).toContain("Filtering by: Week");
    expect(screen.queryByText("Run 10 km in 60 min")).toBeNull();
    // The week goals stand on their own, out of their month frames.
    goalRow("Run 3 times");
    goalRow("Get the proposal approved");

    fireEvent.click(within(line).getByRole("button", { name: "Reset" }));
    goalRow("Run 10 km in 60 min");
    expect(screen.queryByText(/Filtering by/)).toBeNull();
  });

  it("hides done todos and keeps the goal details under the controls", async () => {
    const { panel } = await renderTab();
    fireEvent.click(goalRow("Get the proposal approved"));
    fireEvent.click(panel().getByRole("checkbox", { name: "Hide done todos" }));

    const tree = within(screen.getByRole("region", { name: "Goal tree" }));
    expect(tree.queryByText("Draft the proposal")).toBeNull();
    tree.getByText("Write the estimate");
    // The count still includes them.
    goalRow("Get the proposal approved", "2/4");
    panel().getByRole("textbox", { name: "Goal title" });
  });

  it("closes and reopens a goal's branch", async () => {
    await renderTab();
    const close = screen.getByRole("button", {
      name: "Collapse: Run 10 km in 60 min",
    });
    expect(close.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(close);
    expect(screen.queryByText("Run three times a week")).toBeNull();
    expect(screen.queryByText("Interval run")).toBeNull();

    const open = screen.getByRole("button", {
      name: "Expand: Run 10 km in 60 min",
    });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(open);
    goalRow("Run three times a week");
  });

  it("creates a todo linked to no goal from + Todo, but not on an IME Enter", async () => {
    const createTodo = vi.fn().mockResolvedValue(TODOS[0]);
    const ds = makeDS({ createTodo });
    await renderTab(ds);
    const loose = within(
      screen.getByRole("region", { name: "Todos not linked to a goal" }),
    );
    fireEvent.click(
      loose.getByRole("button", { name: "Add a todo not linked to a goal" }),
    );
    const field = loose.getByRole("textbox", {
      name: "Add a todo not linked to a goal",
    });
    fireEvent.change(field, { target: { value: "Buy stamps" } });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(createTodo).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(createTodo).toHaveBeenCalledTimes(1));
    const created = createTodo.mock.calls[0][0];
    expect(created).toMatchObject({
      title: "Buy stamps",
      type: "task",
      status: "NOT_STARTED",
      parentId: null,
    });
    expect(created.id).toMatch(/^task-/);
    expect(created.scheduledAt).toBeUndefined();
    expect(ds.createGoal).not.toHaveBeenCalled();
    // Ready for the next one.
    await waitFor(() => expect((field as HTMLInputElement).value).toBe(""));
  });

  it("opens sort and filter in a bottom sheet on a phone", async () => {
    setNarrow();
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Sort & filter" }));
    const sheet = within(screen.getByRole("dialog", { name: "Sort & filter" }));
    fireEvent.click(
      within(sheet.getByRole("tablist", { name: "Status" })).getByRole("tab", {
        name: "Achieved",
      }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Filtering by: Achieved",
    );
    expect(screen.queryByText("Run 10 km in 60 min")).toBeNull();
  });

  it("puts the panel in a bottom sheet on a phone", async () => {
    setNarrow();
    await renderTab();
    fireEvent.click(goalRow("Run 3 times"));
    const sheet = within(
      screen.getByRole("dialog", { name: "Goal: Run 3 times" }),
    );
    sheet.getByRole("textbox", { name: "Goal title" });
  });
});

describe("Connect Goals & Todos tab — drag (#2226)", () => {
  /** jsdom has no DataTransfer; the tree only writes to it. */
  const transfer = () => ({
    setData: vi.fn(),
    effectAllowed: "",
    dropEffect: "",
  });
  /** The row a goal's select button sits in — the drop target. */
  const rowOf = (title: string) => goalRow(title).parentElement as HTMLElement;
  const handle = (attr: "goal" | "todo", id: string) =>
    document.querySelector(`[data-${attr}-drag="${id}"]`) as HTMLElement;
  const isTarget = (title: string) =>
    rowOf(title).querySelector("[data-drop-target]") !== null;

  async function startDrag(el: HTMLElement) {
    fireEvent.dragStart(el, { dataTransfer: transfer() });
    // The paint follows a tick after dragstart.
    await waitFor(() =>
      expect(document.querySelector("[data-drop-target]")).not.toBeNull(),
    );
  }
  function dropOn(title: string) {
    const row = rowOf(title);
    fireEvent.dragOver(row, { dataTransfer: transfer() });
    fireEvent.drop(row, { dataTransfer: transfer() });
  }

  it("lights only the months that may hold a week, and re-parents it with one write", async () => {
    const ds = makeDS();
    await renderTab(ds);
    // The open / close arrow is the grip; a year goal's arrow is not.
    const grip = screen.getByRole("button", { name: "Collapse: Run 3 times" });
    expect(grip.getAttribute("draggable")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Collapse: Run 10 km in 60 min" })
        .hasAttribute("draggable"),
    ).toBe(false);

    await startDrag(grip);
    expect(isTarget("Win an autumn project")).toBe(true);
    // Its own month, the years (two up) and the weeks (same period) stay dark.
    expect(isTarget("Run three times a week")).toBe(false);
    expect(isTarget("Run 10 km in 60 min")).toBe(false);
    expect(isTarget("Get the proposal approved")).toBe(false);
    expect(isTarget("Finish one book")).toBe(false);

    // A browser drops only where dragover was cancelled: the year row lets
    // it pass, the month row takes it.
    expect(
      fireEvent.dragOver(rowOf("Run 10 km in 60 min"), {
        dataTransfer: transfer(),
      }),
    ).toBe(true);
    expect(
      fireEvent.dragOver(rowOf("Win an autumn project"), {
        dataTransfer: transfer(),
      }),
    ).toBe(false);
    // jsdom fires drop regardless; the handler still writes nothing there.
    dropOn("Run 10 km in 60 min");
    expect(ds.updateGoal).not.toHaveBeenCalled();

    await startDrag(grip);
    dropOn("Win an autumn project");
    await waitFor(() => expect(ds.updateGoal).toHaveBeenCalledTimes(1));
    expect(ds.updateGoal).toHaveBeenCalledWith("w2", { parentGoalId: "m1" });
    expect(document.querySelector("[data-drop-target]")).toBeNull();
  });

  it("gives a goal with nothing under it a grip of its own", async () => {
    const ds = makeDS();
    await renderTab(ds);
    await startDrag(handle("goal", "w3"));
    dropOn("Run three times a week");
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w3", { parentGoalId: "m2" }),
    );
  });

  it("moves a todo off the goal it was dragged from and onto the one it lands on", async () => {
    const calls: string[] = [];
    const ds = makeDS({
      unlinkGoalTodo: vi.fn(async (g: string, t: string) => {
        calls.push(`unlink ${g} ${t}`);
      }),
      linkGoalTodo: vi.fn(async (g: string, t: string) => {
        calls.push(`link ${g} ${t}`);
        return { id: "x", goalId: g, todoId: t, isDeleted: false };
      }),
    });
    await renderTab(ds);
    await startDrag(handle("todo", "t6"));
    // Already under "Run 3 times", so that goal is not offered.
    expect(isTarget("Run 3 times")).toBe(false);
    expect(isTarget("Get the proposal approved")).toBe(true);
    dropOn("Get the proposal approved");
    await waitFor(() => expect(calls).toEqual(["unlink w2 t6", "link w1 t6"]));
  });

  it("links the todo back to its goal when the new link fails", async () => {
    const linkGoalTodo = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({
        id: "x",
        goalId: "w2",
        todoId: "t6",
        isDeleted: false,
      });
    const ds = makeDS({
      unlinkGoalTodo: vi.fn().mockResolvedValue(undefined),
      linkGoalTodo,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderTab(ds);
    await startDrag(handle("todo", "t6"));
    dropOn("Get the proposal approved");
    await waitFor(() => expect(linkGoalTodo).toHaveBeenCalledTimes(2));
    expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("w2", "t6");
    expect(linkGoalTodo.mock.calls).toEqual([
      ["w1", "t6"],
      ["w2", "t6"],
    ]);
  });

  it("links a todo no goal holds to the goal it lands on, unlinking nothing", async () => {
    const ds = makeDS({
      unlinkGoalTodo: vi.fn().mockResolvedValue(undefined),
      linkGoalTodo: vi.fn().mockResolvedValue(LINKS[0]),
    });
    await renderTab(ds);
    await startDrag(handle("todo", "l1"));
    dropOn("Finish one book");
    await waitFor(() =>
      expect(ds.linkGoalTodo).toHaveBeenCalledWith("w3", "l1"),
    );
    expect(ds.unlinkGoalTodo).not.toHaveBeenCalled();
  });

  it("draws no grip on a phone", async () => {
    setNarrow();
    await renderTab();
    expect(
      document.querySelector("[data-goal-drag], [data-todo-drag], [draggable]"),
    ).toBeNull();
  });
});
