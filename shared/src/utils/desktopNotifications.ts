/*
 * Renderer half of the OS-notification bridge (#1374) — the twin of
 * `claudeLauncher.ts`, and for the same reason.
 *
 * `shared/` must not import from `desktop/`: the same bundle is served to the
 * browser and to the Capacitor shells, where `electron` does not exist. So
 * this re-declares the one method `desktop/src/shared/ipcContract.ts` exposes,
 * and the two declarations are pinned against each other in
 * `desktop/tests/ipcContract.test.ts` — a signature change on either side
 * fails desktop's typecheck instead of half-landing.
 *
 * This is the ONLY path to an OS notification. Nothing in shared/ or web/
 * calls `new Notification(...)`, which is what makes the browser and the
 * Capacitor shell safe by construction: no permission prompt to raise, no
 * rejection to handle, nothing to throw. They get the in-app toast and that
 * is the documented Desktop-only boundary (CLAUDE.md §2).
 */

export interface DesktopNotifyArgs {
  title: string;
  body?: string;
}

export interface DesktopNotificationBridge {
  /**
   * Raise an OS notification. Resolves `false` — never rejects — when the
   * platform cannot show one (unsupported, or the OS denied it), so the
   * renderer degrades to its toast rather than handling a rejection on a
   * notification path.
   */
  notify(args: DesktopNotifyArgs): Promise<boolean>;
}

/**
 * The bridge, or null everywhere it does not exist (browser, Capacitor, tests,
 * SSR). The METHOD is checked, not just the `desktop` object: an older desktop
 * build exposes `window.desktop` without this one, and treating that as
 * present means invoking a channel main has no handler for.
 */
export function getDesktopNotificationBridge(): DesktopNotificationBridge | null {
  if (typeof window === "undefined") return null;
  const desktop = (
    window as unknown as { desktop?: Partial<DesktopNotificationBridge> }
  ).desktop;
  if (typeof desktop?.notify !== "function") return null;
  return desktop as DesktopNotificationBridge;
}
