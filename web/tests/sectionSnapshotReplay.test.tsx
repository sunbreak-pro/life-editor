import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import {
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  TimerProvider,
  clearDomainSnapshots,
  type DataService,
} from "@life-editor/shared";
import { createBumpableSync, stubDataService } from "./helpers";
import { TrashScreen } from "../src/trash/TrashScreen";
import { WorkScreen } from "../src/work/WorkScreen";
import { AnalyticsScreen } from "../src/analytics/AnalyticsScreen";
import { useBriefingFetch } from "../src/briefing/hooks/useBriefingFetch";
import { useFocusNote } from "../src/briefing/hooks/useFocusNote";
import { useGoalsDoc } from "../src/briefing/hooks/useGoalsDoc";

/*
 * #1157's acceptance test: the four self-fetching screens must draw what they
 * had instead of a skeleton when the user comes back to them.
 *
 * The shape is always the same, and it is the shape shared/tests/
 * domainLoadSnapshot.test.tsx uses one layer down: mount, let the load land,
 * UNMOUNT (a section switch replaces `descriptor.body(...)`, so the whole
 * subtree and its state go), then mount again with the SAME DataService and a
 * read that has NOT resolved yet. What is on screen in that window is the only
 * thing this file is about — if the previous data is there, the snapshot was
 * replayed before paint; if the skeleton is there, it was not.
 *
 * The deferred read matters. With an already-resolved stub the second mount
 * would look right either way, because the refetch lands in the same tick.
 *
 * The negative case is just as load-bearing: a DIFFERENT DataService instance
 * must still show the skeleton. The app swaps that object when the backend
 * changes, and rows from the old one are not valid for the new one.
 */

/** A promise plus the handle to settle it later. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  clearDomainSnapshots();
});

// ── Trash ──────────────────────────────────────────────────────────────────

const TRASH_READS = [
  "fetchDeletedTodos",
  "fetchDeletedNotesUnified",
  "fetchDeletedDailiesUnified",
  "fetchDeletedRoutines",
  "fetchDeletedScheduleItems",
] as const;

function trashService(): DataService {
  const fns: Record<string, unknown> = {};
  for (const name of TRASH_READS) fns[name] = vi.fn(async () => []);
  fns.fetchDeletedTodos = vi.fn(async () => [
    { id: "task-1", title: "Buy milk" },
  ]);
  return stubDataService(fns) as DataService;
}

function renderTrash(ds: DataService) {
  const { wrapper } = createBumpableSync();
  return render(<TrashScreen dataService={ds} />, { wrapper });
}

describe("Trash — second visit", () => {
  it("draws the previous rows before the refetch lands", async () => {
    const ds = trashService();
    const first = renderTrash(ds);
    await screen.findByRole("region", { name: "Todos" });
    within(screen.getByRole("region", { name: "Todos" })).getByText("Buy milk");
    first.unmount();

    // Park the re-read so the assertions below run while it is in flight.
    const pending = deferred<unknown[]>();
    (
      ds.fetchDeletedTodos as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(pending.promise);

    renderTrash(ds);
    // Synchronous — no findBy, no act flush. The row is on the FIRST frame.
    within(screen.getByRole("region", { name: "Todos" })).getByText("Buy milk");
    expect(
      screen.queryByRole("status", { name: "Loading trash..." }),
    ).toBeNull();

    pending.resolve([{ id: "task-1", title: "Buy milk" }]);
  });

  it("still shows the skeleton when the DataService instance changed", async () => {
    const first = renderTrash(trashService());
    await screen.findByRole("region", { name: "Todos" });
    first.unmount();

    // A different backend: the stored rows are not valid for it.
    renderTrash(trashService());
    screen.getByRole("status", { name: "Loading trash..." });
  });
});

// ── Work ───────────────────────────────────────────────────────────────────

const TODOS = [
  { id: "task-1", type: "task", title: "Write the spec", isDeleted: false },
];

function workService(): DataService {
  return stubDataService({
    fetchTodoTree: vi.fn(async () => TODOS),
    // #1375: the pick list is todos AND the coming week's events, read in one
    // `Promise.all`. Leaving this out rejects the whole load, which shows up
    // here as an empty picker rather than as a replayed one.
    fetchScheduleItemsByDateRange: vi.fn(async () => []),
    fetchTimerSettings: vi.fn(async () => ({ targetSessions: 4 })),
    fetchTimerSessions: vi.fn(async () => []),
    fetchPomodoroPresets: vi.fn(async () => []),
  }) as DataService;
}

function renderWork(ds: DataService) {
  const { wrapper: SyncWrapper } = createBumpableSync();
  return render(
    <SyncWrapper>
      <TimerProvider dataService={ds}>
        <WorkScreen dataService={ds} />
      </TimerProvider>
    </SyncWrapper>,
  );
}

describe("Work — second visit", () => {
  it("has the pick list before the refetch lands", async () => {
    const ds = workService();
    const first = renderWork(ds);
    await waitFor(() =>
      expect(
        ds.fetchTodoTree as unknown as ReturnType<typeof vi.fn>,
      ).toHaveBeenCalled(),
    );
    first.unmount();

    const pending = deferred<unknown[]>();
    (
      ds.fetchTodoTree as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(pending.promise);

    renderWork(ds);
    // While the host is fetching, PomodoroTodoSelector swaps its trigger for a
    // skeleton bar. The trigger being present on the FIRST frame is exactly
    // "the pick list came back without a load".
    screen.getByRole("button", { name: "Select a todo or an event…" });

    pending.resolve(TODOS);
  });
});

// ── Briefing ───────────────────────────────────────────────────────────────

/*
 * Briefing is asserted one layer down, at its three hooks, because the paper's
 * skeleton gate is `loading || goalsLoading || focusLoading` — three separate
 * flags from three separate reads, and any one of them left behind puts the
 * eight-row skeleton back on the default landing screen. Checking the flags
 * directly is what says which of the three is covered.
 */

