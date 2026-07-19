import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScheduleItemsRoutineSync } from "../src/hooks/useScheduleItemsRoutineSync";
import type { DataService } from "../src/services/DataService";
import type { RoutineNode } from "../src/types/routine";
import type { RoutineGroup } from "../src/types/routineGroup";
import type { ScheduleItem } from "../src/types/schedule";
import { todayDateKey } from "../src/utils/dateKey";

/*
 * ensureRoutineItemsForDateRange cleanup guards (#296). Pre-fix the
 * frequency-mismatch cleanup HARD-deleted (items_meta DELETE — no Trash)
 * any not-done, today-onward row whose date no longer matched the routine's
 * frequency. That destroyed two classes of legitimate rows:
 *   - hand-moved occurrences (the user cross-day-dragged one; its date
 *     necessarily mismatches the frequency for the new day);
 *   - EVERY row of a group-frequency routine whenever the caller omitted
 *     the groupForRoutine map (group + no map ⇒ "should never exist").
 * The fix: cleanup soft-deletes (Trash-recoverable), skips rows whose
 * date drifted from source_date, keys the existing-set on source_date so
 * the collector cannot re-mint a moved row's original slot, and reports
 * success/failure so destructive callers (scope-dialog fill) can abort.
 */

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
function dow(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

const T = todayDateKey();
const T1 = addDays(T, 1);
const T2 = addDays(T, 2);
const T3 = addDays(T, 3);

// Runs on today's weekday and T2's weekday → matches exactly T and T2
// within the [T, T3] window.
function makeRoutine(overrides: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id: "r1",
    title: "Stretch",
    startTime: "07:00",
    endTime: "07:30",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "weekdays",
    frequencyDays: [dow(T), dow(T2)],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "si1",
    date: T,
    title: "Stretch",
    startTime: "07:00",
    endTime: "07:30",
    completed: false,
    completedAt: null,
    routineId: "r1",
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as ScheduleItem;
}

function makeDs(rows: ScheduleItem[], opts: { failFetch?: boolean } = {}) {
  const bulkSoftDeleteScheduleItems = vi.fn(
    async (ids: string[]) => ids.length,
  );
  const bulkDeleteScheduleItems = vi.fn(async (ids: string[]) => ids.length);
  const bulkCreateScheduleItems = vi.fn(async () => {});
  const fetchScheduleItemsByDateRange = vi.fn(async () => {
    if (opts.failFetch) throw new Error("offline");
    return rows;
  });
  const ds = {
    bulkSoftDeleteScheduleItems,
    bulkDeleteScheduleItems,
    bulkCreateScheduleItems,
    fetchScheduleItemsByDateRange,
  } as unknown as DataService;
  return {
    ds,
    bulkSoftDeleteScheduleItems,
    bulkDeleteScheduleItems,
    bulkCreateScheduleItems,
  };
}

function renderGenerator(ds: DataService) {
  const { result } = renderHook(() =>
    useScheduleItemsRoutineSync({ dataService: ds }),
  );
  return result.current;
}

describe("ensureRoutineItemsForDateRange — cleanup guards (#296)", () => {
  it("soft-deletes stale generated rows, keeps hand-moved ones, never hard-deletes", async () => {
    const routine = makeRoutine();
    const rows = [
      // Legit generated row for a matching day — kept.
      makeItem({ id: "keep-match", date: T, sourceDate: T }),
      // Stale generated row on a non-matching day — soft-deleted.
      makeItem({ id: "del-stale", date: T1, sourceDate: T1 }),
      // Hand-moved: generated for T2, dragged to T3 (non-matching day).
      // date ≠ sourceDate marks it as a user edit — kept.
      makeItem({ id: "keep-moved", date: T3, sourceDate: T2 }),
      // Completed rows are life record — kept even on a non-matching day.
      makeItem({ id: "keep-done", date: T1, sourceDate: T1, completed: true }),
    ];
    const { ds, bulkSoftDeleteScheduleItems, bulkDeleteScheduleItems } =
      makeDs(rows);
    const gen = renderGenerator(ds);

    const ok = await gen.ensureRoutineItemsForDateRange(T, T3, [routine]);

    expect(ok).toBe(true);
    expect(bulkSoftDeleteScheduleItems).toHaveBeenCalledTimes(1);
    expect(bulkSoftDeleteScheduleItems.mock.calls[0][0]).toEqual(["del-stale"]);
    // The hard bulk delete must NEVER fire from cleanup.
    expect(bulkDeleteScheduleItems).not.toHaveBeenCalled();
  });

  it("does not regenerate the calendar day a hand-moved row currently occupies (no visible duplicate) and never deletes it", async () => {
    // Occurrence generated for T (source=T), dragged onto T3. The routine
    // runs on T3's weekday. existingSet is keyed on the CALENDAR date, so
    // T3 reads as occupied → the collector skips it: the user sees exactly
    // one event on T3, and the moved row is never cleaned up. (Regenerating
    // the vacated T source slot is the DataService pre-check's job — a
    // cross-day reconcile out of this unit's scope, Step 4.)
    const routine = makeRoutine({
      frequencyType: "weekdays",
      frequencyDays: [dow(T3)],
    });
    const rows = [makeItem({ id: "keep-moved", date: T3, sourceDate: T })];
    const { ds, bulkCreateScheduleItems, bulkSoftDeleteScheduleItems } =
      makeDs(rows);
    const gen = renderGenerator(ds);

    const ok = await gen.ensureRoutineItemsForDateRange(T3, T3, [routine]);

    expect(ok).toBe(true);
    // T3 is occupied by the moved row → no fresh occurrence minted there.
    expect(bulkCreateScheduleItems).not.toHaveBeenCalled();
    // And the moved row survives (date ≠ sourceDate ⇒ user edit).
    expect(bulkSoftDeleteScheduleItems).not.toHaveBeenCalled();
  });

  it("keeps group-frequency rows when the group map resolves them", async () => {
    const routine = makeRoutine({ id: "r2", frequencyType: "group" });
    const group: RoutineGroup = {
      id: "g1",
      name: "Morning",
      color: "#000000",
      isVisible: true,
      order: 0,
      frequencyType: "daily",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const rows = [
      makeItem({ id: "keep-group", routineId: "r2", date: T1, sourceDate: T1 }),
    ];
    const { ds, bulkSoftDeleteScheduleItems } = makeDs(rows);
    const gen = renderGenerator(ds);

    const ok = await gen.ensureRoutineItemsForDateRange(
      T1,
      T1,
      [routine],
      new Map([["r2", [group]]]),
    );

    expect(ok).toBe(true);
    expect(bulkSoftDeleteScheduleItems).not.toHaveBeenCalled();
  });

  it("returns false when the range read fails (callers must abort destructive follow-ups)", async () => {
    const { ds, bulkSoftDeleteScheduleItems, bulkCreateScheduleItems } = makeDs(
      [],
      { failFetch: true },
    );
    const gen = renderGenerator(ds);

    const ok = await gen.ensureRoutineItemsForDateRange(T, T3, [makeRoutine()]);

    expect(ok).toBe(false);
    expect(bulkSoftDeleteScheduleItems).not.toHaveBeenCalled();
    expect(bulkCreateScheduleItems).not.toHaveBeenCalled();
  });
});
