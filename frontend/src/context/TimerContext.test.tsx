import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { TimerProvider } from "./TimerContext";
import { TimerContext } from "./TimerContextValue";
import { useContext } from "react";
import { createMockDataService } from "../test/mockDataService";
import { setDataServiceForTest } from "../services/dataServiceFactory";
import { describe, it, expect } from "vitest";

function useTimerTest() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("TimerContext not found");
  return ctx;
}

function wrapper({ children }: { children: ReactNode }) {
  return <TimerProvider>{children}</TimerProvider>;
}

function setupMock() {
  const mock = createMockDataService();
  setDataServiceForTest(mock);
  return mock;
}

describe("TimerContext", () => {
  it("provides default values", async () => {
    setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    expect(result.current.sessionType).toBe("WORK");
    expect(result.current.isRunning).toBe(false);
    expect(result.current.completedSessions).toBe(0);
  });

  it("start sets isRunning and records session", async () => {
    const mock = setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    await act(async () => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);
    await waitFor(() => {
      expect(mock.startTimerSession).toHaveBeenCalledWith("WORK", undefined);
    });
  });

  it("pause sets isRunning to false", async () => {
    setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      result.current.pause();
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("reset restores initial remaining seconds", async () => {
    setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    await act(async () => {
      result.current.start();
    });

    // Wait a tick so remaining decrements
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });

    const beforeReset = result.current.remainingSeconds;
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.remainingSeconds).toBeGreaterThan(beforeReset);
  });

  it("startForTask sets active task and starts running", async () => {
    const mock = setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    await act(async () => {
      result.current.startForTask("task-1", "My Task");
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.activeTask?.id).toBe("task-1");
    expect(result.current.activeTask?.title).toBe("My Task");
    await waitFor(() => {
      expect(mock.startTimerSession).toHaveBeenCalledWith("WORK", "task-1");
    });
  });

  it("openForTask sets task without starting", async () => {
    setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    await act(async () => {
      result.current.openForTask("task-2", "Another Task");
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.activeTask?.id).toBe("task-2");
  });

  it("clearTask removes active task", async () => {
    setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    await act(async () => {
      result.current.startForTask("task-1", "Test");
    });
    await act(async () => {
      result.current.clearTask();
    });

    expect(result.current.activeTask).toBeNull();
  });

  it("formatTime formats correctly", async () => {
    setupMock();
    const { result } = renderHook(useTimerTest, { wrapper });

    expect(result.current.formatTime(65)).toBe("01:05");
    expect(result.current.formatTime(0)).toBe("00:00");
    expect(result.current.formatTime(3600)).toBe("60:00");
  });

  it("loads settings from DataService on mount", async () => {
    const mock = setupMock();
    mock.fetchTimerSettings.mockResolvedValue({
      id: 1,
      workDuration: 30,
      breakDuration: 10,
      longBreakDuration: 20,
      sessionsBeforeLongBreak: 3,
      updatedAt: new Date(),
    });

    const { result } = renderHook(useTimerTest, { wrapper });

    await waitFor(() => {
      expect(result.current.workDurationMinutes).toBe(30);
    });
  });
});
