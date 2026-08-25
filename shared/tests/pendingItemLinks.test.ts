// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  createPendingItemLinks,
  queuePendingItemLink,
  takePendingItemLinks,
} from "../src/utils/pendingItemLinks";

/*
 * #371 — `[[ ]]` edges inserted on a day that has no items_meta row yet used
 * to be dropped (FK violation avoidance). They park here instead, keyed by
 * date, until the save that creates the row drains them.
 */

describe("pendingItemLinks (#371)", () => {
  it("parks a target and hands it back once", () => {
    const pending = createPendingItemLinks();
    expect(queuePendingItemLink(pending, "2026-07-26", "note-1")).toBe(true);

    expect(takePendingItemLinks(pending, "2026-07-26")).toEqual(["note-1"]);
    // Drained — the same save must not write the edge twice.
    expect(takePendingItemLinks(pending, "2026-07-26")).toEqual([]);
  });

  it("keeps insertion order and rejects a duplicate target", () => {
    const pending = createPendingItemLinks();
    queuePendingItemLink(pending, "2026-07-26", "note-1");
    queuePendingItemLink(pending, "2026-07-26", "daily-2026-07-01");
    // Re-inserting the same link before the first save must not queue twice.
    expect(queuePendingItemLink(pending, "2026-07-26", "note-1")).toBe(false);

    expect(takePendingItemLinks(pending, "2026-07-26")).toEqual([
      "note-1",
      "daily-2026-07-01",
    ]);
  });

  it("isolates dates so a date switch drags nothing along", () => {
    const pending = createPendingItemLinks();
    queuePendingItemLink(pending, "2026-07-26", "note-1");
    queuePendingItemLink(pending, "2026-07-27", "note-2");

    expect(takePendingItemLinks(pending, "2026-07-26")).toEqual(["note-1"]);
    // The other day's edge survives its neighbour's save untouched.
    expect(takePendingItemLinks(pending, "2026-07-27")).toEqual(["note-2"]);
  });

  it("returns [] for a date that never queued anything", () => {
    const pending = createPendingItemLinks();
    expect(takePendingItemLinks(pending, "2026-07-26")).toEqual([]);
  });
});
