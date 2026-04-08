import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import path from "path";

export function createTray(win: BrowserWindow): Tray {
  const iconName =
    process.platform === "darwin" ? "trayIconTemplate.png" : "trayIcon.png";
  const iconPath = path.join(app.getAppPath(), "resources", iconName);

  let trayIcon: Electron.NativeImage;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback to an empty 16x16 image if the icon file is missing
    trayIcon = nativeImage.createEmpty();
  }

  // Resize for consistent appearance across platforms
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  const tray = new Tray(trayIcon);
  tray.setToolTip("Life Editor");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show/Hide Window",
      click: () => {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
          win.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // On non-macOS, click toggles window visibility
  if (process.platform !== "darwin") {
    tray.on("click", () => {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    });
  }

  return tray;
}

export function updateTrayTimer(
  tray: Tray,
  state: { remaining: string; isRunning: boolean },
): void {
  const tooltip = state.isRunning
    ? `Life Editor — ${state.remaining}`
    : "Life Editor";
  tray.setToolTip(tooltip);

  // On macOS, display remaining time next to the tray icon
  if (process.platform === "darwin") {
    tray.setTitle(state.isRunning ? state.remaining : "");
  }
}
