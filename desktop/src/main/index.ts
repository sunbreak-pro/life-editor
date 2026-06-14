import { join } from "node:path";
import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
} from "electron";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";

// ---------------------------------------------------------------------------
// Persistent config (electron-store). Minimal use only: window bounds + theme.
// The data of the app itself lives in Supabase; this is a ~1KB local prefs file.
// ---------------------------------------------------------------------------
interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface DesktopStoreSchema {
  windowBounds: WindowBounds;
  theme: "light" | "dark" | "system";
}

const store = new Store<DesktopStoreSchema>({
  defaults: {
    windowBounds: { width: 1280, height: 800 },
    theme: "system",
  },
});

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const bounds = store.get("windowBounds");

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: "#ffffff",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      // Security baseline (Electron well-trodden defaults). Do not loosen.
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // Persist window size/position on close so the next launch restores it.
  mainWindow.on("close", () => {
    if (!mainWindow) return;
    const { width, height, x, y } = mainWindow.getBounds();
    store.set("windowBounds", { width, height, x, y });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // External links open in the user's browser, never inside the app window.
  // Only safe schemes are forwarded to the OS — a malicious renderer must not be
  // able to trigger file:// / smb:// / custom-scheme handlers via window.open.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Defence-in-depth: block top-level navigation away from the app in
  // production. The bundled renderer never navigates the top frame (auth is
  // email/password, no OAuth redirect), so an injected script doing
  // `location.href = 'https://attacker/'` would otherwise replace the whole app
  // window with a phishing page. Same-document reloads are allowed; external
  // http(s) targets are opened in the user's browser instead. Dev is exempt so
  // the Vite dev server / HMR are unaffected.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (is.dev) return;
    if (url === mainWindow?.webContents.getURL()) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  // electron-vite flow: dev loads the dev server URL, prod loads the built
  // renderer (web/index.html bundled into out/renderer).
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ---------------------------------------------------------------------------
// Standard application menu (Electron built-in Menu API only, no plugins).
// ---------------------------------------------------------------------------
function setupApplicationMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Minimal IPC. Only serializable payloads cross the bridge — never functions.
// Kept intentionally tiny (theme + window prefs); business logic stays in
// shared/web, not here.
// ---------------------------------------------------------------------------
function setupIpcHandlers(): void {
  ipcMain.handle("config:getTheme", () => store.get("theme"));

  ipcMain.handle("config:setTheme", (_event, theme: unknown) => {
    // Validate at the IPC boundary: the renderer can send any value regardless
    // of the TS type, so whitelist before persisting/applying (an unchecked
    // value would pollute the prefs JSON and be re-applied on next launch).
    if (theme !== "light" && theme !== "dark" && theme !== "system") {
      throw new Error(`config:setTheme: invalid theme ${String(theme)}`);
    }
    store.set("theme", theme);
    nativeTheme.themeSource = theme;
    return theme;
  });

  ipcMain.handle("window:getBounds", () => store.get("windowBounds"));

  ipcMain.handle("app:getVersion", () => app.getVersion());
}

// ---------------------------------------------------------------------------
// Auto-updater: SKELETON ONLY for Phase 3. The real GitHub Releases feed and
// the actual update check are wired in Phase 5. Do NOT call checkForUpdates()
// here — this only constructs the structure so Phase 5 fills in config.
// ---------------------------------------------------------------------------
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  // Phase 5: configure the GitHub Releases feed + call
  // autoUpdater.checkForUpdatesAndNotify(). No-op in Phase 3.
  //
  // SECURITY: do NOT enable checkForUpdates while builds are unsigned
  // (mac.identity:null / no win cert). electron-updater's package-signature
  // check is only meaningful with code signing — enabling auto-update on
  // unsigned builds would let a compromised feed push a malicious binary.
  // Turn this on together with code signing (when the $0 policy is lifted).
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.life-editor.app");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Apply persisted theme to the OS-level color scheme on launch.
  nativeTheme.themeSource = store.get("theme");

  setupIpcHandlers();
  setupApplicationMenu();
  setupAutoUpdater();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
