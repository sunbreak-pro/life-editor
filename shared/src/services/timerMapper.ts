import type {
  TimerSettings,
  TimerSession,
  PomodoroPreset,
  SessionType,
} from "../types/timer";

/*
 * Pure Row <-> domain mappers for the W3-A independent timer tables
 * (0018_timer_audio_tables.sql): `timer_settings` (singleton per user),
 * `timer_sessions` (start-time based log), `pomodoro_presets`.
 *
 * These are NOT items_meta 2-row entities — each table owns its own
 * `updated_at` (single-owner). So unlike the notes/dailies mappers there is
 * no meta/payload split and no `version` column. The DB-Q2 contract still
 * applies: every `*UpdatesToPatch` ALWAYS emits `updated_at` so a write can
 * never forget to bump the LWW cursor.
 *
 * NAMING: DB snake_case <-> domain camelCase. The session `ended_at` column
 * materialises the domain `completedAt` field (legacy SQLite called it
 * `completed_at`; 0018 renamed it `ended_at` to match the start-time model,
 * but the FROZEN domain type keeps `completedAt`). Date fields in the domain
 * `TimerSettings` / `TimerSession` are `Date` objects (legacy parity); the
 * mapper parses ISO strings to `Date` on read.
 *
 * Carries NO `@supabase/supabase-js` dependency — pure, testable under Node.
 * 0018 is the SSOT for column types/nullability; keep this in lockstep.
 */

// ---------------------------------------------------------------------------
// 1. Row shapes (verbatim with 0018)
// ---------------------------------------------------------------------------

/** Row shape of `public.timer_settings` (singleton, id always 1). */
export interface TimerSettingsRow {
  id: number;
  user_id: string;
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  auto_start_breaks: boolean;
  target_sessions: number;
  created_at: string;
  updated_at: string;
}

