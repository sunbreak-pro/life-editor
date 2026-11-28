import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  RightSidebarProvider,
  ToastProvider,
  UndoRedoProvider,
  useRightSidebarContext,
  useUndoRedoContext,
  type DataService,
  type Goal,
  type GoalTodoLink,
  type TodoNode,
} from "@life-editor/shared";
import en from "../../shared/src/i18n/locales/en.json";
import ja from "../../shared/src/i18n/locales/ja.json";
import { GoalsTodosScreen } from "../src/connect/GoalsTodosScreen";
import { GOALS_UNDO_LABELS, useGoalsUndo } from "../src/connect/useGoalsUndo";
import { UndoRedoHost } from "../src/UndoRedoHost";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * #2880 — every write on Connect's Goals & Todos tab goes on the header's
 * Undo / Redo. Each case does the thing through the screen, undoes it, redoes
 * it, and checks both what the service heard and what the re-read shows.
 *
 * The service here remembers its writes (soft deletes included), so the
 * re-read after an undo shows exactly what the undo put back. Only Date is
 * faked: the fixture's week is 9/27 – 10/3, as in connectGoalsTab.test.tsx.
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
  // Nothing under it and nothing linked: the only goal with a manual mark.
  goal({ id: "w3", title: "Finish one book", sortOrder: 2 }),
];

const todo = (id: string, title: string, done = false): TodoNode => ({
  id,
  type: "task",
  title,
  status: done ? "DONE" : "NOT_STARTED",
  parentId: null,
  order: 0,
  createdAt: "2026-09-27T00:00:00Z",
  updatedAt: "2026-09-27T00:00:00Z",
  ...(done ? { completedAt: "2026-09-28T03:00:00Z" } : {}),
});

const TODOS: TodoNode[] = [
  todo("t1", "Draft the proposal", true),
  todo("t2", "Write the estimate"),
  todo("t5", "5 km jog", true),
  todo("t6", "Interval run"),
  todo("l1", "Pick up the residence certificate"),
];

const link = (goalId: string, todoId: string): GoalTodoLink =>
  ({
    id: `link-${goalId}-${todoId}`,
    goalId,
    todoId,
    isDeleted: false,
  }) as GoalTodoLink;

const LINKS: GoalTodoLink[] = [
  link("w1", "t1"),
  link("w1", "t2"),
  link("w2", "t5"),
  link("w2", "t6"),
];

/** A service that remembers, so every re-read shows where things went. */
function makeLiveDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  let goals = GOALS.map((g) => ({ ...g }));
  let todos = TODOS.map((n) => ({ ...n }));
  let links = LINKS.map((l) => ({ ...l }));
  const setGoal = (id: string, patch: Partial<Goal>): void => {
    goals = goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
  };
  const setTodo = (id: string, patch: Partial<TodoNode>): void => {
    todos = todos.map((n) => (n.id === id ? { ...n, ...patch } : n));
  };
  const liveLink = (goalId: string, todoId: string) =>
    links.find(
      (l) => l.goalId === goalId && l.todoId === todoId && !l.isDeleted,
    );
  return stubDataService({
    fetchGoals: vi.fn(async () => goals.filter((g) => !g.isDeleted)),
    fetchTodoTree: vi.fn(async () => todos.filter((n) => !n.isDeleted)),
    fetchGoalTodoLinks: vi.fn(async (ids: readonly string[]) =>
      links.filter((l) => !l.isDeleted && ids.includes(l.goalId)),
    ),
    createGoal: vi.fn(
      async (input: Partial<Goal> & Pick<Goal, "id" | "title">) => {
        const row = goal(input);
        goals = [...goals, row];
        return row;
      },
    ),
    updateGoal: vi.fn(async (id: string, updates: Partial<Goal>) => {
      setGoal(id, updates);
      return goals.find((g) => g.id === id);
    }),
    softDeleteGoal: vi.fn(async (id: string) =>
      setGoal(id, { isDeleted: true }),
    ),
    restoreGoal: vi.fn(async (id: string) => setGoal(id, { isDeleted: false })),
    createTodo: vi.fn(async (node: TodoNode) => {
      todos = [...todos, { ...node }];
      return node;
    }),
    updateTodo: vi.fn(async (id: string, updates: Partial<TodoNode>) => {
      setTodo(id, updates);
      return todos.find((n) => n.id === id);
    }),
    softDeleteTodo: vi.fn(async (id: string) =>
      setTodo(id, { isDeleted: true }),
    ),
    restoreTodo: vi.fn(async (id: string) => setTodo(id, { isDeleted: false })),
    // Idempotent, as SupabaseGoalsService's is.
    linkGoalTodo: vi.fn(async (goalId: string, todoId: string) => {
      const live = liveLink(goalId, todoId);
      if (live) return live;
      const row = link(goalId, todoId);
      links = [...links, row];
      return row;
    }),
    unlinkGoalTodo: vi.fn(async (goalId: string, todoId: string) => {
      links = links.map((l) =>
        l.goalId === goalId && l.todoId === todoId ? { ...l, isDeleted: true } : l,
      );
    }),
    ...over,
  });
}

