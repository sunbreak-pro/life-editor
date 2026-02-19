import type { SessionType } from "../types/timer";
import type { ActiveTask } from "./TimerContextValue";

export interface TimerConfig {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export interface TimerState {
  sessionType: SessionType;
  remainingSeconds: number;
  isRunning: boolean;
  completedSessions: number;
  activeTask: ActiveTask | null;
  showCompletionModal: boolean;
  completedSessionType: "WORK" | "REST" | null;
  config: TimerConfig;
}

export type TimerAction =
  | { type: "TICK" }
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "ADVANCE_SESSION" }
  | { type: "START_REST" }
  | { type: "EXTEND_WORK"; minutes: number }
  | { type: "DISMISS_COMPLETION_MODAL" }
  | { type: "SET_ACTIVE_TASK"; task: ActiveTask | null }
  | { type: "UPDATE_ACTIVE_TASK_TITLE"; title: string }
  | { type: "SET_CONFIG"; config: Partial<TimerConfig> }
  | { type: "OPEN_FOR_TASK"; task: ActiveTask; durationSeconds: number }
  | { type: "START_FOR_TASK"; task: ActiveTask; durationSeconds: number }
  | { type: "SET_REMAINING"; seconds: number };

export function getDuration(
  sessionType: SessionType,
  config: TimerConfig,
): number {
  switch (sessionType) {
    case "WORK":
      return config.workDuration;
    case "BREAK":
      return config.breakDuration;
    case "LONG_BREAK":
      return config.longBreakDuration;
  }
}

export const DEFAULT_CONFIG: TimerConfig = {
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  sessionsBeforeLongBreak: 4,
};

export function createInitialState(config?: Partial<TimerConfig>): TimerState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return {
    sessionType: "WORK",
    remainingSeconds: cfg.workDuration,
    isRunning: false,
    completedSessions: 0,
    activeTask: null,
    showCompletionModal: false,
    completedSessionType: null,
    config: cfg,
  };
}

export function timerReducer(
  state: TimerState,
  action: TimerAction,
): TimerState {
  switch (action.type) {
    case "TICK": {
      if (state.remainingSeconds <= 1) {
        // Timer reached zero — handled externally via ADVANCE_SESSION
        return { ...state, remainingSeconds: 0 };
      }
      return { ...state, remainingSeconds: state.remainingSeconds - 1 };
    }

    case "START":
      return { ...state, isRunning: true };

    case "PAUSE":
      return { ...state, isRunning: false };

    case "RESET":
      return {
        ...state,
        isRunning: false,
        remainingSeconds: getDuration(state.sessionType, state.config),
      };

    case "ADVANCE_SESSION": {
      if (state.sessionType === "WORK") {
        // Work completed → increment completedSessions and show modal
        return {
          ...state,
          isRunning: false,
          completedSessions: state.completedSessions + 1,
          showCompletionModal: true,
          completedSessionType: "WORK",
        };
      }
      // Rest completed → transition to WORK, show modal (no increment here)
      return {
        ...state,
        isRunning: false,
        sessionType: "WORK",
        remainingSeconds: state.config.workDuration,
        showCompletionModal: true,
        completedSessionType: "REST",
      };
    }

    case "START_REST": {
      const isLongBreak =
        state.completedSessions % state.config.sessionsBeforeLongBreak === 0;
      const nextType: SessionType = isLongBreak ? "LONG_BREAK" : "BREAK";
      return {
        ...state,
        showCompletionModal: false,
        completedSessionType: null,
        isRunning: true,
        sessionType: nextType,
        remainingSeconds: isLongBreak
          ? state.config.longBreakDuration
          : state.config.breakDuration,
      };
    }

    case "EXTEND_WORK":
      return {
        ...state,
        showCompletionModal: false,
        isRunning: true,
        remainingSeconds: action.minutes * 60,
      };

    case "DISMISS_COMPLETION_MODAL":
      return {
        ...state,
        showCompletionModal: false,
        completedSessionType: null,
      };

    case "SET_ACTIVE_TASK":
      return { ...state, activeTask: action.task };

    case "UPDATE_ACTIVE_TASK_TITLE":
      return {
        ...state,
        activeTask: state.activeTask
          ? { ...state.activeTask, title: action.title }
          : null,
      };

    case "SET_CONFIG": {
      const newConfig = { ...state.config, ...action.config };
      // If not running, update remaining seconds to match new duration for current session type
      const newRemaining = !state.isRunning
        ? getDuration(state.sessionType, newConfig)
        : state.remainingSeconds;
      return {
        ...state,
        config: newConfig,
        remainingSeconds: newRemaining,
      };
    }

    case "OPEN_FOR_TASK":
      return {
        ...state,
        isRunning: false,
        activeTask: action.task,
        sessionType: "WORK",
        remainingSeconds: action.durationSeconds,
      };

    case "START_FOR_TASK":
      return {
        ...state,
        isRunning: true,
        activeTask: action.task,
        sessionType: "WORK",
        remainingSeconds: action.durationSeconds,
      };

    case "SET_REMAINING":
      return { ...state, remainingSeconds: action.seconds };

    default:
      return state;
  }
}
