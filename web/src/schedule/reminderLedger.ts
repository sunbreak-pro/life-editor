/*
 * The fired-reminder ledger (#1374), at MODULE scope rather than in a useRef.
 *
 * "Once per page load" is a page-scoped fact, and StrictMode remounts every
 * component on mount in dev — a ref would be discarded and the same reminder
 * would toast twice, in exactly the build a reviewer checks the DoD's
 * no-duplicates clause in.
 *
 * It lives in its own module rather than beside the bridge component because
 * a file that exports a component AND anything else breaks Fast Refresh
 * (react-refresh/only-export-components): editing the bridge would remount
 * the tree and, without the separation, silently reset the ledger mid-session
 * — the exact failure the module scope was chosen to avoid.
 *
 * Values are the ms the key fired at, so the map can be pruned rather than
 * growing for the life of the session.
 */

const FIRED = new Map<string, number>();

const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Keys already delivered, for the sweep's duplicate check. */
export function firedKeys(): Set<string> {
  return new Set(FIRED.keys());
}

/** Record a delivery at `nowMs`. */
export function markFired(key: string, nowMs: number): void {
  FIRED.set(key, nowMs);
}

/** Drop entries older than a day so the map does not grow unbounded. */
export function pruneFired(nowMs: number): void {
  for (const [key, firedAt] of FIRED) {
    if (nowMs - firedAt > PRUNE_AFTER_MS) FIRED.delete(key);
  }
}

/** Tests only — the module singleton has to be resettable between cases. */
export function __resetReminderLedger(): void {
  FIRED.clear();
}
