import { describe, it, expect } from "vitest";
import { pickRepeatOccurrence } from "../src/schedule/repeatOccurrence";

/*
 * #1830 — the rule both repeat-row jumps wait on.
 *
 * "Edit detail" (#1678) and "show the next one" (#1830) park the ROUTINE id
 * and resolve it once the anchored day's range has been read. What has to hold
 * is that they resolve to the occurrence ON THAT DAY: a series has a row on
 * several days inside a fetched window, and the wrong one opens — or rings —
 * a day the calendar is not showing.
 */

type Row = { id: string; routineId: string | null; date: string };

const ROWS: Row[] = [
  { id: "ev-1", routineId: null, date: "2026-09-23" },
  { id: "occ-mon", routineId: "routine-9", date: "2026-09-21" },
  { id: "occ-wed", routineId: "routine-9", date: "2026-09-23" },
  { id: "occ-other", routineId: "routine-4", date: "2026-09-23" },
];

describe("pickRepeatOccurrence", () => {
  it("takes the series' row on the anchored day", () => {
    expect(pickRepeatOccurrence(ROWS, "routine-9", "2026-09-23")?.id).toBe(
      "occ-wed",
    );
  });

  it("does not take an earlier day's row of the same series", () => {
    expect(pickRepeatOccurrence(ROWS, "routine-9", "2026-09-22")).toBeNull();
  });

  it("ignores another series on the same day", () => {
    expect(pickRepeatOccurrence(ROWS, "routine-4", "2026-09-23")?.id).toBe(
      "occ-other",
    );
  });

  it("returns null while the day has not been fetched", () => {
    expect(pickRepeatOccurrence([], "routine-9", "2026-09-23")).toBeNull();
  });
});
