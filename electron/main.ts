import log from "./logger";
import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import * as path from "path";
import { getDatabase, closeDatabase } from "./database/db";
import { registerAllHandlers } from "./ipc/registerAll";
import { loadWindowState, trackWindowState } from "./windowState";
import { createMenu } from "./menu";
import { initAutoUpdater } from "./updater";
import { TerminalManager } from "./terminal/TerminalManager";
import { registerTerminalHandlers } from "./ipc/terminalHandlers";
import { registerClaudeSetupHandlers } from "./ipc/claudeSetupHandlers";
import { registerMcpServer } from "./services/claudeSetup";
import { migrateUserData } from "./migration/renameMigration";
import { stopServer } from "./server/index";
import { registerServerHandlers } from "./ipc/serverHandlers";
import { createAppSettingsRepository } from "./database/appSettingsRepository";
import { createTray, updateTrayTimer } from "./tray";
import {
  registerGlobalShortcuts,
  unregisterAllGlobalShortcuts,
} from "./globalShortcuts";
import { ReminderService } from "./services/reminderService";
import { AutoArchiveService } from "./services/autoArchiveService";
import type { Tray } from "electron";

const isDev = !app.isPackaged;
const terminalManager = new TerminalManager();
const reminderService = new ReminderService();
const autoArchiveService = new AutoArchiveService();
let appTray: Tray | null = null;

if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}

function setupCSP(): void {
  const policy = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self' ws://localhost:*; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [policy],
      },
    });
  });
}

function createWindow(): BrowserWindow {
  const saved = loadWindowState();

  const win = new BrowserWindow({
    title: "Life Editor",
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 16, y: 14 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  if (saved.isMaximized) win.maximize();

  trackWindowState(win);

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(app.getAppPath(), "frontend", "dist", "index.html"));
  }

  return win;
}

app
  .whenReady()
  .then(() => {
    setupCSP();
    migrateUserData();

    let db: ReturnType<typeof getDatabase>;
    try {
      db = getDatabase();
      registerAllHandlers(db);
    } catch (e) {
      log.error("[Main] Failed to initialize database/handlers:", e);
      dialog.showErrorBox(
        "Life Editor - Database Error",
        `Failed to initialize the database. The application will now quit.\n\n${e instanceof Error ? e.message : String(e)}`,
      );
      app.quit();
      return;
    }

    registerTerminalHandlers(terminalManager);
    registerClaudeSetupHandlers();
    registerServerHandlers(db);

    ipcMain.handle("window:close", () => {
      BrowserWindow.getFocusedWindow()?.close();
    });

    // Auto-register MCP Server (fire and forget)
    registerMcpServer().catch((e) =>
      log.warn("[Main] Auto MCP registration failed:", e),
    );

    // Read system settings before creating window
    const appSettings = createAppSettingsRepository(db);
    const startMinimized = appSettings.get("start_minimized") === "true";

    const win = createWindow();
    if (startMinimized) {
      win.hide();
    }
    terminalManager.setMainWindow(win);
    createMenu(win);

    if (!isDev) {
      initAutoUpdater(win);
    }

    // System tray
    const trayEnabled = appSettings.get("tray_enabled") === "true";
    if (trayEnabled) {
      appTray = createTray(win);
    }

    // Tray timer updates from renderer
    ipcMain.handle(
      "tray:updateTimer",
      (_event, state: { remaining: string; isRunning: boolean }) => {
        if (appTray) {
          updateTrayTimer(appTray, state);
        }
      },
    );

    // Global shortcuts
    const shortcutsJson = appSettings.get("global_shortcuts");
    if (shortcutsJson) {
      try {
        registerGlobalShortcuts(win, JSON.parse(shortcutsJson));
      } catch (e) {
        log.warn("[Main] Failed to register global shortcuts:", e);
      }
    }

    // Start background services
    reminderService.start(db, win);
    autoArchiveService.start(db);

    // macOS: re-create window on dock click when no windows exist
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const newWin = createWindow();
        terminalManager.setMainWindow(newWin);
        createMenu(newWin);
      }
    });
  })
  .catch((e) => log.error("[Main] app.whenReady failed:", e));

// Quit when all windows are closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  reminderService.stop();
  autoArchiveService.stop();
  unregisterAllGlobalShortcuts();
  terminalManager.destroyAll();
  stopServer().catch(() => {});
  closeDatabase();
});
