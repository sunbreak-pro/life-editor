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
  RightSidebarProvider,
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

async function renderTab(
  ds: DataService = makeDS(),
  ready: string | (() => unknown) = "Goal tree",
) {
  const onNavigateToItem = vi.fn();
  const { wrapper: SyncWrapper, sync } = createBumpableSync();
  render(
    <SyncWrapper>
      <RightSidebarProvider>
        <GoalsTodosScreen
          dataService={ds}
          onNavigateToItem={onNavigateToItem}
        />
        <PanelWell />
      </RightSidebarProvider>
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
    ).getByRole("button", { name: "Open in Schedule: Write the estimate" });
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
      name: "Open in Schedule: Pick up the residence certificate",
    });
    // Completed this week: listed with the done style (brief §11's sample).
    expect(loose.getByText("Submit expenses").className).toContain(
      "line-through",
    );
    loose.getByRole("checkbox", { name: "Submit expenses — Status: Done" });
    // Completed long ago: not listed.
    expect(loose.queryByText("Renew the passport")).toBeNull();
    // Held only by last week's (undrawn) goal: listed here rather than lost.
    loose.getByRole("button", { name: "Open in Schedule: Pick the curtains" });
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

    panel().getByRole("button", { name: "Open in Schedule: Book the review" });

    fireEvent.click(panel().getByRole("button", { name: "Delete goal" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete goal",
      }),
    );
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w1"));
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

  it("sends a todo row to Schedule", async () => {
    const { onNavigateToItem } = await renderTab();
    fireEvent.click(
      screen.getByRole("button", { name: "Open in Schedule: Long run" }),
    );
    expect(onNavigateToItem).toHaveBeenCalledWith({ id: "t7", role: "task" });
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
