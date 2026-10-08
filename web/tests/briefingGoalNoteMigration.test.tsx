import { StrictMode, type ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  ToastContext,
  ToastProvider,
  goalPeriodKeys,
  todayDateKey,
  WEEK_STARTS_ON,
  type DataService,
  type Goal,
  type NoteNode,
  type SyncDomain,
  type ToastContextValue,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";
import {
  migrateNoteGoals,
  useNoteGoalsMigration,
} from "../src/briefing/hooks/useNoteGoalsMigration";

/*
 * #2105 — the goals note's current-period lines become goals once, when the
 * paper opens. Which lines move is pinned in shared/tests/goalNoteMigration;
 * this suite pins the "once" (StrictMode, a second open, another app launch,
 * a goal the user trashed) and the toast for the lines that did not fit.
 *
 * The goal store below behaves like the DB on the one point that matters
 * here: `legacy_key` is unique per user INCLUDING trashed goals (0034), and a
 * duplicate create fails with the index's name in the message.
 */

const TODAY = todayDateKey();
const KEYS = goalPeriodKeys(TODAY, WEEK_STARTS_ON);

function head(text: string) {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  };
}
function line(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function noteDoc(...nodes: unknown[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}

function goalsNote(content: string, over: Partial<NoteNode> = {}): NoteNode {
  return {
    id: "note-goals",
    type: "note",
    title: "Goals",
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

interface StoredGoal {
  id: string;
  title: string;
  periodKind: string;
  periodKey: string;
  sortOrder: number;
  legacyKey: string | null;
  isDeleted: boolean;
}

function makeDS(
  note: NoteNode | null,
  seed: StoredGoal[] = [],
  /** 1-based createGoal call that fails like a dropped connection. */
  failOnCall?: number,
) {
  const goals: StoredGoal[] = [...seed];
  let calls = 0;
  const createGoal = vi.fn(async (input: Omit<StoredGoal, "isDeleted">) => {
    await Promise.resolve();
    calls += 1;
    if (calls === failOnCall) throw new Error("Failed to fetch");
    if (
      input.legacyKey !== null &&
      goals.some((g) => g.legacyKey === input.legacyKey)
    ) {
      throw new Error(
        'createGoal goals_payload: duplicate key value violates unique constraint "uq_goals_payload_legacy_key"',
      );
    }
    const goal = { ...input, isDeleted: false };
    goals.push(goal);
    return goal;
  });
  const updateNoteUnified = vi.fn();
  const createNoteUnified = vi.fn();
  const ds = stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    getNoteUnified: vi.fn().mockResolvedValue(note),
    updateNoteUnified,
    createNoteUnified,
    // Live goals only, like SupabaseGoalsService.
    fetchGoalsForDate: vi.fn(async () => goals.filter((g) => !g.isDeleted)),
    createGoal,
    // What the paper's goals block reads (#2106).
    fetchGoals: vi.fn(async () =>
      goals
        .filter((g) => !g.isDeleted)
        .map(
          (g) =>
            ({
              parentGoalId: null,
              manualAchievedAt: null,
              periodEndDecision: null,
              decidedAt: null,
              carriedFromGoalId: null,
              createdAt: "2026-10-01T00:00:00.000Z",
              updatedAt: "2026-10-01T00:00:00.000Z",
              ...g,
            }) as Goal,
        ),
    ),
    fetchGoalTodoLinks: vi.fn().mockResolvedValue([]),
  });
  return {
    ds,
    goals,
    createGoal,
    updateNoteUnified,
    createNoteUnified,
    live: () => goals.filter((g) => !g.isDeleted),
  };
}

const FOUR_WEEK_LINES = noteDoc(
  head(`週目標 ${KEYS.week}`),
  line("Ship the block"),
  line("Run twice"),
  line("Call home"),
  line("Fix the bike"),
  head(`月目標 ${KEYS.month}`),
  line("Read one book"),
);

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

function renderPaper(ds: DataService) {
  return render(
    <ToastProvider>
      <SyncContext.Provider value={syncValue}>
        <BriefingScreen dataService={ds} onNavigate={vi.fn()} tab="morning" />
      </SyncContext.Provider>
    </ToastProvider>,
  );
}

function toastWrapper(showToast: ToastContextValue["showToast"]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <ToastContext.Provider value={{ showToast }}>
          {children}
        </ToastContext.Provider>
      </StrictMode>
    );
  };
}

