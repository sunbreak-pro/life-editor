import type { SyncDomain } from "./syncDomains";

/*
 * The debounced accumulator behind SyncProvider's Realtime listener (#499).
 *
 * Extracted from the Provider so it can be tested directly: it is the one
 * piece of genuinely new logic in the domain split, and driving it through a
 * real Supabase channel is not something a unit test can do.
 *
 * ONE shared timer, not one per domain. That keeps the pre-#499 burst
 * collapsing (a multi-row DnD reorder is still a single refetch) while
 * remembering WHICH domains the burst spanned, so the flush bumps those and
 * only those.
 */

export interface SyncBumpQueue {
  /** Record a change. Restarts the debounce; flushes `debounceMs` after the last call. */
  push(domains: readonly SyncDomain[]): void;
  /** Drop the pending flush (Provider unmount). */
  cancel(): void;
}

export function createSyncBumpQueue(
  flush: (domains: readonly SyncDomain[]) => void,
  debounceMs: number,
): SyncBumpQueue {
  let pending = new Set<SyncDomain>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    push(domains) {
      for (const d of domains) pending.add(d);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        // Swap the set out BEFORE flushing: a change arriving during the
        // flush belongs to the next round, not this one. Re-flushing a
        // domain is only a wasted fetch, but carrying one over forever
        // would be a bump nobody asked for on every subsequent burst.
        const flushing = [...pending];
        pending = new Set();
        flush(flushing);
      }, debounceMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = new Set();
    },
  };
}
