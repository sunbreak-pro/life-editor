import {
  timerReducer,
  createInitialState,
  getDuration,
  DEFAULT_CONFIG,
} from "./timerReducer";
import type { TimerState } from "./timerReducer";
import { describe, it, expect } from "vitest";

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  return { ...createInitialState(), ...overrides };
}

describe("timerReducer", () => {
  describe("TICK", () => {
    it("decrements remainingSeconds by 1", () => {
      const state = makeState({ remainingSeconds: 100, isRunning: true });
      const next = timerReducer(state, { type: "TICK" });
      expect(next.remainingSeconds).toBe(99);
    });

    it("sets to 0 when reaching 1", () => {
      const state = makeState({ remainingSeconds: 1, isRunning: true });
      const next = timerReducer(state, { type: "TICK" });
      expect(next.remainingSeconds).toBe(0);
    });

    it("does not go below 0", () => {
      const state = makeState({ remainingSeconds: 0, isRunning: true });
      const next = timerReducer(state, { type: "TICK" });
      expect(next.remainingSeconds).toBe(0);
    });
  });

  describe("START", () => {
    it("sets isRunning to true", () => {
      const state = makeState({ isRunning: false });
      const next = timerReducer(state, { type: "START" });
      expect(next.isRunning).toBe(true);
    });
  });

  describe("PAUSE", () => {
    it("sets isRunning to false", () => {
      const state = makeState({ isRunning: true });
      const next = timerReducer(state, { type: "PAUSE" });
      expect(next.isRunning).toBe(false);
    });
  });

  describe("RESET", () => {
    it("stops timer and resets remaining seconds", () => {
      const state = makeState({
        isRunning: true,
        remainingSeconds: 100,
        sessionType: "WORK",
      });
      const next = timerReducer(state, { type: "RESET" });
      expect(next.isRunning).toBe(false);
      expect(next.remainingSeconds).toBe(DEFAULT_CONFIG.workDuration);
    });

    it("resets to break duration when in break", () => {
      const state = makeState({
        isRunning: true,
        remainingSeconds: 50,
        sessionType: "BREAK",
      });
      const next = timerReducer(state, { type: "RESET" });
      expect(next.remainingSeconds).toBe(DEFAULT_CONFIG.breakDuration);
    });
  });

  describe("ADVANCE_SESSION", () => {
    it("shows completion modal and increments completedSessions when WORK ends", () => {
      const state = makeState({
        sessionType: "WORK",
        isRunning: true,
        completedSessions: 0,
      });
      const next = timerReducer(state, { type: "ADVANCE_SESSION" });
      expect(next.showCompletionModal).toBe(true);
      expect(next.isRunning).toBe(false);
      expect(next.completedSessions).toBe(1);
    });

    it("transitions to WORK without incrementing completedSessions when REST ends", () => {
      const state = makeState({
        sessionType: "BREAK",
        isRunning: true,
        completedSessions: 1,
      });
      const next = timerReducer(state, { type: "ADVANCE_SESSION" });
      expect(next.sessionType).toBe("WORK");
      expect(next.isRunning).toBe(false);
      expect(next.remainingSeconds).toBe(DEFAULT_CONFIG.workDuration);
      expect(next.completedSessions).toBe(1);
    });

    it("does not increment completedSessions when LONG_BREAK ends", () => {
      const state = makeState({
        sessionType: "LONG_BREAK",
        completedSessions: 4,
      });
      const next = timerReducer(state, { type: "ADVANCE_SESSION" });
      expect(next.completedSessions).toBe(4);
    });
  });

  describe("START_REST", () => {
    it("transitions to BREAK without changing completedSessions", () => {
      const state = makeState({
        sessionType: "WORK",
        completedSessions: 1,
        showCompletionModal: true,
      });
      const next = timerReducer(state, { type: "START_REST" });
      expect(next.sessionType).toBe("BREAK");
      expect(next.isRunning).toBe(true);
      expect(next.showCompletionModal).toBe(false);
      expect(next.completedSessions).toBe(1);
      expect(next.remainingSeconds).toBe(DEFAULT_CONFIG.breakDuration);
    });

    it("transitions to LONG_BREAK when completedSessions is divisible by sessionsBeforeLongBreak", () => {
      const state = makeState({ sessionType: "WORK", completedSessions: 4 });
      const next = timerReducer(state, { type: "START_REST" });
      expect(next.sessionType).toBe("LONG_BREAK");
      expect(next.completedSessions).toBe(4);
      expect(next.remainingSeconds).toBe(DEFAULT_CONFIG.longBreakDuration);
    });
  });

  describe("EXTEND_WORK", () => {
    it("sets remaining time and starts running", () => {
      const state = makeState({ showCompletionModal: true, isRunning: false });
      const next = timerReducer(state, { type: "EXTEND_WORK", minutes: 10 });
      expect(next.remainingSeconds).toBe(600);
      expect(next.isRunning).toBe(true);
      expect(next.showCompletionModal).toBe(false);
    });
  });

  describe("DISMISS_COMPLETION_MODAL", () => {
    it("hides the modal", () => {
      const state = makeState({ showCompletionModal: true });
      const next = timerReducer(state, { type: "DISMISS_COMPLETION_MODAL" });
      expect(next.showCompletionModal).toBe(false);
    });
  });

  describe("SET_ACTIVE_TASK", () => {
    it("sets active task", () => {
      const state = makeState();
      const next = timerReducer(state, {
        type: "SET_ACTIVE_TASK",
        task: { id: "task-1", title: "Test" },
      });
      expect(next.activeTask).toEqual({ id: "task-1", title: "Test" });
    });

    it("clears active task", () => {
      const state = makeState({ activeTask: { id: "task-1", title: "Test" } });
      const next = timerReducer(state, { type: "SET_ACTIVE_TASK", task: null });
      expect(next.activeTask).toBeNull();
    });
  });

  describe("UPDATE_ACTIVE_TASK_TITLE", () => {
    it("updates title when task exists", () => {
      const state = makeState({ activeTask: { id: "task-1", title: "Old" } });
      const next = timerReducer(state, {
        type: "UPDATE_ACTIVE_TASK_TITLE",
        title: "New",
      });
      expect(next.activeTask?.title).toBe("New");
    });

    it("no-op when no active task", () => {
      const state = makeState({ activeTask: null });
      const next = timerReducer(state, {
        type: "UPDATE_ACTIVE_TASK_TITLE",
        title: "Test",
      });
      expect(next.activeTask).toBeNull();
    });
  });

  describe("SET_CONFIG", () => {
    it("updates config", () => {
      const state = makeState();
      const next = timerReducer(state, {
        type: "SET_CONFIG",
        config: { workDuration: 30 * 60 },
      });
      expect(next.config.workDuration).toBe(30 * 60);
    });

    it("updates remaining seconds when not running", () => {
      const state = makeState({ isRunning: false, sessionType: "WORK" });
      const next = timerReducer(state, {
        type: "SET_CONFIG",
        config: { workDuration: 30 * 60 },
      });
      expect(next.remainingSeconds).toBe(30 * 60);
    });

    it("preserves remaining seconds when running", () => {
      const state = makeState({ isRunning: true, remainingSeconds: 100 });
      const next = timerReducer(state, {
        type: "SET_CONFIG",
        config: { workDuration: 30 * 60 },
      });
      expect(next.remainingSeconds).toBe(100);
    });
  });

  describe("OPEN_FOR_TASK", () => {
    it("sets task and session without starting", () => {
      const state = makeState();
      const next = timerReducer(state, {
        type: "OPEN_FOR_TASK",
        task: { id: "task-1", title: "Test" },
        durationSeconds: 1800,
      });
      expect(next.isRunning).toBe(false);
      expect(next.activeTask?.id).toBe("task-1");
      expect(next.sessionType).toBe("WORK");
      expect(next.remainingSeconds).toBe(1800);
    });
  });

  describe("START_FOR_TASK", () => {
    it("sets task and starts immediately", () => {
      const state = makeState();
      const next = timerReducer(state, {
        type: "START_FOR_TASK",
        task: { id: "task-1", title: "Test" },
        durationSeconds: 1500,
      });
      expect(next.isRunning).toBe(true);
      expect(next.activeTask?.id).toBe("task-1");
      expect(next.remainingSeconds).toBe(1500);
    });
  });
});

