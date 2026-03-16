import { createContext } from "react";
import type { SessionType } from "../types/timer";

export interface ActiveTask {
  id: string;
  title: string;
}

export interface TimerContextValue {
  sessionType: SessionType;
  remainingSeconds: number;
  isRunning: boolean;
  completedSessions: number;
  progress: number;
  totalDuration: number;
  sessionsBeforeLongBreak: number;
  workDurationMinutes: number;
  breakDurationMinutes: number;
  longBreakDurationMinutes: number;
  activeTask: ActiveTask | null;
  showCompletionModal: boolean;
  completedSessionType: "WORK" | "REST" | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  formatTime: (seconds: number) => string;
  startForTask: (id: string, title: string) => void;
  openForTask: (id: string, title: string, durationMinutes?: number) => void;
  clearTask: () => void;
  updateActiveTaskTitle: (title: string) => void;
  setWorkDurationMinutes: (min: number) => void;
  setBreakDurationMinutes: (min: number) => void;
  setLongBreakDurationMinutes: (min: number) => void;
  setSessionsBeforeLongBreak: (count: number) => void;
  extendWork: (minutes: number) => void;
  startRest: () => void;
  dismissCompletionModal: () => void;
  autoStartBreaks: boolean;
  setAutoStartBreaks: (enabled: boolean) => void;
  targetSessions: number;
  setTargetSessions: (count: number) => void;
  adjustRemainingSeconds: (delta: number) => void;
  activeRoutineId: string | null;
  startRoutineTimer: (
    routineId: string,
    title: string,
    durationMinutes?: number,
  ) => void;
}

export const TimerContext = createContext<TimerContextValue | null>(null);
