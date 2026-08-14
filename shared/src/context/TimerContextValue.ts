import { createContext } from "react";
import type { PomodoroPreset } from "../types/timer";
import type { ActiveTodo, TimerPhase } from "./timerReducer";

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
/**
 * The numeric settings one press of the Work panel's save button changes
 * (#714). Only the fields that moved are present — an untouched setting is
 * never rewritten with the value it already had. Minutes / counts, as edited.
 */
export interface TimerSettingsPatch {
  workDuration?: number;
  breakDuration?: number;
  longBreakDuration?: number;
  sessionsBeforeLongBreak?: number;
  targetSessions?: number;
}

/** The durations a new preset stores (the panel supplies them — #714). */
export interface TimerPresetValues {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

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
  activeTodo: ActiveTodo | null;

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
  /** Attribute future sessions to this todo (or clear with null). */
  setActiveTodo: (todo: ActiveTodo | null) => void;
  /**
   * Nudge the current phase's remaining time by ±`delta` minutes. Only takes
   * effect while paused/idle (no-op while running); remaining never drops
   * below 1 minute. Powers the −5/+5 pills on the paused timer face.
   */
  adjustRemainingMinutes: (delta: number) => void;

  // --- settings mutators (persist via DataService) ---
  /**
   * Commit the Work panel's numeric draft (#714). ONE dispatch + ONE write per
   * call, however many fields moved — the five per-field setters this replaced
   * meant five rows and five sync bumps for one gesture. Values are clamped
   * here, so a saved 500 comes back as the field's maximum.
   */
  saveSettings: (patch: TimerSettingsPatch) => void;
  /** An act, not a drafted field — commits on click (#714). */
  setAutoStartBreaks: (enabled: boolean) => void;

  // --- preset CRUD ---
  /**
   * Store `values` under `name`. The values come from the panel because an
   * unsaved draft and the stored settings can differ since #714 — reading the
   * stored ones here would name a preset after numbers nobody is looking at.
   */
  createPreset: (name: string, values: TimerPresetValues) => Promise<void>;
  applyPreset: (preset: PomodoroPreset) => void;
  deletePreset: (id: number) => Promise<void>;
}

export const TimerContext = createContext<TimerContextValue | null>(null);
