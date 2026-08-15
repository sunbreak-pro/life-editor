import { describe, it, expect } from "vitest";
import { dateKeyOfInstant, formatDateKey } from "../src/utils/dateKey";
import { localDateTimeToISO } from "../src/utils/todoCalendarChips";

/*
 * #413 regression guard. The Briefing paper used to bucket todos with
 * `scheduledAt.slice(0, 10)`, which reads the UTC calendar day. The "add to
 * today" write stores local midnight (`localDateTimeToISO(key, "00:00")`), so
 * east of UTC every all-day todo was filed one day early — it vanished from
 * 今日の Todo and reappeared under 持ち越し「2日目」. These tests pin the
 * local-day reading and the round-trip with the write helper.
 */
describe("dateKeyOfInstant", () => {
  it("round-trips localDateTimeToISO at every hour, midnight included", () => {
    for (const time of ["00:00", "08:59", "09:00", "14:30", "23:59"]) {
      expect(dateKeyOfInstant(localDateTimeToISO("2026-07-27", time))).toBe(
        "2026-07-27",
      );
    }
  });

  it("reads the LOCAL day where a sliced key would read the UTC day", () => {
    const iso = localDateTimeToISO("2026-07-27", "00:00");
    expect(dateKeyOfInstant(iso)).toBe("2026-07-27");
    // East of UTC (JST = -540) local midnight falls on the PREVIOUS UTC date —
    // exactly what the old slice returned. Where the two days coincide (UTC and
    // west of it) the negative assertion is meaningless, so it is guarded and
    // the test stays timezone-agnostic.
    if (new Date("2026-07-27T00:00:00").getTimezoneOffset() < 0) {
      expect(iso.slice(0, 10)).not.toBe("2026-07-27");
    }
  });

  it("agrees with formatDateKey on the same instant", () => {
    const iso = "2026-07-27T14:30:00.000Z";
    expect(dateKeyOfInstant(iso)).toBe(formatDateKey(new Date(iso)));
  });

  it("returns null for missing or unparseable input", () => {
    expect(dateKeyOfInstant(undefined)).toBeNull();
    expect(dateKeyOfInstant(null)).toBeNull();
    expect(dateKeyOfInstant("")).toBeNull();
    expect(dateKeyOfInstant("not a date")).toBeNull();
  });
});
