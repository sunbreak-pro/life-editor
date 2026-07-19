import { describe, it, expect } from "vitest";
import {
  filterAndSortDailyEntries,
  type DailyListEntry,
} from "../src/utils/dailyListView";

/*
 * #283 — pure filter + date-sort helper for the Daily sidebar list. Verifies
 * asc/desc date ordering, case-insensitive substring narrowing, and that a
 * blank query is a no-op filter. Generic over the entry type (extra fields are
 * carried through untouched).
 */

const ENTRIES: DailyListEntry[] = [
  { date: "2026-07-01", searchText: "Planned the month" },
  { date: "2026-07-04", searchText: "Reviewed the WEEK" },
  { date: "2026-07-03", searchText: "Rest day, no notes" },
];

const dates = (rows: DailyListEntry[]): string[] => rows.map((r) => r.date);

describe("filterAndSortDailyEntries — sorting", () => {
  it("asc lists oldest date first", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      direction: "asc",
      query: "",
    });
    expect(dates(out)).toEqual(["2026-07-01", "2026-07-03", "2026-07-04"]);
  });

  it("desc lists newest date first", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      direction: "desc",
      query: "",
    });
    expect(dates(out)).toEqual(["2026-07-04", "2026-07-03", "2026-07-01"]);
  });
});

describe("filterAndSortDailyEntries — filtering", () => {
  it("empty query returns all entries", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      direction: "asc",
      query: "",
    });
    expect(out).toHaveLength(3);
  });

  it("whitespace-only query returns all entries", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      direction: "asc",
      query: "   ",
    });
    expect(out).toHaveLength(3);
  });

  it("narrows by case-insensitive substring", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      direction: "asc",
      query: "week",
    });
    expect(dates(out)).toEqual(["2026-07-04"]);
  });

  it("returns empty when nothing matches", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      direction: "asc",
      query: "quarterly",
    });
    expect(out).toEqual([]);
  });

  it("filters then sorts together", () => {
    const withHits: DailyListEntry[] = [
      { date: "2026-07-01", searchText: "gym session" },
      { date: "2026-07-05", searchText: "GYM again" },
      { date: "2026-07-02", searchText: "reading" },
    ];
    const out = filterAndSortDailyEntries(withHits, {
      direction: "desc",
      query: "gym",
    });
    expect(dates(out)).toEqual(["2026-07-05", "2026-07-01"]);
  });

  it("does not mutate the input array", () => {
    const input: DailyListEntry[] = [...ENTRIES];
    const snapshot = dates(input);
    filterAndSortDailyEntries(input, { direction: "desc", query: "" });
    expect(dates(input)).toEqual(snapshot);
  });

  it("carries through extra fields on generic entries", () => {
    const rich = [
      { date: "2026-07-02", searchText: "note", dayLabel: "7/2" },
      { date: "2026-07-01", searchText: "note", dayLabel: "7/1" },
    ];
    const out = filterAndSortDailyEntries(rich, {
      direction: "asc",
      query: "",
    });
    expect(out[0].dayLabel).toBe("7/1");
  });
});
