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

/*
 * #1854 — Skip is live on an idle phase, so the Provider half of that promise
 * is pinned here: moving off a phase that never ran writes no session row.
 * The case that matters is the idle BREAK a completed WORK phase lands on.
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

function Probe() {
  const t = useTimerContext();
  return (
    <div>
      <span data-testid="phase">{t.phase}</span>
      <span data-testid="running">{String(t.isRunning)}</span>
      <button onClick={t.start}>start</button>
      <button onClick={() => t.setPhase(t.phase === "WORK" ? "BREAK" : "WORK")}>
        skip
      </button>
    </div>
  );
}

async function renderTimer() {
  const fns = {
    startTimerSession: vi.fn(async () => ({ id: 1 })),
    endTimerSession: vi.fn(async () => undefined),
  };
  const ds: DataService = stubDataService({
    fetchTimerSettings: async () => ({
      workDuration: 1,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    }),
    fetchPomodoroPresets: async () => [],
    ...fns,
  });
  vi.useFakeTimers();
  render(
    <TimerProvider dataService={ds}>
      <Probe />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  await act(async () => {});
  return fns;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("TimerProvider — skip on an idle phase (#1854)", () => {
  it("returns to WORK from the idle break without writing a BREAK row", async () => {
    const fns = await renderTimer();
    await act(async () => {
      fireEvent.click(screen.getByText("start"));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("phase").textContent).toBe("BREAK");
    expect(screen.getByTestId("running").textContent).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByText("skip"));
    });

    expect(screen.getByTestId("phase").textContent).toBe("WORK");
    expect(screen.getByTestId("running").textContent).toBe("false");
    // Only the WORK phase that actually ran touched the log.
    expect(fns.startTimerSession).toHaveBeenCalledTimes(1);
    expect(fns.endTimerSession).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when a never-started WORK phase is skipped", async () => {
    const fns = await renderTimer();
    await act(async () => {
      fireEvent.click(screen.getByText("skip"));
    });

    expect(screen.getByTestId("phase").textContent).toBe("BREAK");
    expect(fns.startTimerSession).not.toHaveBeenCalled();
    expect(fns.endTimerSession).not.toHaveBeenCalled();
  });
});
