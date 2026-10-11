import { describe, expect, it } from "vitest";
import { recordsWindow } from "../src/analytics/recordsRange";

/*
 * The window the Analytics host reads app_records for (#2164): local
 * midnights as instants, `to` exclusive, and never narrower than the last
 * seven days (the narrow block reads them out of the same read).
 */

const NOW = new Date(2026, 9, 11, 15, 30); // 2026-10-11, local

const local = (y: number, m: number, d: number): string =>
  new Date(y, m - 1, d).toISOString();

describe("recordsWindow", () => {
  it("covers the range from its first local midnight to the midnight after its last day", () => {
    expect(recordsWindow("2026-09-12", "2026-10-11", NOW)).toEqual({
      from: local(2026, 9, 12),
      to: local(2026, 10, 12),
    });
  });

  it("widens a short range to the last seven days", () => {
    // A range of only today still has to reach the six days before it.
    expect(recordsWindow("2026-10-11", "2026-10-11", NOW)).toEqual({
      from: local(2026, 10, 5),
      to: local(2026, 10, 12),
    });
  });

  it("reaches back across a month boundary", () => {
    const early = new Date(2026, 10, 3, 9);
    expect(recordsWindow("2026-11-01", "2026-11-03", early)).toEqual({
      from: local(2026, 10, 28),
      to: local(2026, 11, 4),
    });
  });
});
