import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { TimerRepository } from "../database/timerRepository";
import type { TimerSettings, SessionType } from "../types";

export function registerTimerHandlers(repo: TimerRepository): void {
  ipcMain.handle(
    "db:timer:fetchSettings",
    loggedHandler("Timer", "fetchSettings", () => repo.fetchSettings()),
  );

  ipcMain.handle(
    "db:timer:updateSettings",
    loggedHandler(
      "Timer",
      "updateSettings",
      (
        _event,
        settings: Partial<
          Pick<
            TimerSettings,
            | "workDuration"
            | "breakDuration"
            | "longBreakDuration"
            | "sessionsBeforeLongBreak"
          >
        >,
      ) => repo.updateSettings(settings),
    ),
  );

  ipcMain.handle(
    "db:timer:startSession",
    loggedHandler(
      "Timer",
      "startSession",
      (_event, sessionType: SessionType, taskId: string | null) =>
        repo.startSession(sessionType, taskId),
    ),
  );

  ipcMain.handle(
    "db:timer:endSession",
    loggedHandler(
      "Timer",
      "endSession",
      (_event, id: number, duration: number, completed: boolean) =>
        repo.endSession(id, duration, completed),
    ),
  );

  ipcMain.handle(
    "db:timer:fetchSessions",
    loggedHandler("Timer", "fetchSessions", () => repo.fetchSessions()),
  );

  ipcMain.handle(
    "db:timer:fetchSessionsByTaskId",
    loggedHandler("Timer", "fetchSessionsByTaskId", (_event, taskId: string) =>
      repo.fetchSessionsByTaskId(taskId),
    ),
  );
}
