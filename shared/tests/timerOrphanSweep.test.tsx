import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { TimerProvider } from "../src/context/TimerContext";
import { useTimerContext } from "../src/hooks/useTimerContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import {
  OPEN_SESSION_MARKER_LIVE_MS,
  ORPHAN_SESSION_STALE_MS,
  planOrphanRecovery,
  readOpenSessionMarker,
  timerTabId,
  writeOpenSessionMarker,
} from "../src/utils/timerOpenSessionMarker";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1857 — a reload mid-run must not leave a timer_sessions row open for good.
 *
 * Pause, reset and completion close the open row; a reload gives the Provider
 * no turn, so the row kept `ended_at = null` and nothing ever came back for
 * it. Pinned here: the marker the running tab leaves behind, the decision of
 * what the next startup closes (and with how many seconds), and the Provider
 * actually doing it on mount.
 */

const MARKER_KEY = "life-editor:timer-open-session";
const NOW = new Date("2026-09-22T10:00:00.000Z").getTime();

function row(id: number, startedMsAgo: number) {
  return { id, startedAt: new Date(NOW - startedMsAgo) };
}

describe("planOrphanRecovery", () => {
  it("closes this tab's own row with the time up to its last pulse", () => {
    const plan = planOrphanRecovery(
      [row(7, 10 * 60_000)],
      { sessionId: 7, tabId: "me", lastSeenAt: NOW - 60_000 },
      "me",
      NOW,
    );
    // Started 10 min ago, last seen 1 min ago: 9 minutes ran.
    expect(plan).toEqual([
      { session: row(7, 10 * 60_000), durationSeconds: 540 },
    ]);
  });

  it("leaves a row another tab is visibly still running", () => {
    const plan = planOrphanRecovery(
      [row(7, 10 * 60_000)],
      { sessionId: 7, tabId: "other", lastSeenAt: NOW - 2_000 },
      "me",
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it("closes another tab's row once its pulse has gone quiet", () => {
    const lastSeenAt = NOW - OPEN_SESSION_MARKER_LIVE_MS - 1_000;
    const plan = planOrphanRecovery(
      [row(7, 10 * 60_000)],
      { sessionId: 7, tabId: "other", lastSeenAt },
      "me",
      NOW,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]?.durationSeconds).toBe(
      Math.floor((lastSeenAt - (NOW - 10 * 60_000)) / 1000),
    );
  });

  it("discards an unvouched row only once it is too old to be live", () => {
    const young = row(1, 30 * 60_000);
    const old = row(2, ORPHAN_SESSION_STALE_MS + 60_000);
    const plan = planOrphanRecovery([young, old], null, "me", NOW);
    // Zero seconds: nothing recorded how long it ran, so none are invented.
    expect(plan).toEqual([{ session: old, durationSeconds: 0 }]);
  });

  it("never writes a negative duration", () => {
    const plan = planOrphanRecovery(
      [row(7, 1_000)],
      { sessionId: 7, tabId: "me", lastSeenAt: NOW - 5_000 },
      "me",
      NOW,
    );
    expect(plan[0]?.durationSeconds).toBe(0);
  });
});

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

const SETTINGS = {
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  targetSessions: 4,
};

function makeDS(overrides: Partial<Record<keyof DataService, unknown>>) {
  return stubDataService({
    fetchTimerSettings: async () => SETTINGS,
    fetchPomodoroPresets: async () => [],
    ...overrides,
  });
}

function Probe() {
  const t = useTimerContext();
  return (
    <div>
      <button onClick={t.start}>start</button>
      <button onClick={t.pause}>pause</button>
    </div>
  );
}

describe("TimerProvider orphan sweep", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes the row a reload left open, with the seconds that ran", async () => {
    const startedAt = new Date(Date.now() - 20 * 60_000);
    // What the previous page load left behind: last seen 5 minutes in.
    writeOpenSessionMarker(25, startedAt.getTime() + 5 * 60_000);
    const recoverTimerSession = vi.fn(async () => null);
    const ds = makeDS({
      fetchOpenTimerSessions: async () => [{ id: 25, startedAt }],
      recoverTimerSession,
    });

    render(
      <TimerProvider dataService={ds}>
        <Probe />
      </TimerProvider>,
      { wrapper: syncWrapper },
    );

    await waitFor(() => expect(recoverTimerSession).toHaveBeenCalledTimes(1));
    expect(recoverTimerSession).toHaveBeenCalledWith(
      { id: 25, startedAt },
      300,
    );
    await waitFor(() => expect(readOpenSessionMarker()).toBeNull());
  });

  it("files a recovered free session as an Event, without tags", async () => {
    const startedAt = new Date(Date.now() - 20 * 60_000);
    writeOpenSessionMarker(25, startedAt.getTime() + 5 * 60_000);
    const createScheduleItem = vi.fn(async () => ({ id: "event-1" }));
    const assignTagToItem = vi.fn(async () => undefined);
    const attributeTimerSession = vi.fn(async () => undefined);
    const ds = makeDS({
      fetchOpenTimerSessions: async () => [{ id: 25, startedAt }],
      recoverTimerSession: async () => ({
        id: 25,
        sessionType: "WORK",
        startedAt,
        completedAt: new Date(startedAt.getTime() + 300_000),
        duration: 300,
        completed: false,
        todoId: null,
        eventId: null,
      }),
      createScheduleItem,
      assignTagToItem,
      attributeTimerSession,
    });

    render(
      <TimerProvider dataService={ds} freeSessionTitle="Free session">
        <Probe />
      </TimerProvider>,
      { wrapper: syncWrapper },
    );

    await waitFor(() =>
      expect(attributeTimerSession).toHaveBeenCalledWith(25, {
        kind: "event",
        id: "event-1",
      }),
    );
    expect(createScheduleItem).toHaveBeenCalledTimes(1);
    expect(assignTagToItem).not.toHaveBeenCalled();
  });

  it("leaves a young row it holds no marker for", async () => {
    const recoverTimerSession = vi.fn(async () => null);
    const fetchOpenTimerSessions = vi.fn(async () => [
      { id: 9, startedAt: new Date(Date.now() - 10 * 60_000) },
    ]);
    const ds = makeDS({ fetchOpenTimerSessions, recoverTimerSession });

    render(
      <TimerProvider dataService={ds}>
        <Probe />
      </TimerProvider>,
      { wrapper: syncWrapper },
    );

    await waitFor(() => expect(fetchOpenTimerSessions).toHaveBeenCalled());
    await act(async () => {});
    expect(recoverTimerSession).not.toHaveBeenCalled();
  });

  it("keeps a marker while the row is open and drops it on pause", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const ds = makeDS({
      startTimerSession: async () => ({ id: 41 }),
      endTimerSession: async () => undefined,
    });

    render(
      <TimerProvider dataService={ds}>
        <Probe />
      </TimerProvider>,
      { wrapper: syncWrapper },
    );
    await act(async () => {});

    fireEvent.click(screen.getByText("start"));
    await act(async () => {});
    const opened = readOpenSessionMarker();
    expect(opened).toMatchObject({ sessionId: 41, tabId: timerTabId() });

    // The pulse moves the last-seen stamp forward with the clock.
    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });
    expect(readOpenSessionMarker()?.lastSeenAt).toBeGreaterThan(
      opened?.lastSeenAt ?? Infinity,
    );

    fireEvent.click(screen.getByText("pause"));
    expect(readOpenSessionMarker()).toBeNull();
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull();
  });
});
