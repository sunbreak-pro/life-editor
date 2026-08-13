import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  type DataService,
  type SyncDomain,
  type TaskNode,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { makeTask, stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * Ticking a todo off the evening paper (#794).
 *
 * The REMAINING TODOS block was display-only: it drew a <span> in the shape of
 * a checkbox with nothing listening, so on a phone — where the rightSidebar
 * tray is behind a drawer — there was no way to close a todo from the paper at
 * all. Two things are worth pinning down from the host side, and neither is
 * visible to the pure view's own suite:
 *
 *   1. the tap reaches `DataService.updateTask` with the right patch, and
 *   2. the tick is painted BEFORE that write resolves. Waiting for the round
 *      trip is what made the tray's checkbox feel heavy (#794's second half),
 *      and a deferred promise is the only honest way to test "before".
 */

const TODAY = todayDateKey();

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

/** jsdom has no matchMedia; useMediaQuery falls back to wide without it. */
function setWidth(wide: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

const OPEN_TASK: TaskNode = makeTask({
  id: "t-open",
  title: "Write the report",
  status: "NOT_STARTED",
  scheduledAt: `${TODAY}T09:00:00.000Z`,
});

function makeDS(updateTask: DataService["updateTask"]): DataService {
  return stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTaskTree: vi.fn().mockResolvedValue([OPEN_TASK]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn().mockResolvedValue(null),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    updateTask,
  });
}

async function renderEvening(updateTask: DataService["updateTask"]) {
  const view = render(
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen
        dataService={makeDS(updateTask)}
        onNavigate={vi.fn()}
        tab="evening"
      />
    </SyncContext.Provider>,
  );
  // The paper's own row, not the tray's — the tray lives behind a portal that
  // is not mounted here at all.
  const row = await screen.findByRole("button", { name: "Toggle complete" });
  return { ...view, row };
}

describe.each([
  ["narrow (mobile)", false],
  ["wide (desktop)", true],
])("evening REMAINING TODOS toggle — %s (#794)", (_label, wide) => {
  beforeEach(() => setWidth(wide));

  it("writes the completion through the DataService", async () => {
    const updateTask = vi.fn(
      (id: string, updates: Partial<TaskNode>): Promise<TaskNode> =>
        Promise.resolve({ ...OPEN_TASK, ...updates, id }),
    );
    const { row } = await renderEvening(updateTask);

    expect(row.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      row.click();
    });

    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(updateTask.mock.calls[0]?.[0]).toBe("t-open");
    expect(updateTask.mock.calls[0]?.[1]).toMatchObject({ status: "DONE" });
    // Still listed, now struck through: the tap has to stay visible, and
    // taking it back must not mean going to another screen.
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Toggle complete" })
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
  });

  it("paints the tick before the write resolves", async () => {
    let settle: (node: TaskNode) => void = () => undefined;
    const updateTask = vi.fn(
      (id: string, updates: Partial<TaskNode>): Promise<TaskNode> =>
        new Promise<TaskNode>((resolve) => {
          settle = () => resolve({ ...OPEN_TASK, ...updates, id });
        }),
    );
    const { row } = await renderEvening(updateTask);

    await act(async () => {
      row.click();
    });
    // The write is still in flight and the box has already moved.
    expect(
      screen
        .getByRole("button", { name: "Toggle complete" })
        .getAttribute("aria-pressed"),
    ).toBe("true");

    await act(async () => {
      settle({ ...OPEN_TASK, status: "DONE" });
    });
    expect(
      screen
        .getByRole("button", { name: "Toggle complete" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("puts the row back when the write fails", async () => {
    const updateTask = vi.fn(() => Promise.reject(new Error("offline")));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { row } = await renderEvening(
        updateTask as unknown as DataService["updateTask"],
      );
      await act(async () => {
        row.click();
      });
      // An optimistic tick that survives its own failure is a lie about what
      // is stored.
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", { name: "Toggle complete" })
            .getAttribute("aria-pressed"),
        ).toBe("false"),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
