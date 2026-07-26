import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScheduleItemsRoutineSync } from "../src/hooks/useScheduleItemsRoutineSync";
import type { DataService } from "../src/services/DataService";
import type { RoutineNode } from "../src/types/routine";
import type { ScheduleItem } from "../src/types/schedule";
import { todayDateKey } from "../src/utils/dateKey";

/*
 * reconcileRoutineScheduleItems — Routine 編集の未来伝播 (#352 Step 4,
 * Epic #290).
 *
 * Changing a routine's FREQUENCY used to touch nothing that already
 * existed: the template update only steered future generation, so
 * materialised occurrences kept the old rhythm (rows sitting on days that
 * no longer fire, gaps on days that now do). Reconcile closes that gap.
 *
 * These cases pin the tier-1 §Schedule 競合解決ルール, which is the whole
 * reason the propagation cannot be a blind rewrite:
 *   1. 実績は不可侵 — done / dismissed / past rows survive everything.
 *   2. 手動編集は Routine 変更に勝つ — a row the user retitled, re-timed or
 *      dragged to another day is theirs; the series edit skips it.
 *   3. 発火日から外れた未来行 — cleaned up with a SOFT delete (Trash), not
 *      the hard one.
 * plus the generation side: new firing days are filled, occupied days are
 * not duplicated, and nothing is ever fabricated into the past.
 */

const T = todayDateKey();

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

const YESTERDAY = addDays(T, -1);
const T1 = addDays(T, 1);
const T2 = addDays(T, 2);
const T3 = addDays(T, 3);

/** The routine as it looks AFTER the user changed its frequency. */
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
    // Fires on no weekday at all unless a case says otherwise — makes
    // "this row dropped out of the schedule" the default.
    frequencyType: "weekdays",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A materialised occurrence carrying the routine's template values. */
function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "si1",
    date: T1,
    title: "Stretch",
    startTime: "10:00",
    endTime: "10:30",
    completed: false,
    completedAt: null,
    routineId: "r1",
    sourceDate: overrides.date ?? T1,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

/** The routine's PRE-edit title/times — the rule-2 discriminator. */
const TEMPLATE = {
  title: "Stretch",
  startTime: "10:00" as string | null,
  endTime: "10:30" as string | null,
};

function makeDs(rows: ScheduleItem[]) {
  const bulkSoftDeleteScheduleItems = vi.fn(
    async (ids: string[]) => ids.length,
  );
  const bulkDeleteScheduleItems = vi.fn(async (ids: string[]) => ids.length);
  const bulkCreateScheduleItems = vi.fn(async () => {});
  // Mirrors the real contract: the service filters is_dismissed = false, so
  // dismissed occurrences never reach the hook at all (rule 1).
  const fetchScheduleItemsByRoutineId = vi.fn(async () =>
    rows.filter((r) => !r.isDismissed),
  );
  const ds = {
    fetchScheduleItemsByRoutineId,
    bulkSoftDeleteScheduleItems,
    bulkDeleteScheduleItems,
    bulkCreateScheduleItems,
  } as unknown as DataService;
  return {
    ds,
    bulkSoftDeleteScheduleItems,
    bulkDeleteScheduleItems,
    bulkCreateScheduleItems,
  };
}

function renderGenerator(ds: DataService, onChanged?: () => void) {
  const { result } = renderHook(() =>
    useScheduleItemsRoutineSync({ dataService: ds, onChanged }),
  );
  return result.current;
}

/** ids passed to the soft delete across all calls, flattened. */
function deletedIds(mock: { mock: { calls: unknown[][] } }): string[] {
  return mock.mock.calls.flatMap((c) => c[0] as string[]);
}

