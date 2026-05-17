import { createContext } from "react";

/**
 * Web Sync Context (S1 — provisional no-op).
 *
 * The Tauri build had a full Cloudflare-D1 bidirectional sync engine
 * behind this Context. The web build is Supabase-native and assumes
 * always-online; real cross-tab propagation lands in S8 (Supabase
 * Realtime). Until then this Context exists only so TaskTree (which
 * reads `syncVersion` to know when to refetch) does not crash for want
 * of a provider. `triggerSync` is a no-op and `syncVersion` never
 * changes (no polling — user-confirmed).
 *
 * This is intentionally a thin, single-file Context (CLAUDE.md §6.3
 * exception: self-contained, no other provider depends on it), mirroring
 * the `ToastContext` precedent.
 */
export interface WebSyncContextValue {
  /** Bumps when a refetch should occur. Static in the web no-op build. */
  syncVersion: number;
  /** No-op in web S1; replaced by Supabase Realtime in S8. */
  triggerSync: () => Promise<void>;
}

export const SyncContext = createContext<WebSyncContextValue | null>(null);
