import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimerDataService } from "./DataService";
import type {
  TimerSettings,
  TimerSession,
  PomodoroPreset,
  SessionType,
} from "../types/timer";
import {
  TIMER_SETTINGS_COLUMNS,
  TIMER_SESSION_COLUMNS,
  POMODORO_PRESET_COLUMNS,
  rowToTimerSettings,
  rowToTimerSession,
  rowToPomodoroPreset,
  timerSettingsUpdatesToPatch,
  newTimerSessionInsert,
  closeTimerSessionPatch,
  pomodoroPresetToInsert,
  pomodoroPresetUpdatesToPatch,
  type TimerSettingsRow,
  type TimerSessionRow,
  type PomodoroPresetRow,
} from "./timerMapper";
import { fetchAllPages } from "./postgrestFetchAll";
import { requireSingleRow, fetchMaybeSingleRow } from "./postgrestSingle";

/*
 * SupabaseTimerService (W3-A). I/O layer over the independent timer tables
 * (0018). Pure mapping lives in timerMapper.ts. `user_id` is never written —
 * the DB default (auth.uid()) fills it; RLS scopes every read.
 *
 * timer_settings is a per-user singleton (PK (user_id, id), id always 1).
 * `fetchTimerSettings` upserts the default row on first access so the caller
 * always gets a row back. timer_sessions are start-time based (started_at +
 * ended_at; duration denormalised on close).
 */
