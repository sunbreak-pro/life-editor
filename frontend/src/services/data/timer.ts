import type {
  PomodoroPreset,
  SessionType,
  TimerSession,
  TimerSettings,
} from "../../types/timer";
import { tauriInvoke } from "../bridge";

export const timerApi = {
  fetchTimerSettings(): Promise<TimerSettings> {
    return tauriInvoke("db_timer_fetch_settings");
  },
  updateTimerSettings(
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
    return tauriInvoke("db_timer_update_settings", { settings });
  },
  startTimerSession(
    sessionType: SessionType,
    taskId?: string,
  ): Promise<TimerSession> {
    return tauriInvoke("db_timer_start_session", {
      sessionType,
      taskId: taskId ?? null,
    });
  },
  endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession> {
    return tauriInvoke("db_timer_end_session", { id, duration, completed });
  },
  endTimerSessionWithLabel(
    id: number,
    duration: number,
    completed: boolean,
    label: string | null,
  ): Promise<TimerSession> {
    return tauriInvoke("db_timer_end_session_with_label", {
      id,
      duration,
      completed,
      label,
    });
  },
  fetchTimerSessions(): Promise<TimerSession[]> {
    return tauriInvoke("db_timer_fetch_sessions");
  },
  fetchSessionsByTaskId(taskId: string): Promise<TimerSession[]> {
    return tauriInvoke("db_timer_fetch_sessions_by_task_id", {
      taskId,
    });
  },
  fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    return tauriInvoke("db_timer_fetch_pomodoro_presets");
  },
  createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    return tauriInvoke("db_timer_create_pomodoro_preset", { preset });
  },
  updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    return tauriInvoke("db_timer_update_pomodoro_preset", { id, updates });
  },
  deletePomodoroPreset(id: number): Promise<void> {
    return tauriInvoke("db_timer_delete_pomodoro_preset", { id });
  },
};
