import { isNativeMobile } from "../utils/platform";

/*
 * Platform-aware storage for the Supabase auth session (#838).
 *
 * supabase-js persists the session (access + refresh token) through
 * `auth.storage`, defaulting to the renderer's localStorage. That default
 * breaks on two of our three shells:
 *
 * - Electron (packaged): the renderer is served from file://, whose origin
 *   Chromium treats as unreliable for storage — the saved session can vanish
 *   across restarts, forcing a fresh login every launch. The preload bridge
 *   (`window.desktop.authStorage`) stores the session in the MAIN process
 *   instead, encrypted at rest via Electron safeStorage (OS keychain /
 *   credential manager). Rationale for choosing safeStorage over an app://
 *   custom scheme: it fixes persistence AND moves the refresh token — an
 *   effectively long-lived login key — out of plaintext renderer storage
 *   (see desktop/src/main/index.ts `setupAuthStorageIpc`).
 * - Native mobile (Capacitor shell): WebView localStorage can be purged by
 *   the OS under storage pressure. `@capacitor/preferences` writes to
 *   UserDefaults / SharedPreferences, which survive. Accessed through the
 *   `window.Capacitor.Plugins` runtime global — shared/ MUST stay free of
 *   `@capacitor/*` imports (see utils/platform.ts).
 * - Web (browser): localStorage is the right default; return undefined so
 *   supabase-js keeps its own fallback.
 *
 * This module is the ONE place the platform decision lives (#838 DoD). If a
 * shell's bridge is missing at runtime (old desktop build, plugin not
 * installed), we fall back to the default storage — same behavior as before
 * this change, never a hard failure.
 */

/**
 * Structurally matches supabase-js's `SupportedStorage` (defined in
 * @supabase/auth-js but not re-exported by @supabase/supabase-js, so we
 * declare the shape instead of importing a transitive dependency).
 */
export interface AuthSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * The shape `window.desktop.authStorage` is expected to have. Declared here
 * rather than imported because `shared/` must not depend on `desktop/` (or on
 * `electron`), which is exactly what makes it drift-prone: the real object is
 * built in `desktop/src/preload/index.ts` from
 * `desktop/src/shared/ipcContract.ts`, and nothing at this end would notice a
 * rename there.
 *
 * Exported so it can be pinned against that contract from the side that CAN
 * see both — `desktop/tests/ipcContract.test.ts` asserts the two types are
 * mutually assignable, so a signature change on either end fails desktop's
 * typecheck (#894).
 */
export interface DesktopAuthStorageBridge {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface CapacitorPreferencesProxy {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

interface AuthStorageGlobals {
  desktop?: { authStorage?: DesktopAuthStorageBridge };
  Capacitor?: { Plugins?: { Preferences?: CapacitorPreferencesProxy } };
}

export function resolveAuthStorage(): AuthSessionStorage | undefined {
  if (typeof window === "undefined") return undefined;
  const globals = window as unknown as AuthStorageGlobals;

  const desktopBridge = globals.desktop?.authStorage;
  if (desktopBridge) {
    return {
      getItem: (key) => desktopBridge.getItem(key),
      setItem: (key, value) => desktopBridge.setItem(key, value),
      removeItem: (key) => desktopBridge.removeItem(key),
    };
  }

  const preferences = globals.Capacitor?.Plugins?.Preferences;
  if (isNativeMobile() && preferences) {
    return {
      getItem: async (key) => (await preferences.get({ key })).value,
      setItem: async (key, value) => {
        await preferences.set({ key, value });
      },
      removeItem: async (key) => {
        await preferences.remove({ key });
      },
    };
  }

  return undefined;
}
