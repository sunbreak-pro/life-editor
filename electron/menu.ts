import { Menu, BrowserWindow, app } from "electron";
import { autoUpdater } from "electron-updater";

const isMac = process.platform === "darwin";
const isDev = !app.isPackaged;

export function createMenu(win: BrowserWindow): void {
  const send = (action: string) => {
    if (!win.isDestroyed()) win.webContents.send("menu:action", action);
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: "Life Editor",
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Preferences…",
                accelerator: "Cmd+,",
                click: () => send("navigate:settings"),
              },
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

    // File
    {
      label: "File",
      submenu: [
        {
          label: "New Task",
          accelerator: "CmdOrCtrl+N",
          click: () => send("new-task"),
        },
        {
          label: "New Folder",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => send("new-folder"),
        },
        { type: "separator" },
        { label: "Export Data…", click: () => send("export-data") },
        { label: "Import Data…", click: () => send("import-data") },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },

    // Edit
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

    // View
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Left Sidebar",
          accelerator: "CmdOrCtrl+.",
          click: () => send("toggle-left-sidebar"),
        },
        { type: "separator" },
        {
          label: "Timer Modal",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => send("toggle-timer-modal"),
        },
        { type: "separator" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev
          ? [
              { type: "separator" as const },
              { role: "toggleDevTools" as const },
            ]
          : []),
      ],
    },

    // Window
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

    // Help
    {
      label: "Help",
      submenu: [
        { label: "Tips", click: () => send("navigate:tips") },
        { type: "separator" },
        {
          label: "Check for Updates…",
          click: () => {
            autoUpdater.checkForUpdates().catch(() => {});
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
