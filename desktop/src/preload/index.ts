import { contextBridge, ipcRenderer } from "electron";

// Thin, serializable-only bridge. Business logic lives in shared/web; this only
// exposes the desktop shell's local prefs (theme / window bounds / version)
// plus the auth-session storage (#838).
//
// Risk 1 guard: keep the number of exposed functions <= 10. Current count = 7.
const api = {
  /** Read the persisted theme preference ("light" | "dark" | "system"). */
  getTheme: (): Promise<"light" | "dark" | "system"> =>
    ipcRenderer.invoke("config:getTheme"),
  /** Persist the theme preference and apply it to the OS color scheme. */
  setTheme: (theme: "light" | "dark" | "system"): Promise<typeof theme> =>
    ipcRenderer.invoke("config:setTheme", theme),
  /** Read the last persisted window bounds. */
  getWindowBounds: (): Promise<{
    width: number;
    height: number;
    x?: number;
    y?: number;
  }> => ipcRenderer.invoke("window:getBounds"),
  /** Read the desktop app version (from package.json at runtime). */
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  /**
   * Supabase auth-session storage (#838). The packaged renderer runs on
   * file://, where localStorage is not reliably persisted, so the session is
   * stored in the main process (safeStorage-encrypted) instead. Consumed by
   * shared/src/services/supabaseAuthStorage.ts via `window.desktop.authStorage`.
   */
  authStorage: {
    getItem: (key: string): Promise<string | null> =>
      ipcRenderer.invoke("authStorage:getItem", key),
    setItem: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke("authStorage:setItem", key, value),
    removeItem: (key: string): Promise<void> =>
      ipcRenderer.invoke("authStorage:removeItem", key),
  },
};

// contextIsolation is on, so expose via contextBridge only.
contextBridge.exposeInMainWorld("desktop", api);

export type DesktopApi = typeof api;
