import { describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  DAY_START_HOUR_STORAGE_KEY,
  SyncContext,
  SYNC_DOMAINS,
  WEEK_STARTS_ON,
  addDaysKey,
  goalPeriodKeys,
  localDateTimeToISO,
  todayDateKey,
  type DailyNode,
  type DataService,
  type Goal,
  type SyncDomain,
  type TodoNode,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { makeTodo, stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * The rebuilt evening paper, host half (#2107 — plan Step 8). The pure view
 * has its own suite (shared/tests/eveningPaper.test.tsx); what only the host
 * can answer is what is READ and what is WRITTEN:
 *
 *   - opening the paper writes nothing at all — not the daily, not a todo,
 *     not a note, not a goal — even on a day whose old Daily body the
 *     reflection field now shows (the one text moves only on an edit);
 *   - the issue number follows the star at once;
 *   - a row's note and「明日に置く」reach the right DataService call;
 *   -「Daily に移動」names the day's daily.
 */

const TODAY = todayDateKey();
const TOMORROW = addDaysKey(TODAY, 1);
const WEEK = goalPeriodKeys(TODAY, WEEK_STARTS_ON).week;
const NOW_ISO = new Date().toISOString();

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const head = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const docOf = (...nodes: unknown[]) =>
  JSON.stringify({ type: "doc", content: nodes });
const published = (mood: number) =>
  docOf(head("夕刊"), para(`気分: ${mood}/5`));

function daily(date: string, content: string, over: Partial<DailyNode> = {}) {
  return {
    id: `daily-${date}`,
    date,
    content,
    isDeleted: false,
    eveningPublishedAt: null,
    eveningNotes: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  } satisfies DailyNode;
}

const WEEK_GOAL: Goal = {
  id: "g-plan",
  title: "企画書を通す",
  periodKind: "week",
  periodKey: WEEK,
  sortOrder: 0,
  parentGoalId: null,
  manualAchievedAt: null,
  periodEndDecision: null,
  decidedAt: null,
  carriedFromGoalId: null,
  legacyKey: null,
  isDeleted: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const DONE_TODAY: TodoNode = makeTodo({
  id: "t-done",
  title: "初稿を仕上げる",
  status: "DONE",
  completedAt: NOW_ISO,
});
const STILL_OPEN: TodoNode = makeTodo({
  id: "t-open",
  title: "図を直す",
  status: "NOT_STARTED",
});

/** Every write the paper could make, as spies — none may fire on open. */
const WRITES = [
  "upsertDailyByDateUnified",
  "updateDailyUnified",
  "createDailyUnified",
  "updateTodo",
  "createNoteUnified",
  "updateNoteUnified",
  "restoreNoteUnified",
  "createGoal",
  "updateGoal",
  "linkGoalTodo",
  "unlinkGoalTodo",
] as const;

function makeDS(seed: {
  today?: DailyNode | null;
  past?: DailyNode[];
  todos?: TodoNode[];
}) {
  let today = seed.today ?? null;
  const writes = Object.fromEntries(
    WRITES.map((name) => [name, vi.fn().mockResolvedValue(undefined)]),
  ) as Record<(typeof WRITES)[number], ReturnType<typeof vi.fn>>;
  writes.upsertDailyByDateUnified.mockImplementation(
    (date: string, content: string) => {
      today = { ...(today ?? daily(date, "")), content };
      return Promise.resolve(today);
    },
  );
  writes.updateDailyUnified.mockImplementation(
    (_id: string, updates: Partial<DailyNode>) => {
      today = { ...(today ?? daily(TODAY, "")), ...updates };
      return Promise.resolve(today);
    },
  );
  writes.createDailyUnified.mockImplementation((node: DailyNode) => {
    today = node;
    return Promise.resolve(node);
  });
  writes.updateTodo.mockImplementation(
    (id: string, updates: Partial<TodoNode>) =>
      Promise.resolve({
        ...(seed.todos ?? []).find((t) => t.id === id)!,
        ...updates,
      }),
  );
  const ds = stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue(seed.todos ?? []),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn(async () => today),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    listDailiesUnified: vi.fn(async () => [
      ...(seed.past ?? []),
      ...(today ? [today] : []),
    ]),
    fetchGoals: vi.fn().mockResolvedValue([WEEK_GOAL]),
    fetchGoalTodoLinks: vi.fn().mockResolvedValue([
      { id: "l1", goalId: "g-plan", todoId: "t-done", isDeleted: false },
      { id: "l2", goalId: "g-plan", todoId: "t-open", isDeleted: false },
    ]),
    // No `note-goals` and no focus note: the #2105 migration and the focus
    // note both find nothing, so neither has a reason to write.
    getNoteUnified: vi.fn().mockResolvedValue(null),
    ...writes,
  });
  return { ds, writes };
}

function renderEvening(
  ds: DataService,
  onNavigateToItem?: (t: { id: string; role: string }) => void,
) {
  return render(
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen
        dataService={ds}
        onNavigate={vi.fn()}
        onNavigateToItem={onNavigateToItem}
        tab="evening"
        key={TODAY}
      />
    </SyncContext.Provider>,
  );
}

/** Let every read land and every effect settle. */
async function settle() {
  await screen.findByText("CLOSING THE DAY");
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

describe("opening the evening paper writes nothing (#2107)", () => {
  it.each([
    ["a blank day", null],
    [
      "a day with an old Daily body",
      daily(TODAY, docOf(para("Lunch with Aki."))),
    ],
    [
      "a published day",
      daily(TODAY, published(4), { eveningPublishedAt: NOW_ISO }),
    ],
  ])("on %s", async (_label, today) => {
    const { ds, writes } = makeDS({
      today,
      past: [daily(addDaysKey(TODAY, -1), published(3))],
      todos: [DONE_TODAY, STILL_OPEN],
    });
    renderEvening(ds);
    await settle();
    // The blocks really did read their data …
    const goals = screen.getByRole("region", { name: "GOALS MOVED TODAY" });
    await within(goals).findByText("企画書を通す");
    // … and nothing was written for it.
    for (const name of WRITES) expect(writes[name]).not.toHaveBeenCalled();
  });

  it("shows an old Daily body in the reflection field without moving it", async () => {
    const { ds, writes } = makeDS({
      today: daily(TODAY, docOf(para("Lunch with Aki."))),
    });
    renderEvening(ds);
    await settle();
    expect(screen.getByText("Lunch with Aki.")).toBeTruthy();
    expect(writes.upsertDailyByDateUnified).not.toHaveBeenCalled();
  });
});

describe("no 宣言 on the evening paper (#2107)", () => {
  it("leaves the narrow evening paper without the intention field or heading", async () => {
    // Narrow: every min-width query fails. The narrow paper used to carry
    // the only evening 宣言 input, so this is the width that could regress.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    try {
      const { ds } = makeDS({
        today: daily(
          TODAY,
          docOf(head("宣言"), para("Ship the draft"), head("夕刊")),
        ),
      });
      renderEvening(ds);
      await settle();
      expect(
        screen.queryByPlaceholderText(
          "What will you get done today? One line is enough…",
        ),
      ).toBeNull();
      expect(screen.queryByText(/TODAY'S INTENTION/)).toBeNull();
      // The declaration itself is kept, just not printed here.
      expect(screen.queryByText("Ship the draft")).toBeNull();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
});

describe("issue number and streak (#2107)", () => {
  it("keeps the last number until the star publishes today", async () => {
    const { ds, writes } = makeDS({
      today: daily(TODAY, ""),
      past: [
        daily(addDaysKey(TODAY, -2), published(3)),
        daily(addDaysKey(TODAY, -1), published(4)),
      ],
    });
    renderEvening(ds);
    await screen.findByText("Evening No. 2 · 2-day streak");

    fireEvent.click(screen.getByLabelText("Mood 4/5"));
    await screen.findByText("Evening No. 3 · 3-day streak");
    // Publishing stamps the day, once.
    await waitFor(() =>
      expect(writes.updateDailyUnified).toHaveBeenCalledWith(`daily-${TODAY}`, {
        eveningPublishedAt: expect.any(String),
      }),
    );
  });

  it("prints no line before the first issue", async () => {
    const { ds } = makeDS({ today: null });
    renderEvening(ds);
    await settle();
    expect(screen.queryByText(/Evening No\./)).toBeNull();
  });

  it("does not re-list every daily on a dailies sync bump", async () => {
    // The paper's own saves echo back as `dailies` bumps; re-listing the
    // whole history on each one is what the once-per-day read avoids.
    const { ds } = makeDS({
      today: daily(TODAY, ""),
      past: [daily(addDaysKey(TODAY, -1), published(4))],
    });
    const { rerender } = renderEvening(ds);
    await screen.findByText("Evening No. 1 · 1-day streak");
    const bumped: WebSyncContextValue = {
      ...syncValue,
      domainVersions: { ...syncValue.domainVersions, dailies: 1 },
    };
    rerender(
      <SyncContext.Provider value={bumped}>
        <BriefingScreen
          dataService={ds}
          onNavigate={vi.fn()}
          tab="evening"
          key={TODAY}
        />
      </SyncContext.Provider>,
    );
    await settle();
    expect(ds.listDailiesUnified).toHaveBeenCalledTimes(1);
  });
});

describe("goals moved today and what happened (#2107)", () => {
  it("prints the goal's before → after and the done todo as an event row", async () => {
    const { ds } = makeDS({ today: null, todos: [DONE_TODAY, STILL_OPEN] });
    renderEvening(ds);
    const goals = await screen.findByRole("region", {
      name: "GOALS MOVED TODAY",
    });
    await within(goals).findByText("企画書を通す");
    expect(within(goals).getByText("0/2")).toBeTruthy();
    expect(within(goals).getByText("1/2")).toBeTruthy();
    expect(within(goals).getByText("1 to go")).toBeTruthy();

    const happened = screen.getByRole("region", {
      name: "WHAT HAPPENED TODAY",
    });
    expect(within(happened).getByText("初稿を仕上げる")).toBeTruthy();
    expect(within(happened).getByText("Done")).toBeTruthy();
  });

  it("shows no goal block — not a false「none」— while the goals load", async () => {
    const { ds } = makeDS({ today: null, todos: [DONE_TODAY, STILL_OPEN] });
    let answer: (goals: Goal[]) => void = () => undefined;
    vi.mocked(ds.fetchGoals).mockReturnValue(
      new Promise<Goal[]>((resolve) => {
        answer = resolve;
      }),
    );
    renderEvening(ds);
    await settle();
    expect(screen.queryByText("No goals moved today")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "GOALS MOVED TODAY" }),
    ).toBeNull();

    await act(async () => answer([WEEK_GOAL]));
    const goals = await screen.findByRole("region", {
      name: "GOALS MOVED TODAY",
    });
    await within(goals).findByText("企画書を通す");
  });

  it("keeps the goal block and says the read failed when it rejects", async () => {
    const { ds } = makeDS({ today: null, todos: [DONE_TODAY, STILL_OPEN] });
    vi.mocked(ds.fetchGoals).mockRejectedValue(new Error("offline"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderEvening(ds);
      const goals = await screen.findByRole("region", {
        name: "GOALS MOVED TODAY",
      });
      expect(
        within(goals).getByText(
          "Could not load your goals. Check your connection and open the evening page again.",
        ),
      ).toBeTruthy();
      // Not the empty line: a failed read is not "nothing moved".
      expect(within(goals).queryByText("No goals moved today")).toBeNull();
    } finally {
      errors.mockRestore();
    }
  });

  it("prints only the empty line on a day with nothing in it", async () => {
    const { ds } = makeDS({ today: null });
    renderEvening(ds);
    await settle();
    const happened = screen.getByRole("region", {
      name: "WHAT HAPPENED TODAY",
    });
    expect(
      within(happened).getByText("Nothing recorded today yet"),
    ).toBeTruthy();
    // No「Events 0 · Worked 0 min」beside it.
    expect(within(happened).queryByText(/^Events /)).toBeNull();
  });

  it("saves a row's note into evening_notes on the day's daily", async () => {
    const { ds, writes } = makeDS({
      today: daily(TODAY, ""),
      todos: [DONE_TODAY],
    });
    renderEvening(ds);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /^Add a note: .* Done 初稿を仕上げる$/,
      }),
    );
    const field = screen.getByRole("textbox", {
      name: /^Add a note: .* Done 初稿を仕上げる$/,
    });
    fireEvent.change(field, { target: { value: "思ったより早い" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect(writes.updateDailyUnified).toHaveBeenCalledWith(`daily-${TODAY}`, {
        eveningNotes: { "todo:t-done": "思ったより早い" },
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: "思ったより早い",
        description: /^Edit the note: .* Done 初稿を仕上げる$/,
      }),
    ).toBeTruthy();
  });

  it("keeps a later row's note on screen when an earlier write answers", async () => {
    const OTHER = makeTodo({
      id: "t-done2",
      title: "表を作る",
      status: "DONE",
      completedAt: NOW_ISO,
    });
    const { ds, writes } = makeDS({
      today: daily(TODAY, ""),
      todos: [DONE_TODAY, OTHER],
    });
    // Hold every answer, so the second line is painted while the first
    // write's answer (which knows only the first key) is still to come.
    const answers: Array<() => void> = [];
    writes.updateDailyUnified.mockImplementation(
      (_id: string, updates: Partial<DailyNode>) =>
        new Promise((resolve) => {
          answers.push(() => resolve(daily(TODAY, "", updates)));
        }),
    );
    renderEvening(ds);
    const addNote = async (title: string, text: string) => {
      const name = new RegExp(`^Add a note: .* Done ${title}$`);
      fireEvent.click(await screen.findByRole("button", { name }));
      const field = screen.getByRole("textbox", { name });
      fireEvent.change(field, { target: { value: text } });
      fireEvent.keyDown(field, { key: "Enter" });
    };
    await addNote("初稿を仕上げる", "早い");
    await addNote("表を作る", "丁寧");
    await waitFor(() => expect(answers).toHaveLength(1));

    await act(async () => answers[0]());
    await waitFor(() => expect(answers).toHaveLength(2));
    expect(
      screen.getByRole("button", {
        description: /^Edit the note: .* Done 表を作る$/,
      }).textContent,
    ).toBe("丁寧");
  });

  it("creates the day's daily with the note when there is none yet", async () => {
    const { ds, writes } = makeDS({ today: null, todos: [DONE_TODAY] });
    renderEvening(ds);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /^Add a note: .* Done 初稿を仕上げる$/,
      }),
    );
    const field = screen.getByRole("textbox", {
      name: /^Add a note: .* Done 初稿を仕上げる$/,
    });
    fireEvent.change(field, { target: { value: "早い" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() =>
      expect(writes.createDailyUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `daily-${TODAY}`,
          date: TODAY,
          content: "",
          eveningNotes: { "todo:t-done": "早い" },
        }),
      ),
    );
    expect(writes.upsertDailyByDateUnified).not.toHaveBeenCalled();
  });
});

describe("put on tomorrow (#2107)", () => {
  it("books a timed 30-minute slot, and keeps the goal's denominator", async () => {
    const { ds, writes } = makeDS({
      today: null,
      todos: [DONE_TODAY, STILL_OPEN],
    });
    renderEvening(ds);
    const goals = await screen.findByRole("region", {
      name: "GOALS MOVED TODAY",
    });
    await within(goals).findByText("1/2");

    fireEvent.change(screen.getByLabelText("Time (optional): 図を直す 企画書を通す"), {
      target: { value: "09:00" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Put on tomorrow: 図を直す 企画書を通す" }),
    );
    await waitFor(() =>
      expect(writes.updateTodo).toHaveBeenCalledWith("t-open", {
        scheduledAt: localDateTimeToISO(TOMORROW, "09:00"),
        scheduledEndAt: localDateTimeToISO(TOMORROW, "09:30"),
        isAllDay: false,
      }),
    );
    await screen.findByText("Tomorrow 09:00");
    // Still counted: the row was replaced, not dropped from the tree.
    expect(within(goals).getByText("1/2")).toBeTruthy();
  });

  it("stages an all-day todo when no time is given", async () => {
    const { ds, writes } = makeDS({ today: null, todos: [STILL_OPEN] });
    renderEvening(ds);
    fireEvent.click(
      await screen.findByRole("button", { name: "Put on tomorrow: 図を直す 企画書を通す" }),
    );
    await waitFor(() =>
      expect(writes.updateTodo).toHaveBeenCalledWith("t-open", {
        scheduledAt: localDateTimeToISO(TOMORROW, "00:00"),
        isAllDay: true,
      }),
    );
    // The old end is cleared, not left behind: a todo booked today 10:00–
    // 11:00 must not keep an end that sits before tomorrow's start.
    const patch = writes.updateTodo.mock.calls[0][1] as Partial<TodoNode>;
    expect("scheduledEndAt" in patch).toBe(true);
    expect(patch.scheduledEndAt).toBeUndefined();
  });

  it("lets a late slot run past midnight rather than collapse", async () => {
    const { ds, writes } = makeDS({ today: null, todos: [STILL_OPEN] });
    renderEvening(ds);
    fireEvent.change(
      await screen.findByLabelText("Time (optional): 図を直す 企画書を通す"),
      { target: { value: "23:45" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Put on tomorrow: 図を直す 企画書を通す" }),
    );
    await waitFor(() =>
      expect(writes.updateTodo).toHaveBeenCalledWith("t-open", {
        scheduledAt: localDateTimeToISO(TOMORROW, "23:45"),
        scheduledEndAt: localDateTimeToISO(addDaysKey(TODAY, 2), "00:15"),
        isAllDay: false,
      }),
    );
  });

  it("books a time before the day-start hour on tomorrow's night, not tonight", async () => {
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
    try {
      // Tomorrow by the paper's own clock (4 o'clock start), whatever the
      // hour this runs at.
      const tomorrow = addDaysKey(todayDateKey(new Date(), 4), 1);
      const { ds, writes } = makeDS({ today: null, todos: [STILL_OPEN] });
      renderEvening(ds);
      fireEvent.change(
        await screen.findByLabelText("Time (optional): 図を直す 企画書を通す"),
        { target: { value: "02:00" } },
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Put on tomorrow: 図を直す 企画書を通す" }),
      );
      // 02:00 belongs to tomorrow until 04:00, which on the wall calendar is
      // the date after tomorrow — and the row says「Tomorrow 02:00」.
      await waitFor(() =>
        expect(writes.updateTodo).toHaveBeenCalledWith("t-open", {
          scheduledAt: localDateTimeToISO(addDaysKey(tomorrow, 1), "02:00"),
          scheduledEndAt: localDateTimeToISO(addDaysKey(tomorrow, 1), "02:30"),
          isAllDay: false,
        }),
      );
      await screen.findByText("Tomorrow 02:00");
    } finally {
      localStorage.removeItem(DAY_START_HOUR_STORAGE_KEY);
    }
  });
});

describe("Daily に移動 (#2107)", () => {
  it("opens the day's daily through the shell's item intent", async () => {
    const onNavigateToItem = vi.fn();
    const { ds, writes } = makeDS({ today: null });
    renderEvening(ds, onNavigateToItem);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /^Open in Daily: / }));
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: `daily-${TODAY}`,
      role: "daily",
    });
    expect(writes.createDailyUnified).not.toHaveBeenCalled();
  });
});