describe("reconcileRoutineScheduleItems — rule 1: 実績は不可侵", () => {
  it("never touches done, dismissed or past occurrences, whatever the new frequency says", async () => {
    // New frequency fires only on today's weekday: every other row below
    // has "dropped out of the schedule" and would be cleanup-eligible if
    // the life-record rules did not protect it.
    const routine = makeRoutine({ frequencyDays: [dow(T)] });
    const rows = [
      makeItem({ id: "keep-today", date: T }), // still fires
      makeItem({ id: "del-stale", date: T1 }), // dropped out → cleaned
      makeItem({ id: "keep-done", date: T2, completed: true }),
      makeItem({ id: "keep-dismissed", date: T3, isDismissed: true }),
      makeItem({ id: "keep-past", date: YESTERDAY }),
    ];
    const { ds, bulkSoftDeleteScheduleItems, bulkDeleteScheduleItems } =
      makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(routine, undefined, TEMPLATE);

    expect(deletedIds(bulkSoftDeleteScheduleItems)).toEqual(["del-stale"]);
    // Auto-cleanup must stay Trash-recoverable (#296) — never the hard path.
    expect(bulkDeleteScheduleItems).not.toHaveBeenCalled();
  });

  it("keeps a dismissed row even when it IS reachable (defence-in-depth)", async () => {
    // The service already filters dismissed rows out; if that contract ever
    // changed, the hook must still refuse to delete them.
    const routine = makeRoutine();
    const rows = [makeItem({ id: "dismissed", date: T1, isDismissed: true })];
    const { ds, bulkSoftDeleteScheduleItems } = makeDs(rows);
    // Bypass the service-level filter to hand the row straight to the hook.
    (
      ds as unknown as { fetchScheduleItemsByRoutineId: () => Promise<unknown> }
    ).fetchScheduleItemsByRoutineId = async () => rows;
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(routine, undefined, TEMPLATE);

    expect(bulkSoftDeleteScheduleItems).not.toHaveBeenCalled();
  });
});

describe("reconcileRoutineScheduleItems — rule 2: 手動編集は Routine 変更に勝つ", () => {
  it("skips rows the user retitled, re-timed or hand-moved; cleans the untouched one", async () => {
    const routine = makeRoutine(); // fires on nothing → all future rows stale
    const rows = [
      makeItem({ id: "del-untouched", date: T1 }),
      makeItem({ id: "keep-retitled", date: T2, title: "Stretch (long)" }),
      makeItem({ id: "keep-retimed", date: T3, startTime: "07:00" }),
      // Generated for T2, dragged onto T3+1: date ≠ sourceDate ⇒ user edit.
      makeItem({ id: "keep-moved", date: addDays(T, 4), sourceDate: T2 }),
    ];
    const { ds, bulkSoftDeleteScheduleItems } = makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(routine, undefined, TEMPLATE);

    expect(deletedIds(bulkSoftDeleteScheduleItems)).toEqual(["del-untouched"]);
  });

  it("compares a time-less routine against the generator defaults, not against null", async () => {
    // A null template time is NOT a wildcard: a time-less routine
    // materialises at 09:00–09:30, so THAT is the untouched shape. Same
    // rule the #279 series edit applies (updateFutureScheduleItemsByRoutine).
    const routine = makeRoutine({ startTime: null, endTime: null });
    const rows = [
      makeItem({
        id: "del-default-times",
        date: T1,
        startTime: "09:00",
        endTime: "09:30",
      }),
      // Same routine, but the user pinned this occurrence to 10:00.
      makeItem({
        id: "keep-hand-timed",
        date: T2,
        startTime: "10:00",
        endTime: "10:30",
      }),
    ];
    const { ds, bulkSoftDeleteScheduleItems } = makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(routine, undefined, {
      title: "Stretch",
      startTime: null,
      endTime: null,
    });

    expect(deletedIds(bulkSoftDeleteScheduleItems)).toEqual([
      "del-default-times",
    ]);
  });

  it("without a template every stale future row is fair game (caller must pass one)", async () => {
    const routine = makeRoutine();
    const rows = [
      makeItem({ id: "del-a", date: T1 }),
      makeItem({ id: "del-b", date: T2, title: "Stretch (long)" }),
    ];
    const { ds, bulkSoftDeleteScheduleItems } = makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(routine);

    expect(deletedIds(bulkSoftDeleteScheduleItems)).toEqual(["del-a", "del-b"]);
  });
});