describe("getDuration", () => {
  it("returns work duration", () => {
    expect(getDuration("WORK", DEFAULT_CONFIG)).toBe(
      DEFAULT_CONFIG.workDuration,
    );
  });
  it("returns break duration", () => {
    expect(getDuration("BREAK", DEFAULT_CONFIG)).toBe(
      DEFAULT_CONFIG.breakDuration,
    );
  });
  it("returns long break duration", () => {
    expect(getDuration("LONG_BREAK", DEFAULT_CONFIG)).toBe(
      DEFAULT_CONFIG.longBreakDuration,
    );
  });
});

describe("createInitialState", () => {
  it("creates state with defaults", () => {
    const state = createInitialState();
    expect(state.sessionType).toBe("WORK");
    expect(state.isRunning).toBe(false);
    expect(state.remainingSeconds).toBe(DEFAULT_CONFIG.workDuration);
  });

  it("accepts config overrides", () => {
    const state = createInitialState({ workDuration: 30 * 60 });
    expect(state.remainingSeconds).toBe(30 * 60);
    expect(state.config.workDuration).toBe(30 * 60);
  });
});

describe("full pomodoro cycle (sessionsBeforeLongBreak=4)", () => {
  it("reaches LONG_BREAK after 4 WORK+REST cycles", () => {
    let state = createInitialState();

    for (let i = 1; i <= 4; i++) {
      // WORK completes → ADVANCE_SESSION increments completedSessions
      state = timerReducer(state, { type: "ADVANCE_SESSION" });
      expect(state.completedSessions).toBe(i);
      expect(state.showCompletionModal).toBe(true);
      expect(state.completedSessionType).toBe("WORK");

      // User starts rest → START_REST does NOT increment
      state = timerReducer(state, { type: "START_REST" });
      expect(state.completedSessions).toBe(i);
      expect(state.isRunning).toBe(true);

      if (i < 4) {
        expect(state.sessionType).toBe("BREAK");
        // BREAK completes → ADVANCE_SESSION does NOT increment
        state = timerReducer(state, { type: "ADVANCE_SESSION" });
        expect(state.completedSessions).toBe(i);
        expect(state.sessionType).toBe("WORK");
      } else {
        // 4th cycle → LONG_BREAK
        expect(state.sessionType).toBe("LONG_BREAK");
      }
    }

    // LONG_BREAK completes → back to WORK, completedSessions unchanged
    state = timerReducer(state, { type: "ADVANCE_SESSION" });
    expect(state.completedSessions).toBe(4);
    expect(state.sessionType).toBe("WORK");
  });
});
