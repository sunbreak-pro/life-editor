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
 * #1853 — a phase that was paused and resumed must still be recorded.
 *
 * Pause closes the open row, and Resume used to open nothing, so the
 * completion found no row to close: the only thing the log kept was the
 * seconds before the first pause, which `isCountedSession` then dropped as a
 * scrap. What is pinned here is the segment model that replaced it — one row
 * per running segment, each closed with ITS OWN seconds, the last one as
 * `completed` — plus the two promises that ride on it: Reset retracts nothing
 * (#1475), and the figure the completion modal reads is the sum of the rows
 * that count.
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

interface Fns {
  startTimerSession: ReturnType<typeof vi.fn>;
  endTimerSession: ReturnType<typeof vi.fn>;
}

function makeFns(): Fns {
  let nextId = 1;
  return {
    startTimerSession: vi.fn(async () => ({ id: nextId++ })),
    endTimerSession: vi.fn(async () => undefined),
  };
}

function makeDS(fns: Fns): DataService {
  return stubDataService({
    fetchTimerSettings: async () => ({
      // A 3-minute work phase: long enough to hold a counted (>= 60 s)
      // segment on either side of a pause.
      workDuration: 3,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    }),
    fetchPomodoroPresets: async () => [],
    ...fns,
  });
}

function Probe() {
  const t = useTimerContext();
  return (
    <div>
      <span data-testid="phase">{t.phase}</span>
      <span data-testid="logged">{String(t.lastLoggedWorkSeconds)}</span>
      <button onClick={t.start}>start</button>
      <button onClick={t.pause}>pause</button>
      <button onClick={t.reset}>reset</button>
    </div>
  );
}

async function renderTimer(fns: Fns) {
  vi.useFakeTimers();
  render(
    <TimerProvider dataService={makeDS(fns)}>
      <Probe />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  await act(async () => {});
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
}

async function run(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("TimerProvider — pause, resume, complete (#1853)", () => {
  it("opens a new row on resume and closes it as completed", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await run(3_000);
    await click("pause");
    await click("start");
    await run(177_000);

    expect(screen.getByTestId("phase").textContent).toBe("BREAK");
    expect(fns.startTimerSession).toHaveBeenCalledTimes(2);
    // Each row carries its own segment: 3 s before the pause, then the 177 s
    // that reached the target. Together they are the 180 s that were worked.
    expect(fns.endTimerSession.mock.calls).toEqual([
      [1, 3, false],
      [2, 177, true],
    ]);
  });

  it("reports the seconds of the rows that count, not the phase length", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    expect(screen.getByTestId("logged").textContent).toBe("null");
    await click("start");
    await run(3_000);
    await click("pause");
    await click("start");
    await run(177_000);

    // The 3 s row is a scrap to `isCountedSession` (never completed, under a
    // minute), so History shows 177 s and the modal must say the same.
    expect(screen.getByTestId("logged").textContent).toBe("177");
  });

  it("adds a paused segment of a minute or more to the reported total", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await run(90_000);
    await click("pause");
    await click("start");
    await run(90_000);

    expect(fns.endTimerSession.mock.calls).toEqual([
      [1, 90, false],
      [2, 90, true],
    ]);
    expect(screen.getByTestId("logged").textContent).toBe("180");
  });

  it("reports the whole phase when nothing paused it", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await run(180_000);

    expect(fns.endTimerSession.mock.calls).toEqual([[1, 180, true]]);
    expect(screen.getByTestId("logged").textContent).toBe("180");
  });

  it("leaves the paused row alone on reset (#1475)", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await run(90_000);
    await click("pause");
    await click("reset");

    // The pause already wrote the row; reset has nothing open to close and
    // must not reach back for it.
    expect(fns.endTimerSession.mock.calls).toEqual([[1, 90, false]]);
    expect(fns.startTimerSession).toHaveBeenCalledTimes(1);
  });

  it("closes only the live segment when reset lands after a resume", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await run(90_000);
    await click("pause");
    await click("start");
    await run(20_000);
    await click("reset");

    expect(fns.endTimerSession.mock.calls).toEqual([
      [1, 90, false],
      [2, 20, false],
    ]);
  });

  it("does not carry a reset run's seconds into the next completion", async () => {
    const fns = makeFns();
    await renderTimer(fns);
    await click("start");
    await run(90_000);
    await click("pause");
    await click("reset");
    await click("start");
    await run(180_000);

    expect(screen.getByTestId("logged").textContent).toBe("180");
  });
});
