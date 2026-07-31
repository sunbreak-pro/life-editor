import { useSyncContext } from "./useSyncContext";
import type { SyncDomain } from "../context/syncDomains";

/*
 * useSyncDomains (#499) — a refetch key scoped to the domains a consumer
 * actually reads.
 *
 * Drop-in for the old `const { syncVersion } = useSyncContext()`: it returns a
 * single number for the effect's dep array, but one that only moves when a
 * table belonging to one of the named domains changed. A note edit no longer
 * re-pulls the task tree, and — because reading the timer settings WRITES a
 * defaults row — no longer writes to `timer_settings` either.
 *
 * The sum is the combining function on purpose: each counter only ever
 * increases, so the total changes if and only if at least one member moved. No
 * array identity to memoise, and it behaves as a plain number in deps.
 *
 * Pass every domain the effect reads. Under-declaring is the dangerous
 * direction — a missed domain means stale data with no way for the user to
 * refresh it — so when a fetch spans domains, list them all.
 */
export function useSyncDomains(...domains: readonly SyncDomain[]): number {
  const { domainVersions } = useSyncContext();
  let total = 0;
  // `?? 0` guards a hand-written stub Provider missing a key: an undefined
  // would make the total NaN, and React compares deps with Object.is — which
  // says NaN === NaN, so the effect would silently never re-run again.
  for (const domain of domains) total += domainVersions[domain] ?? 0;
  return total;
}
