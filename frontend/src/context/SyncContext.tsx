import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { SyncContext, type SyncContextValue } from "./SyncContextValue";
import { getDataService } from "../services/dataServiceFactory";
import { emitSyncComplete } from "../services/events";
import type { SyncResult, SyncStatus } from "../types/sync";

const SYNC_INTERVAL_MS = 30_000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ds = getDataService();

  // Load status on mount
  useEffect(() => {
    ds.syncGetStatus()
      .then(setStatus)
      .catch(() => {});
  }, [ds]);

  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await ds.syncTrigger();
      setLastSyncResult(result);
      const newStatus = await ds.syncGetStatus();
      setStatus(newStatus);
      if (result.pulled > 0) {
        emitSyncComplete();
      }
    } catch {
      // Silently handle sync errors for background polling
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [ds]);

  const configure = useCallback(
    async (url: string, token: string): Promise<boolean> => {
      const ok = await ds.syncConfigure(url, token);
      if (ok) {
        const newStatus = await ds.syncGetStatus();
        setStatus(newStatus);
      }
      return ok;
    },
    [ds],
  );

  const disconnect = useCallback(async () => {
    await ds.syncDisconnect();
    setStatus(
      (prev) =>
        prev && {
          ...prev,
          enabled: false,
          lastSyncedAt: null,
          url: null,
        },
    );
    setLastSyncResult(null);
  }, [ds]);

  const fullDownload = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await ds.syncFullDownload();
      setLastSyncResult(result);
      const newStatus = await ds.syncGetStatus();
      setStatus(newStatus);
      if (result.pulled > 0) {
        emitSyncComplete();
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [ds]);

  // Start/stop polling based on enabled status
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (status?.enabled) {
      intervalRef.current = setInterval(() => {
        triggerSync();
      }, SYNC_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status?.enabled, triggerSync]);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      lastSyncResult,
      isSyncing,
      triggerSync,
      configure,
      disconnect,
      fullDownload,
    }),
    [
      status,
      lastSyncResult,
      isSyncing,
      triggerSync,
      configure,
      disconnect,
      fullDownload,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
