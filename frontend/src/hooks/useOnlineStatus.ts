import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../config/api";

export type OnlineStatus = "online" | "offline";
export type SyncStatus = "idle" | "syncing" | "pending" | "error";

const HEALTH_CHECK_INTERVAL_MS = 30_000;

export function useOnlineStatus(): {
  onlineStatus: OnlineStatus;
  syncStatus: SyncStatus;
  pendingCount: number;
  triggerSync: () => Promise<void>;
} {
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>(
    navigator.onLine ? "online" : "offline",
  );
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await apiFetch("/api/health");
      if (res.ok) {
        setOnlineStatus("online");
      } else {
        setOnlineStatus("offline");
      }
    } catch {
      setOnlineStatus("offline");
    }
  }, []);

  const triggerSync = useCallback(async () => {
    // No-op: offline sync removed in Tauri migration
  }, []);

  // Online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus("online");
    };
    const handleOffline = () => {
      setOnlineStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Health check polling
  useEffect(() => {
    checkHealth();
    healthTimerRef.current = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    return () => {
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    };
  }, [checkHealth]);

  return { onlineStatus, syncStatus: "idle", pendingCount: 0, triggerSync };
}
