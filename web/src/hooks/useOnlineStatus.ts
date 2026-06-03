import { useSyncExternalStore } from "react";

/*
 * Tracks the browser's online/offline connectivity (S7, migration SSOT:
 * "常時オンライン前提" — no Service Worker, no offline editing). The web
 * build assumes connectivity; this hook is the single source the global
 * OfflineBanner reads to decide whether to warn the user.
 *
 * `navigator.onLine` + the `online`/`offline` window events form an
 * external store, so `useSyncExternalStore` is the canonical fit: React
 * subscribes/unsubscribes the listener for us (cleanup handled by the
 * returned unsubscribe), and there is no in-effect setState — it reads the
 * live value through `getSnapshot` on every render that matters. The web
 * build has no SSR, so `getServerSnapshot` is omitted (direct
 * `navigator.onLine` access is always safe here).
 *
 * Returns `true` when the browser believes it is online.
 */
function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
