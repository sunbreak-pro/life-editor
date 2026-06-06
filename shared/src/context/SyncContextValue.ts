import { createContext } from "react";

/**
 * Web Sync Context (S8 — Supabase Realtime backed).
 *
 * The Tauri build had a full Cloudflare-D1 bidirectional sync engine
 * behind this Context. The web build is Supabase-native and assumes
 * always-online. As of S8 the Provider (SyncContext.tsx) subscribes to
 * `postgres_changes` on every owned table and bumps `syncVersion` (debounced)
 * whenever any row changes; the domain `*API` hooks keep `syncVersion` in
 * their load-effect deps, so a bump refetches every mounted domain.
 *
 * This is intentionally a thin, single-file Context (CLAUDE.md §6.3
 * exception: self-contained, no other provider depends on it), mirroring
 * the `ToastContext` precedent.
 */
export interface WebSyncContextValue {
  /** Bumps when a refetch should occur (Realtime change events, debounced). */
  syncVersion: number;
  /**
   * Forces a manual refetch bump. Unused by Realtime (the subscription is
   * passive) but kept for compatibility — never removed.
   */
  triggerSync: () => Promise<void>;
}

export const SyncContext = createContext<WebSyncContextValue | null>(null);