function briefingService(): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn(async () => []),
    fetchTodoTree: vi.fn(async () => []),
    fetchTimerSessions: vi.fn(async () => []),
    getDailyByDateUnified: vi.fn(async () => ({ content: "morning" })),
    listNotesUnified: vi.fn(async () => []),
    listAllTagConnections: vi.fn(async () => []),
    getNoteUnified: vi.fn(async () => ({
      id: "note-goals",
      content: "## 週目標 2026-08-30\n\nship it",
      isDeleted: false,
    })),
  }) as DataService;
}

const TODAY = "2026-08-30";

describe("Briefing — second visit", () => {
  it("useBriefingFetch reports settled on the first render back", async () => {
    const ds = briefingService();
    const { wrapper } = createBumpableSync();
    const first = renderHook(() => useBriefingFetch(ds, TODAY), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.dailyContent).toBe("morning");
    first.unmount();

    const pending = deferred<unknown[]>();
    (
      ds.fetchScheduleItemsByDate as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(pending.promise);

    const second = renderHook(() => useBriefingFetch(ds, TODAY), { wrapper });
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.dailyContent).toBe("morning");

    pending.resolve([]);
  });

  it("useGoalsDoc reports settled on the first render back", async () => {
    const ds = briefingService();
    const { wrapper } = createBumpableSync();
    const first = renderHook(() => useGoalsDoc(ds, TODAY), { wrapper });
    await waitFor(() => expect(first.result.current.goalsLoading).toBe(false));
    first.unmount();

    const pending = deferred<unknown>();
    (
      ds.getNoteUnified as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(pending.promise);

    const reads = (ds.getNoteUnified as unknown as ReturnType<typeof vi.fn>).mock
      .calls.length;
    const second = renderHook(() => useGoalsDoc(ds, TODAY), { wrapper });
    expect(second.result.current.goalsLoading).toBe(false);
    // Replayed, not skipped: the revalidate still went out.
    await waitFor(() =>
      expect(
        (ds.getNoteUnified as unknown as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThan(reads),
    );

    pending.resolve(null);
  });

  it("useFocusNote reports settled on the first render back", async () => {
    const ds = briefingService();
    const { wrapper } = createBumpableSync();
    const first = renderHook(() => useFocusNote(ds, TODAY), { wrapper });
    await waitFor(() => expect(first.result.current.focusLoading).toBe(false));
    first.unmount();

    const pending = deferred<unknown>();
    (
      ds.getNoteUnified as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(pending.promise);

    const second = renderHook(() => useFocusNote(ds, TODAY), { wrapper });
    expect(second.result.current.focusLoading).toBe(false);

    pending.resolve(null);
  });

  it("a failed revalidate does not poison the stored paper", async () => {
    // The regression this guards: `load` uses allSettled and never rejects, so
    // useDomainLoad treats even an all-failed read as a success and stores what
    // it returned. If that were the raw delta, one dropped connection would
    // replace a good paper with an empty one — and because a hit opens the
    // gate, the NEXT visit would draw a confident "nothing today" with the
    // editable 宣言 field over a daily that exists.
    const ds = briefingService();
    const first = renderHook(() => useBriefingFetch(ds, TODAY), { wrapper: createBumpableSync().wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.dailyContent).toBe("morning");
    first.unmount();

    // Second visit, offline: every read throws.
    for (const name of [
      "fetchScheduleItemsByDate",
      "fetchTodoTree",
      "fetchTimerSessions",
      "getDailyByDateUnified",
      "listNotesUnified",
      "listAllTagConnections",
    ]) {
      (ds[name as keyof DataService] as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("offline"),
      );
    }
    const offline = renderHook(() => useBriefingFetch(ds, TODAY), { wrapper: createBumpableSync().wrapper });
    // The replay still holds — nothing on screen was blanked.
    expect(offline.result.current.dailyContent).toBe("morning");
    await waitFor(() =>
      expect(
        (ds.getDailyByDateUnified as unknown as ReturnType<typeof vi.fn>).mock.calls
          .length,
      ).toBeGreaterThan(1),
    );
    offline.unmount();

    // Third visit, still offline: the slot must still carry the good paper.
    const third = renderHook(() => useBriefingFetch(ds, TODAY), { wrapper: createBumpableSync().wrapper });
    expect(third.result.current.loading).toBe(false);
    expect(third.result.current.dailyContent).toBe("morning");
  });

  it("a focus save refreshes the slot it invalidated", async () => {
    // Typing a focus and clicking away flushes the save on blur and unmounts in
    // the same tick, so the Realtime echo that would re-read arrives with
    // nobody listening. Without the persist-path write, the next visit replays
    // the PRE-EDIT body with the gate already open.
    let stored: string | null = null;
    const ds = stubDataService({
      getNoteUnified: vi.fn(async () =>
        stored === null ? null : { id: "note-focus", content: stored, isDeleted: false },
      ),
      createNoteUnified: vi.fn(async (node: { content: string }) => {
        stored = node.content;
        return node;
      }),
      updateNoteUnified: vi.fn(async (_id: string, patch: { content: string }) => {
        stored = patch.content;
        return { id: "note-focus", content: patch.content };
      }),
    }) as DataService;

    const first = renderHook(() => useFocusNote(ds, TODAY), { wrapper: createBumpableSync().wrapper });
    await waitFor(() => expect(first.result.current.focusLoading).toBe(false));
    act(() => first.result.current.handleFocusChange("ship the thing"));
    act(() => first.result.current.flushFocus());
    await waitFor(() => expect(stored).not.toBeNull());
    first.unmount();

    // Park the re-read: the first frame back must come from the snapshot.
    const pending = deferred<unknown>();
    (ds.getNoteUnified as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      pending.promise,
    );

    const second = renderHook(() => useFocusNote(ds, TODAY), { wrapper: createBumpableSync().wrapper });
    expect(second.result.current.focusLoading).toBe(false);
    expect(second.result.current.focusDraft).toBe("ship the thing");

    pending.resolve(stored === null ? null : { id: "note-focus", content: stored });
  });

  it("a different DataService still starts on the skeleton", async () => {
    const { wrapper } = createBumpableSync();
    const first = renderHook(() => useBriefingFetch(briefingService(), TODAY), {
      wrapper,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    const second = renderHook(
      () => useBriefingFetch(briefingService(), TODAY),
      {
        wrapper,
      },
    );
    expect(second.result.current.loading).toBe(true);
  });
});

// ── Analytics ──────────────────────────────────────────────────────────────

const ANALYTICS_READS = {
  fetchTimerSessions: () => [],
  fetchTodoTree: () => [],
  fetchScheduleItemsByDateRange: () => [],
  // Every live event, for the Overview tag usage card (#1379) — a different
  // read from the range one above it.
  fetchEvents: () => [],
  fetchAllRoutines: () => [],
  listNotesUnified: () => [],
  listAllWikiTagsUnified: () => [],
  listAllTagAssignments: () => [],
} as const;

function analyticsService(): DataService {
  const fns: Record<string, unknown> = {
    fetchTimerSettings: vi.fn(async () => ({ targetSessions: 4 })),
  };
  for (const [name, value] of Object.entries(ANALYTICS_READS)) {
    fns[name] = vi.fn(async () => value());
  }
  return stubDataService(fns) as DataService;
}

function renderAnalytics(ds: DataService) {
  const { wrapper } = createBumpableSync();
  return render(
    <AnalyticsScreen dataService={ds} tab="overview" onTabChange={() => {}} />,
    { wrapper },
  );
}

describe("Analytics — second visit", () => {
  it("does not go back to the dashboard skeleton", async () => {
    const ds = analyticsService();
    const first = renderAnalytics(ds);
    await waitFor(() =>
      expect(
        (ds.fetchTimerSettings as unknown as ReturnType<typeof vi.fn>).mock.calls
          .length,
      ).toBe(1),
    );
    // The skeleton is gone once the mount load lands.
    await waitFor(() =>
      expect(document.querySelector("[aria-busy=\"true\"]")).toBeNull(),
    );
    first.unmount();

    const pending = deferred<unknown>();
    (
      ds.fetchTimerSettings as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce(pending.promise);

    renderAnalytics(ds);
    expect(document.querySelector("[aria-busy=\"true\"]")).toBeNull();

    pending.resolve({ targetSessions: 4 });
  });
});
