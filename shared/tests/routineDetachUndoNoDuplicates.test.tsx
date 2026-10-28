import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoutinesAPI } from "../src/hooks/useRoutinesAPI";
import { diffRoutineScheduleItems } from "../src/utils/routineScheduleSync";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { RoutineNode } from "../src/types/routine";
import type { ScheduleItem } from "../src/types/schedule";
import type { DetachedOccurrence } from "../src/services/DataService";

/*
 * #2319 — undoing "delete / this and following" must leave one occurrence per
 * day, and keep a day the user dismissed on its own dismissed.
 *
 * The issue's steps, run against an in-memory table that does what the
 * service does to the rows (trash the future ones, unlink the past ones, trash
 * the routine — and back), and then asked of the real generator diff: would
 * it add anything once the repeat is back? Before the fix the undo left the
 * past rows unlinked, so for every one of those days the diff saw no row of
 * the routine and made a second — the dismissed day included, which is how it
 * "came back".
 *
 * The service's own writes (which columns, which filters, the conflict
 * report) are pinned in detachRoutine.test.ts; this suite is about the
 * sequence the hook runs and what the calendar ends up holding.
 */

const { wrapper } = createBumpableSync();

const ROUTINE: RoutineNode = {
  id: "routine-1",
  title: "Stretch",
  startTime: "07:00",
  endTime: "07:30",
  isArchived: false,
  isVisible: true,
  isDeleted: false,
  deletedAt: null,
  order: 0,
  frequencyType: "daily",
  frequencyDays: [],
  frequencyInterval: null,
  frequencyStartDate: "2026-11-01",
  createdAt: "2026-10-31T00:00:00.000Z",
  updatedAt: "2026-10-31T00:00:00.000Z",
};

const DAYS = [
  "2026-11-01",
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
];
/** Where "this and following" was pressed. */
const ANCHOR = "2026-11-05";
/** Step 2 of the issue: deleted "this one only" — a dismiss. */
const DISMISSED_DAY = "2026-11-02";

interface Row {
  id: string;
  date: string;
  routineId: string | null;
  sourceDate: string | null;
  dismissed: boolean;
  deleted: boolean;
}

function makeTable() {
  const rows: Row[] = DAYS.map((date, i) => ({
    // The first one is the seed the repeat was grown from.
    id: i === 0 ? "seed" : `si-${date}`,
    date,
    routineId: ROUTINE.id,
    sourceDate: date,
    dismissed: date === DISMISSED_DAY,
    deleted: false,
  }));
  let routineDeleted = false;

  const ds = stubDataService({
    fetchAllRoutines: async () => (routineDeleted ? [] : [ROUTINE]),
    fetchDeletedRoutines: async () => [],
    // What SupabaseRoutinesService.detachRoutine does to the rows.
    detachRoutine: async (id: string, today: string) => {
      const live = rows.filter((r) => r.routineId === id && !r.deleted);
      const trashed = live.filter((r) => r.date >= today);
      const kept = live.filter((r) => r.date < today);
      const detachedItems: DetachedOccurrence[] = kept.map((r) => ({
        id: r.id,
        sourceDate: r.sourceDate,
      }));
      for (const r of trashed) r.deleted = true;
      for (const r of kept) {
        r.routineId = null;
        r.sourceDate = null;
      }
      routineDeleted = true;
      return {
        deletedScheduleItemIds: trashed.map((r) => r.id),
        detachedItems,
      };
    },
    bulkRestoreScheduleItems: async (ids: string[]) => {
      for (const r of rows) if (ids.includes(r.id)) r.deleted = false;
      return { restoredIds: ids, conflictedIds: [] };
    },
    reattachRoutineOccurrences: async (
      id: string,
      items: DetachedOccurrence[],
    ) => {
      const reattachedIds: string[] = [];
      for (const item of items) {
        const r = rows.find((x) => x.id === item.id && x.routineId === null);
        if (!r) continue;
        r.routineId = id;
        r.sourceDate = item.sourceDate;
        reattachedIds.push(r.id);
      }
      return { reattachedIds, conflictedIds: [] };
    },
    restoreRoutine: async () => {
      routineDeleted = false;
    },
  });

  /** The live rows of a day, as the generator reads them. */
  const liveOn = (date: string): ScheduleItem[] =>
    rows
      .filter((r) => !r.deleted && r.date === date)
      .map(
        (r) =>
          ({
            id: r.id,
            date: r.date,
            routineId: r.routineId,
            sourceDate: r.sourceDate,
            dismissed: r.dismissed,
          }) as unknown as ScheduleItem,
      );

  return { ds, rows, liveOn };
}

async function splitThenUndo(table: ReturnType<typeof makeTable>) {
  const view = renderHook(() => useRoutinesAPI({ dataService: table.ds }), {
    wrapper,
  });
  await waitFor(() => expect(view.result.current.routines).toHaveLength(1));

  let reversal: { undo: () => Promise<void> } | null = null;
  await act(async () => {
    ({ reversal } = await view.result.current.detachRoutine(
      ROUTINE.id,
      ANCHOR,
      { reversible: true },
    ));
  });
  expect(view.result.current.routines).toHaveLength(0);

  await act(async () => {
    await reversal!.undo();
  });
  await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
  return view.result.current.routines;
}

describe("undoing 'this and following' (#2319)", () => {
  it("leaves the generator nothing to add on any day", async () => {
    const table = makeTable();
    const routines = await splitThenUndo(table);

    for (const date of DAYS) {
      const { toCreate } = diffRoutineScheduleItems(
        table.liveOn(date),
        routines,
        date,
      );
      expect({ date, toCreate }).toEqual({ date, toCreate: [] });
    }
  });

  it("keeps one occurrence per day, each back under the repeat", async () => {
    const table = makeTable();
    await splitThenUndo(table);

    for (const date of DAYS) {
      const live = table.liveOn(date);
      expect(live).toHaveLength(1);
      expect(live[0]).toMatchObject({
        routineId: ROUTINE.id,
        sourceDate: date,
      });
    }
  });

  it("keeps the day deleted on its own deleted", async () => {
    const table = makeTable();
    const routines = await splitThenUndo(table);

    const [row] = table.liveOn(DISMISSED_DAY);
    expect(row).toMatchObject({ id: `si-${DISMISSED_DAY}`, dismissed: true });
    // The dismissed row is what tells the generator the day is taken; an
    // unlinked one does not, and the day came back as a fresh occurrence.
    expect(
      diffRoutineScheduleItems(
        table.liveOn(DISMISSED_DAY),
        routines,
        DISMISSED_DAY,
      ).toCreate,
    ).toEqual([]);
  });
});
