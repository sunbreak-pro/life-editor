import type { SessionType } from "../types/timer";

/*
 * Shared Pomodoro timer reducer (W3-B). A v2 reimplementation of the FROZEN
 * `frontend/src/context/timerReducer.ts`, redesigned around the confirmed
 * START-TIME based model (plan 2026-06-10, ユーザー確定 #4):
 *
 *   The remaining time is NOT decremented on a tick. Instead the elapsed time
 *   is computed from wall-clock anchors — `startedAt` (epoch ms of the current
 *   run segment) plus `accumulatedMs` (elapsed captured across previous
 *   run/pause segments). A 1 s interval only forces a re-render so the display
 *   recomputes; if the browser throttles the interval (background tab) the
 *   time math stays exact because it reads `Date.now()`, never a counter.
 *
 * Pause is handled by folding the current segment's elapsed into
 * `accumulatedMs` and clearing `startedAt`; resume re-anchors `startedAt` to
 * `now` and keeps `accumulatedMs`. This is why the reducer takes `now` (epoch
 * ms) on the time-sensitive actions — it stays pure (no `Date.now()` inside)
 * and is therefore deterministic under fake timers.
 *
 * Differences vs the FROZEN Tauri reducer:
 *  - FREE mode is GONE from the UI flow (section-unification 確定). The
 *    SessionType union still carries "FREE" (DB CHECK + domain type are
 *    FROZEN), but this reducer never enters it.
 *  - Durations are stored in MINUTES (matching 0018 columns + domain
 *    TimerSettings.workDuration), converted to seconds only for display.
 *  - No tray, no routine timer, no completion-modal state machine — the
 *    Pomodoro WORK→BREAK→… transition is explicit (ADVANCE) and the host
 *    decides whether to auto-start the next phase (auto_start_breaks).
 */

/** Phase the timer can be in. FREE is intentionally unreachable (UI dropped). */
export type TimerPhase = "WORK" | "BREAK" | "LONG_BREAK";

/** Durations are in MINUTES (0018 columns + domain TimerSettings). */
export interface TimerConfig {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

/** The task a session is attributed to (task_id on timer_sessions). */
export interface ActiveTask {
  id: string;
  title: string;
}

export interface TimerState {
  phase: TimerPhase;
  isRunning: boolean;
  /** Epoch ms of the current run segment, or null when paused/idle. */
  startedAt: number | null;
  /** Elapsed ms folded in from previous run segments (pause carry-over). */
  accumulatedMs: number;
  /** Target length of the current phase, in seconds. */
  durationSeconds: number;
  /** Completed WORK sessions in the current run (drives long-break cadence). */
  completedSessions: number;
  activeTask: ActiveTask | null;
  config: TimerConfig;
}

export type TimerAction =
  | { type: "START"; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "RESET" }
  | { type: "ADVANCE"; now: number }
  | { type: "SET_PHASE"; phase: TimerPhase }
  | { type: "SET_CONFIG"; config: Partial<TimerConfig> }
  | { type: "SET_ACTIVE_TASK"; task: ActiveTask | null }
  | { type: "ADJUST_REMAINING"; deltaMinutes: number };

export const DEFAULT_CONFIG: TimerConfig = {
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
};

/** Phase target length in SECONDS for the given config. */
export function phaseDurationSeconds(
  phase: TimerPhase,
  config: TimerConfig,
): number {
  switch (phase) {
    case "WORK":
      return config.workDuration * 60;
    case "BREAK":
      return config.breakDuration * 60;
    case "LONG_BREAK":
      return config.longBreakDuration * 60;
  }
}

/**
 * Elapsed seconds for a state at wall-clock `now` (epoch ms). Pure: reads the
 * anchors, never the clock. Running segments add (now - startedAt); the result
 * is clamped to >= 0 (a backwards clock never produces negative elapsed).
 */
export function elapsedSeconds(state: TimerState, now: number): number {
  const liveMs =
    state.isRunning && state.startedAt !== null
      ? Math.max(0, now - state.startedAt)
      : 0;
  return Math.floor((state.accumulatedMs + liveMs) / 1000);
}

/**
 * Remaining seconds = target - elapsed, clamped to >= 0. The display reads
 * this each render; when it hits 0 the host fires ADVANCE.
 */
export function remainingSeconds(state: TimerState, now: number): number {
  return Math.max(0, state.durationSeconds - elapsedSeconds(state, now));
}

export function createInitialState(config?: Partial<TimerConfig>): TimerState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return {
    phase: "WORK",
    isRunning: false,
    startedAt: null,
    accumulatedMs: 0,
    durationSeconds: phaseDurationSeconds("WORK", cfg),
    completedSessions: 0,
    activeTask: null,
    config: cfg,
  };
}

