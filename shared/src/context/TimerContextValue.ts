import { createContext } from "react";
import type { PomodoroPreset } from "../types/timer";
import type { ActiveTask, TimerPhase } from "./timerReducer";

/*
 * Timer context value (W3-B). Pattern A (CLAUDE.md §6.3). Timer is enabled on
 * Mobile too (it is NOT in the §2 Mobile 省略 Provider list), so this is a
 * normal REQUIRED context (default null + throwing hook), not an Optional
 * variant. The Pomodoro flow is start-time based (see timerReducer.ts).
 *
 * The value exposes derived, display-ready fields (remainingSeconds /
 * progress / formatted) recomputed each second from the wall-clock anchors,
 * plus the imperative controls and the settings/preset surface the Work tab
 * needs. Durations are surfaced in MINUTES (matching the 0018 columns and the
 * domain TimerSettings) — the UI edits minutes.
 */
export interface TimerContextValue {
  // --- live, derived display state ---
  phase: TimerPhase;
  isRunning: boolean;
  /** Seconds left in the current phase (clamped >= 0). */
  remainingSeconds: number;
  /** 0–100 percent of the current phase elapsed. */
  progress: number;
  /** Target length of the current phase, in seconds. */
  totalSeconds: number;
  /** Completed WORK sessions in the current run. */
  completedSessions: number;
  /** "MM:SS" of `remainingSeconds`. */
  formatted: string;
  activeTask: ActiveTask | null;

  // --- settings (minutes) ---
  workDurationMinutes: number;
  breakDurationMinutes: number;
  longBreakDurationMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  targetSessions: number;

  // --- presets ---
  presets: PomodoroPreset[];

  // --- controls ---
  start: () => void;
  pause: () => void;
  reset: () => void;
  /** Force the timer onto a given phase (idle, elapsed reset). */
  setPhase: (phase: TimerPhase) => void;
  /** Attribute future sessions to this task (or clear with null). */
  setActiveTask: (task: ActiveTask | null) => void;
  /**
   * Nudge the current phase's remaining time by ±`delta` minutes. Only takes
   * effect while paused/idle (no-op while running); remaining never drops
   * below 1 minute. Powers the −5/+5 pills on the paused timer face.
   */
  adjustRemainingMinutes: (delta: number) => void;

  // --- settings mutators (persist via DataService) ---
  setWorkDurationMinutes: (min: number) => void;
  setBreakDurationMinutes: (min: number) => void;
  setLongBreakDurationMinutes: (min: number) => void;
  setSessionsBeforeLongBreak: (count: number) => void;
  setAutoStartBreaks: (enabled: boolean) => void;
  setTargetSessions: (count: number) => void;

  // --- preset CRUD ---
  createPresetFromCurrent: (name: string) => Promise<void>;
  applyPreset: (preset: PomodoroPreset) => void;
  deletePreset: (id: number) => Promise<void>;
}

export const TimerContext = createContext<TimerContextValue | null>(null);
