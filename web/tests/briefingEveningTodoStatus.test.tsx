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
 * Three-status Todos on the evening paper (#796) — the host half.
 *
 * The pure view's own suite covers the control (cycle order, labels, 44px).
 * What only the host can answer is whether a press turns into the right write
 * and the right repaint:
 *
 *   1. `DataService.updateTask` gets the status the cycle landed on, with
 *      `completedAt` following it — that stamp decides whether a closed task
 *      still belongs on today's paper, so a status write that forgets it drops
 *      the row on the next fetch.
 *   2. the new status is painted BEFORE the write resolves. `updateTask` is
 *      several sequential requests, and a control that does not move until they
 *      all return reads as broken (that is the "重い" half of #794's report).
 *
 * This suite REPLACES briefingEveningTodoToggle.test.tsx: #794 gave the paper a
 * binary checkbox and that file guarded it, but #796 removed the checkbox, so
 * the questions it asked now have to be asked of the status control instead.
 * Nothing it covered is dropped — the write, the optimistic paint and the
 * rollback are all still asserted here, at both widths.
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
  // The paper's own row — the tray lives behind a portal not mounted here.
  await screen.findByLabelText("Status: Not started");
  return view;
}

describe.each([
  ["narrow (mobile)", false],
  ["wide (desktop)", true],
])("evening REMAINING TODOS status — %s (#796)", (_label, wide) => {
  beforeEach(() => setWidth(wide));

  it("writes the status the cycle landed on, with completedAt", async () => {
    const updateTask = vi.fn(
      (id: string, updates: Partial<TaskNode>): Promise<TaskNode> =>
        Promise.resolve({ ...OPEN_TASK, ...updates, id }),
    );
    await renderEvening(updateTask);

    // Not started → In progress: no completion stamp yet.
    await act(async () => {
      screen.getByLabelText("Status: Not started").click();
    });
    expect(updateTask.mock.calls[0]?.[0]).toBe("t-open");
    expect(updateTask.mock.calls[0]?.[1]).toEqual({
      status: "IN_PROGRESS",
      completedAt: undefined,
    });
    await screen.findByLabelText("Status: In progress");

    // In progress → Done: stamped, which is what keeps the row on today's
    // paper rather than dropping it as a stale carryover.
    await act(async () => {
      screen.getByLabelText("Status: In progress").click();
    });
    expect(updateTask.mock.calls[1]?.[1]?.status).toBe("DONE");
    expect(typeof updateTask.mock.calls[1]?.[1]?.completedAt).toBe("string");

    // Still listed, struck through — the press has to stay visible.
    await waitFor(() =>
      expect(screen.getByLabelText("Status: Done")).toBeTruthy(),
    );
    expect(screen.getByText("Write the report").className).toContain(
      "line-through",
    );
  });

  it("paints the new status before the write resolves", async () => {
    let settle: () => void = () => undefined;
    const updateTask = vi.fn(
      (id: string, updates: Partial<TaskNode>): Promise<TaskNode> =>
        new Promise<TaskNode>((resolve) => {
          settle = () => resolve({ ...OPEN_TASK, ...updates, id });
        }),
    );
    await renderEvening(updateTask);

    await act(async () => {
      screen.getByLabelText("Status: Not started").click();
    });
    expect(screen.getByLabelText("Status: In progress")).toBeTruthy();

    await act(async () => {
      settle();
    });
    expect(screen.getByLabelText("Status: In progress")).toBeTruthy();
  });

  it("puts the old status back when the write fails", async () => {
    const updateTask = vi.fn(() => Promise.reject(new Error("offline")));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await renderEvening(updateTask as unknown as DataService["updateTask"]);
      await act(async () => {
        screen.getByLabelText("Status: Not started").click();
      });
      // An optimistic status that survives its own failure is a lie about what
      // is stored.
      await waitFor(() =>
        expect(screen.getByLabelText("Status: Not started")).toBeTruthy(),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
