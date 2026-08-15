export type SessionType = "WORK" | "BREAK" | "LONG_BREAK" | "FREE";

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
  todoId: string | null;
  sessionType: SessionType;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  completed: boolean;
  label: string | null;
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

/*
 * There is no `TimerState` here. The name used to be declared twice with
 * two different shapes — this Phase 2 one (`remainingSeconds` /
 * `currentSessionId`) and the live reducer state in
 * `context/timerReducer.ts` (`phase` / `startedAt` / `accumulatedMs` /
 * `config`). The Phase 2 shape had zero references anywhere in the 4
 * packages and `index.ts` only ever exported the reducer's, so the dead
 * declaration was deleted in #670 C3 PR 2. `TimerState` now means exactly
 * one thing: `import type { TimerState } from "../context/timerReducer"`.
 */
