import { useSyncExternalStore } from "react";
import { isOffline, subscribeConnectivity } from "@life-editor/shared";

/*
 * Tracks whether the app can reach the server (S7). This hook is what the
 * global OfflineBanner and the Notes list read to decide what to show.
 *
 * The answer lives in shared's connectivity store (#2334), which useDomainLoad
 * also reads: `navigator.onLine` with its `online` / `offline` window events,
 * plus the session gate's finding that the session could not be refreshed.
 *
 * Returns `true` when the app believes it is online.
 */
function getSnapshot(): boolean {
  return !isOffline();
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeConnectivity, getSnapshot);
}
