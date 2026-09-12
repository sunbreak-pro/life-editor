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
 * macOS desktop-shell detection (#1590).
 *
 * The narrow question `isMac` cannot answer. `isMac` reads the userAgent, which
 * says "Macintosh" for a browser tab on macOS as well — and a browser tab has
 * a real title bar, so it needs none of what this gates. What this asks is
 * "is this window's title bar hidden with the traffic lights floating over my
 * top-left corner", and only the shell that set `titleBarStyle: "hiddenInset"`
 * knows that. It hands the answer over as a plain value on the bridge
 * (`desktop/src/shared/ipcContract.ts::DesktopHostPlatform`), so this is a
 * synchronous read with no await before the first paint.
 *
 * `platform` is read as OPTIONAL, which is the #1389 lesson applied rather than
 * undone: a desktop build from before that field existed exposes
 * `window.desktop` without it, and the absence has to resolve to "no mac
 * chrome" — the old layout — instead of throwing inside a shell that is
 * otherwise fine.
 */
export type DesktopShellPlatform = "darwin" | "win32" | "linux";

/**
 * The platform half of `window.desktop`. Declared here because `shared/` must
 * not import from `desktop/`; the two declarations are pinned against each
 * other in `desktop/tests/ipcContract.test.ts`, the same way the auth-storage
 * and launcher bridges are.
 */
export interface DesktopPlatformBridge {
  platform: DesktopShellPlatform;
}

export function isMacDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (
    window as unknown as { desktop?: Partial<DesktopPlatformBridge> }
  ).desktop;
  return bridge?.platform === "darwin";
}

/*
 * There is deliberately no `isDesktopShell()` here (#1389). It existed for
 * "UI that only MAKES SENSE on the desktop shell", but nothing ever asked it —
 * the Claude Code launcher, its one intended caller, goes through
 * `getClaudeLauncherBridge()` instead, which is the better question: an older
 * desktop build exposes `window.desktop` WITHOUT the newer methods on it, so
 * the shell being present never implied the capability being there.
 */