describe("goals note → goals (#2105)", () => {
  it("opening the paper twice does not add goals", async () => {
    const store = makeDS(goalsNote(FOUR_WEEK_LINES));
    const first = renderPaper(store.ds);
    await waitFor(() => expect(store.live()).toHaveLength(4));
    first.unmount();

    renderPaper(store.ds);
    // A later launch of the app (no in-tab memory) finds the moved goals.
    const again = await migrateNoteGoals(store.ds, TODAY);
    expect(again).toEqual({ created: 0, leftInNote: 0 });
    expect(store.live()).toHaveLength(4);
    expect(store.createGoal).toHaveBeenCalledTimes(4);
  });

  it("a period with four lines moves exactly three and says so", async () => {
    const store = makeDS(goalsNote(FOUR_WEEK_LINES));
    renderPaper(store.ds);

    expect(
      await screen.findByText(
        "Your goals note became goals. A period holds up to 3 goals, so 1 more line stays in the note as it was.",
      ),
    ).toBeTruthy();
    const week = store.live().filter((g) => g.periodKind === "week");
    expect(week.map((g) => [g.title, g.sortOrder])).toEqual([
      ["Ship the block", 0],
      ["Run twice", 1],
      ["Call home", 2],
    ]);
    expect(store.live().filter((g) => g.periodKind === "month")).toHaveLength(
      1,
    );
    // The note itself is never written.
    expect(store.updateNoteUnified).not.toHaveBeenCalled();
    expect(store.createNoteUnified).not.toHaveBeenCalled();
  });

  it("StrictMode and two papers at once share one run and one toast", async () => {
    const store = makeDS(goalsNote(FOUR_WEEK_LINES));
    const showToast = vi.fn<ToastContextValue["showToast"]>();
    const wrapper = toastWrapper(showToast);
    renderHook(() => useNoteGoalsMigration(store.ds, TODAY), { wrapper });
    renderHook(() => useNoteGoalsMigration(store.ds, TODAY), { wrapper });

    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    expect(store.createGoal).toHaveBeenCalledTimes(4);
    expect(store.live()).toHaveLength(4);
  });

  it("finishes a period on the next open when a create failed halfway", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // Call 1 = week line 0, call 2 = week line 1 (fails), call 3 = month.
    const store = makeDS(goalsNote(FOUR_WEEK_LINES), [], 2);
    const showToast = vi.fn<ToastContextValue["showToast"]>();
    const wrapper = toastWrapper(showToast);

    const first = renderHook(() => useNoteGoalsMigration(store.ds, TODAY), {
      wrapper,
    });
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(store.live().map((g) => g.title)).toEqual([
      "Ship the block",
      "Read one book",
    ]);
    // The cut-short week has not said anything yet.
    expect(showToast).not.toHaveBeenCalled();
    first.unmount();

    // The failed run was dropped, so the next open runs again and finishes.
    renderHook(() => useNoteGoalsMigration(store.ds, TODAY), { wrapper });
    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    const week = store.live().filter((g) => g.periodKind === "week");
    expect(week.map((g) => [g.title, g.sortOrder])).toEqual([
      ["Ship the block", 0],
      ["Run twice", 1],
      ["Call home", 2],
    ]);
    expect(showToast.mock.calls[0]?.[1]).toContain("1 more line");
    error.mockRestore();
  });

  it("still shows the toast when the paper closes before the run ends", async () => {
    const store = makeDS(goalsNote(FOUR_WEEK_LINES));
    const showToast = vi.fn<ToastContextValue["showToast"]>();
    const hook = renderHook(() => useNoteGoalsMigration(store.ds, TODAY), {
      wrapper: toastWrapper(showToast),
    });
    hook.unmount();

    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(1));
    expect(store.live()).toHaveLength(4);
  });

  it("does not bring back a moved goal the user trashed", async () => {
    const store = makeDS(goalsNote(FOUR_WEEK_LINES));
    await migrateNoteGoals(store.ds, TODAY);
    // Trash every moved week goal: no live goal of that section is left.
    for (const g of store.goals)
      if (g.periodKind === "week") g.isDeleted = true;

    const again = await migrateNoteGoals(store.ds, TODAY);
    expect(again).toEqual({ created: 0, leftInNote: 0 });
    expect(store.live().filter((g) => g.periodKind === "week")).toHaveLength(0);
  });

  it("stays quiet when every line fits", async () => {
    const store = makeDS(
      goalsNote(noteDoc(head(`週目標 ${KEYS.week}`), line("Only one"))),
    );
    const showToast = vi.fn<ToastContextValue["showToast"]>();
    renderHook(() => useNoteGoalsMigration(store.ds, TODAY), {
      wrapper: toastWrapper(showToast),
    });
    await waitFor(() => expect(store.live()).toHaveLength(1));
    await Promise.resolve();
    expect(showToast).not.toHaveBeenCalled();
  });

  // #2106 review fix: the paper reads its goals after the move settles. A
  // read taken mid-move showed an empty week over the moved goals, and its
  // count was what the add field's 3-per-period check trusted.
  it("the paper reads its goals after the move, so it shows them", async () => {
    const store = makeDS(
      goalsNote(noteDoc(head(`週目標 ${KEYS.week}`), line("Only one"))),
    );
    renderPaper(store.ds);

    expect(await screen.findByText("Only one")).toBeTruthy();
    expect(screen.queryByText("Set this week's goals")).toBeNull();
    expect(
      vi.mocked(store.ds.fetchGoals).mock.invocationCallOrder[0],
    ).toBeGreaterThan(store.createGoal.mock.invocationCallOrder[0]!);
  });

  it("leaves a trashed or locked note alone and reads no goals for an empty one", async () => {
    for (const note of [
      goalsNote(FOUR_WEEK_LINES, { isDeleted: true }),
      goalsNote("", { hasPassword: true }),
      goalsNote(noteDoc(head("週目標 2020-01-05"), line("Long ago"))),
      null,
    ]) {
      const store = makeDS(note);
      expect(await migrateNoteGoals(store.ds, TODAY)).toEqual({
        created: 0,
        leftInNote: 0,
      });
      expect(store.createGoal).not.toHaveBeenCalled();
      expect(store.ds.fetchGoalsForDate).not.toHaveBeenCalled();
    }
  });
});
