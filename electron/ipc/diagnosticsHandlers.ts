import { ipcMain, shell, dialog, BrowserWindow, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type Database from "better-sqlite3";
import { getMetrics, resetMetrics } from "./ipcMetrics";
import { loggedHandler } from "./handlerUtil";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export function registerDiagnosticsHandlers(db: Database.Database): void {
  const logDir = path.join(app.getPath("userData"), "logs");
  const logFile = path.join(logDir, "main.log");

  ipcMain.handle(
    "diagnostics:fetchLogs",
    loggedHandler(
      "Diagnostics",
      "fetchLogs",
      (_event, options?: { level?: string; limit?: number }) => {
        const limit = options?.limit ?? 200;
        const levelFilter = options?.level?.toLowerCase();

        if (!fs.existsSync(logFile)) return [];

        const content = fs.readFileSync(logFile, "utf-8");
        const lines = content.split("\n").filter(Boolean);

        const entries: LogEntry[] = [];
        const logLineRegex =
          /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\] \[(\w+)\]\s*(.*)/;

        for (const line of lines) {
          const match = logLineRegex.exec(line);
          if (match) {
            const entry: LogEntry = {
              timestamp: match[1],
              level: match[2],
              message: match[3],
            };
            if (
              !levelFilter ||
              levelFilter === "all" ||
              entry.level.toLowerCase() === levelFilter
            ) {
              entries.push(entry);
            }
          }
        }

        return entries.slice(-limit);
      },
    ),
  );

  ipcMain.handle(
    "diagnostics:openLogFolder",
    loggedHandler("Diagnostics", "openLogFolder", async () => {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      await shell.openPath(logDir);
    }),
  );

  ipcMain.handle(
    "diagnostics:exportLogs",
    loggedHandler("Diagnostics", "exportLogs", async () => {
      const win = BrowserWindow.getFocusedWindow();
      if (!win || !fs.existsSync(logFile)) return false;

      const result = await dialog.showSaveDialog(win, {
        title: "Export Logs",
        defaultPath: `sonic-flow-logs-${new Date().toISOString().slice(0, 10)}.log`,
        filters: [{ name: "Log Files", extensions: ["log", "txt"] }],
      });

      if (result.canceled || !result.filePath) return false;

      fs.copyFileSync(logFile, result.filePath);
      return true;
    }),
  );

  ipcMain.handle(
    "diagnostics:fetchMetrics",
    loggedHandler("Diagnostics", "fetchMetrics", () => {
      return getMetrics();
    }),
  );

  ipcMain.handle(
    "diagnostics:resetMetrics",
    loggedHandler("Diagnostics", "resetMetrics", () => {
      resetMetrics();
      return true;
    }),
  );

  ipcMain.handle(
    "diagnostics:fetchSystemInfo",
    loggedHandler("Diagnostics", "fetchSystemInfo", () => {
      const dbPath = path.join(app.getPath("userData"), "sonic-flow.db");
      let dbSizeBytes = 0;
      if (fs.existsSync(dbPath)) {
        dbSizeBytes = fs.statSync(dbPath).size;
      }

      const mem = process.memoryUsage();

      const tables = [
        "tasks",
        "timer_sessions",
        "sound_settings",
        "memos",
        "tags",
        "task_templates",
      ];
      const tableCounts: Record<string, number> = {};
      for (const table of tables) {
        try {
          const row = db
            .prepare(`SELECT COUNT(*) as count FROM ${table}`)
            .get() as { count: number };
          tableCounts[table] = row.count;
        } catch {
          tableCounts[table] = -1;
        }
      }

      return {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        dbSizeBytes,
        memoryUsage: {
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          rss: mem.rss,
        },
        tableCounts,
      };
    }),
  );
}