/** Row shape of `public.timer_sessions`. */
export interface TimerSessionRow {
  id: number;
  user_id: string;
  task_id: string | null;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  completed: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape of `public.pomodoro_presets`. */
export interface PomodoroPresetRow {
  id: number;
  user_id: string;
  name: string;
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 2. SELECT column lists
// ---------------------------------------------------------------------------

export const TIMER_SETTINGS_COLUMNS =
  "id, user_id, work_duration, break_duration, long_break_duration, " +
  "sessions_before_long_break, auto_start_breaks, target_sessions, " +
  "created_at, updated_at";

export const TIMER_SESSION_COLUMNS =
  "id, user_id, task_id, session_type, started_at, ended_at, duration, " +
  "completed, label, created_at, updated_at";

export const POMODORO_PRESET_COLUMNS =
  "id, user_id, name, work_duration, break_duration, long_break_duration, " +
  "sessions_before_long_break, created_at, updated_at";

// ---------------------------------------------------------------------------
// 3. Validators (defence-in-depth; CHECK already enforces at the DB layer)
// ---------------------------------------------------------------------------

const SESSION_TYPES: ReadonlySet<string> = new Set([
  "WORK",
  "BREAK",
  "LONG_BREAK",
  "FREE",
]);

/** Narrow a DB `session_type` value to the SessionType union. */
export function toSessionType(value: string): SessionType {
  if (SESSION_TYPES.has(value)) return value as SessionType;
  throw new Error(
    `timer_sessions: invalid session_type "${value}" ` +
      `(expected WORK|BREAK|LONG_BREAK|FREE)`,
  );
}

// ---------------------------------------------------------------------------
// 4. timer_settings
// ---------------------------------------------------------------------------

export function rowToTimerSettings(row: TimerSettingsRow): TimerSettings {
  return {
    id: row.id,
    workDuration: row.work_duration,
    breakDuration: row.break_duration,
    longBreakDuration: row.long_break_duration,
    sessionsBeforeLongBreak: row.sessions_before_long_break,
    autoStartBreaks: row.auto_start_breaks,
    targetSessions: row.target_sessions,
    updatedAt: new Date(row.updated_at),
  };
}

export type TimerSettingsUpdatePatch = Partial<{
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  auto_start_breaks: boolean;
  target_sessions: number;
  updated_at: string;
}>;

/**
 * Build a snake_case PATCH for timer_settings from a partial settings update.
 * Only keys present on `updates` are emitted. DB-Q2: `updated_at` ALWAYS set.
 * `now` is injected so the mapper stays pure.
 */
export function timerSettingsUpdatesToPatch(
  updates: Partial<
    Pick<
      TimerSettings,
      | "workDuration"
      | "breakDuration"
      | "longBreakDuration"
      | "sessionsBeforeLongBreak"
      | "autoStartBreaks"
      | "targetSessions"
    >
  >,
  now: string,
): TimerSettingsUpdatePatch {
  const patch: TimerSettingsUpdatePatch = { updated_at: now };
  if ("workDuration" in updates && updates.workDuration !== undefined)
    patch.work_duration = updates.workDuration;
  if ("breakDuration" in updates && updates.breakDuration !== undefined)
    patch.break_duration = updates.breakDuration;
  if (
    "longBreakDuration" in updates &&
    updates.longBreakDuration !== undefined
  )
    patch.long_break_duration = updates.longBreakDuration;
  if (
    "sessionsBeforeLongBreak" in updates &&
    updates.sessionsBeforeLongBreak !== undefined
  )
    patch.sessions_before_long_break = updates.sessionsBeforeLongBreak;
  if ("autoStartBreaks" in updates && updates.autoStartBreaks !== undefined)
    patch.auto_start_breaks = updates.autoStartBreaks;
  if ("targetSessions" in updates && updates.targetSessions !== undefined)
    patch.target_sessions = updates.targetSessions;
  return patch;
}

// ---------------------------------------------------------------------------
// 5. timer_sessions
// ---------------------------------------------------------------------------

export function rowToTimerSession(row: TimerSessionRow): TimerSession {
  return {
    id: row.id,
    taskId: row.task_id,
    sessionType: toSessionType(row.session_type),
    startedAt: new Date(row.started_at),
    completedAt: row.ended_at === null ? null : new Date(row.ended_at),
    duration: row.duration,
    completed: row.completed,
    label: row.label,
  };
}

/** Writable subset for INSERT on timer_sessions (start of a session). */
export interface TimerSessionInsertRow {
  session_type: SessionType;
  task_id: string | null;
  started_at: string;
}

/**
 * Build the INSERT row for a freshly started session. `user_id` is left to
 * the DB default (auth.uid()); `id` is identity-generated; `ended_at` /
 * `duration` / `completed` stay at their DB defaults until close.
 */
export function newTimerSessionInsert(
  sessionType: SessionType,
  taskId: string | null,
  startedAt: string,
): TimerSessionInsertRow {
  return {
    session_type: sessionType,
    task_id: taskId,
    started_at: startedAt,
  };
}

export type TimerSessionUpdatePatch = Partial<{
  ended_at: string | null;
  duration: number | null;
  completed: boolean;
  label: string | null;
  updated_at: string;
}>;

/**
 * Build the PATCH that CLOSES a session: stamp `ended_at`, denormalise
 * `duration` (seconds), set `completed`, and optionally `label`. DB-Q2:
 * `updated_at` ALWAYS set. `endedAt` is injected (pure).
 */
export function closeTimerSessionPatch(
  endedAt: string,
  duration: number,
  completed: boolean,
  label: string | null | undefined,
): TimerSessionUpdatePatch {
  const patch: TimerSessionUpdatePatch = {
    ended_at: endedAt,
    duration,
    completed,
    updated_at: endedAt,
  };
  if (label !== undefined) patch.label = label;
  return patch;
}

// ---------------------------------------------------------------------------
// 6. pomodoro_presets
// ---------------------------------------------------------------------------

export function rowToPomodoroPreset(row: PomodoroPresetRow): PomodoroPreset {
  return {
    id: row.id,
    name: row.name,
    workDuration: row.work_duration,
    breakDuration: row.break_duration,
    longBreakDuration: row.long_break_duration,
    sessionsBeforeLongBreak: row.sessions_before_long_break,
    createdAt: row.created_at,
  };
}

/** Writable subset for INSERT on pomodoro_presets. */
export interface PomodoroPresetInsertRow {
  name: string;
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
}

export function pomodoroPresetToInsert(
  preset: Omit<PomodoroPreset, "id" | "createdAt">,
): PomodoroPresetInsertRow {
  return {
    name: preset.name,
    work_duration: preset.workDuration,
    break_duration: preset.breakDuration,
    long_break_duration: preset.longBreakDuration,
    sessions_before_long_break: preset.sessionsBeforeLongBreak,
  };
}

export type PomodoroPresetUpdatePatch = Partial<{
  name: string;
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  updated_at: string;
}>;

/**
 * Build a snake_case PATCH for pomodoro_presets. Only present keys emitted.
 * DB-Q2: `updated_at` ALWAYS set. `now` injected (pure).
 */
export function pomodoroPresetUpdatesToPatch(
  updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  now: string,
): PomodoroPresetUpdatePatch {
  const patch: PomodoroPresetUpdatePatch = { updated_at: now };
  if ("name" in updates && updates.name !== undefined) patch.name = updates.name;
  if ("workDuration" in updates && updates.workDuration !== undefined)
    patch.work_duration = updates.workDuration;
  if ("breakDuration" in updates && updates.breakDuration !== undefined)
    patch.break_duration = updates.breakDuration;
  if (
    "longBreakDuration" in updates &&
    updates.longBreakDuration !== undefined
  )
    patch.long_break_duration = updates.longBreakDuration;
  if (
    "sessionsBeforeLongBreak" in updates &&
    updates.sessionsBeforeLongBreak !== undefined
  )
    patch.sessions_before_long_break = updates.sessionsBeforeLongBreak;
  return patch;
}
