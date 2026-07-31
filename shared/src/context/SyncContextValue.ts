import { createContext } from "react";
import type { SyncDomain } from "./syncDomains";

/**
 * Web Sync Context (S8 — Supabase Realtime backed).
 *
 * The Tauri build had a full Cloudflare-D1 bidirectional sync engine
 * behind this Context. The web build is Supabase-native and assumes
 * always-online. The Provider (SyncContext.tsx) subscribes to
 * `postgres_changes` on every owned table and bumps a counter (debounced)
 * whenever a row changes.
 *
 * Since #499 the bump is PER DOMAIN: a change routes through
 * `domainsForChange` and moves only the counters it affects, so a note edit no
 * longer re-pulls tasks, tags, the timer and the sound settings. Consumers ask
 * for the domains they read via `useSyncDomains`, which is the supported
 * entry point — `domainVersions` is exposed for it and for tests.
 *
 * This is intentionally a thin, single-file Context (CLAUDE.md §6.3
 * exception: self-contained, no other provider depends on it), mirroring
 * the `ToastContext` precedent.
 */
export interface WebSyncContextValue {
  /**
   * Bumps on ANY owned-table change. Kept as the app-wide "something moved"
   * signal; prefer `useSyncDomains` so a refetch is not triggered by a
   * domain the consumer does not read.
   */
  syncVersion: number;
  /** Per-domain counters. A domain moves only when its own tables change. */
  domainVersions: Readonly<Record<SyncDomain, number>>;
  /**
   * Forces a manual refetch bump across every domain. Unused by Realtime (the
   * subscription is passive) but kept for compatibility — never removed.
   */
  triggerSync: () => Promise<void>;
}

export const SyncContext = createContext<WebSyncContextValue | null>(null);