describe("reconcileRoutineScheduleItems — regeneration of newly firing days", () => {
  it("fills the days the new frequency added, skips occupied ones, and never writes into the past", async () => {
    // Now fires daily. T1 already has a row; T, T2, T3 are gaps. Yesterday
    // fires too but must NOT be fabricated (rule 1 spirit — the life record
    // is not backfilled with not-done rows).
    const routine = makeRoutine({ frequencyType: "daily" });
    const rows = [makeItem({ id: "existing", date: T1 })];
    const { ds, bulkCreateScheduleItems, bulkSoftDeleteScheduleItems } =
      makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(
      routine,
      { startDate: YESTERDAY, endDate: T3 },
      TEMPLATE,
    );

    expect(bulkSoftDeleteScheduleItems).not.toHaveBeenCalled();
    expect(bulkCreateScheduleItems).toHaveBeenCalledTimes(1);
    const created = bulkCreateScheduleItems.mock
      .calls[0][0] as unknown as Array<{
      date: string;
      title: string;
      startTime: string;
      routineId: string;
    }>;
    expect(created.map((c) => c.date).sort()).toEqual([T, T2, T3].sort());
    expect(created[0]).toMatchObject({
      title: "Stretch",
      startTime: "10:00",
      routineId: "r1",
    });
  });

  it("does not duplicate a day a protected row still occupies", async () => {
    // T2 fires under the new frequency and is held by a row the user
    // retitled (rule 2 keeps it). The regeneration pass must read that day
    // as occupied — otherwise the protected row and a fresh generated one
    // would both sit on T2.
    const routine = makeRoutine({ frequencyType: "daily" });
    const rows = [
      makeItem({ id: "keep-retitled", date: T2, title: "Stretch (long)" }),
    ];
    const { ds, bulkCreateScheduleItems, bulkSoftDeleteScheduleItems } =
      makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(
      routine,
      { startDate: T2, endDate: T2 },
      TEMPLATE,
    );

    expect(bulkSoftDeleteScheduleItems).not.toHaveBeenCalled();
    expect(bulkCreateScheduleItems).not.toHaveBeenCalled();
  });

  it("does not regenerate for a soft-deleted routine (Issue 017 (b)/(d))", async () => {
    const routine = makeRoutine({ frequencyType: "daily", isDeleted: true });
    const { ds, bulkCreateScheduleItems } = makeDs([]);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(
      routine,
      { startDate: T, endDate: T3 },
      TEMPLATE,
    );

    expect(bulkCreateScheduleItems).not.toHaveBeenCalled();
  });

  it("never cleans outside the window it can refill", async () => {
    // The read is whole-series (fetchScheduleItemsByRoutineId takes no date
    // filter), so an unbounded delete would sweep occurrences far past the
    // visible range while only that range got regenerated. Rows beyond the
    // window are left to ensureRoutineItemsForDateRange when the user
    // navigates onto them.
    const routine = makeRoutine(); // fires on nothing
    const rows = [
      makeItem({ id: "del-in-window", date: T1 }),
      makeItem({ id: "keep-far-future", date: addDays(T, 90) }),
    ];
    const { ds, bulkSoftDeleteScheduleItems } = makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(
      routine,
      { startDate: T, endDate: T3 },
      TEMPLATE,
    );

    expect(deletedIds(bulkSoftDeleteScheduleItems)).toEqual(["del-in-window"]);
  });

  it("cleans up without a dateRange (no range ⇒ no generation pass)", async () => {
    const routine = makeRoutine();
    const rows = [makeItem({ id: "del-stale", date: T1 })];
    const { ds, bulkCreateScheduleItems, bulkSoftDeleteScheduleItems } =
      makeDs(rows);
    const gen = renderGenerator(ds);

    await gen.reconcileRoutineScheduleItems(routine, undefined, TEMPLATE);

    expect(deletedIds(bulkSoftDeleteScheduleItems)).toEqual(["del-stale"]);
    expect(bulkCreateScheduleItems).not.toHaveBeenCalled();
  });
});

describe("reconcileRoutineScheduleItems — change signal", () => {
  it("signals the host once the pass wrote something", async () => {
    const onChanged = vi.fn();
    const routine = makeRoutine();
    const { ds } = makeDs([makeItem({ id: "del-stale", date: T1 })]);
    const gen = renderGenerator(ds, onChanged);

    await gen.reconcileRoutineScheduleItems(routine, undefined, TEMPLATE);

    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("stays silent on a no-op pass (no spurious re-read / render loop)", async () => {
    const onChanged = vi.fn();
    // Fires on T1's weekday, and T1's row already exists and matches.
    const routine = makeRoutine({ frequencyDays: [dow(T1)] });
    const { ds } = makeDs([makeItem({ id: "keep", date: T1 })]);
    const gen = renderGenerator(ds, onChanged);

    await gen.reconcileRoutineScheduleItems(
      routine,
      { startDate: T1, endDate: T1 },
      TEMPLATE,
    );

    expect(onChanged).not.toHaveBeenCalled();
  });

  it("swallows a read failure without signalling (host keeps its state)", async () => {
    const onChanged = vi.fn();
    const routine = makeRoutine();
    const { ds } = makeDs([]);
    (
      ds as unknown as { fetchScheduleItemsByRoutineId: () => Promise<unknown> }
    ).fetchScheduleItemsByRoutineId = async () => {
      throw new Error("offline");
    };
    const gen = renderGenerator(ds, onChanged);

    await expect(
      gen.reconcileRoutineScheduleItems(routine, undefined, TEMPLATE),
    ).resolves.toBeUndefined();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
