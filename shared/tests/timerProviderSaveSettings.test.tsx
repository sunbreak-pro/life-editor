import { describe, it, expect, vi, beforeEach } from "vitest";
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
 * TimerProvider — the Work panel's save button lands here (#714, Epic #627).
 *
 * What this pins is the "ONE write per press" half of the change: the five
 * per-field setters it replaced dispatched and wrote once EACH, so editing the
 * whole block produced five rows and five sync bumps for one gesture. Also
 * pinned: clamping stayed in the Provider (the limits are the domain's), and
 * "save as preset" stores the numbers it is handed rather than the ones the
 * Provider happens to hold.
 */

const updateTimerSettings = vi.fn(async () => {});
const createPomodoroPreset = vi.fn(async (input: Record<string, unknown>) => ({
  id: 1,
  createdAt: "2026-08-12T00:00:00.000Z",
  ...input,
}));

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

function makeDS(): DataService {
  return stubDataService({
    fetchTimerSettings: async () => ({
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    }),
    fetchPomodoroPresets: async () => [],
    updateTimerSettings,
    createPomodoroPreset,
  });
}

function Probe() {
  const timer = useTimerContext();
  return (
    <div>
      <span data-testid="work">{timer.workDurationMinutes}</span>
      <span data-testid="target">{timer.targetSessions}</span>
      <button
        onClick={() =>
          timer.saveSettings({
            workDuration: 50,
            breakDuration: 10,
            longBreakDuration: 30,
            sessionsBeforeLongBreak: 2,
            targetSessions: 6,
          })
        }
      >
        save-all
      </button>
      <button onClick={() => timer.saveSettings({ breakDuration: 7 })}>
        save-one
      </button>
      <button onClick={() => timer.saveSettings({ workDuration: 500 })}>
        save-over-max
      </button>
      <button
        onClick={() =>
          void timer.createPreset("Deep", {
            workDuration: 50,
            breakDuration: 10,
            longBreakDuration: 30,
            sessionsBeforeLongBreak: 2,
          })
        }
      >
        create-preset
      </button>
    </div>
  );
}

async function renderTimer() {
  render(
    <TimerProvider dataService={makeDS()} untitledTodoTitle="Untitled todo">
      <Probe />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  await act(async () => {});
  expect(screen.getByTestId("work").textContent).toBe("25");
}

const press = (name: string) => fireEvent.click(screen.getByText(name));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TimerProvider — saveSettings (#714)", () => {
  it("writes the whole patch in ONE call", async () => {
    await renderTimer();

    press("save-all");

    expect(updateTimerSettings).toHaveBeenCalledExactlyOnceWith({
      workDuration: 50,
      breakDuration: 10,
      longBreakDuration: 30,
      sessionsBeforeLongBreak: 2,
      targetSessions: 6,
    });
    expect(screen.getByTestId("work").textContent).toBe("50");
    expect(screen.getByTestId("target").textContent).toBe("6");
  });

  it("leaves the fields the patch omits alone", async () => {
    await renderTimer();

    press("save-one");

    expect(updateTimerSettings).toHaveBeenCalledExactlyOnceWith({
      breakDuration: 7,
    });
    expect(screen.getByTestId("work").textContent).toBe("25");
  });

  it("clamps on the way in", async () => {
    await renderTimer();

    press("save-over-max");

    expect(updateTimerSettings).toHaveBeenCalledExactlyOnceWith({
      workDuration: 240,
    });
    expect(screen.getByTestId("work").textContent).toBe("240");
  });

  it("stores the durations the preset was handed, not the live settings", async () => {
    await renderTimer();

    press("create-preset");
    await act(async () => {});

    expect(createPomodoroPreset).toHaveBeenCalledExactlyOnceWith({
      name: "Deep",
      workDuration: 50,
      breakDuration: 10,
      longBreakDuration: 30,
      sessionsBeforeLongBreak: 2,
    });
  });
});
