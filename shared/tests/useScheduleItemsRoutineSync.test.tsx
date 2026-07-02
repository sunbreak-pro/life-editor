import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useScheduleItemsRoutineSync } from "../src/hooks/useScheduleItemsRoutineSync";
import type { DataService } from "../src/services/DataService";
import type { RoutineNode } from "../src/types/routine";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * M4 (perf) regression suite for useScheduleItemsRoutineSync.
 *
 * The live web host (RoutineScheduleSync) mounts this hook with an inline
 * `onChanged: () => { if (date) void loadDate(date); }` — a FRESH closure on
 * every render. Before M4, `notifyChanged` had dep `[onChanged]`, so it (and
 * every returned generator, dep `[ds, notifyChanged]`) changed identity on
 * every render. The host effect `[date, routines, groupForRoutine, ensure]`
 * therefore re-fired on EVERY render, issuing one `fetchScheduleItemsByDate`
 * per render — the "excessive re-fetch/re-compute" this milestone removes.
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
const updateScheduleItem = vi.fn(() => Promise.resolve({} as ScheduleItem));
const ds = { updateScheduleItem } as unknown as DataService;

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

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "si1",
    date: "2026-07-02",
    title: "Old title",
    startTime: "09:00",
    endTime: "09:30",
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
    const firstSync = result.current.syncScheduleItemsWithRoutines;

    // Re-render several times, each with a brand-new onChanged closure.
    for (let i = 0; i < 3; i++) {
      rerender({ dataService: ds, onChanged: () => {} });
    }

    // Nothing changed except the (ignored, ref-captured) onChanged identity,
    // so every reference the host effect could depend on is unchanged.
    expect(result.current).toBe(firstContainer);
    expect(result.current.ensureRoutineItemsForDate).toBe(firstEnsure);
    expect(result.current.syncScheduleItemsWithRoutines).toBe(firstSync);
  });

  it("invokes the LATEST onChanged (ref captures newest closure, not a stale one)", () => {
    const onChangedA = vi.fn();
    const onChangedB = vi.fn();

    const { result, rerender } = renderHook(
      (props: { dataService: DataService; onChanged: () => void }) =>
        useScheduleItemsRoutineSync(props),
      { initialProps: { dataService: ds, onChanged: onChangedA } },
    );

    // Swap in a new onChanged; the effect updates the ref.
    rerender({ dataService: ds, onChanged: onChangedB });

    // Drive a change → notifyChanged() fires synchronously.
    act(() => {
      const res = result.current.syncScheduleItemsWithRoutines(
        [makeRoutine({ title: "New title" })],
        [makeItem({ title: "Old title" })],
      );
      expect(res.changed).toBe(true);
    });

    expect(onChangedB).toHaveBeenCalledTimes(1);
    expect(onChangedA).not.toHaveBeenCalled();
  });
});
