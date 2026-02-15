import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
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
      return repo.create(preset);
    }),
  );

  ipcMain.handle(
    "db:timer:updatePomodoroPreset",
    loggedHandler(
      "PomodoroPresets",
      "update",
      (_event, id: number, updates) => {
        return repo.update(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:timer:deletePomodoroPreset",
    loggedHandler("PomodoroPresets", "delete", (_event, id: number) => {
      repo.delete(id);
    }),
  );
}
