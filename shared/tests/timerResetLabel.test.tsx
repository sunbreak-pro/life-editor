import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { TimerProvider } from "../src/context/TimerContext";
import { useTimerContext } from "../src/hooks/useTimerContext";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import {
  PomodoroTimer,
  type PomodoroTimerProps,
} from "../src/components/PomodoroTimer";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2542 — after a pause, Reset must bring the main button back to Start.
 *
 * The face picks its word from `progress > 0` while stopped, and progress is
 * derived inside the Provider, so a face-only test with a hand-set progress
 * cannot see this. Here the face reads the REAL Provider, the way WorkScreen
 * feeds it.
 */

const LABELS: PomodoroTimerProps["labels"] = {
  phase: { WORK: "Work", BREAK: "Break", LONG_BREAK: "Long Break" },
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  reset: "Reset",
  skip: "Skip",
  paused: "Paused",
  subtractFive: "-5 min",
  addFive: "+5 min",
  sessionsProgress: "0 / 4 sessions",
};

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

function Face({ variant }: { variant: "card" | "fullscreen" }) {
  const t = useTimerContext();
  return (
    <PomodoroTimer
      variant={variant}
      phase={t.phase}
      isRunning={t.isRunning}
      formatted={t.formatted}
      totalFormatted="30:00"
      progress={t.progress}
      sessions={{ total: 4, filled: 0 }}
      labels={LABELS}
      onStart={t.start}
      onPause={t.pause}
      onReset={t.reset}
      onSkip={() => {}}
      onAdjust={t.adjustRemainingMinutes}
    />
  );
}

async function renderFace(variant: "card" | "fullscreen") {
  vi.useFakeTimers();
  let nextId = 1;
  const ds = stubDataService({
    fetchTimerSettings: async () => ({
      workDuration: 30,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    }),
    fetchPomodoroPresets: async () => [],
    startTimerSession: vi.fn(async () => ({ id: nextId++ })),
    endTimerSession: vi.fn(async () => undefined),
  });
  render(
    <TimerProvider dataService={ds}>
      <Face variant={variant} />
    </TimerProvider>,
    { wrapper: syncWrapper },
  );
  await act(async () => {});
}

async function press(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
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

describe("PomodoroTimer over TimerProvider — the main button after Reset (#2542)", () => {
  for (const variant of ["fullscreen", "card"] as const) {
    it(`${variant}: pause → reset reads Start, not Resume`, async () => {
      await renderFace(variant);
      await press(/Start/);
      await run(3_000);
      await press(/Pause/);
      expect(screen.getByRole("button", { name: /Resume/ })).toBeTruthy();
      await press("Reset");
      await run(1_000);
      expect(screen.getByText("30:00")).toBeTruthy();
      expect(screen.getByRole("button", { name: /Start/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Resume/ })).toBeNull();
    });

    it(`${variant}: running → reset reads Start`, async () => {
      await renderFace(variant);
      await press(/Start/);
      await run(3_000);
      await press("Reset");
      await run(1_000);
      expect(screen.getByRole("button", { name: /Start/ })).toBeTruthy();
    });
  }
});
