import type Database from "better-sqlite3";
import type { TimerSettings, TimerSession, SessionType } from "../types";

interface TimerSettingsRow {
  id: number;
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  auto_start_breaks: number;
  target_sessions: number;
  updated_at: string;
}

interface TimerSessionRow {
  id: number;
  task_id: string | null;
  session_type: string;
  started_at: string;
  completed_at: string | null;
  duration: number | null;
  completed: number;
}

function settingsRowToObj(row: TimerSettingsRow): TimerSettings {
  return {
    id: row.id,
    workDuration: row.work_duration,
    breakDuration: row.break_duration,
    longBreakDuration: row.long_break_duration,
    sessionsBeforeLongBreak: row.sessions_before_long_break,
    autoStartBreaks: !!row.auto_start_breaks,
    targetSessions: row.target_sessions,
    updatedAt: row.updated_at,
  };
}

function sessionRowToObj(row: TimerSessionRow): TimerSession {
  return {
    id: row.id,
    taskId: row.task_id,
    sessionType: row.session_type as SessionType,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    duration: row.duration,
    completed: !!row.completed,
  };
}

export function createTimerRepository(db: Database.Database) {
  const stmts = {
    fetchSettings: db.prepare(`SELECT * FROM timer_settings WHERE id = 1`),
    updateSettings: db.prepare(`
      UPDATE timer_settings SET
        work_duration = COALESCE(@workDuration, work_duration),
        break_duration = COALESCE(@breakDuration, break_duration),
        long_break_duration = COALESCE(@longBreakDuration, long_break_duration),
        sessions_before_long_break = COALESCE(@sessionsBeforeLongBreak, sessions_before_long_break),
        auto_start_breaks = COALESCE(@autoStartBreaks, auto_start_breaks),
        target_sessions = COALESCE(@targetSessions, target_sessions),
        updated_at = datetime('now')
      WHERE id = 1
    `),
    startSession: db.prepare(`
      INSERT INTO timer_sessions (task_id, session_type, started_at, completed)
      VALUES (@taskId, @sessionType, datetime('now'), 0)
    `),
    endSession: db.prepare(`
      UPDATE timer_sessions SET completed_at = datetime('now'), duration = @duration, completed = @completed
      WHERE id = @id
    `),
    fetchSessions: db.prepare(
      `SELECT * FROM timer_sessions ORDER BY started_at DESC`,
    ),
    fetchSessionsByTaskId: db.prepare(
      `SELECT * FROM timer_sessions WHERE task_id = ? ORDER BY started_at DESC`,
    ),
    fetchSessionById: db.prepare(`SELECT * FROM timer_sessions WHERE id = ?`),
  };

  return {
    fetchSettings(): TimerSettings {
      return settingsRowToObj(stmts.fetchSettings.get() as TimerSettingsRow);
    },

    updateSettings(
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
    ): TimerSettings {
      stmts.updateSettings.run({
        workDuration: settings.workDuration ?? null,
        breakDuration: settings.breakDuration ?? null,
        longBreakDuration: settings.longBreakDuration ?? null,
        sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak ?? null,
        autoStartBreaks:
          settings.autoStartBreaks != null
            ? settings.autoStartBreaks
              ? 1
              : 0
            : null,
        targetSessions: settings.targetSessions ?? null,
      });
      return settingsRowToObj(stmts.fetchSettings.get() as TimerSettingsRow);
    },

    startSession(
      sessionType: SessionType,
      taskId: string | null,
    ): TimerSession {
      const info = stmts.startSession.run({ taskId, sessionType });
      const row = stmts.fetchSessionById.get(
        info.lastInsertRowid,
      ) as TimerSessionRow;
      return sessionRowToObj(row);
    },

    endSession(id: number, duration: number, completed: boolean): TimerSession {
      stmts.endSession.run({ id, duration, completed: completed ? 1 : 0 });
      const row = stmts.fetchSessionById.get(id) as TimerSessionRow;
      return sessionRowToObj(row);
    },

    fetchSessions(): TimerSession[] {
      return (stmts.fetchSessions.all() as TimerSessionRow[]).map(
        sessionRowToObj,
      );
    },

    fetchSessionsByTaskId(taskId: string): TimerSession[] {
      return (stmts.fetchSessionsByTaskId.all(taskId) as TimerSessionRow[]).map(
        sessionRowToObj,
      );
    },
  };
}

export type TimerRepository = ReturnType<typeof createTimerRepository>;
