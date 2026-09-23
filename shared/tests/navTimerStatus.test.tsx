import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  BottomTabBar,
  NavItem,
  NavTimerDot,
  NavTimerStatus,
} from "../src/components";
import { TimerContext, type TimerContextValue } from "../src/context";

/*
 * #550 — the Work nav row's live timer line. A TimerContext bridge: renders
 * the running countdown (+ the active todo's title when one is linked) and
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
    lastLoggedWorkSeconds: null,
    formatted: "25:00",
    activeItem: null,
    workDurationMinutes: 25,
    breakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    targetSessions: 4,
    presets: [],
    // #1665: the free session's tag selection lives on the context too.
    freeSessionTagIds: [],
    setFreeSessionTagIds: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    setPhase: vi.fn(),
    setActiveItem: vi.fn(),
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

  it("appends the active todo's title when one is linked", () => {
    const { container } = renderWithTimer(
      makeTimerValue({
        isRunning: true,
        formatted: "24:31",
        activeItem: { id: "task-1", title: "Write the report", kind: "todo" },
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

describe("NavTimerDot (#1858)", () => {
  it("renders nothing while the timer is idle", () => {
    const { container } = renderWithTimer(
      makeTimerValue({ isRunning: false }),
      <NavTimerDot />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the dot while the timer runs, break phase included", () => {
    renderWithTimer(
      makeTimerValue({ isRunning: true, phase: "BREAK" }),
      <NavTimerDot />,
    );
    expect(screen.getByTestId("nav-timer-dot")).toBeInTheDocument();
  });

  // The expanded row already says it in words (the sublabel), so the dot is
  // only for the collapsed rail, where the sublabel is hidden.
  it("draws the badge on the collapsed rail only", () => {
    const running = makeTimerValue({ isRunning: true });
    const row = (collapsed: boolean) => (
      <NavItem
        icon={<svg />}
        label="Work"
        sublabel={<NavTimerStatus />}
        badge={<NavTimerDot />}
        collapsed={collapsed}
        onClick={() => {}}
      />
    );
    const { rerender } = renderWithTimer(running, row(false));
    expect(screen.queryByTestId("nav-timer-dot")).not.toBeInTheDocument();
    rerender(
      <TimerContext.Provider value={running}>{row(true)}</TimerContext.Provider>,
    );
    expect(screen.getByTestId("nav-timer-dot")).toBeInTheDocument();
  });

  it("draws the badge on a fixed bottom tab", () => {
    renderWithTimer(
      makeTimerValue({ isRunning: true }),
      <BottomTabBar
        sections={[
          { id: "work", label: "Work", icon: <svg />, badge: <NavTimerDot /> },
        ]}
        activeSection="materials"
        onNavigate={() => {}}
        labels={{ more: "More", moreTitle: "More", moreClose: "Close" }}
      />,
    );
    const tab = screen.getByRole("button", { name: "Work" });
    expect(
      tab.querySelector('[data-testid="nav-timer-dot"]'),
    ).toBeInTheDocument();
  });
});
