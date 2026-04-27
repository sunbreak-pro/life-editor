import { describe, it, expect } from "vitest";
import { shouldRoutineRunOnDate } from "./routineFrequency";

describe("shouldRoutineRunOnDate", () => {
  describe("daily", () => {
    it("matches every date", () => {
      expect(
        shouldRoutineRunOnDate("daily", [], null, null, "2026-04-27"),
      ).toBe(true);
      expect(
        shouldRoutineRunOnDate("daily", [], null, null, "2030-01-01"),
      ).toBe(true);
    });
  });

  describe("weekdays", () => {
    it("matches when day-of-week is in frequencyDays", () => {
      // 2026-04-27 is a Monday → getDay() === 1
      expect(
        shouldRoutineRunOnDate("weekdays", [1, 3, 5], null, null, "2026-04-27"),
      ).toBe(true);
    });

    it("does not match when day-of-week is missing from frequencyDays", () => {
      // Monday not in [Sun, Sat]
      expect(
        shouldRoutineRunOnDate("weekdays", [0, 6], null, null, "2026-04-27"),
      ).toBe(false);
    });

    it("returns false for empty frequencyDays", () => {
      expect(
        shouldRoutineRunOnDate("weekdays", [], null, null, "2026-04-27"),
      ).toBe(false);
    });
  });

  describe("interval", () => {
    it("matches when diff is divisible by interval", () => {
      // start 2026-04-01, every 3 days → 04-01, 04-04, 04-07, ...
      expect(
        shouldRoutineRunOnDate("interval", [], 3, "2026-04-01", "2026-04-04"),
      ).toBe(true);
      expect(
        shouldRoutineRunOnDate("interval", [], 3, "2026-04-01", "2026-04-07"),
      ).toBe(true);
    });

    it("does not match when diff is not divisible", () => {
      expect(
        shouldRoutineRunOnDate("interval", [], 3, "2026-04-01", "2026-04-02"),
      ).toBe(false);
    });

    it("does not match dates before frequencyStartDate", () => {
      expect(
        shouldRoutineRunOnDate("interval", [], 3, "2026-04-10", "2026-04-01"),
      ).toBe(false);
    });

    it("returns true if interval is missing or zero (degenerate)", () => {
      expect(
        shouldRoutineRunOnDate(
          "interval",
          [],
          null,
          "2026-04-01",
          "2026-04-02",
        ),
      ).toBe(true);
      expect(
        shouldRoutineRunOnDate("interval", [], 0, "2026-04-01", "2026-04-02"),
      ).toBe(true);
    });

    it("returns true if frequencyStartDate is missing (degenerate)", () => {
      expect(
        shouldRoutineRunOnDate("interval", [], 3, null, "2026-04-02"),
      ).toBe(true);
    });
  });

  describe("group (V69) — caller must resolve group, default returns false", () => {
    it("returns false so reconcile does not match every date", () => {
      // Regression guard: previously default → true, which caused
      // shouldRoutineRunOnDate("group", ...) to match every date when the
      // caller forgot to resolve the routine's groups, leading to runaway
      // bulkCreateScheduleItems calls.
      expect(
        shouldRoutineRunOnDate("group", [], null, null, "2026-04-27"),
      ).toBe(false);
    });
  });
});
