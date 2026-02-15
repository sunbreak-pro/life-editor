import { ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { loggedHandler } from "./handlerUtil";

export function registerUpdaterHandlers(): void {
  ipcMain.handle(
    "updater:checkForUpdates",
    loggedHandler("Updater", "checkForUpdates", async () => {
      await autoUpdater.checkForUpdates();
    }),
  );

  ipcMain.handle(
    "updater:downloadUpdate",
    loggedHandler("Updater", "downloadUpdate", async () => {
      await autoUpdater.downloadUpdate();
    }),
  );

  ipcMain.handle("updater:installUpdate", () => {
    autoUpdater.quitAndInstall();
  });
}