/** The shell's right panel, as connectGoalsTab.test.tsx stands it in. */
function PanelWell() {
  const { setPortalTarget } = useRightSidebarContext();
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(ref.current);
    return () => setPortalTarget(null);
  }, [setPortalTarget]);
  return <aside aria-label="Details" ref={ref} />;
}

/** The header's two buttons, and what each would do next. */
function HistoryButtons() {
  const { undo, redo, canUndo, canRedo } = useUndoRedoContext();
  return (
    <>
      <button type="button" onClick={() => undo()}>
        Header undo
      </button>
      <button type="button" onClick={() => redo()}>
        Header redo
      </button>
      <output aria-label="History">
        {`${canUndo() ? "undo" : "-"} ${canRedo() ? "redo" : "-"}`}
      </output>
    </>
  );
}

/** Stands in for Connect being left and come back to (#1727). */
function Section({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShown((s) => !s)}>
        Switch section
      </button>
      {shown && children}
    </>
  );
}

async function renderTab(ds: DataService) {
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <ToastProvider>
      <SyncWrapper>
        <UndoRedoHost>
          <RightSidebarProvider>
            <Section>
              <GoalsTodosScreen dataService={ds} onNavigateToItem={vi.fn()} />
            </Section>
            <PanelWell />
          </RightSidebarProvider>
          <HistoryButtons />
        </UndoRedoHost>
      </SyncWrapper>
    </ToastProvider>,
  );
  await waitFor(() => screen.getByRole("region", { name: "Goal tree" }));
  const panel = () =>
    within(screen.getByRole("complementary", { name: "Details" }));
  return { panel };
}

const history = () => screen.getByLabelText("History").textContent;
const undo = () =>
  fireEvent.click(screen.getByRole("button", { name: "Header undo" }));
const redo = () =>
  fireEvent.click(screen.getByRole("button", { name: "Header redo" }));

/** A goal row by its spoken name, "Week: Run 3 times — 1/3". */
const goalRowName = (title: string) => (name: string) =>
  new RegExp(`^\\w+: ${title} — `).test(name);
const goalRow = (title: string) =>
  screen.getByRole("button", { name: goalRowName(title) });
const queryGoalRow = (title: string) =>
  screen.queryByRole("button", { name: goalRowName(title) });
/** Every row of a goal; a week hung straight on a year can show twice. */
const goalRowCount = (title: string) =>
  screen.queryAllByRole("button", { name: goalRowName(title) }).length;

