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

/** Which kind of item a session is attributed to (#1375). */
export type WorkTargetKind = "todo" | "event";

/**
 * What a session is measured against — a Todo or an Event (#1375).
 *
 * One object rather than two optional ids: the DB says the same thing with a
 * CHECK (`task_id is null or event_id is null`, 0029), and a pair of optional
 * arguments would let a caller pass both and only find out at the round trip.
 * Item ids are unique across roles (CLAUDE.md §4), so `kind` is not there to
 * disambiguate the id — it names the COLUMN the row is written to.
 */
export interface WorkTarget {
  kind: WorkTargetKind;
  id: string;
}

export interface TimerSession {
  id: number;
  todoId: string | null;
  /**
   * The Event this session was measured against (`event_id`, 0029), or null.
   * At most one of `todoId` / `eventId` is set — the DB enforces it.
   *
   * Optional so the session literals already spread across the suites keep
   * compiling; `rowToTimerSession` always fills it, so production values never
   * carry `undefined`.
   */
  eventId?: string | null;
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
