/*
 * Own-write ledger (#2290 item 3) — which Realtime changes are this client's
 * own writes coming back.
 *
 * `postgres_changes` echoes a tab's own writes to it, and SyncProvider turned
 * every echo into a refetch of the whole domain. The local state already holds
 * what was written (every save path updates it optimistically), so that
 * refetch only re-downloaded the list it had just changed: measured on
 * 2026-10-19, one note save was a 0.9KB RPC followed by a 24KB note list, and
 * one Daily save ended in a 17KB Daily list.
 *
 * A write path calls `noteOwnWrite` for the rows it writes, and SyncProvider
 * asks `isOwnEcho` before it schedules a bump. Matching is deliberately
 * narrow, so a change from another device is never taken for ours:
 *
 *   - `items_meta` matches on id AND `updated_at`. Another device's write to
 *     the same item carries its own stamp, so it never matches.
 *   - a payload table (keyed by `item_id`) has no `updated_at` (DB-Q2 — the
 *     stamp lives on the meta row only), so it matches on the id alone, inside
 *     a short window. That is safe because every write bumps `items_meta` too:
 *     another device's payload write in the same window is followed by its
 *     meta change, which does not match, and that one refetches the domain.
 *
 * Each recorded write absorbs ONE echo and then is gone; an echo that never
 * arrives (the socket was down) simply expires.
 */

/** How long a recorded write waits for its echo. */
export const OWN_WRITE_TTL_MS = 10_000;

interface Entry {
  /** `Date.parse` of the written `updated_at`; null for a payload row. */
  stamp: number | null;
  expires: number;
}

const entries = new Map<string, Entry[]>();

function keyOf(table: string, id: string): string {
  return `${table}\u0000${id}`;
}

function parseStamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function live(key: string, now: number): Entry[] {
  const list = (entries.get(key) ?? []).filter((e) => e.expires > now);
  if (list.length === 0) entries.delete(key);
  else entries.set(key, list);
  return list;
}

/**
 * Remember a row this client just wrote. `updatedAt` is required for
 * `items_meta` (without the stamp the echo cannot be told apart from another
 * device's write, so nothing is recorded) and ignored for payload tables.
 */
export function noteOwnWrite(
  table: string,
  id: string,
  updatedAt?: string | null,
  now: number = Date.now(),
): void {
  const stamp = table === "items_meta" ? parseStamp(updatedAt) : null;
  if (table === "items_meta" && stamp === null) return;
  const key = keyOf(table, id);
  const list = live(key, now);
  list.push({ stamp, expires: now + OWN_WRITE_TTL_MS });
  entries.set(key, list);
}

/**
 * True when `row` (a Realtime payload's `new`) is the echo of a write recorded
 * above. A match is consumed. Deletes carry no `new` row and never match.
 */
export function isOwnEcho(
  table: string,
  row: unknown,
  now: number = Date.now(),
): boolean {
  if (!row || typeof row !== "object") return false;
  const record = row as Record<string, unknown>;
  const id = table === "items_meta" ? record.id : record.item_id;
  if (typeof id !== "string") return false;
  const key = keyOf(table, id);
  const list = live(key, now);
  if (list.length === 0) return false;
  const stamp = table === "items_meta" ? parseStamp(record.updated_at) : null;
  if (table === "items_meta" && stamp === null) return false;
  const at = list.findIndex((e) => e.stamp === stamp);
  if (at === -1) return false;
  list.splice(at, 1);
  if (list.length === 0) entries.delete(key);
  return true;
}

/** Forget everything (tests, sign-out). */
export function resetOwnWriteLedger(): void {
  entries.clear();
}
