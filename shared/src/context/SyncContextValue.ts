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
 * #676 (d) finished the job on the RENDER side. Until then the counters lived
 * in Provider state, so the context value was a new object on every bump and
 * every consumer re-rendered — including the ones whose own counter had not
 * moved, which is precisely what the domain split exists to avoid. The
 * counters are now an external store (`subscribe` + `getDomainVersions`) and
 * the context value has a STABLE identity, so a note edit no longer wakes the
 * timer, the audio mixer or the calendar at all.
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
   *
   * On the real Provider this is a live GETTER over the store, not a
   * re-rendered field: reading it during render gives the current value but
   * does NOT subscribe the reader to changes. Nothing in the app reads it
   * directly; go through `useSyncDomains`.
   */
  syncVersion: number;
  /** Per-domain counters. A domain moves only when its own tables change. */
  domainVersions: Readonly<Record<SyncDomain, number>>;
  /**
   * Forces a manual refetch bump across every domain. Unused by Realtime (the
   * subscription is passive) but kept for compatibility — never removed.
   */
  triggerSync: () => Promise<void>;
  /**
   * Store subscription — `useSyncDomains` uses it with useSyncExternalStore so
   * a consumer re-renders only when one of ITS domains moved.
   *
   * OPTIONAL because the test suites mount hand-written stub Providers that
   * hold the counters in ordinary state (see syncDomainWiring.test.tsx). Those
   * keep working: without a store `useSyncDomains` re-reads `domainVersions`
   * off the context value each render, which the stub's own re-render delivers.
   */
  subscribe?: (onStoreChange: () => void) => () => void;
  /** Current counters, read imperatively. Pairs with `subscribe`. */
  getDomainVersions?: () => Readonly<Record<SyncDomain, number>>;
}

export const SyncContext = createContext<WebSyncContextValue | null>(null);
