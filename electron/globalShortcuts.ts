import { globalShortcut, BrowserWindow } from "electron";
import log from "./logger";

export interface GlobalShortcutConfig {
  toggleTimer?: string;
  quickAddTask?: string;
}

export function registerGlobalShortcuts(
  win: BrowserWindow,
  config: GlobalShortcutConfig,
): void {
  // Always unregister existing shortcuts first to avoid duplicates
  unregisterAllGlobalShortcuts();

  if (config.toggleTimer) {
    try {
      const registered = globalShortcut.register(config.toggleTimer, () => {
        win.webContents.send("menu:action", "toggleTimer");
      });
      if (registered) {
        log.info(
          `[GlobalShortcut] Registered toggleTimer: ${config.toggleTimer}`,
        );
      } else {
        log.warn(
          `[GlobalShortcut] Failed to register toggleTimer: ${config.toggleTimer} (already in use)`,
        );
      }
    } catch (e) {
      log.error(
        `[GlobalShortcut] Error registering toggleTimer: ${config.toggleTimer}`,
        e,
      );
    }
  }

  if (config.quickAddTask) {
    try {
      const registered = globalShortcut.register(config.quickAddTask, () => {
        win.webContents.send("menu:action", "quickAddTask");
      });
      if (registered) {
        log.info(
          `[GlobalShortcut] Registered quickAddTask: ${config.quickAddTask}`,
        );
      } else {
        log.warn(
          `[GlobalShortcut] Failed to register quickAddTask: ${config.quickAddTask} (already in use)`,
        );
      }
    } catch (e) {
      log.error(
        `[GlobalShortcut] Error registering quickAddTask: ${config.quickAddTask}`,
        e,
      );
    }
  }
}

export function unregisterAllGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
  log.info("[GlobalShortcut] Unregistered all global shortcuts");
}
