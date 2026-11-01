/*
 * "Can this app reach the server right now?" (#2334 — plan
 * 2026-10-21-offline-cache.md P1c), as one external store for React and for the
 * code outside it.
 *
 * Two facts count as offline. The browser's `navigator.onLine`, and the session
 * gate's finding that the session could not be refreshed: a captive portal or a
 * dead access point leaves `onLine` true while every request fails. The second
 * is set only by the gate in `web/src/App.tsx`, and that is also what clears it.
 *
 * `online` and `offline` are the browser's own events, so a stale reading here
 * lasts no longer than the browser's. Without `navigator` (a non-browser run)
 * this says online, the state everything behaved in before.
 */
let sessionUnreachable = false;
const listeners = new Set<() => void>();

export function isOffline(): boolean {
  if (sessionUnreachable) return true;
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function setSessionUnreachable(next: boolean): void {
  if (sessionUnreachable === next) return;
  sessionUnreachable = next;
  for (const listener of listeners) listener();
}

export function subscribeConnectivity(onChange: () => void): () => void {
  listeners.add(onChange);
  if (typeof window !== "undefined") {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
  }
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    }
  };
}