export class SupabaseTimerService implements TimerDataService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Timer settings (singleton, id = 1)
  // -------------------------------------------------------------------------

  async fetchTimerSettings(): Promise<TimerSettings> {
    // Read first (#499). This used to upsert unconditionally and then select,
    // which meant a READ wrote a row on every single call — and since every
    // Realtime echo re-ran it, editing a note produced a POST to
    // `timer_settings`. The row exists after the first call for the rest of
    // the account's life, so the write belongs on the miss path only.
    const existing = await fetchMaybeSingleRow<TimerSettingsRow>(
      this.client
        .from("timer_settings")
        .select(TIMER_SETTINGS_COLUMNS)
        .eq("id", 1)
        .maybeSingle(),
      "fetchTimerSettings failed",
    );
    if (existing) return rowToTimerSettings(existing);

    // QA-W3A申し送り #1: the old maybeSingle()→insert sequence had a race —
    // two concurrent first-accesses (e.g. TimerProvider mount + a Settings
    // open in another tab) could both miss the row and both INSERT, the
    // second tripping the (user_id, id) PK. Materialise idempotently with a
    // single upsert (ignoreDuplicates: a concurrent insert is a no-op, never
    // an error), then SELECT the now-guaranteed row. The upsert sends only
    // `id` so existing column values are preserved on the duplicate path —
    // which is what makes it safe to re-run after a lost race.
    const { error: upErr } = await this.client
      .from("timer_settings")
      .upsert({ id: 1 }, { onConflict: "user_id,id", ignoreDuplicates: true });
    if (upErr)
      throw new Error(`fetchTimerSettings upsert failed: ${upErr.message}`);

    const data = await requireSingleRow<TimerSettingsRow>(
      this.client
        .from("timer_settings")
        .select(TIMER_SETTINGS_COLUMNS)
        .eq("id", 1)
        .single(),
      "fetchTimerSettings failed",
    );
    return rowToTimerSettings(data);
  }

  async updateTimerSettings(
    settings: Partial<
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
  ): Promise<TimerSettings> {
    // Ensure the singleton exists before patching (idempotent).
    await this.fetchTimerSettings();
    const now = new Date().toISOString();
    const patch = timerSettingsUpdatesToPatch(settings, now);

    const data = await requireSingleRow<TimerSettingsRow>(
      this.client
        .from("timer_settings")
        .update(patch)
        .eq("id", 1)
        .select(TIMER_SETTINGS_COLUMNS)
        .single(),
      "updateTimerSettings failed",
    );
    return rowToTimerSettings(data);
  }

  // -------------------------------------------------------------------------
  // Timer sessions
  // -------------------------------------------------------------------------

  async startTimerSession(
    sessionType: SessionType,
    todoId?: string,
  ): Promise<TimerSession> {
    const startedAt = new Date().toISOString();
    const insert = newTimerSessionInsert(
      sessionType,
      todoId ?? null,
      startedAt,
    );
    const data = await requireSingleRow<TimerSessionRow>(
      this.client
        .from("timer_sessions")
        .insert(insert)
        .select(TIMER_SESSION_COLUMNS)
        .single(),
      "startTimerSession failed",
    );
    return rowToTimerSession(data);
  }

  async endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession> {
    return this.closeSession(id, duration, completed, undefined);
  }

  async endTimerSessionWithLabel(
    id: number,
    duration: number,
    completed: boolean,
    label: string | null,
  ): Promise<TimerSession> {
    return this.closeSession(id, duration, completed, label);
  }

  private async closeSession(
    id: number,
    duration: number,
    completed: boolean,
    label: string | null | undefined,
  ): Promise<TimerSession> {
    const endedAt = new Date().toISOString();
    const patch = closeTimerSessionPatch(endedAt, duration, completed, label);
    const data = await requireSingleRow<TimerSessionRow>(
      this.client
        .from("timer_sessions")
        .update(patch)
        .eq("id", id)
        .select(TIMER_SESSION_COLUMNS)
        .single(),
      `endTimerSession (id=${id}) failed`,
    );
    return rowToTimerSession(data);
  }

  async fetchTimerSessions(): Promise<TimerSession[]> {
    // timer_sessions grows a row per start/close, so it is the first
    // table to outgrow the PostgREST max-rows cap — paged read required.
    // Trailing .order("id") = unique tiebreaker for deterministic pages.
    const rows = await fetchAllPages<TimerSessionRow>(
      (from, to) =>
        this.client
          .from("timer_sessions")
          .select(TIMER_SESSION_COLUMNS)
          .order("started_at", { ascending: false })
          .order("id")
          .range(from, to),
      "fetchTimerSessions failed",
    );
    return rows.map(rowToTimerSession);
  }

  async fetchSessionsByTodoId(todoId: string): Promise<TimerSession[]> {
    const rows = await fetchAllPages<TimerSessionRow>(
      (from, to) =>
        this.client
          .from("timer_sessions")
          .select(TIMER_SESSION_COLUMNS)
          .eq("task_id", todoId)
          .order("started_at", { ascending: false })
          .order("id")
          .range(from, to),
      "fetchSessionsByTodoId failed",
    );
    return rows.map(rowToTimerSession);
  }

  // -------------------------------------------------------------------------
  // Pomodoro presets
  // -------------------------------------------------------------------------

  async fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    const rows = await fetchAllPages<PomodoroPresetRow>(
      (from, to) =>
        this.client
          .from("pomodoro_presets")
          .select(POMODORO_PRESET_COLUMNS)
          .order("created_at", { ascending: true })
          .order("id")
          .range(from, to),
      "fetchPomodoroPresets failed",
    );
    return rows.map(rowToPomodoroPreset);
  }

  async createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    const insert = pomodoroPresetToInsert(preset);
    const data = await requireSingleRow<PomodoroPresetRow>(
      this.client
        .from("pomodoro_presets")
        .insert(insert)
        .select(POMODORO_PRESET_COLUMNS)
        .single(),
      "createPomodoroPreset failed",
    );
    return rowToPomodoroPreset(data);
  }

  async updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    const now = new Date().toISOString();
    const patch = pomodoroPresetUpdatesToPatch(updates, now);
    const data = await requireSingleRow<PomodoroPresetRow>(
      this.client
        .from("pomodoro_presets")
        .update(patch)
        .eq("id", id)
        .select(POMODORO_PRESET_COLUMNS)
        .single(),
      `updatePomodoroPreset (id=${id}) failed`,
    );
    return rowToPomodoroPreset(data);
  }

  async deletePomodoroPreset(id: number): Promise<void> {
    const { error } = await this.client
      .from("pomodoro_presets")
      .delete()
      .eq("id", id);
    if (error)
      throw new Error(
        `deletePomodoroPreset (id=${id}) failed: ${error.message}`,
      );
  }
}

export const PHASE2_TIMER_METHOD_NAMES = [
  "fetchTimerSettings",
  "updateTimerSettings",
  "startTimerSession",
  "endTimerSession",
  "endTimerSessionWithLabel",
  "fetchTimerSessions",
  "fetchSessionsByTodoId",
  "fetchPomodoroPresets",
  "createPomodoroPreset",
  "updatePomodoroPreset",
  "deletePomodoroPreset",
] as const;

export type TimerMethodName = (typeof PHASE2_TIMER_METHOD_NAMES)[number];

export const PHASE2_TIMER_METHODS: ReadonlySet<string> = new Set(
  PHASE2_TIMER_METHOD_NAMES,
);
