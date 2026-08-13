import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { TimerProvider } from "../src/context/TimerContext";
import { useTimerContext } from "../src/hooks/useTimerContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import type { DataService } from "../src/services/DataService";
import { stubDataService } from "./helpers/dataServiceStub";
import type { TimerPhase } from "../src/context/timerReducer";

/*
 * TimerProvider phase-completion flow (#586 pins). The provider had no test
 * of its own; what gets pinned here is the seam the baseline fix touches —
 * the phase ADVANCE at 0 and the auto-start of the freshly-entered break:
 *
 *   - the completed phase is reported to the host exactly once,
 *   - with auto_start_breaks the BREAK starts RUNNING and its display shows
 *     the FULL break target (never a stale remainder of the old phase),
 *   - without it the BREAK arrives idle, again at full target.
 */

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

function makeDS(overrides?: { autoStartBreaks?: boolean }): DataService {
  return stubDataService({
    fetchTimerSettings: async () => ({
      // 1-minute work / 5-minute break keeps the fake-timer loop short.
      workDuration: 1,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: overrides?.autoStartBreaks ?? false,
      targetSessions: 4,
    }),
    fetchPomodoroPresets: async () => [],
    startTimerSession: async () => ({
      id: 1,
      phase: "WORK",
      startedAt: "2026-08-10T00:00:00.000Z",
      endedAt: null,
      durationSeconds: 0,
      completed: false,
      todoId: null,
    }),
    endTimerSession: async () => {},
  });
}

function Probe() {
  const t = useTimerContext();
  return (
    <div>
      <span data-testid="phase">{t.phase}</span>
      <span data-testid="running">{String(t.isRunning)}</span>
      <span data-testid="remaining">{t.remainingSeconds}</span>
      <button onClick={t.start}>start</button>
    </div>
  );
}

async function renderTimer(opts: {
  autoStartBreaks: boolean;
  onSessionComplete?: (phase: TimerPhase) => void;
}) {
  vi.useFakeTimers();
  render(
    <TimerProvider
      dataService={makeDS({ autoStartBreaks: opts.autoStartBreaks })}
      onSessionComplete={opts.onSessionComplete}
    >
      <Probe />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  // Let the settings fetch land (microtodos only — no timer advance needed).
  await act(async () => {});
  expect(screen.getByTestId("remaining").textContent).toBe("60");
}

const readout = () => ({
  phase: screen.getByTestId("phase").textContent,
  running: screen.getByTestId("running").textContent,
  remaining: screen.getByTestId("remaining").textContent,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TimerProvider — phase completion (#586 pins)", () => {
  it("counts the running work phase down on the 1 s pulse", async () => {
    await renderTimer({ autoStartBreaks: false });
    fireEvent.click(screen.getByText("start"));
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(readout()).toEqual({
      phase: "WORK",
      running: "true",
      remaining: "50",
    });
  });

  it("advances to an IDLE break at the full target when auto-start is off", async () => {
    const onSessionComplete = vi.fn();
    await renderTimer({ autoStartBreaks: false, onSessionComplete });
    fireEvent.click(screen.getByText("start"));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(readout()).toEqual({
      phase: "BREAK",
      running: "false",
      remaining: "300",
    });
    expect(onSessionComplete).toHaveBeenCalledExactlyOnceWith("WORK");
  });

  it("auto-starts the break RUNNING at the full target when auto-start is on", async () => {
    const onSessionComplete = vi.fn();
    await renderTimer({ autoStartBreaks: true, onSessionComplete });
    fireEvent.click(screen.getByText("start"));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    // The freshly-entered break shows its OWN full duration — never a stale
    // remainder of the completed work phase.
    expect(readout()).toEqual({
      phase: "BREAK",
      running: "true",
      remaining: "300",
    });
    expect(onSessionComplete).toHaveBeenCalledExactlyOnceWith("WORK");
  });

  it("keeps the auto-started break counting down", async () => {
    await renderTimer({ autoStartBreaks: true });
    fireEvent.click(screen.getByText("start"));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(readout()).toEqual({
      phase: "BREAK",
      running: "true",
      remaining: "270",
    });
  });
});
