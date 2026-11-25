import { describe, expect, it } from "vitest";
import { formatNoteUpdated } from "../src/notes/formatNoteUpdated";

const labels = {
  updatedToday: (time: string) => `today ${time}`,
  updatedOn: (date: string) => `on ${date}`,
};

describe("formatNoteUpdated", () => {
  // Local-time constructors: the function reads the device's own time zone.
  const now = new Date(2026, 10, 25, 18, 0, 0);

  it("shows the time for a note touched today", () => {
    const at = new Date(2026, 10, 25, 9, 5, 0).toISOString();
    expect(formatNoteUpdated(at, now, labels)).toBe("today 09:05");
  });

  it("shows month/day for a note touched on another day", () => {
    const at = new Date(2026, 10, 3, 23, 59, 0).toISOString();
    expect(formatNoteUpdated(at, now, labels)).toBe("on 11/3");
  });

  it("returns undefined for an invalid date", () => {
    expect(formatNoteUpdated("not-a-date", now, labels)).toBeUndefined();
  });
});
