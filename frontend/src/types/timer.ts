export type SessionType = "WORK" | "BREAK" | "LONG_BREAK";

export interface TimerSettings {
  id: number;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  targetSessions: number;
  updatedAt: Date;
}

export interface TimerSession {
  id: number;
  taskId: string | null;
  sessionType: SessionType;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  completed: boolean;
}

export interface PomodoroPreset {
  id: number;
  name: string;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  createdAt: string;
}

export interface TimerState {
  isRunning: boolean;
  currentSessionType: SessionType;
  remainingSeconds: number;
  completedSessions: number;
  currentSessionId: number | null;
}
