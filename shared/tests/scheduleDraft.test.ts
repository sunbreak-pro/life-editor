import { describe, it, expect } from "vitest";
import { makeOptimisticScheduleItem } from "../src/utils/scheduleDraft";

/*
 * scheduleDraft (#280) — the optimistic-create row factory extracted from
 * CalendarTab. The defaults must mirror the provider's create semantics
 * (manual, timed, live) or the grid would briefly show a different item
 * than the one the INSERT lands.
 */

describe("makeOptimisticScheduleItem", () => {
  it("carries the given identity and time fields", () => {
    const item = makeOptimisticScheduleItem(
      "si-1",
      "2026-07-19",
      "Dentist",
      "09:00",
      "10:00",
    );
    expect(item.id).toBe("si-1");
    expect(item.date).toBe("2026-07-19");
    expect(item.title).toBe("Dentist");
    expect(item.startTime).toBe("09:00");
    expect(item.endTime).toBe("10:00");
  });

  it("defaults to a live, manual, timed, not-completed row", () => {
    const item = makeOptimisticScheduleItem(
      "si-1",
      "2026-07-19",
      "Dentist",
      "09:00",
      "10:00",
    );
    expect(item.completed).toBe(false);
    expect(item.completedAt).toBeNull();
    expect(item.routineId).toBeNull();
    expect(item.templateId).toBeNull();
    expect(item.memo).toBeNull();
    expect(item.noteId).toBeNull();
    expect(item.content).toBeNull();
    expect(item.isDeleted).toBe(false);
    expect(item.deletedAt).toBeNull();
    expect(item.isDismissed).toBe(false);
    expect(item.isAllDay).toBe(false);
  });

  it("stamps createdAt/updatedAt with the same ISO instant", () => {
    const item = makeOptimisticScheduleItem(
      "si-1",
      "2026-07-19",
      "Dentist",
      "09:00",
      "10:00",
    );
    expect(item.createdAt).toBe(item.updatedAt);
    expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);
  });
});
