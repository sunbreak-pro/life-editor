import { useMemo, type ReactNode } from "react";
import { SyncContext, type WebSyncContextValue } from "./SyncContextValue";

/**
 * Web no-op Sync Provider (S1 — provisional). See SyncContextValue.ts for
 * the rationale. `syncVersion` is a constant so TaskTree's load effect
 * runs exactly once; `triggerSync` resolves immediately. Replaced by a
 * Supabase Realtime-backed provider in S8.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const value = useMemo<WebSyncContextValue>(
    () => ({
      syncVersion: 0,
      triggerSync: async () => {},
    }),
    [],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
