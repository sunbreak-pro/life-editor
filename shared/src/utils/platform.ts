/*
 * Platform detection (W1). Ported from the FROZEN
 * `frontend/src/utils/platform.ts` (web-lean: only what shortcut display
 * needs). Guards `navigator` so it is safe under SSR / non-browser test runs.
 */
const ua =
  typeof navigator !== "undefined" && navigator.userAgent
    ? navigator.userAgent
    : "";

export const isMac = /Mac|iPhone|iPad/.test(ua);

/*
 * Native-mobile detection (Phase 4 — Capacitor wrapper).
 *
 * The SAME `web/` Vite bundle is shipped to the browser, Electron, and the
 * Capacitor iOS/Android shells (Capacitor wraps `web/dist`). To let the host
 * gate the Mobile 省略 Providers (roster = CLAUDE.md §2) only on the native
 * shells, the host needs a runtime check bundled into the shared web build.
 *
 * Wired (#320): `web/src/MainScreen.tsx` (ShortcutConfigHost) gates the
 * ShortcutConfigProvider on this, and WorkScreen gates the ambient-mixer UI
 * (AudioProvider itself stays mounted on native so the Pomodoro completion
 * chime rings — mobile-scope.md #10/#11).
 *
 * Deliberately reads the `window.Capacitor` runtime global instead of
 * `import { Capacitor } from "@capacitor/core"`: shared/ MUST stay free of any
 * `@capacitor/*` import so the cross-platform invariant holds (a mobile-only
 * dependency must never leak into the browser/Electron dependency graph).
 * Capacitor injects `window.Capacitor` only inside the native WebView, so this
 * returns false everywhere else (browser, Electron, SSR / test runs — `window`
 * is guarded).
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNativeMobile(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}

/*
 * Electron-shell detection (#1211).
 *
 * The counterpart to `isNativeMobile` above, and it reads its runtime global
 * for the same reason: `window.desktop` is what `desktop/src/preload` exposes
 * through contextBridge, and shared/ must stay free of any `electron` import
 * so the one bundle keeps loading in the browser and inside Capacitor.
 *
 * Use this for UI that only MAKES SENSE on the desktop shell — the Claude Code
 * launcher needs a CLI on the machine, which the browser and the mobile shells
 * do not have. Code that needs a specific bridge should ask for that bridge
 * instead (`getClaudeLauncherBridge`): an older desktop build has `desktop`
 * without the newer methods on it.
 */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  return (window as unknown as { desktop?: unknown }).desktop != null;
}
