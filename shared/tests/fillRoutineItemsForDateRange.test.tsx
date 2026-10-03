import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useScheduleItemsRoutineSync } from "../src/hooks/useScheduleItemsRoutineSync";
import type { DataService } from "../src/services/DataService";
import type { RoutineNode } from "../src/types/routine";
import type { ScheduleItem } from "../src/types/schedule";
import type { RoutineSyncCreate } from "../src/utils/routineScheduleSync";

/*
 * #2081 — the navigation-time fill.
 *
 * The reported shape: a daily and a weekdays repeat made on 2026-09-09 had
 * occurrences up to the edge of the grid that was on screen that day
 * (2026-10-03) and nothing after it, because nothing on the navigation path
 * generated rows. The fill is what the calendar now calls for the window it
 * shows; these cases pin that it creates the missing days, skips the ones that
 * already exist, and NEVER deletes (looking at a week is not an edit).
 */

function makeRoutine(overrides: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id: "r-bath",
    title: "Bath",
    startTime: "20:00",
    endTime: "20:30",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-09-09T10:53:34.000Z",
    updatedAt: "2026-09-09T10:54:12.000Z",
    ...overrides,
  };
}

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "si-existing",
    date: "2026-10-05",
    title: "Bath",
    startTime: "20:00",
    endTime: "20:30",
    completed: false,
    completedAt: null,
    routineId: "r-bath",
    updatedAt: "2026-09-09T10:54:12.000Z",
    ...overrides,
  } as ScheduleItem;
}

function makeDs(existing: ScheduleItem[], fail = false) {
  const bulkCreateScheduleItems = vi.fn<
    (rows: RoutineSyncCreate[]) => Promise<void>
  >(() => (fail ? Promise.reject(new Error("23505")) : Promise.resolve()));
  const bulkSoftDeleteScheduleItems = vi.fn(() => Promise.resolve(0));
  const ds = {
    fetchScheduleItemsByDateRange: vi.fn(() => Promise.resolve(existing)),
    bulkCreateScheduleItems,
    bulkSoftDeleteScheduleItems,
  } as unknown as DataService;
  return { ds, bulkCreateScheduleItems, bulkSoftDeleteScheduleItems };
}

describe("fillRoutineItemsForDateRange (#2081)", () => {
  it("creates every missing day of an October week for daily and weekdays repeats", async () => {
    const { ds, bulkCreateScheduleItems } = makeDs([makeItem()]);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useScheduleItemsRoutineSync({ dataService: ds, onChanged }),
    );
    const daily = makeRoutine();
    const work = makeRoutine({
      id: "r-work",
      title: "Work",
      frequencyType: "weekdays",
      frequencyDays: [1, 2, 3, 4, 5],
    });

    let created: number | null = null;
    await act(async () => {
      created = await result.current.fillRoutineItemsForDateRange(
        "2026-10-04",
        "2026-10-10",
        [daily, work],
      );
    });

    const rows = bulkCreateScheduleItems.mock.calls[0][0];
    const bath = rows
      .filter((r) => r.routineId === "r-bath")
      .map((r) => r.date);
    const workDays = rows
      .filter((r) => r.routineId === "r-work")
      .map((r) => r.date);
    // 7 days minus the one that already exists (10/05).
    expect(bath).toEqual([
      "2026-10-04",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
    // Mon 10/05 – Fri 10/09.
    expect(workDays).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    expect(created).toBe(11);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("never deletes, even a row on a day the frequency no longer fires", async () => {
    // A weekdays repeat with a leftover Saturday row: the range ENSURE would
    // soft-delete it; the navigation fill must leave it alone.
    const { ds, bulkSoftDeleteScheduleItems } = makeDs([
      makeItem({ id: "si-sat", date: "2026-10-10", routineId: "r-work" }),
    ]);
    const { result } = renderHook(() =>
      useScheduleItemsRoutineSync({ dataService: ds }),
    );
    await act(async () => {
      await result.current.fillRoutineItemsForDateRange(
        "2026-10-04",
        "2026-10-10",
        [
          makeRoutine({
            id: "r-work",
            frequencyType: "weekdays",
            frequencyDays: [1, 2, 3, 4, 5],
          }),
        ],
      );
    });
    expect(bulkSoftDeleteScheduleItems).not.toHaveBeenCalled();
  });

  it("writes nothing and reports 0 when the window is already complete", async () => {
    const { ds, bulkCreateScheduleItems } = makeDs([makeItem()]);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useScheduleItemsRoutineSync({ dataService: ds, onChanged }),
    );
    let created: number | null = null;
    await act(async () => {
      created = await result.current.fillRoutineItemsForDateRange(
        "2026-10-05",
        "2026-10-05",
        [makeRoutine()],
      );
    });
    expect(created).toBe(0);
    expect(bulkCreateScheduleItems).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("reports a failed write as null instead of throwing", async () => {
    const { ds } = makeDs([], true);
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useScheduleItemsRoutineSync({ dataService: ds, onChanged }),
    );
    let created: number | null = 0;
    await act(async () => {
      created = await result.current.fillRoutineItemsForDateRange(
        "2026-10-04",
        "2026-10-04",
        [makeRoutine()],
      );
    });
    expect(created).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
