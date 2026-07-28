import { describe, it, expect } from "vitest";
import { nextRoutineOccurrence } from "../src/utils/routineScheduleSync";
import type { RoutineNode } from "../src/types/routine";

/*
 * nextRoutineOccurrence (#408) — the repeat list's only source of truth for
 * "where does this routine next land?". The list uses null to decide whether a
 * row is navigable at all, so the never-materialises cases matter as much as
 * the hits. It answers through shouldCreateRoutineItem, NOT raw frequency, so
 * archived / hidden routines must read as "no occurrence" too.
 */

function routine(over: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id: "r-1",
    title: "R",
    startTime: null,
    endTime: null,
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("nextRoutineOccurrence", () => {
  it("returns the from-date itself when the routine fires that day", () => {
    expect(nextRoutineOccurrence(routine(), "2026-07-28")).toBe("2026-07-28");
  });

  it("walks forward to the next matching weekday", () => {
    // 2026-07-28 is a Tuesday; the routine only fires on Friday (5).
    expect(
      nextRoutineOccurrence(
        routine({ frequencyType: "weekdays", frequencyDays: [5] }),
        "2026-07-28",
      ),
    ).toBe("2026-07-31");
  });

  it("crosses a month boundary", () => {
    expect(
      nextRoutineOccurrence(
        routine({ frequencyType: "weekdays", frequencyDays: [1] }),
        "2026-07-30",
      ),
    ).toBe("2026-08-03");
  });

  it("finds a future-dated interval's first occurrence", () => {
    // The exact case the calendar cannot reach: nothing is materialised
    // anywhere near the visible range, so the list is the only route in.
    expect(
      nextRoutineOccurrence(
        routine({
          frequencyType: "interval",
          frequencyInterval: 10,
          frequencyStartDate: "2026-09-01",
        }),
        "2026-07-28",
      ),
    ).toBe("2026-09-01");
  });

  it("returns null for a weekday routine with no day set", () => {
    expect(
      nextRoutineOccurrence(
        routine({ frequencyType: "weekdays", frequencyDays: [] }),
        "2026-07-28",
      ),
    ).toBeNull();
  });

  it("returns null for a malformed interval (#407 zombie shape)", () => {
    // A bare interval switch fails closed in shouldRoutineRunOnDate, so it
    // fires on no day — exactly the routine that has no occurrence to click.
    expect(
      nextRoutineOccurrence(
        routine({ frequencyType: "interval", frequencyInterval: null }),
        "2026-07-28",
      ),
    ).toBeNull();
  });

  it("returns null for an archived or hidden routine that fires daily", () => {
    // Frequency alone would say "today". The generator never materialises
    // these, so a jump would land on a permanently empty day.
    expect(
      nextRoutineOccurrence(routine({ isArchived: true }), "2026-07-28"),
    ).toBeNull();
    expect(
      nextRoutineOccurrence(routine({ isVisible: false }), "2026-07-28"),
    ).toBeNull();
    expect(
      nextRoutineOccurrence(routine({ isDeleted: true }), "2026-07-28"),
    ).toBeNull();
  });

  it("returns null when the first occurrence is past the horizon", () => {
    expect(
      nextRoutineOccurrence(
        routine({
          frequencyType: "interval",
          frequencyInterval: 1,
          frequencyStartDate: "2030-01-01",
        }),
        "2026-07-28",
      ),
    ).toBeNull();
  });

  it("honours a caller-supplied horizon", () => {
    const weekly = routine({ frequencyType: "weekdays", frequencyDays: [5] });
    expect(nextRoutineOccurrence(weekly, "2026-07-28", 2)).toBeNull();
    expect(nextRoutineOccurrence(weekly, "2026-07-28", 3)).toBe("2026-07-31");
  });
});
