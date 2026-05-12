import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSessionCompletionToast } from "./useSessionCompletionToast";

const showToast = vi.fn();
const incrementActualMinutes = vi.fn(() => Promise.resolve());

const timerState = {
  completedSessions: 0,
  workDurationMinutes: 25,
  activeTask: null as {
    id: string;
    title: string;
    kind?: "task" | "event";
  } | null,
};

vi.mock("./useTimerContext", () => ({
  useTimerContext: () => timerState,
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../services/dataServiceFactory", () => ({
  getDataService: () => ({
    incrementScheduleItemActualMinutes: incrementActualMinutes,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const fallback = (opts?.defaultValue as string | undefined) ?? key;
      return fallback.replace(/{{(\w+)}}/g, (_, k) => String(opts?.[k] ?? ""));
    },
  }),
}));

describe("useSessionCompletionToast", () => {
  beforeEach(() => {
    showToast.mockReset();
    incrementActualMinutes.mockClear();
    timerState.completedSessions = 0;
    timerState.workDurationMinutes = 25;
    timerState.activeTask = null;
  });

  it("shows nothing on first render (no increase)", () => {
    renderHook(() => useSessionCompletionToast());
    expect(showToast).not.toHaveBeenCalled();
  });

  it("fires toast with task title when completedSessions increments", () => {
    timerState.activeTask = { id: "t1", title: "Write report" };
    const { rerender } = renderHook(() => useSessionCompletionToast());
    timerState.completedSessions = 1;
    rerender();
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      "success",
      "✓ Recorded 25min to Write report",
    );
  });

  it("fires toast without task title when no active task", () => {
    timerState.activeTask = null;
    const { rerender } = renderHook(() => useSessionCompletionToast());
    timerState.completedSessions = 1;
    rerender();
    expect(showToast).toHaveBeenCalledWith("success", "✓ Recorded 25min");
  });

  it("does not fire when completedSessions stays the same", () => {
    timerState.completedSessions = 3;
    const { rerender } = renderHook(() => useSessionCompletionToast());
    rerender();
    rerender();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("writes actual_time_minutes back when subject is an Event", () => {
    timerState.activeTask = {
      id: "event-42",
      title: "Morning standup",
      kind: "event",
    };
    timerState.workDurationMinutes = 25;
    const { rerender } = renderHook(() => useSessionCompletionToast());
    timerState.completedSessions = 1;
    rerender();

    expect(incrementActualMinutes).toHaveBeenCalledTimes(1);
    expect(incrementActualMinutes).toHaveBeenCalledWith("event-42", 25);
    expect(showToast).toHaveBeenCalledWith(
      "success",
      "✓ Recorded 25min to event Morning standup",
    );
  });

  it("does not write actual_time_minutes for Task subjects", () => {
    timerState.activeTask = {
      id: "task-1",
      title: "Refactor module",
      kind: "task",
    };
    const { rerender } = renderHook(() => useSessionCompletionToast());
    timerState.completedSessions = 1;
    rerender();

    expect(incrementActualMinutes).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "success",
      "✓ Recorded 25min to Refactor module",
    );
  });
});
