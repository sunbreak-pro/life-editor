import { query, mutation } from "./handlerUtil";
import type { TimerRepository } from "../database/timerRepository";
import type { TimerSettings, SessionType } from "../types";

export function registerTimerHandlers(repo: TimerRepository): void {
  query("db:timer:fetchSettings", "Timer", "fetchSettings", () =>
    repo.fetchSettings(),
  );

  mutation(
    "db:timer:updateSettings",
    "Timer",
    "updateSettings",
    "timerSettings",
    "update",
    (
      _event,
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
    ) => {
      return repo.updateSettings(settings);
    },
    () => undefined,
  );

  mutation(
    "db:timer:startSession",
    "Timer",
    "startSession",
    "timerSession",
    "create",
    (_event, sessionType: SessionType, taskId: string | null) => {
      return repo.startSession(sessionType, taskId);
    },
    (_args, result) => (result as { id?: number })?.id,
  );

  mutation(
    "db:timer:endSession",
    "Timer",
    "endSession",
    "timerSession",
    "update",
    (_event, id: number, duration: number, completed: boolean) => {
      return repo.endSession(id, duration, completed);
    },
  );

  query("db:timer:fetchSessions", "Timer", "fetchSessions", () =>
    repo.fetchSessions(),
  );

  query(
    "db:timer:fetchSessionsByTaskId",
    "Timer",
    "fetchSessionsByTaskId",
    (_event, taskId: string) => repo.fetchSessionsByTaskId(taskId),
  );
}
