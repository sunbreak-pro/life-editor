import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useScheduleItemsRoutineSync } from "../src/hooks/useScheduleItemsRoutineSync";
import type { DataService } from "../src/services/DataService";
import type { RoutineNode } from "../src/types/routine";
import type { ScheduleItem } from "../src/types/schedule";
import { todayDateKey } from "../src/utils/dateKey";

/*
 * M4 (perf) regression suite for useScheduleItemsRoutineSync.
 *
 * The live web host (RoutineScheduleSync) mounts this hook with an inline
 * `onChanged: () => { if (date) void loadDate(date); }` — a FRESH closure on
 * every render. Before M4, `notifyChanged` had dep `[onChanged]`, so it (and
 * every returned generator, dep `[ds, notifyChanged]`) changed identity on
 * every render. The host effect `[date, routines, ensure]` therefore
 * re-fired on EVERY render, issuing one `fetchScheduleItemsByDate` per
 * render — the "excessive re-fetch/re-compute" this milestone removes.
 *
 * These tests pin the fix in machine-verifiable terms:
 *   (1) the returned generators + container keep a STABLE identity across
 *       re-renders that pass a brand-new `onChanged` closure each time
 *       (⇒ a consumer effect depending on them does NOT re-fire per render,
 *       so the fetch count drops from O(renders) to O(genuine input changes));
 *   (2) the ref indirection still calls the LATEST `onChanged` (no stale
 *       closure captured by the now empty-deps `notifyChanged`).
 */

// Stable DataService stub — identity must not change across re-renders, else
// the callbacks would legitimately change (that is not what we are testing).
// reconcile is the driver for the "latest onChanged" case: it reads the
// routine's occurrences, then soft-deletes the ones the frequency dropped.
const bulkSoftDeleteScheduleItems = vi.fn(() => Promise.resolve(1));
const ds = {
  updateScheduleItem: vi.fn(() => Promise.resolve({} as ScheduleItem)),
  fetchScheduleItemsByRoutineId: vi.fn(() => Promise.resolve([makeItem()])),
  bulkSoftDeleteScheduleItems,
  bulkCreateScheduleItems: vi.fn(() => Promise.resolve()),
} as unknown as DataService;

function makeRoutine(overrides: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id: "r1",
    title: "Stretch",
    startTime: "10:00",
    endTime: "10:30",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Tomorrow — reconcile only ever touches today-onward rows. */
function tomorrowKey(): string {
  const [y, m, d] = todayDateKey().split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "si1",
    date: tomorrowKey(),
    title: "Stretch",
    startTime: "10:00",
    endTime: "10:30",
    completed: false,
    completedAt: null,
    routineId: "r1",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as ScheduleItem;
}

describe("useScheduleItemsRoutineSync — M4 callback stability", () => {
  it("keeps generator + container identity stable across re-renders with a fresh onChanged each time", () => {
    const { result, rerender } = renderHook(
      (props: { dataService: DataService; onChanged: () => void }) =>
        useScheduleItemsRoutineSync(props),
      // A NEW inline arrow every render — mirrors the web host exactly.
      { initialProps: { dataService: ds, onChanged: () => {} } },
    );

    const firstContainer = result.current;
    const firstEnsure = result.current.ensureRoutineItemsForDate;
    const firstReconcile = result.current.reconcileRoutineScheduleItems;

    // Re-render several times, each with a brand-new onChanged closure.
    for (let i = 0; i < 3; i++) {
      rerender({ dataService: ds, onChanged: () => {} });
    }

    // Nothing changed except the (ignored, ref-captured) onChanged identity,
    // so every reference the host effect could depend on is unchanged.
    expect(result.current).toBe(firstContainer);
    expect(result.current.ensureRoutineItemsForDate).toBe(firstEnsure);
    expect(result.current.reconcileRoutineScheduleItems).toBe(firstReconcile);
  });

  it("invokes the LATEST onChanged (ref captures newest closure, not a stale one)", async () => {
    const onChangedA = vi.fn();
    const onChangedB = vi.fn();

    const { result, rerender } = renderHook(
      (props: { dataService: DataService; onChanged: () => void }) =>
        useScheduleItemsRoutineSync(props),
      { initialProps: { dataService: ds, onChanged: onChangedA } },
    );

    // Swap in a new onChanged; the effect updates the ref.
    rerender({ dataService: ds, onChanged: onChangedB });

    // Drive a change → the reconcile pass soft-deletes tomorrow's row (the
    // routine fires on no weekday at all) and then calls notifyChanged().
    await act(async () => {
      await result.current.reconcileRoutineScheduleItems(
        makeRoutine({ frequencyType: "weekdays", frequencyDays: [] }),
      );
    });

    expect(bulkSoftDeleteScheduleItems).toHaveBeenCalledWith(["si1"]);
    expect(onChangedB).toHaveBeenCalledTimes(1);
    expect(onChangedA).not.toHaveBeenCalled();
  });
});

/*
 * #2097 — the calendar's range fill, the today generator and a conversion's
 * fill are separate hook instances. Passes over the same slots that overlapped
 * in time both read "missing", both inserted, and the loser hit the
 * (routine, date) partial UNIQUE. Passes on one DataService now run in turn.
 */
describe("useScheduleItemsRoutineSync — one pass at a time per DataService (#2097)", () => {
  it("lets a second instance's fill see the first one's rows instead of colliding", async () => {
    const stored: ScheduleItem[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const store = {
      fetchScheduleItemsByDateRange: vi.fn(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        return [...stored];
      }),
      bulkCreateScheduleItems: vi.fn(
        async (
          rows: Array<{ id: string; date: string; routineId: string }>,
        ) => {
          await new Promise((r) => setTimeout(r, 5));
          for (const row of rows) {
            if (
              stored.some(
                (s) => s.routineId === row.routineId && s.date === row.date,
              )
            )
              throw new Error("duplicate key uq_events_payload_routine_date");
            stored.push(makeItem({ id: row.id, date: row.date }));
          }
          inFlight--;
        },
      ),
    } as unknown as DataService;

    const a = renderHook(() =>
      useScheduleItemsRoutineSync({ dataService: store }),
    );
    const b = renderHook(() =>
      useScheduleItemsRoutineSync({ dataService: store }),
    );
    const start = tomorrowKey();
    let results: Array<number | null> = [];
    await act(async () => {
      results = await Promise.all([
        a.result.current.fillRoutineItemsForDateRange(start, start, [
          makeRoutine(),
        ]),
        b.result.current.fillRoutineItemsForDateRange(start, start, [
          makeRoutine(),
        ]),
      ]);
    });

    expect(results).toEqual([1, 0]);
    expect(store.bulkCreateScheduleItems).toHaveBeenCalledTimes(1);
    expect(stored).toHaveLength(1);
    expect(maxInFlight).toBe(1);
  });

  it("keeps the queue moving after a pass that failed", async () => {
    const store = {
      fetchScheduleItemsByDateRange: vi
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce([]),
      bulkCreateScheduleItems: vi.fn(() => Promise.resolve()),
    } as unknown as DataService;
    const { result } = renderHook(() =>
      useScheduleItemsRoutineSync({ dataService: store }),
    );
    const start = tomorrowKey();
    let results: Array<number | null> = [];
    await act(async () => {
      results = await Promise.all([
        result.current.fillRoutineItemsForDateRange(start, start, [
          makeRoutine(),
        ]),
        result.current.fillRoutineItemsForDateRange(start, start, [
          makeRoutine(),
        ]),
      ]);
    });
    expect(results).toEqual([null, 1]);
  });
});
