import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
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
            | "autoStartBreaks"
            | "targetSessions"
          >
        >,
      ) => {
        const result = repo.updateSettings(settings);
        broadcastChange("timerSettings", "update");
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:timer:startSession",
    loggedHandler(
      "Timer",
      "startSession",
      (_event, sessionType: SessionType, taskId: string | null) => {
        const result = repo.startSession(sessionType, taskId);
        broadcastChange("timerSession", "create", result?.id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:timer:endSession",
    loggedHandler(
      "Timer",
      "endSession",
      (_event, id: number, duration: number, completed: boolean) => {
        const result = repo.endSession(id, duration, completed);
        broadcastChange("timerSession", "update", id);
        return result;
      },
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
