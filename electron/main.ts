import log from "./logger";
import { app, BrowserWindow, dialog, session } from "electron";
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

const isDev = !app.isPackaged;
const terminalManager = new TerminalManager();

if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}

function setupCSP(): void {
  const policy = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http:; media-src 'self' blob:; font-src 'self'; connect-src 'self' ws://localhost:*; frame-src 'none'; object-src 'none'; base-uri 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'";

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

    try {
      const db = getDatabase();
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

    // Auto-register MCP Server (fire and forget)
    registerMcpServer().catch((e) =>
      log.warn("[Main] Auto MCP registration failed:", e),
    );

    const win = createWindow();
    terminalManager.setMainWindow(win);
    createMenu(win);

    if (!isDev) {
      initAutoUpdater(win);
    }

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
  terminalManager.destroyAll();
  closeDatabase();
});
