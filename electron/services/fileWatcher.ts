import * as fs from "fs";
import * as path from "path";
import log from "../logger";
import type { BrowserWindow } from "electron";

export class FileWatcher {
  private watcher: fs.FSWatcher | null = null;
  private rootPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingChanges: Map<string, string> = new Map();

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  start(rootPath: string): void {
    this.stop();
    this.rootPath = rootPath;

    if (!fs.existsSync(rootPath)) {
      log.warn(`[FileWatcher] Root path does not exist: ${rootPath}`);
      return;
    }

    try {
      this.watcher = fs.watch(
        rootPath,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) return;
          // Skip hidden files
          if (filename.startsWith(".") || filename.includes("/.")) return;

          const changeType = eventType === "rename" ? "rename" : "change";
          this.pendingChanges.set(filename, changeType);
          this.scheduleBroadcast();
        },
      );

      this.watcher.on("error", (err) => {
        log.warn("[FileWatcher] Watcher error:", err);
      });

      log.info(`[FileWatcher] Started watching: ${rootPath}`);
    } catch (e) {
      log.error("[FileWatcher] Failed to start:", e);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingChanges.clear();
    if (this.rootPath) {
      log.info(`[FileWatcher] Stopped watching: ${this.rootPath}`);
    }
    this.rootPath = null;
  }

  restart(rootPath: string): void {
    this.stop();
    this.start(rootPath);
  }

  private scheduleBroadcast(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.broadcastChanges();
    }, 150);
  }

  private broadcastChanges(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.pendingChanges.size === 0) return;

    const changes = Array.from(this.pendingChanges.entries()).map(
      ([filePath, type]) => ({ path: filePath, type }),
    );
    this.pendingChanges.clear();

    try {
      this.mainWindow.webContents.send("files:changed", changes);
    } catch (e) {
      log.warn("[FileWatcher] Failed to broadcast:", e);
    }
  }
}
