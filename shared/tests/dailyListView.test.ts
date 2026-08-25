// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  filterAndSortDailyEntries,
  type DailyListEntry,
} from "../src/utils/dailyListView";

/*
 * #283 — pure filter + sort helper for the Daily sidebar list. Verifies
 * asc/desc ordering, case-insensitive substring narrowing, and that a blank
 * query is a no-op filter. Generic over the entry type (extra fields are
 * carried through untouched).
 *
 * #369 added the sort MODE. The fixture below deliberately scrambles the three
 * keys against each other — the entry with the newest `date` has the OLDEST
 * `updatedAt` — so a test that passes under the wrong mode is impossible.
 */

const entry = (
  date: string,
  searchText: string,
  createdAt: string,
  updatedAt: string,
): DailyListEntry => ({ date, searchText, createdAt, updatedAt });

const ENTRIES: DailyListEntry[] = [
  // date order:      01 < 03 < 04
  // createdAt order: 04 < 01 < 03
  // updatedAt order: 04 < 03 < 01
  entry(
    "2026-07-01",
    "Planned the month",
    "2026-07-01T09:00:00.000Z",
    "2026-07-20T09:00:00.000Z",
  ),
  entry(
    "2026-07-04",
    "Reviewed the WEEK",
    "2026-06-30T09:00:00.000Z",
    "2026-07-05T09:00:00.000Z",
  ),
  entry(
    "2026-07-03",
    "Rest day, no notes",
    "2026-07-02T09:00:00.000Z",
    "2026-07-10T09:00:00.000Z",
  ),
];

const dates = (rows: DailyListEntry[]): string[] => rows.map((r) => r.date);

describe("filterAndSortDailyEntries — sorting by date", () => {
  it("asc lists oldest date first", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "date",
      direction: "asc",
      query: "",
    });
    expect(dates(out)).toEqual(["2026-07-01", "2026-07-03", "2026-07-04"]);
  });

  it("desc lists newest date first", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "date",
      direction: "desc",
      query: "",
    });
    expect(dates(out)).toEqual(["2026-07-04", "2026-07-03", "2026-07-01"]);
  });
});

describe("filterAndSortDailyEntries — sorting by timestamp (#369)", () => {
  it("updatedAt desc puts the most recently edited entry first", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "updatedAt",
      direction: "desc",
      query: "",
    });
    // Newest updatedAt belongs to the OLDEST date — proves the mode is read.
    expect(dates(out)).toEqual(["2026-07-01", "2026-07-03", "2026-07-04"]);
  });

  it("updatedAt asc reverses that order", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "updatedAt",
      direction: "asc",
      query: "",
    });
    expect(dates(out)).toEqual(["2026-07-04", "2026-07-03", "2026-07-01"]);
  });

  it("createdAt desc orders by creation, not by date or edit time", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "createdAt",
      direction: "desc",
      query: "",
    });
    // Distinct from BOTH date-desc and updatedAt-desc above.
    expect(dates(out)).toEqual(["2026-07-03", "2026-07-01", "2026-07-04"]);
  });

  it("breaks timestamp ties on date so the order stays deterministic", () => {
    const sameStamp = "2026-07-09T00:00:00.000Z";
    const tied: DailyListEntry[] = [
      entry("2026-07-02", "b", sameStamp, sameStamp),
      entry("2026-07-01", "a", sameStamp, sameStamp),
    ];
    const asc = filterAndSortDailyEntries(tied, {
      mode: "updatedAt",
      direction: "asc",
      query: "",
    });
    expect(dates(asc)).toEqual(["2026-07-01", "2026-07-02"]);
    const desc = filterAndSortDailyEntries(tied, {
      mode: "updatedAt",
      direction: "desc",
      query: "",
    });
    expect(dates(desc)).toEqual(["2026-07-02", "2026-07-01"]);
  });

  it("filters first, then applies the timestamp mode", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "updatedAt",
      direction: "desc",
      query: "the",
    });
    // "Planned the month" + "Reviewed the WEEK" match; "Rest day" does not.
    expect(dates(out)).toEqual(["2026-07-01", "2026-07-04"]);
  });
});

describe("filterAndSortDailyEntries — filtering", () => {
  it("empty query returns all entries", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "date",
      direction: "asc",
      query: "",
    });
    expect(out).toHaveLength(3);
  });

  it("whitespace-only query returns all entries", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "date",
      direction: "asc",
      query: "   ",
    });
    expect(out).toHaveLength(3);
  });

  it("narrows by case-insensitive substring", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "date",
      direction: "asc",
      query: "week",
    });
    expect(dates(out)).toEqual(["2026-07-04"]);
  });

  it("returns empty when nothing matches", () => {
    const out = filterAndSortDailyEntries(ENTRIES, {
      mode: "date",
      direction: "asc",
      query: "quarterly",
    });
    expect(out).toEqual([]);
  });

  it("filters then sorts together", () => {
    const withHits: DailyListEntry[] = [
      entry(
        "2026-07-01",
        "gym session",
        "2026-07-01T00:00:00.000Z",
        "2026-07-01T00:00:00.000Z",
      ),
      entry(
        "2026-07-05",
        "GYM again",
        "2026-07-05T00:00:00.000Z",
        "2026-07-05T00:00:00.000Z",
      ),
      entry(
        "2026-07-02",
        "reading",
        "2026-07-02T00:00:00.000Z",
        "2026-07-02T00:00:00.000Z",
      ),
    ];
    const out = filterAndSortDailyEntries(withHits, {
      mode: "date",
      direction: "desc",
      query: "gym",
    });
    expect(dates(out)).toEqual(["2026-07-05", "2026-07-01"]);
  });

  it("does not mutate the input array", () => {
    const input: DailyListEntry[] = [...ENTRIES];
    const snapshot = dates(input);
    filterAndSortDailyEntries(input, {
      mode: "updatedAt",
      direction: "desc",
      query: "",
    });
    expect(dates(input)).toEqual(snapshot);
  });

  it("carries through extra fields on generic entries", () => {
    const rich = [
      {
        ...entry(
          "2026-07-02",
          "note",
          "2026-07-02T00:00:00.000Z",
          "2026-07-02T00:00:00.000Z",
        ),
        dayLabel: "7/2",
      },
      {
        ...entry(
          "2026-07-01",
          "note",
          "2026-07-01T00:00:00.000Z",
          "2026-07-01T00:00:00.000Z",
        ),
        dayLabel: "7/1",
      },
    ];
    const out = filterAndSortDailyEntries(rich, {
      mode: "date",
      direction: "asc",
      query: "",
    });
    expect(out[0].dayLabel).toBe("7/1");
  });
});
