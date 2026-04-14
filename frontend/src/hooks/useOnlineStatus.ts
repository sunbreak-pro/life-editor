import { useState, useEffect, useCallback, useRef } from "react";
import {
  getOfflineDataService,
  isStandalone,
} from "../services/dataServiceFactory";
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updatePendingCount = useCallback(async () => {
    const svc = getOfflineDataService();
    if (svc) {
      const count = await svc.getQueueSize();
      setPendingCount(count);
      if (count > 0 && syncStatus === "idle") {
        setSyncStatus("pending");
      } else if (count === 0 && syncStatus === "pending") {
        setSyncStatus("idle");
      }
    }
  }, [syncStatus]);

  const checkHealth = useCallback(async () => {
    if (isStandalone()) {
      // Standalone mode: no server to check
      setOnlineStatus("offline");
      return;
    }
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
    if (isStandalone()) return;
    const svc = getOfflineDataService();
    if (!svc) return;

    setSyncStatus("syncing");
    try {
      await svc.triggerSync();
      setSyncStatus("idle");
    } catch {
      setSyncStatus("error");
    }
    await updatePendingCount();
  }, [updatePendingCount]);

  // Online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus("online");
      triggerSync();
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
  }, [triggerSync]);

  // Health check polling
  useEffect(() => {
    checkHealth();
    healthTimerRef.current = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    return () => {
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    };
  }, [checkHealth]);

  // Subscribe to queue changes
  useEffect(() => {
    const svc = getOfflineDataService();
    if (svc) {
      svc.setQueueChangeHandler(() => {
        updatePendingCount();
      });
      // Initial count
      updatePendingCount();
    }
  }, [updatePendingCount]);

  // Auto-sync on coming back online
  useEffect(() => {
    if (onlineStatus === "online" && pendingCount > 0) {
      triggerSync();
    }
  }, [onlineStatus, pendingCount, triggerSync]);

  return { onlineStatus, syncStatus, pendingCount, triggerSync };
}
