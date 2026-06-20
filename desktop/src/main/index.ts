import { join } from "node:path";
import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  nativeTheme,
  screen,
} from "electron";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";

// ---------------------------------------------------------------------------
// Persistent config (electron-store). Minimal use only: window bounds + theme +
// tray residency preference. The data of the app itself lives in Supabase; this
// is a ~1KB local prefs file.
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
  // When true, closing the window keeps the app resident in the tray instead of
  // quitting (so Supabase realtime stays connected and reopening is instant).
  closeToTray: boolean;
}

const store = new Store<DesktopStoreSchema>({
  defaults: {
    windowBounds: { width: 1280, height: 800 },
    theme: "system",
    closeToTray: true,
  },
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
// Set just before a real quit so the close handler stops intercepting and lets
// the window actually close. Reset is unnecessary (the process is exiting).
let isQuitting = false;

// ---------------------------------------------------------------------------
// Window bounds sanitisation. If a saved x/y is fully outside every connected
// display's work area (e.g. an external monitor was unplugged since last run),
// drop the position so the window opens centered instead of off-screen where it
// can never be dragged back into view.
// ---------------------------------------------------------------------------
function sanitizeBounds(bounds: WindowBounds): WindowBounds {
  if (bounds.x === undefined || bounds.y === undefined) return bounds;
  const point = { x: bounds.x, y: bounds.y };
  const onScreen = screen.getAllDisplays().some((display) => {
    const { x, y, width, height } = display.workArea;
    return (
      point.x >= x &&
      point.x < x + width &&
      point.y >= y &&
      point.y < y + height
    );
  });
  return onScreen ? bounds : { width: bounds.width, height: bounds.height };
}

function createWindow(): void {
  const bounds = sanitizeBounds(store.get("windowBounds"));

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

  // On close: always persist bounds first, then either hide to tray (stay
  // resident) or let the close proceed (real quit). Tray residency keeps the
  // Supabase realtime connection alive so reopening shows the latest state.
  mainWindow.on("close", (event) => {
    if (mainWindow) {
      const { width, height, x, y } = mainWindow.getBounds();
      store.set("windowBounds", { width, height, x, y });
    }
    if (!isQuitting && store.get("closeToTray")) {
      event.preventDefault();
      mainWindow?.hide();
    }
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
// Window visibility helpers (used by the tray).
// ---------------------------------------------------------------------------
function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow(): void {
  if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
}

// ---------------------------------------------------------------------------
// Auto-launch at login. Built into Electron (no extra dependency). Effective on
// macOS and Windows; on Linux setLoginItemSettings is a no-op (documented). We
// start hidden (openAsHidden) so a login launch goes straight to the tray
// instead of popping the window every time the machine boots.
// ---------------------------------------------------------------------------
function getAutoLaunch(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunch(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled });
}

// ---------------------------------------------------------------------------
// Tray (system menu-bar / notification-area residency). Electron's built-in
// Tray only — no plugins. The icon is the app icon resized small; resolved from
// the dev source tree or the packaged resources dir (extraResources).
// ---------------------------------------------------------------------------
function trayIconImage(): Electron.NativeImage {
  const iconPath = is.dev
    ? join(app.getAppPath(), "..", "resources", "icon.png")
    : join(process.resourcesPath, "icon.png");
  const image = nativeImage.createFromPath(iconPath);
  // Source is a 1024px app icon; resize for the menu bar / notification area.
  return image.isEmpty() ? image : image.resize({ width: 18, height: 18 });
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: "Open Life Editor", click: showMainWindow },
    { type: "separator" },
    {
      label: "Keep running in tray when closed",
      type: "checkbox",
      checked: store.get("closeToTray"),
      click: (item) => store.set("closeToTray", item.checked),
    },
    {
      label: "Launch at login",
      type: "checkbox",
      checked: getAutoLaunch(),
      click: (item) => setAutoLaunch(item.checked),
    },
    { type: "separator" },
    {
      label: "Quit Life Editor",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function setupTray(): void {
  tray = new Tray(trayIconImage());
  tray.setToolTip("Life Editor");
  tray.setContextMenu(buildTrayMenu());
  // Left-click toggles the window on Windows/Linux; on macOS it opens the menu
  // (platform convention), where "Open Life Editor" restores the window.
  tray.on("click", () => {
    if (process.platform !== "darwin") toggleMainWindow();
  });
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
  setupTray();
  setupAutoUpdater();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

// A real quit (Cmd+Q / app menu / tray Quit) must bypass close-to-tray.
app.on("before-quit", () => {
  isQuitting = true;
});

// With close-to-tray the window is hidden, not destroyed, so this normally does
// not fire while resident. If the user disabled tray residency, closing the
// last window quits on non-macOS as usual.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
