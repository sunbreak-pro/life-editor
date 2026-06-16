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
 * gate the Mobile 省略 Provider 5 種 (CLAUDE.md §2 — Audio / ScreenLock /
 * FileExplorer / CalendarTags / ShortcutConfig) only on the native shells, the
 * host needs a runtime check that is bundled into the shared web build.
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
