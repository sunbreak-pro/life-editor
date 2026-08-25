// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSyncBumpQueue } from "../src/context/syncBumpQueue";
import type { SyncDomain } from "../src/context/syncDomains";

/*
 * #499 — the debounced accumulator behind SyncProvider's Realtime listener.
 *
 * This is the one piece of genuinely new control flow in the domain split, and
 * it cannot be exercised through a live Supabase channel in a unit test, which
 * is why it lives outside the Provider.
 *
 * The behaviour that matters is the pair: a burst spanning two domains must
 * bump BOTH (dropping one is invisible stale data), and a flushed domain must
 * NOT ride along on the next burst (that is the cross-domain refetch #499 set
 * out to remove, reintroduced through the back door).
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const DEBOUNCE = 300;

function harness() {
  const flushes: SyncDomain[][] = [];
  const queue = createSyncBumpQueue((d) => flushes.push([...d]), DEBOUNCE);
  return { queue, flushes };
}

describe("createSyncBumpQueue", () => {
  it("collapses a burst into one flush", () => {
    const { queue, flushes } = harness();
    queue.push(["notes"]);
    vi.advanceTimersByTime(100);
    queue.push(["notes"]);
    vi.advanceTimersByTime(100);
    queue.push(["notes"]);
    expect(flushes).toEqual([]);
    vi.advanceTimersByTime(DEBOUNCE);
    expect(flushes).toEqual([["notes"]]);
  });

  it("keeps every domain a burst spanned", () => {
    const { queue, flushes } = harness();
    queue.push(["notes"]);
    queue.push(["tags"]);
    vi.advanceTimersByTime(DEBOUNCE);
    expect(flushes).toHaveLength(1);
    expect([...flushes[0]].sort()).toEqual(["notes", "tags"]);
  });

  it("does not carry a flushed domain into the next burst", () => {
    const { queue, flushes } = harness();
    queue.push(["notes"]);
    vi.advanceTimersByTime(DEBOUNCE);
    queue.push(["tags"]);
    vi.advanceTimersByTime(DEBOUNCE);
    // Not [["notes"], ["notes", "tags"]] — a sticky pending set would make
    // every later burst re-refetch notes, which is the very traffic #499
    // exists to remove.
    expect(flushes).toEqual([["notes"], ["tags"]]);
  });

  it("de-duplicates repeats of the same domain within a burst", () => {
    const { queue, flushes } = harness();
    queue.push(["notes", "notes"]);
    queue.push(["notes"]);
    vi.advanceTimersByTime(DEBOUNCE);
    expect(flushes).toEqual([["notes"]]);
  });

  it("still flushes for a change that maps to no domain", () => {
    const { queue, flushes } = harness();
    // An unrouted table bumps the app-wide counter only; the Provider reads
    // an empty list as "syncVersion, no domains".
    queue.push([]);
    vi.advanceTimersByTime(DEBOUNCE);
    expect(flushes).toEqual([[]]);
  });

  it("drops the pending flush on cancel", () => {
    const { queue, flushes } = harness();
    queue.push(["notes"]);
    queue.cancel();
    vi.advanceTimersByTime(DEBOUNCE * 2);
    expect(flushes).toEqual([]);
  });

  it("starts clean after a cancel", () => {
    const { queue, flushes } = harness();
    queue.push(["notes"]);
    queue.cancel();
    queue.push(["tags"]);
    vi.advanceTimersByTime(DEBOUNCE);
    expect(flushes).toEqual([["tags"]]);
  });
});
