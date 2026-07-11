import { describe, it, expect } from "vitest";
import {
  deriveScheduleStatus,
  type DerivableScheduleItem,
} from "../src/utils/scheduleStatus";

/*
 * deriveScheduleStatus (#222) — turns (item, now) into a status tag.
 *   completed → done; else timed: start reached → inProgress, else notStarted;
 *   all-day falls back to a date comparison. All dates/times are LOCAL.
 */

// Fixed reference "now": 2026-07-11 12:00 local.
const NOW = new Date(2026, 6, 11, 12, 0);

function timed(
  over: Partial<DerivableScheduleItem> = {},
): DerivableScheduleItem {
  return {
    date: "2026-07-11",
    startTime: "09:00",
    completed: false,
    ...over,
  };
}

describe("deriveScheduleStatus — timed items", () => {
  it("returns done when completed, regardless of time", () => {
    // Start is still in the future today, but completed wins.
    expect(
      deriveScheduleStatus(timed({ startTime: "18:00", completed: true }), NOW),
    ).toBe("done");
  });

  it("returns notStarted when the start is later today", () => {
    expect(deriveScheduleStatus(timed({ startTime: "18:00" }), NOW)).toBe(
      "notStarted",
    );
  });

  it("returns inProgress when the start has already passed today", () => {
    expect(deriveScheduleStatus(timed({ startTime: "09:00" }), NOW)).toBe(
      "inProgress",
    );
  });

  it("treats the start-time boundary (start == now) as started", () => {
    // now is exactly 12:00; a 12:00 start counts as inProgress (>=).
    expect(deriveScheduleStatus(timed({ startTime: "12:00" }), NOW)).toBe(
      "inProgress",
    );
    // One minute later is still notStarted.
    expect(deriveScheduleStatus(timed({ startTime: "12:01" }), NOW)).toBe(
      "notStarted",
    );
  });

  it("stays inProgress for a past-dated, still-open item (day crossing)", () => {
    // Yesterday's event, never completed → started long ago, still open.
    expect(
      deriveScheduleStatus(
        timed({ date: "2026-07-10", startTime: "23:00" }),
        NOW,
      ),
    ).toBe("inProgress");
  });

  it("returns notStarted for a future-dated item even at an early hour", () => {
    expect(
      deriveScheduleStatus(
        timed({ date: "2026-07-12", startTime: "00:00" }),
        NOW,
      ),
    ).toBe("notStarted");
  });
});

describe("deriveScheduleStatus — all-day items", () => {
  const allDay = (
    over: Partial<DerivableScheduleItem> = {},
  ): DerivableScheduleItem => ({
    date: "2026-07-11",
    startTime: "00:00",
    completed: false,
    isAllDay: true,
    ...over,
  });

  it("returns notStarted for a future day", () => {
    expect(deriveScheduleStatus(allDay({ date: "2026-07-12" }), NOW)).toBe(
      "notStarted",
    );
  });

  it("returns inProgress on the target day", () => {
    expect(deriveScheduleStatus(allDay({ date: "2026-07-11" }), NOW)).toBe(
      "inProgress",
    );
  });

  it("returns inProgress for a past day (still open)", () => {
    expect(deriveScheduleStatus(allDay({ date: "2026-07-01" }), NOW)).toBe(
      "inProgress",
    );
  });

  it("returns done when completed", () => {
    expect(
      deriveScheduleStatus(
        allDay({ date: "2026-07-11", completed: true }),
        NOW,
      ),
    ).toBe("done");
  });
});

describe("deriveScheduleStatus — malformed input (graceful fallback)", () => {
  // The parse path is NaN-tolerant: a bad time/date builds an Invalid Date whose
  // getTime() is NaN, and every comparison against NaN is false. These lock in
  // that the function never throws and picks a sane default instead.

  it("does not throw on an empty timed startTime and falls back to notStarted", () => {
    // "".split(":") → [""] → [NaN]; the start becomes an Invalid Date, so
    // `now >= NaN` is false → notStarted.
    expect(() =>
      deriveScheduleStatus(timed({ startTime: "" }), NOW),
    ).not.toThrow();
    expect(deriveScheduleStatus(timed({ startTime: "" }), NOW)).toBe(
      "notStarted",
    );
  });

  it("falls back to notStarted for a non-time startTime string", () => {
    expect(deriveScheduleStatus(timed({ startTime: "not-a-time" }), NOW)).toBe(
      "notStarted",
    );
  });

  it("falls back to notStarted for a malformed timed date", () => {
    expect(
      deriveScheduleStatus(
        timed({ date: "2026/07/11", startTime: "09:00" }),
        NOW,
      ),
    ).toBe("notStarted");
  });

  it("falls back to inProgress for a malformed all-day date (does not throw)", () => {
    // localDayStart("garbage") → NaN; `NaN > todayDay` is false → inProgress.
    const item: DerivableScheduleItem = {
      date: "garbage",
      startTime: "00:00",
      completed: false,
      isAllDay: true,
    };
    expect(() => deriveScheduleStatus(item, NOW)).not.toThrow();
    expect(deriveScheduleStatus(item, NOW)).toBe("inProgress");
  });
});
