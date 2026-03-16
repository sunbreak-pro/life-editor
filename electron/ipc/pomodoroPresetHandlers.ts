import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import { broadcastChange } from "../server/broadcast";
import type { PomodoroPresetRepository } from "../database/pomodoroPresetRepository";

export function registerPomodoroPresetHandlers(
  repo: PomodoroPresetRepository,
): void {
  ipcMain.handle(
    "db:timer:fetchPomodoroPresets",
    loggedHandler("PomodoroPresets", "fetchAll", () => {
      return repo.fetchAll();
    }),
  );

  ipcMain.handle(
    "db:timer:createPomodoroPreset",
    loggedHandler("PomodoroPresets", "create", (_event, preset) => {
      const result = repo.create(preset);
      broadcastChange("pomodoroPreset", "create", result?.id);
      return result;
    }),
  );

  ipcMain.handle(
    "db:timer:updatePomodoroPreset",
    loggedHandler(
      "PomodoroPresets",
      "update",
      (_event, id: number, updates) => {
        const result = repo.update(id, updates);
        broadcastChange("pomodoroPreset", "update", id);
        return result;
      },
    ),
  );

  ipcMain.handle(
    "db:timer:deletePomodoroPreset",
    loggedHandler("PomodoroPresets", "delete", (_event, id: number) => {
      repo.delete(id);
      broadcastChange("pomodoroPreset", "delete", id);
    }),
  );
}