/** The branch a goal's row heads, holding its child goals and todos. */
const branchOf = (title: string) =>
  within(goalRow(title).closest("li") as HTMLElement);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Goals & Todos tab on the header's Undo / Redo (#2880)", () => {
  it("takes back a new goal and puts it back", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    fireEvent.click(screen.getByRole("button", { name: "Set a goal" }));
    const field = screen.getByRole("textbox", { name: /This week/ });
    fireEvent.change(field, { target: { value: "Sleep by 23:00" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => goalRow("Sleep by 23:00"));
    const id = vi.mocked(ds.createGoal).mock.calls[0]?.[0].id as string;
    expect(history()).toBe("undo -");

    undo();
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith(id));
    await waitFor(() => expect(queryGoalRow("Sleep by 23:00")).toBeNull());
    expect(history()).toBe("- redo");

    redo();
    await waitFor(() => expect(ds.restoreGoal).toHaveBeenCalledWith(id));
    await waitFor(() => goalRow("Sleep by 23:00"));
    expect(history()).toBe("undo -");
  });

  it("takes back a child goal added from a row's +", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    const tree = within(screen.getByRole("region", { name: "Goal tree" }));
    fireEvent.click(
      tree.getByRole("button", { name: "Add under: Run 10 km in 60 min" }),
    );
    fireEvent.click(tree.getByRole("button", { name: "This week's goal" }));
    const field = tree.getByRole("textbox", {
      name: /^Add under: Run 10 km in 60 min/,
    });
    fireEvent.change(field, { target: { value: "Stretch daily" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(goalRowCount("Stretch daily")).toBeGreaterThan(0));
    const id = vi.mocked(ds.createGoal).mock.calls[0]?.[0].id as string;

    undo();
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith(id));
    await waitFor(() => expect(goalRowCount("Stretch daily")).toBe(0));
    redo();
    await waitFor(() => expect(ds.restoreGoal).toHaveBeenCalledWith(id));
    await waitFor(() => expect(goalRowCount("Stretch daily")).toBeGreaterThan(0));
  });

  it("takes back a todo added outside any goal", async () => {
    const ds = makeLiveDS();
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
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => screen.getByRole("button", { name: "Edit: Buy stamps" }));
    const id = vi.mocked(ds.createTodo).mock.calls[0]?.[0].id as string;

    undo();
    await waitFor(() => expect(ds.softDeleteTodo).toHaveBeenCalledWith(id));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Edit: Buy stamps" })).toBeNull(),
    );
    redo();
    await waitFor(() => expect(ds.restoreTodo).toHaveBeenCalledWith(id));
    await waitFor(() => screen.getByRole("button", { name: "Edit: Buy stamps" }));
  });

  it("takes back a todo added under a goal, link and all, in one undo", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    const tree = within(screen.getByRole("region", { name: "Goal tree" }));
    fireEvent.click(
      tree.getByRole("button", { name: "Add under: Get the proposal approved" }),
    );
    const field = tree.getByRole("textbox", {
      name: "Add under: Get the proposal approved — Todo",
    });
    fireEvent.change(field, { target: { value: "Send the draft" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() =>
      branchOf("Get the proposal approved").getByRole("button", {
        name: "Edit: Send the draft",
      }),
    );
    const id = vi.mocked(ds.createTodo).mock.calls[0]?.[0].id as string;

    undo();
    // Backwards: the link comes off before the todo goes.
    await waitFor(() => expect(ds.softDeleteTodo).toHaveBeenCalledWith(id));
    expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("w1", id);
    expect(
      vi.mocked(ds.unlinkGoalTodo).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(ds.softDeleteTodo).mock.invocationCallOrder[0] ?? 0,
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Edit: Send the draft" })).toBeNull(),
    );
    expect(history()).toBe("- redo");

    redo();
    await waitFor(() => expect(ds.restoreTodo).toHaveBeenCalledWith(id));
    // linkGoalTodo: once for the add, once for the redo.
    await waitFor(() => expect(ds.linkGoalTodo).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      branchOf("Get the proposal approved").getByRole("button", {
        name: "Edit: Send the draft",
      }),
    );
  });

  it("takes back a tick, with the stamp it had", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Mark as done: Interval run" }),
    );
    await waitFor(() => expect(history()).toBe("undo -"));
    const patch = vi.mocked(ds.updateTodo).mock.calls[0]?.[1];
    expect(patch).toMatchObject({ status: "DONE" });

    undo();
    await waitFor(() =>
      expect(ds.updateTodo).toHaveBeenLastCalledWith("t6", {
        status: "NOT_STARTED",
        completedAt: undefined,
      }),
    );
    await waitFor(() =>
      screen.getByRole("button", { name: "Mark as done: Interval run" }),
    );

    redo();
    await waitFor(() =>
      expect(ds.updateTodo).toHaveBeenLastCalledWith("t6", patch),
    );
    await waitFor(() =>
      screen.getByRole("button", { name: "Mark as not done: Interval run" }),
    );
  });

  it("puts a done todo's completion time back when its untick is undone", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Mark as not done: 5 km jog" }),
    );
    await waitFor(() => expect(history()).toBe("undo -"));
    undo();
    await waitFor(() =>
      expect(ds.updateTodo).toHaveBeenLastCalledWith("t5", {
        status: "DONE",
        completedAt: "2026-09-28T03:00:00Z",
      }),
    );
    await waitFor(() =>
      screen.getByRole("button", { name: "Mark as not done: 5 km jog" }),
    );
  });

  it("takes back a rename from the tree's pencil", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Edit goal: Get the proposal approved" }),
    );
    const field = within(
      screen.getByRole("region", { name: "Goal tree" }),
    ).getByRole("textbox", { name: "Goal title" });
    fireEvent.change(field, { target: { value: "Get the proposal signed" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => goalRow("Get the proposal signed"));
    await waitFor(() => expect(history()).toBe("undo -"));

    undo();
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenLastCalledWith("w1", {
        title: "Get the proposal approved",
      }),
    );
    await waitFor(() => goalRow("Get the proposal approved"));
    redo();
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenLastCalledWith("w1", {
        title: "Get the proposal signed",
      }),
    );
    await waitFor(() => goalRow("Get the proposal signed"));
  });

  it("takes back the goal above taken off in the panel", async () => {
    const ds = makeLiveDS();
    const { panel } = await renderTab(ds);
    fireEvent.click(goalRow("Get the proposal approved"));
    fireEvent.click(
      panel().getByRole("button", {
        name: "Remove from the goal above: Win an autumn project",
      }),
    );
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenCalledWith("w1", { parentGoalId: null }),
    );
    await waitFor(() => expect(history()).toBe("undo -"));

    undo();
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenLastCalledWith("w1", {
        parentGoalId: "m1",
      }),
    );
    await waitFor(() =>
      branchOf("Win an autumn project").getByRole("button", {
        name: goalRowName("Get the proposal approved"),
      }),
    );
    redo();
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenLastCalledWith("w1", {
        parentGoalId: null,
      }),
    );
  });

  it("takes back the achieved mark, and puts back the same stamp", async () => {
    const ds = makeLiveDS();
    const { panel } = await renderTab(ds);
    fireEvent.click(goalRow("Finish one book"));
    fireEvent.click(panel().getByRole("button", { name: "Mark as achieved" }));
    await waitFor(() => expect(history()).toBe("undo -"));
    const stamp = vi.mocked(ds.updateGoal).mock.calls[0]?.[1];
    expect(stamp?.manualAchievedAt).toEqual(expect.any(String));
    await waitFor(() =>
      panel().getByRole("button", { name: "Remove the achieved mark" }),
    );

    undo();
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenLastCalledWith("w3", {
        manualAchievedAt: null,
      }),
    );
    await waitFor(() =>
      panel().getByRole("button", { name: "Mark as achieved" }),
    );
    redo();
    await waitFor(() =>
      expect(ds.updateGoal).toHaveBeenLastCalledWith("w3", stamp),
    );
    await waitFor(() =>
      panel().getByRole("button", { name: "Remove the achieved mark" }),
    );
  });

  it("takes back the todos linked in the dialog, in one undo", async () => {
    const ds = makeLiveDS();
    const { panel } = await renderTab(ds);
    fireEvent.click(goalRow("Finish one book"));
    fireEvent.click(panel().getByRole("button", { name: "Link todos" }));
    const dialog = within(screen.getByRole("dialog", { name: "Link todos" }));
    fireEvent.click(
      dialog.getByRole("checkbox", { name: /Pick up the residence certificate/ }),
    );
    fireEvent.click(dialog.getByRole("checkbox", { name: /Write the estimate/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Link" }));
    await waitFor(() => expect(ds.linkGoalTodo).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(history()).toBe("undo -"));
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    undo();
    await waitFor(() => expect(ds.unlinkGoalTodo).toHaveBeenCalledTimes(2));
    expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("w3", "l1");
    expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("w3", "t2");
    await waitFor(() =>
      panel().getByRole("heading", { name: "Linked todos 0" }),
    );
    expect(history()).toBe("- redo");

    redo();
    await waitFor(() => expect(ds.linkGoalTodo).toHaveBeenCalledTimes(4));
    await waitFor(() =>
      panel().getByRole("heading", { name: "Linked todos 2" }),
    );
  });

  it("takes back a todo taken off in the dialog", async () => {
    const ds = makeLiveDS();
    const { panel } = await renderTab(ds);
    fireEvent.click(goalRow("Run 3 times"));
    fireEvent.click(panel().getByRole("button", { name: "Link todos" }));
    const dialog = within(screen.getByRole("dialog", { name: "Link todos" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: /Interval run/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Link" }));
    await waitFor(() =>
      expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("w2", "t6"),
    );
    await waitFor(() => expect(history()).toBe("undo -"));

    undo();
    await waitFor(() =>
      expect(ds.linkGoalTodo).toHaveBeenCalledWith("w2", "t6"),
    );
    redo();
    await waitFor(() => expect(ds.unlinkGoalTodo).toHaveBeenCalledTimes(2));
  });

  it("deletes a goal with what goes along, and one undo brings all of it back", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete goal: Win an autumn project" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(
      dialog.getByRole("button", { name: /^Delete \(\d+ items?\)$/ }),
    );
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(queryGoalRow("Win an autumn project")).toBeNull());
    expect(history()).toBe("undo -");

    undo();
    await waitFor(() => expect(ds.restoreGoal).toHaveBeenCalledTimes(2));
    expect(
      vi.mocked(ds.restoreTodo).mock.calls.map(([id]) => id).sort(),
    ).toEqual(["t1", "t2"]);
    // Backwards: the goal asked about went last, so it comes back first.
    expect(vi.mocked(ds.restoreGoal).mock.calls.map(([id]) => id)).toEqual([
      "m1",
      "w1",
    ]);
    await waitFor(() =>
      branchOf("Win an autumn project").getByRole("button", {
        name: goalRowName("Get the proposal approved"),
      }),
    );
    expect(history()).toBe("- redo");

    redo();
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(queryGoalRow("Win an autumn project")).toBeNull());
  });

  it("hangs a kept goal under its parent again when a delete is undone", async () => {
    const live = makeLiveDS();
    await renderTab(live);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete goal: Win an autumn project" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(
      dialog.getByRole("checkbox", { name: "Week: Get the proposal approved" }),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: /^Delete \(\d+ items?\)$/ }),
    );
    await waitFor(() =>
      expect(live.softDeleteGoal).toHaveBeenCalledWith("m1"),
    );
    expect(live.updateGoal).toHaveBeenCalledWith("w1", { parentGoalId: null });

    undo();
    await waitFor(() =>
      expect(live.updateGoal).toHaveBeenLastCalledWith("w1", {
        parentGoalId: "m1",
      }),
    );
    // The month is back before the week is hung under it again.
    expect(
      vi.mocked(live.restoreGoal).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(live.updateGoal).mock.invocationCallOrder[1] ?? 0);
    await waitFor(() =>
      branchOf("Win an autumn project").getByRole("button", {
        name: goalRowName("Get the proposal approved"),
      }),
    );
  });

  it("takes back a todo's delete, children and all, parents first", async () => {
    let todos: TodoNode[] = [
      ...TODOS,
      { ...todo("c1", "Warm up"), parentId: "t6" },
    ];
    const live = makeLiveDS({
      fetchTodoTree: vi.fn(async () => todos.filter((n) => !n.isDeleted)),
      softDeleteTodo: vi.fn(async (id: string) => {
        todos = todos.map((n) => (n.id === id ? { ...n, isDeleted: true } : n));
      }),
      restoreTodo: vi.fn(async (id: string) => {
        todos = todos.map((n) =>
          n.id === id ? { ...n, isDeleted: false } : n,
        );
      }),
    });
    await renderTab(live);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete todo: Interval run" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Delete todo" }));
    await waitFor(() => expect(live.softDeleteTodo).toHaveBeenCalledTimes(2));
    expect(vi.mocked(live.softDeleteTodo).mock.calls.map(([id]) => id)).toEqual(
      ["c1", "t6"],
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Edit: Interval run" }),
      ).toBeNull(),
    );

    undo();
    await waitFor(() => expect(live.restoreTodo).toHaveBeenCalledTimes(2));
    expect(vi.mocked(live.restoreTodo).mock.calls.map(([id]) => id)).toEqual([
      "t6",
      "c1",
    ]);
    await waitFor(() =>
      screen.getByRole("button", { name: "Edit: Interval run" }),
    );
    redo();
    await waitFor(() => expect(live.softDeleteTodo).toHaveBeenCalledTimes(4));
  });

  describe("drag (wide only)", () => {
    /** jsdom has no DataTransfer; the tree only writes to it. */
    const transfer = () => ({
      setData: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    });
    const rowOf = (title: string) =>
      goalRow(title).parentElement as HTMLElement;
    const handle = (attr: "goal" | "todo", id: string) =>
      document.querySelector(`[data-${attr}-drag="${id}"]`) as HTMLElement;
    async function drag(el: HTMLElement, onto: string) {
      fireEvent.dragStart(el, { dataTransfer: transfer() });
      await waitFor(() =>
        expect(document.querySelector("[data-drop-target]")).not.toBeNull(),
      );
      const row = rowOf(onto);
      fireEvent.dragOver(row, { dataTransfer: transfer() });
      fireEvent.drop(row, { dataTransfer: transfer() });
    }

    it("takes back a goal moved under another", async () => {
      const ds = makeLiveDS();
      await renderTab(ds);
      await drag(
        screen.getByRole("button", { name: "Collapse: Run 3 times" }),
        "Win an autumn project",
      );
      await waitFor(() =>
        expect(ds.updateGoal).toHaveBeenCalledWith("w2", {
          parentGoalId: "m1",
        }),
      );
      await waitFor(() => expect(history()).toBe("undo -"));

      undo();
      await waitFor(() =>
        expect(ds.updateGoal).toHaveBeenLastCalledWith("w2", {
          parentGoalId: "m2",
        }),
      );
      await waitFor(() =>
        branchOf("Run three times a week").getByRole("button", {
          name: goalRowName("Run 3 times"),
        }),
      );
      redo();
      await waitFor(() =>
        expect(ds.updateGoal).toHaveBeenLastCalledWith("w2", {
          parentGoalId: "m1",
        }),
      );
      await waitFor(() =>
        branchOf("Win an autumn project").getByRole("button", {
          name: goalRowName("Run 3 times"),
        }),
      );
    });

    it("takes back a todo moved between goals, both links in one undo", async () => {
      const ds = makeLiveDS();
      await renderTab(ds);
      await drag(handle("todo", "t6"), "Get the proposal approved");
      await waitFor(() =>
        expect(ds.linkGoalTodo).toHaveBeenCalledWith("w1", "t6"),
      );
      await waitFor(() => expect(history()).toBe("undo -"));
      await waitFor(() =>
        branchOf("Get the proposal approved").getByRole("button", {
          name: "Edit: Interval run",
        }),
      );

      undo();
      // Backwards: off the goal it landed on, then back onto the one it left.
      await waitFor(() =>
        expect(ds.unlinkGoalTodo).toHaveBeenLastCalledWith("w1", "t6"),
      );
      await waitFor(() =>
        expect(ds.linkGoalTodo).toHaveBeenLastCalledWith("w2", "t6"),
      );
      await waitFor(() =>
        branchOf("Run 3 times").getByRole("button", {
          name: "Edit: Interval run",
        }),
      );
      expect(
        branchOf("Get the proposal approved").queryByRole("button", {
          name: "Edit: Interval run",
        }),
      ).toBeNull();

      redo();
      await waitFor(() =>
        expect(ds.linkGoalTodo).toHaveBeenLastCalledWith("w1", "t6"),
      );
      expect(ds.unlinkGoalTodo).toHaveBeenLastCalledWith("w2", "t6");
    });

    it("takes back only the link a loose todo's drag made", async () => {
      const ds = makeLiveDS();
      await renderTab(ds);
      // l1 is under no goal: the move is a plain link, with nothing to unlink.
      await drag(handle("todo", "l1"), "Finish one book");
      await waitFor(() =>
        expect(ds.linkGoalTodo).toHaveBeenCalledWith("w3", "l1"),
      );
      await waitFor(() => expect(history()).toBe("undo -"));
      undo();
      await waitFor(() =>
        expect(ds.unlinkGoalTodo).toHaveBeenCalledWith("w3", "l1"),
      );
      expect(ds.unlinkGoalTodo).toHaveBeenCalledTimes(1);
      expect(ds.linkGoalTodo).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps what this tab pushed after Connect is left and come back to (#1727)", async () => {
    const ds = makeLiveDS();
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Mark as done: Interval run" }),
    );
    await waitFor(() => expect(history()).toBe("undo -"));

    fireEvent.click(screen.getByRole("button", { name: "Switch section" }));
    expect(screen.queryByRole("region", { name: "Goal tree" })).toBeNull();
    expect(history()).toBe("undo -");

    // Undone from another section: the command names its row, so it still
    // writes the right one, and the tab shows it when it comes back.
    undo();
    await waitFor(() =>
      expect(ds.updateTodo).toHaveBeenLastCalledWith(
        "t6",
        expect.objectContaining({ status: "NOT_STARTED" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch section" }));
    await waitFor(() =>
      screen.getByRole("button", { name: "Mark as done: Interval run" }),
    );
    expect(history()).toBe("- redo");
  });

  it("says an undo failed and leaves the command where it was", async () => {
    const ds = makeLiveDS({
      restoreTodo: vi.fn().mockRejectedValue(new Error("offline")),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete todo: Write the estimate" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete todo",
      }),
    );
    await waitFor(() => expect(history()).toBe("undo -"));
    const reads = vi.mocked(ds.fetchGoals).mock.calls.length;

    undo();
    await waitFor(() => screen.getByText("Couldn't undo: todo deletion"));
    expect(screen.queryByText("Undid: todo deletion")).toBeNull();
    // Not moved to redo (#1668), and the tab re-read either way.
    expect(history()).toBe("undo -");
    await waitFor(() =>
      expect(vi.mocked(ds.fetchGoals).mock.calls.length).toBeGreaterThan(reads),
    );
  });

  it("pushes nothing for a write that did not land", async () => {
    const ds = makeLiveDS({
      createGoal: vi.fn().mockRejectedValue(new Error("offline")),
      linkGoalTodo: vi.fn().mockRejectedValue(new Error("offline")),
      softDeleteTodo: vi.fn().mockRejectedValue(new Error("offline")),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { panel } = await renderTab(ds);

    fireEvent.click(screen.getByRole("button", { name: "Set a goal" }));
    const field = screen.getByRole("textbox", { name: /This week/ });
    fireEvent.change(field, { target: { value: "Sleep by 23:00" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(ds.createGoal).toHaveBeenCalledTimes(1));

    fireEvent.click(goalRow("Finish one book"));
    fireEvent.click(panel().getByRole("button", { name: "Link todos" }));
    const dialog = within(screen.getByRole("dialog", { name: "Link todos" }));
    fireEvent.click(
      dialog.getByRole("checkbox", { name: /Pick up the residence certificate/ }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Link" }));
    await waitFor(() => dialog.getByRole("alert"));

    expect(history()).toBe("- -");
  });

  it("puts a delete stopped part-way on the history, as far as it got", async () => {
    let failOn = "w1";
    const ds = makeLiveDS();
    const softDeleteGoal = ds.softDeleteGoal;
    Object.assign(ds, {
      softDeleteGoal: vi.fn(async (id: string) => {
        if (id === failOn) throw new Error("offline");
        return softDeleteGoal(id);
      }),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderTab(ds);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete goal: Win an autumn project" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /^Delete \(\d+ items?\)$/,
      }),
    );
    await waitFor(() => expect(ds.softDeleteGoal).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(history()).toBe("undo -"));
    failOn = "";

    undo();
    // Only the two todos landed before the failure, so only they come back.
    await waitFor(() => expect(ds.restoreTodo).toHaveBeenCalledTimes(2));
    expect(ds.restoreGoal).not.toHaveBeenCalled();
  });
});

describe("useGoalsUndo (#2880)", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UndoRedoProvider>{children}</UndoRedoProvider>
  );

  function setup() {
    const onSettled = vi.fn();
    const { result } = renderHook(
      () => ({ goals: useGoalsUndo(onSettled), history: useUndoRedoContext() }),
      { wrapper },
    );
    return { result, onSettled };
  }

  it("pushes nothing when nothing changed", () => {
    const { result } = setup();
    act(() => result.current.goals.record("renameGoal", []));
    expect(result.current.history.canUndo()).toBe(false);
  });

  it("runs one command's steps backwards on undo and forwards on redo, then settles", async () => {
    const { result, onSettled } = setup();
    const calls: string[] = [];
    const step = (name: string) => ({
      undo: async () => void calls.push(`undo ${name}`),
      redo: async () => void calls.push(`redo ${name}`),
    });
    act(() => result.current.goals.record("deleteGoal", [step("a"), step("b")]));
    expect(result.current.history.canUndo()).toBe(true);

    await act(async () => result.current.history.undo());
    await waitFor(() => expect(calls).toEqual(["undo b", "undo a"]));
    expect(onSettled).toHaveBeenCalledTimes(1);

    await act(async () => result.current.history.redo());
    await waitFor(() =>
      expect(calls).toEqual(["undo b", "undo a", "redo a", "redo b"]),
    );
    expect(onSettled).toHaveBeenCalledTimes(2);
  });

  it("settles and keeps the command on undo when a step throws", async () => {
    const { result, onSettled } = setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    act(() =>
      result.current.goals.record("renameGoal", [
        {
          undo: () => Promise.reject(new Error("offline")),
          redo: () => Promise.resolve(),
        },
      ]),
    );
    await act(async () => result.current.history.undo());
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
    expect(result.current.history.canUndo()).toBe(true);
    expect(result.current.history.canRedo()).toBe(false);
  });
});

describe("GOALS_UNDO_LABELS in the catalogs (#2880)", () => {
  // The host falls back to the raw key, so a missing label would show
  // "Undid: createGoal" instead of failing anywhere else.
  const catalogs: ReadonlyArray<[string, Record<string, unknown>]> = [
    ["en", en.undoRedo.labels],
    ["ja", ja.undoRedo.labels],
  ];

  it.each(catalogs)(
    "names every label in the %s catalog",
    (_locale, labels) => {
      for (const label of GOALS_UNDO_LABELS) {
        const text = labels[label];
        expect(typeof text, label).toBe("string");
        expect((text as string).trim(), label).not.toBe("");
      }
    },
  );
});
