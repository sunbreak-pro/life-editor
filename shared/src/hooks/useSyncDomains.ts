import { useSyncExternalStore } from "react";
import { useSyncContext } from "./useSyncContext";
import type { SyncDomain } from "../context/syncDomains";

/*
 * useSyncDomains (#499) — a refetch key scoped to the domains a consumer
 * actually reads.
 *
 * Drop-in for the old `const { syncVersion } = useSyncContext()`: it returns a
 * single number for the effect's dep array, but one that only moves when a
 * table belonging to one of the named domains changed. A note edit no longer
 * re-pulls the todo tree, and — because reading the timer settings WRITES a
 * defaults row — no longer writes to `timer_settings` either.
 *
 * The sum is the combining function on purpose: each counter only ever
 * increases, so the total changes if and only if at least one member moved. No
 * array identity to memoise, and it behaves as a plain number in deps.
 *
 * #676 (d): it now reads the counters through useSyncExternalStore rather than
 * off the context value. The number was already scoped, but the RE-RENDER was
 * not — the value object changed on every bump, so `useContext` woke every
 * consumer and only then did each one work out that its own total had not
 * moved. React compares the snapshot instead, and a snapshot that has not
 * moved costs nothing. That is why the snapshot must stay a primitive: return
 * an object here and every bump would look like a change again.
 *
 * Pass every domain the effect reads. Under-declaring is the dangerous
 * direction — a missed domain means stale data with no way for the user to
 * refresh it — so when a fetch spans domains, list them all.
 */

/**
 * Subscription used when the Provider exposes no store — the hand-written stub
 * Providers in the test suites. Module-level so its identity is stable (a new
 * function each render would make useSyncExternalStore resubscribe forever).
 * Those stubs hold the counters in ordinary state, so their own re-render is
 * what delivers a change: the snapshot is re-read on every render either way.
 */
const NO_STORE = (): (() => void) => () => {};

export function useSyncDomains(...domains: readonly SyncDomain[]): number {
  const ctx = useSyncContext();
  const getSnapshot = () => {
    const versions = ctx.getDomainVersions
      ? ctx.getDomainVersions()
      : ctx.domainVersions;
    let total = 0;
    // `?? 0` guards a hand-written stub Provider missing a key: an undefined
    // would make the total NaN, and React compares deps with Object.is — which
    // says NaN === NaN, so the effect would silently never re-run again.
    for (const domain of domains) total += versions[domain] ?? 0;
    return total;
  };
  // Third argument = the server snapshot. There is no SSR here, but React
  // requires it for any component that could hydrate, and reading the same
  // store is the correct answer for a client-only counter.
  return useSyncExternalStore(
    ctx.subscribe ?? NO_STORE,
    getSnapshot,
    getSnapshot,
  );
}
