import { describe, it, expect } from "vitest";
import {
  timerReducer,
  createInitialState,
  phaseDurationSeconds,
  elapsedSeconds,
  remainingSeconds,
  nextBreakPhase,
  DEFAULT_CONFIG,
  type TimerState,
  type TimerConfig,
} from "../src/context/timerReducer";

/*
 * W3-B shared Pomodoro reducer. The reducer is start-time based: time is
 * derived from wall-clock anchors (startedAt + accumulatedMs), never ticked
 * down. These tests inject `now` (epoch ms) so the math is deterministic
 * without fake timers; a few cases also use vi fake timers to prove the
 * display recompute is interval-independent.
 */

const CFG: TimerConfig = {
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
};

const T0 = 1_000_000_000_000; // arbitrary epoch ms anchor

function initial(overrides?: Partial<TimerConfig>): TimerState {
  return createInitialState({ ...CFG, ...overrides });
}

describe("phaseDurationSeconds (minutes → seconds)", () => {
  it("converts each phase's minutes to seconds", () => {
    expect(phaseDurationSeconds("WORK", CFG)).toBe(25 * 60);
    expect(phaseDurationSeconds("BREAK", CFG)).toBe(5 * 60);
    expect(phaseDurationSeconds("LONG_BREAK", CFG)).toBe(15 * 60);
  });
});

describe("createInitialState", () => {
  it("starts paused in WORK with the full work duration remaining", () => {
    const s = initial();
    expect(s.phase).toBe("WORK");
    expect(s.isRunning).toBe(false);
    expect(s.startedAt).toBeNull();
    expect(s.accumulatedMs).toBe(0);
    expect(s.durationSeconds).toBe(25 * 60);
    expect(remainingSeconds(s, T0)).toBe(25 * 60);
  });

  it("falls back to DEFAULT_CONFIG when no overrides given", () => {
    const s = createInitialState();
    expect(s.config).toEqual(DEFAULT_CONFIG);
  });
});

describe("nextBreakPhase (long-break cadence)", () => {
  it("is a LONG_BREAK every sessionsBeforeLongBreak completed sessions", () => {
    expect(nextBreakPhase(1, 4)).toBe("BREAK");
    expect(nextBreakPhase(2, 4)).toBe("BREAK");
    expect(nextBreakPhase(3, 4)).toBe("BREAK");
    expect(nextBreakPhase(4, 4)).toBe("LONG_BREAK");
    expect(nextBreakPhase(8, 4)).toBe("LONG_BREAK");
  });

  it("never long-breaks at zero completed sessions", () => {
    expect(nextBreakPhase(0, 4)).toBe("BREAK");
  });
});

describe("START / elapsed / remaining (start-time based)", () => {
  it("anchors startedAt and derives elapsed from wall-clock delta", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    expect(s.isRunning).toBe(true);
    expect(s.startedAt).toBe(T0);
    // 90 s later
    const now = T0 + 90_000;
    expect(elapsedSeconds(s, now)).toBe(90);
    expect(remainingSeconds(s, now)).toBe(25 * 60 - 90);
  });

  it("START is a no-op when already running", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    const again = timerReducer(s, { type: "START", now: T0 + 5000 });
    expect(again).toBe(s); // identical reference (no change)
  });

  it("never produces negative elapsed under a backwards clock", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    expect(elapsedSeconds(s, T0 - 5000)).toBe(0);
  });

  it("remaining clamps at zero past the target", () => {
    let s = initial({ workDuration: 1 }); // 60 s
    s = timerReducer(s, { type: "START", now: T0 });
    expect(remainingSeconds(s, T0 + 120_000)).toBe(0);
  });
});

