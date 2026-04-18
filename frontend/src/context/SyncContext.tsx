import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import {
  SyncContext,
  type SyncContextValue,
  type SyncError,
} from "./SyncContextValue";
import { getDataService } from "../services/dataServiceFactory";
import { emitSyncComplete } from "../services/events";
import { useServiceErrorHandler } from "../hooks/useServiceErrorHandler";
import type { SyncResult, SyncStatus } from "../types/sync";

const SYNC_INTERVAL_MS = 30_000;

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastError, setLastError] = useState<SyncError | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const isSyncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { handle: handleError } = useServiceErrorHandler();
  const ds = getDataService();

  const reportError = useCallback(
    (
      i18nKey: string,
      err: unknown,
      opts: { toast?: boolean } = { toast: true },
    ) => {
      setLastError({ message: toErrorMessage(err), at: Date.now() });
      handleError(err, i18nKey, { silent: !opts.toast });
    },
    [handleError],
  );

  const clearError = useCallback(() => setLastError(null), []);

  // Load status on mount
  useEffect(() => {
    ds.syncGetStatus()
      .then(setStatus)
      .catch((e) => {
        reportError("errors.sync.loadStatusFailed", e, { toast: false });
      });
  }, [ds, reportError]);

  const runSync = useCallback(
    async (
      op: () => Promise<SyncResult>,
      opts: { notifyOnError: boolean },
    ): Promise<SyncResult | null> => {
      if (isSyncingRef.current) return null;
      isSyncingRef.current = true;
      setIsSyncing(true);

      // Cancel any previous request; set up new controller
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await op();
        if (controller.signal.aborted) return null;
        setLastSyncResult(result);
        setLastError(null);
        const newStatus = await ds.syncGetStatus();
        if (controller.signal.aborted) return null;
        setStatus(newStatus);
        if (result.pulled > 0) {
          emitSyncComplete();
          setSyncVersion((v) => v + 1);
        }
        return result;
      } catch (e) {
        if (controller.signal.aborted) return null;
        reportError("errors.sync.operationFailed", e, {
          toast: opts.notifyOnError,
        });
        return null;
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [ds, reportError],
  );

  const triggerSync = useCallback(async () => {
    await runSync(() => ds.syncTrigger(), { notifyOnError: false });
  }, [ds, runSync]);

  const configure = useCallback(
    async (url: string, token: string): Promise<boolean> => {
      try {
        const ok = await ds.syncConfigure(url, token);
        if (!ok) return false;
        const newStatus = await ds.syncGetStatus();
        setStatus(newStatus);
        setLastError(null);
        // Initial sync — notify on error since user-initiated
        await runSync(() => ds.syncTrigger(), { notifyOnError: true });
        return true;
      } catch (e) {
        reportError("errors.sync.configureFailed", e);
        return false;
      }
    },
    [ds, runSync, reportError],
  );

  const disconnect = useCallback(async () => {
    // Cancel any in-flight sync so it can't mutate state after disconnect
    abortRef.current?.abort();
    try {
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
      setLastError(null);
    } catch (e) {
      reportError("errors.sync.disconnectFailed", e);
    }
  }, [ds, reportError]);

  const fullDownload = useCallback(async () => {
    await runSync(() => ds.syncFullDownload(), { notifyOnError: true });
  }, [ds, runSync]);

  // Start/stop polling based on enabled status
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (status?.enabled) {
      intervalRef.current = setInterval(() => {
        // Skip background polling when tab hidden or offline (battery/data)
        if (typeof document !== "undefined" && document.hidden) return;
        if (typeof navigator !== "undefined" && navigator.onLine === false)
          return;
        triggerSync();
      }, SYNC_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status?.enabled, triggerSync]);

  // Cancel in-flight sync on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      lastSyncResult,
      lastError,
      isSyncing,
      syncVersion,
      triggerSync,
      configure,
      disconnect,
      fullDownload,
      clearError,
    }),
    [
      status,
      lastSyncResult,
      lastError,
      isSyncing,
      syncVersion,
      triggerSync,
      configure,
      disconnect,
      fullDownload,
      clearError,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
