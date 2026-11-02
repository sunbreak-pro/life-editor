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
  ToastProvider,
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
    softDeleteTodo: vi.fn().mockResolvedValue(undefined),
    unlinkGoalTodo: vi.fn().mockResolvedValue(undefined),
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

  it("adds a fourth goal to a period that has three (#2366)", async () => {
    const ds = makeDS();
    await renderTab(ds);
    const week = screen.getByRole("button", { name: /This week/ });
    expect((week as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/already has 3 goals/)).toBeNull();
    fireEvent.click(week);
    const field = screen.getByRole("textbox", { name: /This week/ });
    fireEvent.change(field, { target: { value: "Sleep by 23:00" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(ds.createGoal).toHaveBeenCalledTimes(1));
    const input = vi.mocked(ds.createGoal).mock.calls[0]?.[0];
    expect(input).toMatchObject({
      periodKind: "week",
      periodKey: "2026-09-27",
    });
    // Left at the week's own dates, no range is stored.
    expect(input).not.toHaveProperty("startDate");
  });

  it("creates a goal with a start and end date of its own (#2366)", async () => {
    const ds = makeDS();
    await renderTab(ds);
    fireEvent.click(screen.getByRole("button", { name: /This week/ }));
    const from = screen.getByLabelText("From") as HTMLInputElement;
    const to = screen.getByLabelText("To") as HTMLInputElement;
    // Seeded with the week's own first and last day.
    expect(from.value).toBe("2026-09-27");
    expect(to.value).toBe("2026-10-03");
    fireEvent.change(screen.getByRole("textbox", { name: /This week/ }), {
      target: { value: "Read two books" },
    });
    // A range that runs backwards cannot be added.
    fireEvent.change(to, { target: { value: "2026-09-20" } });
    expect(
      (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(to, { target: { value: "2026-10-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(ds.createGoal).toHaveBeenCalledTimes(1));
    expect(ds.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Read two books",
        periodKind: "week",
        periodKey: "2026-09-27",
        startDate: "2026-09-27",
        endDate: "2026-10-15",
      }),
    );
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

    // A week's parents are the goals of its month and of its year, each named
    // with its kind so the two read apart (#2399).
    const parent = panel().getByRole("combobox", { name: "Goal above" });
    within(parent).getByRole("option", { name: "Year: Run 10 km in 60 min" });
    within(parent).getByRole("option", { name: "Month: Run three times a week" });
    fireEvent.change(parent, { target: { value: "m2" } });
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w1", { parentGoalId: "m2" }),
    );

    panel().getByRole("button", { name: "Edit: Book the review" });

    fireEvent.click(panel().getByRole("button", { name: "Delete goal" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(dialog.getByRole("button", { name: "Delete goal" }));
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w1"));
    // Its todos went with it (#2405), and the panel shut with the goal.
    expect(vi.mocked(ds.softDeleteTodo).mock.calls.map(([id]) => id)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
    ]);
    await waitFor(() =>
      expect(panel().queryByRole("textbox", { name: "Goal title" })).toBeNull(),
    );
  });

  it("renames a goal from the tree's edit icon with the panel's write (#2283 / #2367)", async () => {
    const ds = makeDS();
    const { panel } = await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit goal: Get the proposal approved",
      }),
    );
    // Wide: the panel opens too, with the goal's other fields.
    expect(
      (panel().getByRole("textbox", { name: "Goal title" }) as HTMLInputElement)
        .value,
    ).toBe("Get the proposal approved");
    const field = within(
      screen.getByRole("region", { name: "Goal tree" }),
    ).getByRole("textbox", { name: "Goal title" });
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
      screen.getByRole("button", {
        name: "Edit goal: Get the proposal approved",
      }),
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

  it("adds a linked todo from a goal's + and deletes from its bin (#2367)", async () => {
    const createTodo = vi.fn().mockResolvedValue(TODOS[0]);
    const linkGoalTodo = vi.fn().mockResolvedValue(undefined);
    const ds = makeDS({ createTodo, linkGoalTodo });
    await renderTab(ds);
    const tree = within(screen.getByRole("region", { name: "Goal tree" }));
    // Nothing goes under a week but a todo, so the + opens the todo field.
    fireEvent.click(
      tree.getByRole("button", {
        name: "Add under: Get the proposal approved",
      }),
    );
    const field = tree.getByRole("textbox", {
      name: "Add under: Get the proposal approved — Todo",
    });
    fireEvent.change(field, { target: { value: "Send the draft" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(linkGoalTodo).toHaveBeenCalledTimes(1));
    const created = createTodo.mock.calls[0]?.[0] as { id: string };
    expect(created).toMatchObject({ title: "Send the draft", type: "task" });
    expect(linkGoalTodo).toHaveBeenCalledWith("w1", created.id);

    fireEvent.click(
      tree.getByRole("button", {
        name: "Delete goal: Get the proposal approved",
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(dialog.getByRole("button", { name: "Delete goal" }));
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w1"));
    expect(ds.softDeleteTodo).toHaveBeenCalledTimes(4);
  });

  it("adds this week's goal straight under a year from its + (#2399)", async () => {
    const ds = makeDS();
    await renderTab(ds);
    const tree = within(screen.getByRole("region", { name: "Goal tree" }));
    fireEvent.click(
      tree.getByRole("button", { name: "Add under: Run 10 km in 60 min" }),
    );
    fireEvent.click(tree.getByRole("button", { name: "This week's goal" }));
    const field = tree.getByRole("textbox", {
      name: "Add under: Run 10 km in 60 min — This week's goal",
    });
    fireEvent.change(field, { target: { value: "Long run on Sunday" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(ds.createGoal).toHaveBeenCalledTimes(1));
    expect(ds.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Long run on Sunday",
        periodKind: "week",
        periodKey: "2026-09-27",
        // Three weeks in this period already: it lands last.
        sortOrder: 3,
        parentGoalId: "y1",
      }),
    );
    await waitFor(() =>
      expect(tree.queryByRole("textbox", { name: /^Add under/ })).toBeNull(),
    );
  });

  it("adds this month's goal from a year's +, and only a week from a month's", async () => {
    const ds = makeDS();
    await renderTab(ds);
    const tree = within(screen.getByRole("region", { name: "Goal tree" }));
    fireEvent.click(
      tree.getByRole("button", { name: "Add under: Run three times a week" }),
    );
    tree.getByRole("button", { name: "This week's goal" });
    expect(tree.queryByRole("button", { name: "This month's goal" })).toBeNull();

    fireEvent.click(
      tree.getByRole("button", { name: "Add under: Run 10 km in 60 min" }),
    );
    fireEvent.click(tree.getByRole("button", { name: "This month's goal" }));
    const field = tree.getByRole("textbox", {
      name: "Add under: Run 10 km in 60 min — This month's goal",
    });
    fireEvent.change(field, { target: { value: "Join a club" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(ds.createGoal).toHaveBeenCalledTimes(1));
    expect(ds.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Join a club",
        periodKind: "month",
        periodKey: "2026-09",
        parentGoalId: "y1",
      }),
    );
  });

  it("links a todo to the year it was added under", async () => {
    const createTodo = vi.fn().mockResolvedValue(TODOS[0]);
    const linkGoalTodo = vi.fn().mockResolvedValue(undefined);
    const ds = makeDS({ createTodo, linkGoalTodo });
    await renderTab(ds);
    const tree = within(screen.getByRole("region", { name: "Goal tree" }));
    fireEvent.click(
      tree.getByRole("button", { name: "Add under: Run 10 km in 60 min" }),
    );
    fireEvent.click(tree.getByRole("button", { name: "Todo" }));
    const field = tree.getByRole("textbox", {
      name: "Add under: Run 10 km in 60 min — Todo",
    });
    fireEvent.change(field, { target: { value: "Pick a race" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(linkGoalTodo).toHaveBeenCalledTimes(1));
    const created = createTodo.mock.calls[0]?.[0] as { id: string };
    expect(linkGoalTodo).toHaveBeenCalledWith("y1", created.id);
    expect(ds.createGoal).not.toHaveBeenCalled();
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

  it("lights only the longer periods that may hold a week, and re-parents it with one write", async () => {
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
    // A year may hold a week directly (#2399).
    expect(isTarget("Run 10 km in 60 min")).toBe(true);
    // Its own month and the weeks (same period) stay dark.
    expect(isTarget("Run three times a week")).toBe(false);
    expect(isTarget("Get the proposal approved")).toBe(false);
    expect(isTarget("Finish one book")).toBe(false);

    // A browser drops only where dragover was cancelled: another week's row
    // lets it pass, the month row takes it.
    expect(
      fireEvent.dragOver(rowOf("Get the proposal approved"), {
        dataTransfer: transfer(),
      }),
    ).toBe(true);
    expect(
      fireEvent.dragOver(rowOf("Win an autumn project"), {
        dataTransfer: transfer(),
      }),
    ).toBe(false);
    // jsdom fires drop regardless; the handler still writes nothing there.
    dropOn("Get the proposal approved");
    expect(ds.updateGoal).not.toHaveBeenCalled();

    await startDrag(grip);
    dropOn("Win an autumn project");
    await waitFor(() => expect(ds.updateGoal).toHaveBeenCalledTimes(1));
    expect(ds.updateGoal).toHaveBeenCalledWith("w2", { parentGoalId: "m1" });
    expect(document.querySelector("[data-drop-target]")).toBeNull();
  });

  it("re-parents a week straight onto a year (#2399)", async () => {
    const ds = makeDS();
    await renderTab(ds);
    await startDrag(screen.getByRole("button", { name: "Collapse: Run 3 times" }));
    dropOn("Run 10 km in 60 min");
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w2", { parentGoalId: "y1" }),
    );
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

describe("Deleting a goal and choosing what goes with it (#2405)", () => {
  const openDelete = (title: string) => {
    fireEvent.click(
      screen.getByRole("button", { name: `Delete goal: ${title}` }),
    );
    return within(screen.getByRole("dialog"));
  };
  const confirm = (dialog: ReturnType<typeof within>) =>
    fireEvent.click(dialog.getByRole("button", { name: "Delete goal" }));
  /** The order the service heard about them in. */
  const order = (fn: unknown, call = 0): number =>
    vi.mocked(fn as () => unknown).mock.invocationCallOrder[call] ?? Infinity;

  /** A service that remembers, so the re-read shows where things went. */
  function makeLiveDS() {
    let goals = [...GOALS];
    let links = [...LINKS];
    let todos = [...TODOS];
    return makeDS({
      fetchGoals: vi.fn(async () => goals),
      fetchTodoTree: vi.fn(async () => todos),
      fetchGoalTodoLinks: vi.fn(async () => links),
      updateGoal: vi.fn(async (id: string, updates: Partial<Goal>) => {
        goals = goals.map((g) => (g.id === id ? { ...g, ...updates } : g));
      }),
      unlinkGoalTodo: vi.fn(async (goalId: string, todoId: string) => {
        links = links.filter(
          (l) => !(l.goalId === goalId && l.todoId === todoId),
        );
      }),
      softDeleteTodo: vi.fn(async (id: string) => {
        todos = todos.filter((t) => t.id !== id);
      }),
      softDeleteGoal: vi.fn(async (id: string) => {
        goals = goals.filter((g) => g.id !== id);
      }),
    });
  }

  it("lists the subtree ticked, past periods included, and confirming takes it all", async () => {
    const ds = makeDS();
    await renderTab(ds);
    const dialog = openDelete("Win an autumn project");

    // The goal asked about has no box; the rest all start ticked.
    expect(
      dialog.queryByRole("checkbox", { name: /Win an autumn project/ }),
    ).toBeNull();
    const boxes = dialog.getAllByRole("checkbox");
    expect(boxes).toHaveLength(8);
    for (const item of boxes) {
      expect(item.getAttribute("aria-checked")).toBe("true");
    }
    // Last week's goal is not on the tree, but it is under this month's.
    dialog.getByRole("checkbox", { name: "Week: Decide the room layout" });
    dialog.getByRole("checkbox", { name: "Todo: Pick the curtains" });

    confirm(dialog);
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledTimes(3));
    expect(vi.mocked(ds.softDeleteGoal).mock.calls.map(([id]) => id)).toEqual([
      "pw1",
      "w1",
      "m1",
    ]);
    expect(
      vi.mocked(ds.softDeleteTodo).mock.calls.map(([id]) => id).sort(),
    ).toEqual(["p1", "p2", "t1", "t2", "t3", "t4"]);
    expect(ds.updateGoal).not.toHaveBeenCalled();
    expect(ds.unlinkGoalTodo).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("leaves unticked items in place: detached and unlinked first, deleted last", async () => {
    const ds = makeDS();
    await renderTab(ds);
    const dialog = openDelete("Win an autumn project");
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Week: Get the proposal approved" }),
    );
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Todo: Pick the curtains" }),
    );
    confirm(dialog);

    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledTimes(2));
    // The kept week loses its parent, the month that is going.
    expect(ds.updateGoal).toHaveBeenCalledTimes(1);
    expect(ds.updateGoal).toHaveBeenCalledWith("w1", { parentGoalId: null });
    // The kept todo loses the goal that is going, and that link only.
    expect(ds.unlinkGoalTodo).toHaveBeenCalledTimes(1);
    expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("pw1", "p2");
    // Each box is its own: the kept week's todos stayed ticked, so they go.
    expect(
      vi.mocked(ds.softDeleteTodo).mock.calls.map(([id]) => id).sort(),
    ).toEqual(["p1", "t1", "t2", "t3", "t4"]);
    expect(vi.mocked(ds.softDeleteGoal).mock.calls.map(([id]) => id)).toEqual([
      "pw1",
      "m1",
    ]);

    expect(order(ds.updateGoal)).toBeLessThan(order(ds.unlinkGoalTodo));
    expect(order(ds.unlinkGoalTodo)).toBeLessThan(order(ds.softDeleteTodo));
    expect(order(ds.softDeleteTodo, 4)).toBeLessThan(order(ds.softDeleteGoal));
  });

  it("moves a kept goal to Unconnected and a kept todo to the unlinked list", async () => {
    await renderTab(makeLiveDS());
    const dialog = openDelete("Win an autumn project");
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Week: Get the proposal approved" }),
    );
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Todo: Pick the curtains" }),
    );
    confirm(dialog);

    await waitFor(() =>
      within(screen.getByRole("region", { name: "Unconnected goals" })).getByRole(
        "button",
        { name: "Week: Get the proposal approved — Unconnected" },
      ),
    );
    expect(
      screen.queryByRole("button", { name: /Win an autumn project/ }),
    ).toBeNull();
    within(
      screen.getByRole("region", { name: "Todos not linked to a goal" }),
    ).getByRole("button", { name: "Edit: Pick the curtains" });
  });

  it("keeps a kept goal's own kept todos on it", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    const dialog = openDelete("Run 10 km in 60 min");
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Week: Run 3 times" }),
    );
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Todo: Interval run" }),
    );
    confirm(dialog);

    await waitFor(() =>
      expect(ds.softDeleteGoal).toHaveBeenCalledWith("y1"),
    );
    expect(ds.updateGoal).toHaveBeenCalledWith("w2", { parentGoalId: null });
    // The link to a goal that stays is not touched.
    expect(ds.unlinkGoalTodo).not.toHaveBeenCalled();
    // Still connected, so it stands on the tree by itself, not under Unconnected.
    await waitFor(() =>
      within(
        screen.getByRole("list", { name: "Run 3 times" }),
      ).getByRole("button", { name: "Edit: Interval run" }),
    );
    expect(
      within(screen.getByRole("region", { name: "Unconnected goals" })).queryByRole(
        "button",
        { name: /Run 3 times/ },
      ),
    ).toBeNull();
  });

  it("notes a todo another goal holds, and still deletes it when left ticked", async () => {
    const ds = makeDS({
      fetchGoalTodoLinks: vi
        .fn()
        .mockResolvedValue([...LINKS, link("w3", "t6")]),
    });
    await renderTab(ds);
    const dialog = openDelete("Run 3 times");
    dialog.getByRole("checkbox", {
      name: "Todo: Interval run — Also linked to another goal",
    });
    dialog.getByText("Also linked to another goal");
    // One note, on the one todo with a second goal.
    dialog.getByRole("checkbox", { name: "Todo: Long run" });

    confirm(dialog);
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w2"));
    expect(ds.softDeleteTodo).toHaveBeenCalledWith("t6");
    expect(ds.unlinkGoalTodo).not.toHaveBeenCalled();
  });

  it("takes a kept todo off the goal that goes and leaves its other goal", async () => {
    const ds = makeDS({
      fetchGoalTodoLinks: vi
        .fn()
        .mockResolvedValue([...LINKS, link("w3", "t6")]),
    });
    await renderTab(ds);
    const dialog = openDelete("Run 3 times");
    fireEvent.click(dialog.getByRole("checkbox", { name: /Interval run/ }));
    confirm(dialog);
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w2"));
    expect(ds.unlinkGoalTodo).toHaveBeenCalledTimes(1);
    expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("w2", "t6");
    expect(ds.softDeleteTodo).not.toHaveBeenCalledWith("t6");
  });

  it("takes nested todos with a ticked row, as the todo list's own delete does", async () => {
    const ds = makeDS({
      fetchTodoTree: vi.fn().mockResolvedValue([
        ...TODOS,
        { ...todo("t6a", "Warm up"), parentId: "t6" },
      ]),
    });
    await renderTab(ds);
    const dialog = openDelete("Run 3 times");
    dialog.getByRole("checkbox", {
      name: "Todo: Interval run — 1 todo under this one is deleted with it",
    });
    confirm(dialog);
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w2"));
    expect(ds.softDeleteTodo).toHaveBeenCalledWith("t6a");
  });

  it("asks plainly about a goal with nothing under it, and deletes it", async () => {
    const ds = makeDS();
    await renderTab(ds);
    const dialog = openDelete("Finish one book");
    expect(dialog.queryAllByRole("checkbox")).toHaveLength(0);
    screen.getByRole("dialog", {
      name: 'Delete the goal "Finish one book"? It goes to the trash.',
    });
    confirm(dialog);
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w3"));
    expect(ds.softDeleteGoal).toHaveBeenCalledTimes(1);
    expect(ds.softDeleteTodo).not.toHaveBeenCalled();
  });

  it("writes nothing when cancelled", async () => {
    const ds = makeDS();
    await renderTab(ds);
    const dialog = openDelete("Win an autumn project");
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ds.softDeleteGoal).not.toHaveBeenCalled();
    expect(ds.softDeleteTodo).not.toHaveBeenCalled();
    expect(ds.updateGoal).not.toHaveBeenCalled();
  });

  it("starts ticked again the next time, after a cancel", async () => {
    await renderTab();
    const first = openDelete("Win an autumn project");
    fireEvent.click(first.getByRole("checkbox", { name: "Todo: Book the review" }));
    fireEvent.click(first.getByRole("button", { name: "Cancel" }));
    const second = openDelete("Win an autumn project");
    expect(
      second
        .getByRole("checkbox", { name: "Todo: Book the review" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("lists a done todo too, though the tree draws it under Completed items", async () => {
    await renderTab();
    const dialog = openDelete("Get the proposal approved");
    dialog.getByRole("checkbox", { name: "Todo: Draft the proposal" });
  });

  /** With a toast host, unlike renderTab, for the failure copy. */
  async function renderWithToast(ds: DataService) {
    const { wrapper: SyncWrapper } = createBumpableSync();
    render(
      <SyncWrapper>
        <ToastProvider>
          <RightSidebarProvider>
            <GoalsTodosScreen dataService={ds} onNavigateToItem={vi.fn()} />
          </RightSidebarProvider>
        </ToastProvider>
      </SyncWrapper>,
    );
    await screen.findByRole("region", { name: "Goal tree" });
  }
  const PARTWAY =
    "The delete stopped partway. Check your connection, look at what is left, and try again.";
  const NOTHING_DELETED =
    "Nothing was deleted. Check your connection and try again.";

  it("stops at the first failed write and says so, with the goal still there", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ds = makeDS({
      softDeleteTodo: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error("offline")),
    });
    await renderWithToast(ds);
    const dialog = openDelete("Get the proposal approved");
    confirm(dialog);

    await screen.findByText(PARTWAY);
    expect(screen.queryByText(NOTHING_DELETED)).toBeNull();
    expect(ds.softDeleteTodo).toHaveBeenCalledTimes(2);
    expect(ds.softDeleteGoal).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says nothing was deleted when the very first write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ds = makeDS({
      softDeleteTodo: vi.fn().mockRejectedValue(new Error("offline")),
    });
    await renderWithToast(ds);
    confirm(openDelete("Get the proposal approved"));

    await screen.findByText(NOTHING_DELETED);
    expect(screen.queryByText(PARTWAY)).toBeNull();
    expect(ds.softDeleteTodo).toHaveBeenCalledTimes(1);
    expect(ds.softDeleteGoal).not.toHaveBeenCalled();
  });

  it("still says partway when only a detach landed before the failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ds = makeDS({
      softDeleteTodo: vi.fn().mockRejectedValue(new Error("offline")),
    });
    await renderWithToast(ds);
    const dialog = openDelete("Win an autumn project");
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Week: Get the proposal approved" }),
    );
    confirm(dialog);

    await screen.findByText(PARTWAY);
    expect(ds.updateGoal).toHaveBeenCalledWith("w1", { parentGoalId: null });
    expect(ds.softDeleteGoal).not.toHaveBeenCalled();
  });

  it("holds the dialog open and frozen while the writes run", async () => {
    let finish: () => void = () => undefined;
    const ds = makeDS({
      softDeleteGoal: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    await renderTab(ds);
    const dialog = openDelete("Finish one book");
    confirm(dialog);
    const busy = (await dialog.findByRole("button", {
      name: "Deleting",
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the panel open on a goal that stayed", async () => {
    const { panel } = await renderTab(makeLiveDS());
    fireEvent.click(goalRow("Get the proposal approved"));
    panel().getByRole("textbox", { name: "Goal title" });

    const dialog = openDelete("Win an autumn project");
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Week: Get the proposal approved" }),
    );
    confirm(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      (panel().getByRole("textbox", { name: "Goal title" }) as HTMLInputElement)
        .value,
    ).toBe("Get the proposal approved");
  });

  it("uses the full width on a phone", async () => {
    setNarrow();
    await renderTab();
    openDelete("Win an autumn project");
    expect(screen.getByRole("dialog").className).toContain("max-w-none");
  });
});
