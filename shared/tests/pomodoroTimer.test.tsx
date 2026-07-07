import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PomodoroTimer,
  type PomodoroTimerProps,
} from "../src/components/PomodoroTimer";

/*
 * Work / Pomodoro timer face. Pure primitive — props-injected copy (§6.4).
 * These cover the three UI states (idle / running / paused), the transport
 * wiring, and the paused-only ±5 pills.
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
  sessionsProgress: "2 / 4 sessions",
};

function renderTimer(overrides?: Partial<PomodoroTimerProps>) {
  const props: PomodoroTimerProps = {
    phase: "WORK",
    isRunning: false,
    formatted: "25:00",
    totalFormatted: "25:00",
    progress: 0,
    sessions: { total: 4, filled: 2 },
    labels: LABELS,
    onStart: vi.fn(),
    onPause: vi.fn(),
    onReset: vi.fn(),
    onSkip: vi.fn(),
    onAdjust: vi.fn(),
    ...overrides,
  };
  render(<PomodoroTimer {...props} />);
  return props;
}

describe("PomodoroTimer", () => {
  it("shows the phase label, readout and session progress", () => {
    renderTimer();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("2 / 4 sessions")).toBeInTheDocument();
  });

  it("idle: the main button is Start and reset/skip are disabled", () => {
    renderTimer({ isRunning: false, progress: 0 });
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
  });

  it("running: the main button is Pause and fires onPause", () => {
    const props = renderTimer({ isRunning: true, progress: 30 });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(props.onPause).toHaveBeenCalledOnce();
    // Reset/skip are enabled while running.
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
  });

  it("paused: shows the paused chip + Resume and hides the ±5 pills otherwise", () => {
    renderTimer({ isRunning: false, progress: 40 });
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "-5 min" })).toBeInTheDocument();
  });

  it("paused: the ±5 pills fire onAdjust with ±5", () => {
    const props = renderTimer({ isRunning: false, progress: 40 });
    fireEvent.click(screen.getByRole("button", { name: "-5 min" }));
    fireEvent.click(screen.getByRole("button", { name: "+5 min" }));
    expect(props.onAdjust).toHaveBeenNthCalledWith(1, -5);
    expect(props.onAdjust).toHaveBeenNthCalledWith(2, 5);
  });

  it("idle: no paused chip and no ±5 pills", () => {
    renderTimer({ isRunning: false, progress: 0 });
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "-5 min" }),
    ).not.toBeInTheDocument();
  });
});
