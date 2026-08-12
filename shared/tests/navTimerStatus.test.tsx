import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { NavTimerStatus } from "../src/components";
import { TimerContext, type TimerContextValue } from "../src/context";

/*
 * #550 — the Work nav row's live timer line. A TimerContext bridge: renders
 * the running countdown (+ the active task's title when one is linked) and
 * nothing at all while the timer is idle, so the resting sidebar stays
 * untouched. Context is faked directly — the component only reads derived
 * display state, so the full Provider (DataService et al.) is not needed.
 */

function makeTimerValue(
  partial: Partial<TimerContextValue>,
): TimerContextValue {
  return {
    phase: "WORK",
    isRunning: false,
    remainingSeconds: 1500,
    progress: 0,
    totalSeconds: 1500,
    completedSessions: 0,
    formatted: "25:00",
    activeTask: null,
    workDurationMinutes: 25,
    breakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    targetSessions: 4,
    presets: [],
    start: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    setPhase: vi.fn(),
    setActiveTask: vi.fn(),
    adjustRemainingMinutes: vi.fn(),
    saveSettings: vi.fn(),
    setAutoStartBreaks: vi.fn(),
    createPreset: vi.fn(async () => {}),
    applyPreset: vi.fn(),
    deletePreset: vi.fn(async () => {}),
    ...partial,
  };
}

function renderWithTimer(value: TimerContextValue, children: ReactNode) {
  return render(
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>,
  );
}

describe("NavTimerStatus (#550)", () => {
  it("renders nothing while the timer is idle", () => {
    const { container } = renderWithTimer(
      makeTimerValue({ isRunning: false }),
      <NavTimerStatus />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the running countdown", () => {
    renderWithTimer(
      makeTimerValue({ isRunning: true, formatted: "24:31" }),
      <NavTimerStatus />,
    );
    expect(screen.getByText("24:31")).toBeInTheDocument();
  });

  it("appends the active task's title when one is linked", () => {
    const { container } = renderWithTimer(
      makeTimerValue({
        isRunning: true,
        formatted: "24:31",
        activeTask: { id: "task-1", title: "Write the report" },
      }),
      <NavTimerStatus />,
    );
    expect(container.textContent).toBe("24:31 · Write the report");
  });

  it("keeps counting down through a break phase", () => {
    renderWithTimer(
      makeTimerValue({ isRunning: true, phase: "BREAK", formatted: "04:59" }),
      <NavTimerStatus />,
    );
    expect(screen.getByText("04:59")).toBeInTheDocument();
  });
});