/** The phase that follows a completed WORK session, given the cadence. */
export function nextBreakPhase(
  completedSessions: number,
  sessionsBeforeLongBreak: number,
): TimerPhase {
  // A long break lands after every `sessionsBeforeLongBreak` WORK sessions.
  // `completedSessions` already INCLUDES the WORK that just finished.
  return completedSessions > 0 &&
    completedSessions % sessionsBeforeLongBreak === 0
    ? "LONG_BREAK"
    : "BREAK";
}

export function timerReducer(
  state: TimerState,
  action: TimerAction,
): TimerState {
  switch (action.type) {
    case "START": {
      if (state.isRunning) return state;
      // Re-anchor to now; accumulatedMs carries any pre-pause elapsed.
      return { ...state, isRunning: true, startedAt: action.now };
    }

    case "PAUSE": {
      if (!state.isRunning || state.startedAt === null) return state;
      const segment = Math.max(0, action.now - state.startedAt);
      return {
        ...state,
        isRunning: false,
        startedAt: null,
        accumulatedMs: state.accumulatedMs + segment,
      };
    }

    case "RESET":
      // Stay in the same phase but rewind elapsed to zero.
      return {
        ...state,
        isRunning: false,
        startedAt: null,
        accumulatedMs: 0,
        durationSeconds: phaseDurationSeconds(state.phase, state.config),
      };

    case "ADVANCE": {
      // The current phase finished. WORK → break (increments the counter);
      // a break → WORK. The next phase starts paused (host auto-starts it
      // when auto_start_breaks is on).
      if (state.phase === "WORK") {
        const completedSessions = state.completedSessions + 1;
        const nextPhase = nextBreakPhase(
          completedSessions,
          state.config.sessionsBeforeLongBreak,
        );
        return {
          ...state,
          phase: nextPhase,
          isRunning: false,
          startedAt: null,
          accumulatedMs: 0,
          durationSeconds: phaseDurationSeconds(nextPhase, state.config),
          completedSessions,
        };
      }
      // Break finished → back to WORK (no counter change).
      return {
        ...state,
        phase: "WORK",
        isRunning: false,
        startedAt: null,
        accumulatedMs: 0,
        durationSeconds: phaseDurationSeconds("WORK", state.config),
      };
    }

    case "SET_PHASE":
      return {
        ...state,
        phase: action.phase,
        isRunning: false,
        startedAt: null,
        accumulatedMs: 0,
        durationSeconds: phaseDurationSeconds(action.phase, state.config),
      };

    case "SET_CONFIG": {
      const config = { ...state.config, ...action.config };
      // When idle, reflect the new phase length immediately. While running,
      // keep the in-flight target (a settings change applies next phase).
      const durationSeconds = !state.isRunning
        ? phaseDurationSeconds(state.phase, config)
        : state.durationSeconds;
      return { ...state, config, durationSeconds };
    }

    case "SET_ACTIVE_TASK":
      return { ...state, activeTask: action.task };

    case "ADJUST_REMAINING": {
      // Nudge the current phase length by ±deltaMinutes while paused/idle so
      // the ring + MM:SS reflect the new remaining time. No-op while running
      // (mid-run the in-flight target must stay fixed). Elapsed is read from
      // accumulatedMs alone (no live segment when !isRunning), so this stays
      // pure (no `now` needed). Remaining never drops below 1 minute.
      if (state.isRunning) return state;
      const elapsed = Math.floor(state.accumulatedMs / 1000);
      const remaining = Math.max(0, state.durationSeconds - elapsed);
      const remainingAfter = Math.max(60, remaining + action.deltaMinutes * 60);
      return { ...state, durationSeconds: elapsed + remainingAfter };
    }

    default:
      return state;
  }
}