describe("PAUSE / resume (accumulated offset)", () => {
  it("folds the run segment into accumulatedMs and keeps elapsed across pause", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    // run 40 s then pause
    s = timerReducer(s, { type: "PAUSE", now: T0 + 40_000 });
    expect(s.isRunning).toBe(false);
    expect(s.startedAt).toBeNull();
    expect(s.accumulatedMs).toBe(40_000);
    // paused: elapsed is frozen regardless of `now`
    expect(elapsedSeconds(s, T0 + 999_999)).toBe(40);

    // resume at a much later wall-clock; elapsed continues from 40 s
    s = timerReducer(s, { type: "START", now: T0 + 100_000 });
    expect(elapsedSeconds(s, T0 + 110_000)).toBe(50); // 40 carried + 10 new
  });

  it("PAUSE is a no-op when not running", () => {
    const s = initial();
    const r = timerReducer(s, { type: "PAUSE", now: T0 });
    expect(r).toBe(s);
  });

  it("display math is interval-independent (throttle-safe)", () => {
    // Even if no tick fired for a long stretch, remaining is exact because it
    // reads `now`, not a decremented counter.
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    // simulate a backgrounded tab: no ticks, then check 7 min later
    expect(remainingSeconds(s, T0 + 7 * 60_000)).toBe(25 * 60 - 7 * 60);
  });
});

describe("RESET", () => {
  it("rewinds elapsed to zero in the same phase", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    s = timerReducer(s, { type: "RESET" });
    expect(s.isRunning).toBe(false);
    expect(s.startedAt).toBeNull();
    expect(s.accumulatedMs).toBe(0);
    expect(remainingSeconds(s, T0 + 60_000)).toBe(25 * 60);
    expect(s.phase).toBe("WORK");
  });
});

describe("ADVANCE (WORK → break → WORK)", () => {
  it("WORK → BREAK increments completedSessions and resets elapsed", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    s = timerReducer(s, { type: "ADVANCE", now: T0 + 25 * 60_000 });
    expect(s.completedSessions).toBe(1);
    expect(s.phase).toBe("BREAK");
    expect(s.isRunning).toBe(false);
    expect(s.durationSeconds).toBe(5 * 60);
    expect(remainingSeconds(s, T0)).toBe(5 * 60);
  });

  it("WORK → LONG_BREAK on the 4th completed session", () => {
    let s = initial();
    // simulate 3 prior completed sessions
    s = { ...s, completedSessions: 3 };
    s = timerReducer(s, { type: "ADVANCE", now: T0 });
    expect(s.completedSessions).toBe(4);
    expect(s.phase).toBe("LONG_BREAK");
    expect(s.durationSeconds).toBe(15 * 60);
  });

  it("break → WORK does not change the counter", () => {
    let s = initial();
    s = timerReducer(s, { type: "SET_PHASE", phase: "BREAK" });
    s = { ...s, completedSessions: 2 };
    s = timerReducer(s, { type: "ADVANCE", now: T0 });
    expect(s.phase).toBe("WORK");
    expect(s.completedSessions).toBe(2);
    expect(s.durationSeconds).toBe(25 * 60);
  });
});

describe("SET_PHASE", () => {
  it("jumps phase, pauses, and resets elapsed to the new phase target", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    s = timerReducer(s, { type: "SET_PHASE", phase: "LONG_BREAK" });
    expect(s.phase).toBe("LONG_BREAK");
    expect(s.isRunning).toBe(false);
    expect(s.accumulatedMs).toBe(0);
    expect(remainingSeconds(s, T0 + 5000)).toBe(15 * 60);
  });
});

describe("SET_CONFIG", () => {
  it("reflects the new duration immediately while idle", () => {
    let s = initial();
    s = timerReducer(s, { type: "SET_CONFIG", config: { workDuration: 50 } });
    expect(s.config.workDuration).toBe(50);
    expect(s.durationSeconds).toBe(50 * 60);
  });

  it("keeps the in-flight target while running (applies next phase)", () => {
    let s = initial();
    s = timerReducer(s, { type: "START", now: T0 });
    const before = s.durationSeconds;
    s = timerReducer(s, { type: "SET_CONFIG", config: { workDuration: 50 } });
    expect(s.config.workDuration).toBe(50);
    expect(s.durationSeconds).toBe(before); // unchanged mid-run
  });
});

describe("SET_ACTIVE_TASK", () => {
  it("sets and clears the attributed task", () => {
    let s = initial();
    s = timerReducer(s, {
      type: "SET_ACTIVE_TASK",
      task: { id: "task-1", title: "Write tests" },
    });
    expect(s.activeTask).toEqual({ id: "task-1", title: "Write tests" });
    s = timerReducer(s, { type: "SET_ACTIVE_TASK", task: null });
    expect(s.activeTask).toBeNull();
  });
});
