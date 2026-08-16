import { contextBridge, ipcRenderer } from "electron";
import { DESKTOP_IPC, type DesktopIpcApi } from "../shared/ipcContract";

// Thin, serializable-only bridge. Business logic lives in shared/web; this only
// exposes the desktop shell's local prefs (theme / window bounds / version)
// plus the auth-session storage (#838).
//
// The channel names and the call signatures both come from ../shared/
// ipcContract (#894) — main reads the same names, so renaming one end alone
// no longer compiles. The `DesktopIpcApi` annotation is what makes a missing
// or mistyped method a build error here rather than a runtime rejection in
// the packaged app.
const api: DesktopIpcApi = {
  getTheme: () => ipcRenderer.invoke(DESKTOP_IPC.getTheme),
  setTheme: (theme) => ipcRenderer.invoke(DESKTOP_IPC.setTheme, theme),
  getWindowBounds: () => ipcRenderer.invoke(DESKTOP_IPC.getWindowBounds),
  getAppVersion: () => ipcRenderer.invoke(DESKTOP_IPC.getAppVersion),
  authStorage: {
    getItem: (key) => ipcRenderer.invoke(DESKTOP_IPC.authStorageGetItem, key),
    setItem: (key, value) =>
      ipcRenderer.invoke(DESKTOP_IPC.authStorageSetItem, key, value),
    removeItem: (key) =>
      ipcRenderer.invoke(DESKTOP_IPC.authStorageRemoveItem, key),
  },
};

// contextIsolation is on, so expose via contextBridge only.
contextBridge.exposeInMainWorld("desktop", api);

export type DesktopApi = DesktopIpcApi;
