import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  ToastProvider,
  WEEK_STARTS_ON,
  addDaysKey,
  goalPeriodKeys,
  localDateTimeToISO,
  todayDateKey,
  type DataService,
  type Goal,
  type GoalPeriodKind,
  type GoalTodoLink,
  type SyncDomain,
  type TodoNode,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { makeTodo, stubDataService } from "./helpers";
import { briefingReads, mockOf } from "./helpers/briefingHarness";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * #2106 — the morning paper's goals, through the real host: the goals block
 * reads goal rows (not the old note fields), a todo row names the goals it
 * serves, this week's goal is made from the paper, and the period-end review
 * asks about last period's unanswered goals one at a time.
 *
 * The writes are asserted at the DataService, which is where a real failure
 * would come from; the review's answers carry `periodEndDecision` only — the
 * mapper stamps `decided_at` (goalMapper.goalUpdatesToPatches).
 */

const TODAY = todayDateKey();
const KEYS = goalPeriodKeys(TODAY, WEEK_STARTS_ON);
const LAST_WEEK = addDaysKey(KEYS.week, -7);

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

function goal(
  id: string,
  title: string,
  periodKey: string = KEYS.week,
  over: Partial<Goal> = {},
): Goal {
  const periodKind: GoalPeriodKind = over.periodKind ?? "week";
  return {
    id,
    title,
    periodKind,
    periodKey,
    sortOrder: 0,
    parentGoalId: null,
    manualAchievedAt: null,
    periodEndDecision: null,
    decidedAt: null,
    carriedFromGoalId: null,
    legacyKey: null,
    isDeleted: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

const linkRow = (goalId: string, todoId: string): GoalTodoLink => ({
  id: `${goalId}:${todoId}`,
  goalId,
  todoId,
  isDeleted: false,
});

const TODOS: TodoNode[] = [
  makeTodo({
    id: "task-a",
    title: "資料を作る",
    status: "NOT_STARTED",
    scheduledAt: localDateTimeToISO(TODAY, "09:00"),
  }),
  makeTodo({
    id: "task-b",
    title: "先方に送る",
    status: "DONE",
    order: 1,
  }),
];

function makeDS(
  seed: {
    goals?: Goal[];
    links?: GoalTodoLink[];
    daily?: string | null;
  } = {},
  overrides: Partial<DataService> = {},
): DataService {
  let goals = [...(seed.goals ?? [])];
  return stubDataService({
    ...briefingReads({ todos: TODOS, dailyContent: seed.daily ?? null }),
    getNoteUnified: vi.fn().mockResolvedValue(null),
    fetchGoals: vi.fn(async () => goals),
    fetchGoalTodoLinks: vi.fn(async () => seed.links ?? []),
    createGoal: vi.fn(
      async (input: Parameters<DataService["createGoal"]>[0]) => {
        const created = goal(input.id, input.title, input.periodKey, {
          periodKind: input.periodKind,
          sortOrder: input.sortOrder ?? 0,
          carriedFromGoalId: input.carriedFromGoalId ?? null,
        });
        goals = [...goals, created];
        return created;
      },
    ),
    updateGoal: vi.fn(
      async (id: string, updates: Parameters<DataService["updateGoal"]>[1]) => {
        goals = goals.map((g) => (g.id === id ? { ...g, ...updates } : g));
        return goals.find((g) => g.id === id)!;
      },
    ),
    softDeleteGoal: vi.fn(async (id: string) => {
      goals = goals.map((g) => (g.id === id ? { ...g, isDeleted: true } : g));
    }),
    linkGoalTodo: vi.fn(async (goalId: string, todoId: string) =>
      linkRow(goalId, todoId),
    ),
    unlinkGoalTodo: vi.fn(async () => undefined),
    ...overrides,
  });
}

function paper(ds: DataService, onOpenGoals?: () => void) {
  return (
    <ToastProvider>
      <SyncContext.Provider value={syncValue}>
        <BriefingScreen
          dataService={ds}
          onNavigate={vi.fn()}
          onOpenGoals={onOpenGoals}
          tab="morning"
          key={TODAY}
        />
      </SyncContext.Provider>
    </ToastProvider>
  );
}

const reviewCard = () =>
  screen.queryByText("GOALS FROM AN ENDED PERIOD")?.closest("section") ?? null;

describe("Morning paper goals (#2106)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it("shows this week's goals with progress, and marks the todo rows", async () => {
    const ds = makeDS({
      goals: [goal("w-plan", "企画書を通す")],
      links: [linkRow("w-plan", "task-a"), linkRow("w-plan", "task-b")],
    });
    render(paper(ds));

    const bar = await screen.findByRole("progressbar", {
      name: "企画書を通す",
    });
    expect(bar.getAttribute("aria-valuetext")).toBe("1/2");
    expect(screen.getByText("GOALS AHEAD")).toBeTruthy();

    const mark = screen.getByText("Goals:").closest("p")!;
    expect(mark.textContent).toContain("企画書を通す");
    expect(
      within(screen.getByText("資料を作る").closest("li")!).getByText("Goals:"),
    ).toBeTruthy();
  });

  it("asks for this week's goals when there are none", async () => {
    render(paper(makeDS()));
    expect(await screen.findByText("Set this week's goals")).toBeTruthy();
  });

  it("makes this week's goal in this week, after the ones there, and re-reads", async () => {
    const ds = makeDS({ goals: [goal("w-1", "一つ目")] });
    render(paper(ds));
    const field = await screen.findByRole("textbox", { name: "Set a goal" });
    const reads = mockOf(ds, "fetchGoals").mock.calls.length;

    fireEvent.change(field, { target: { value: "二つ目" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect(mockOf(ds, "createGoal")).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "二つ目",
          periodKind: "week",
          periodKey: KEYS.week,
          sortOrder: 1,
        }),
      ),
    );
    await waitFor(() =>
      expect(mockOf(ds, "fetchGoals").mock.calls.length).toBeGreaterThan(reads),
    );
  });

  it("opens Connect's goals tab from the block when the host can", async () => {
    const onOpenGoals = vi.fn();
    render(paper(makeDS(), onOpenGoals));
    fireEvent.click(
      await screen.findByRole("button", { name: "Open in Goals & Todos" }),
    );
    expect(onOpenGoals).toHaveBeenCalledTimes(1);
  });

  describe("period-end review (P1 / P2)", () => {
    it("drops a goal and moves on", async () => {
      const ds = makeDS({ goals: [goal("w-old", "模様替え", LAST_WEEK)] });
      render(paper(ds));
      await screen.findByText("模様替え");
      expect(reviewCard()).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Drop it" }));

      await waitFor(() =>
        expect(mockOf(ds, "updateGoal")).toHaveBeenCalledWith("w-old", {
          periodEndDecision: "dropped",
        }),
      );
      await waitFor(() => expect(reviewCard()).toBeNull());
    });

    it("carries a goal: the copy first, then the decision", async () => {
      const ds = makeDS({ goals: [goal("w-old", "模様替え", LAST_WEEK)] });
      render(paper(ds));
      fireEvent.click(
        await screen.findByRole("button", { name: "Carry over" }),
      );

      await waitFor(() =>
        expect(mockOf(ds, "updateGoal")).toHaveBeenCalledWith("w-old", {
          periodEndDecision: "carried",
        }),
      );
      const create = mockOf(ds, "createGoal");
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "模様替え",
          periodKind: "week",
          periodKey: KEYS.week,
          carriedFromGoalId: "w-old",
        }),
      );
      expect(create.mock.invocationCallOrder[0]).toBeLessThan(
        mockOf(ds, "updateGoal").mock.invocationCallOrder[0]!,
      );
    });

    it("re-uses a copy carried earlier instead of making another", async () => {
      const ds = makeDS({
        goals: [
          goal("w-old", "模様替え", LAST_WEEK),
          goal("w-copy", "模様替え", KEYS.week, { carriedFromGoalId: "w-old" }),
        ],
      });
      render(paper(ds));
      fireEvent.click(
        await screen.findByRole("button", { name: "Carry over" }),
      );

      await waitFor(() =>
        expect(mockOf(ds, "updateGoal")).toHaveBeenCalledWith("w-old", {
          periodEndDecision: "carried",
        }),
      );
      expect(mockOf(ds, "createGoal")).not.toHaveBeenCalled();
    });

    it("cannot carry into a full week", async () => {
      const ds = makeDS({
        goals: [
          goal("w-old", "模様替え", LAST_WEEK),
          goal("w-1", "一", KEYS.week),
          goal("w-2", "二", KEYS.week),
          goal("w-3", "三", KEYS.week),
        ],
      });
      render(paper(ds));
      const carry = await screen.findByRole("button", { name: "Carry over" });
      expect((carry as HTMLButtonElement).disabled).toBe(true);
    });

    // Review fix: the copy a「持ち越す」makes is patched in before the next
    // card shows, so that card counts it even when the re-read never lands.
    it("counts a goal just carried: the next card cannot overfill the week", async () => {
      const seed = [
        goal("w-old1", "模様替え", LAST_WEEK),
        goal("w-old2", "本を読む", LAST_WEEK, { sortOrder: 1 }),
        goal("w-1", "一", KEYS.week),
        goal("w-2", "二", KEYS.week, { sortOrder: 1 }),
      ];
      let readsFail = false;
      const ds = makeDS(
        { goals: seed },
        {
          fetchGoals: vi.fn(async () => {
            if (readsFail) throw new Error("network down");
            return seed;
          }),
        },
      );
      render(paper(ds));
      const carry = await screen.findByRole("button", { name: "Carry over" });
      readsFail = true;
      fireEvent.click(carry);

      await screen.findByText("本を読む");
      await waitFor(() =>
        expect(
          (
            screen.getByRole("button", {
              name: "Carry over",
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(true),
      );
      expect(
        screen
          .getByRole("button", { name: "Carry over" })
          .getAttribute("aria-describedby"),
      ).not.toBeNull();
      expect(mockOf(ds, "createGoal")).toHaveBeenCalledTimes(1);
    });

    // Review fix: the snapshot counts a new goal only once its create lands,
    // so an add still in flight and a「持ち越す」would both see room. One
    // goal write at a time: the review waits for the add, then counts it.
    it("holds the review while an add is out, then counts the added goal", async () => {
      let landCreate: () => void = () => {};
      const ds = makeDS({
        goals: [
          goal("w-old", "模様替え", LAST_WEEK),
          goal("w-1", "一", KEYS.week),
          goal("w-2", "二", KEYS.week, { sortOrder: 1 }),
        ],
      });
      const create = mockOf(ds, "createGoal");
      const realCreate =
        create.getMockImplementation() as DataService["createGoal"];
      create.mockImplementationOnce(
        (input: Parameters<DataService["createGoal"]>[0]) =>
          new Promise<Goal>((resolve) => {
            landCreate = () => void realCreate(input).then(resolve);
          }),
      );
      render(paper(ds));
      const field = await screen.findByRole("textbox", { name: "Set a goal" });
      fireEvent.change(field, { target: { value: "三" } });
      fireEvent.keyDown(field, { key: "Enter" });

      const carry = () =>
        screen.getByRole("button", { name: "Carry over" }) as HTMLButtonElement;
      await waitFor(() => expect(carry().disabled).toBe(true));
      fireEvent.click(carry());
      expect(create).toHaveBeenCalledTimes(1);

      landCreate();
      // The week is full now: carrying stays off for want of room.
      await waitFor(() =>
        expect(carry().getAttribute("aria-describedby")).not.toBeNull(),
      );
      expect(carry().disabled).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
    });

    // Review fix: a「持ち越す」whose decision write failed leaves its copy in
    // this week. Answering「やめる」after that writes the decision only — the
    // copy is a live goal by then (todos may hang off it), so it stays.
    it("keeps a copy left by a failed carry when the answer changes", async () => {
      const ds = makeDS({
        goals: [
          goal("w-old", "模様替え", LAST_WEEK),
          goal("w-copy", "模様替え", KEYS.week, { carriedFromGoalId: "w-old" }),
        ],
      });
      render(paper(ds));
      fireEvent.click(await screen.findByRole("button", { name: "Drop it" }));

      await waitFor(() =>
        expect(mockOf(ds, "updateGoal")).toHaveBeenCalledWith("w-old", {
          periodEndDecision: "dropped",
        }),
      );
      expect(mockOf(ds, "softDeleteGoal")).not.toHaveBeenCalled();
      expect(mockOf(ds, "createGoal")).not.toHaveBeenCalled();
      expect(await screen.findByText("模様替え")).toBeTruthy();
    });

    // Review fix: with no todo tree read, every link points at a missing todo
    // and an achieved goal would be asked about as if it were not.
    it("asks nothing while the todo tree has not been read", async () => {
      const ds = makeDS(
        {
          goals: [goal("w-old", "模様替え", LAST_WEEK)],
          links: [linkRow("w-old", "task-b")],
        },
        { fetchTodoTree: vi.fn().mockRejectedValue(new Error("network down")) },
      );
      render(paper(ds));
      expect(await screen.findByText("LIFE EDITOR BRIEFING")).toBeTruthy();
      await waitFor(() =>
        expect(mockOf(ds, "fetchGoalTodoLinks")).toHaveBeenCalled(),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(reviewCard()).toBeNull();
      expect(screen.queryByText("GOALS AHEAD")).toBeNull();
    });

    // Review fix: coming back to Briefing replays the last visit's paper,
    // tree included. A todo finished since then must not be judged undone.
    it("asks nothing over a replayed paper until this visit reads the todos", async () => {
      // The first visit reads task-b still open, so w-old reads unachieved.
      const stale = TODOS.map((t) =>
        t.id === "task-b" ? { ...t, status: "NOT_STARTED" as const } : t,
      );
      let serveTree: (nodes: TodoNode[]) => void = () => {};
      const fetchTodoTree = vi
        .fn<DataService["fetchTodoTree"]>()
        .mockResolvedValueOnce(stale)
        .mockImplementation(
          () =>
            new Promise<TodoNode[]>((resolve) => {
              serveTree = resolve;
            }),
        );
      const ds = makeDS(
        {
          goals: [goal("w-old", "模様替え", LAST_WEEK)],
          links: [linkRow("w-old", "task-b")],
        },
        { fetchTodoTree },
      );
      const first = render(paper(ds));
      await screen.findByRole("button", { name: "Drop it" });
      first.unmount();

      // task-b was finished elsewhere meanwhile. Coming back replays the
      // first visit's paper while the re-read is still out.
      render(paper(ds));
      expect(await screen.findByText("資料を作る")).toBeTruthy();
      await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(reviewCard()).toBeNull();
      expect(screen.queryByText("GOALS AHEAD")).toBeNull();

      // The re-read finds task-b done: w-old is achieved, nothing to ask.
      serveTree(TODOS);
      expect(await screen.findByText("GOALS AHEAD")).toBeTruthy();
      expect(reviewCard()).toBeNull();
    });

    it("asks later without writing, and asks again on the next open", async () => {
      const ds = makeDS({ goals: [goal("w-old", "模様替え", LAST_WEEK)] });
      const first = render(paper(ds));
      fireEvent.click(
        await screen.findByRole("button", { name: "Ask me later" }),
      );
      await waitFor(() => expect(reviewCard()).toBeNull());
      expect(mockOf(ds, "updateGoal")).not.toHaveBeenCalled();
      expect(mockOf(ds, "createGoal")).not.toHaveBeenCalled();
      first.unmount();

      render(paper(ds));
      expect(
        await screen.findByRole("button", { name: "Ask me later" }),
      ).toBeTruthy();
    });

    it("says so and keeps the card when the answer cannot be saved", async () => {
      const ds = makeDS(
        { goals: [goal("w-old", "模様替え", LAST_WEEK)] },
        { updateGoal: vi.fn().mockRejectedValue(new Error("network down")) },
      );
      render(paper(ds));
      fireEvent.click(await screen.findByRole("button", { name: "Drop it" }));

      expect(
        await screen.findByText(
          "Could not save the goal. Check your connection and try again.",
        ),
      ).toBeTruthy();
      expect(reviewCard()).not.toBeNull();
      await waitFor(() =>
        expect(
          (screen.getByRole("button", { name: "Drop it" }) as HTMLButtonElement)
            .disabled,
        ).toBe(false),
      );
    });
  });

  it("draws the paper without the goals when they cannot be read", async () => {
    const ds = makeDS(
      {},
      { fetchGoals: vi.fn().mockRejectedValue(new Error("network down")) },
    );
    render(paper(ds));
    expect(await screen.findByText("LIFE EDITOR BRIEFING")).toBeTruthy();
    await waitFor(() => expect(mockOf(ds, "fetchGoals")).toHaveBeenCalled());
    expect(screen.queryByText("GOALS AHEAD")).toBeNull();
    expect(reviewCard()).toBeNull();
  });

  it("links todos from the goal's side in the paper's overlay", async () => {
    const ds = makeDS({ goals: [goal("w-plan", "企画書を通す")] });
    render(paper(ds));
    fireEvent.click(
      await screen.findByRole("button", { name: "Link todos: 企画書を通す" }),
    );
    const dialog = await screen.findByRole("dialog");
    // The overlay's title says it; the screen inside does not say it again,
    // and names its region after the goal instead.
    expect(within(dialog).getAllByText("Link todos")).toHaveLength(1);
    expect(
      within(dialog).getByRole("region", { name: "企画書を通す" }),
    ).toBeTruthy();
    // Bounded to the viewport with a scrolling body (#1728), so Save stays
    // reachable on a phone once the preview grows the screen.
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /資料を作る/ }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockOf(ds, "linkGoalTodo")).toHaveBeenCalledWith(
        "w-plan",
        "task-a",
      ),
    );
  });

  // The Issue's DoD: a day with no comment, no goals and no 宣言 still draws
  // no empty frame anywhere on the paper.
  it("draws no empty frame on a day with nothing written", async () => {
    const { container } = render(paper(makeDS({ daily: null })));
    await screen.findByText("Set this week's goals");
    expect(screen.queryByText("A WORD ON YESTERDAY")).toBeNull();
    for (const section of container.querySelectorAll("section")) {
      expect(section.textContent?.trim()).not.toBe("");
    }
  });
});
