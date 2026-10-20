import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoutinesAPI } from "../src/hooks/useRoutinesAPI";
import { diffRoutineScheduleItems } from "../src/utils/routineScheduleSync";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { RoutineNode } from "../src/types/routine";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * #2320 — "Repeat = None" from a mid-series occurrence could leave an
 * untagged duplicate of that occurrence behind.
 *
 * detachRoutine writes in steps: unlink the kept occurrence, hand the tags
 * over, and only then trash the routine. Each step is a Realtime bump. A
 * re-read that landed between them still found the routine live and put it
 * back on the list the detach had just taken it off; RoutineScheduleSync then
 * saw a live routine with no row of its own on the open day (the kept row was
 * unlinked) and made one. The routine was trashed a moment later, and the new
 * row stayed, untagged and still pointing at it.
 *
 * These tests put the re-read in the middle, in the order the issue saw, and
 * ask both the routine list and the real generator diff what they hold.
 */

const { sync, wrapper } = createBumpableSync();

const ROUTINE: RoutineNode = {
  id: "routine-1",
  title: "Weekly review",
  startTime: "18:00",
  endTime: "19:00",
  isArchived: false,
  isVisible: true,
  isDeleted: false,
  deletedAt: null,
  order: 0,
  frequencyType: "weekdays",
  frequencyDays: [6],
  frequencyInterval: null,
  frequencyStartDate: "2026-10-31",
  createdAt: "2026-10-30T00:00:00.000Z",
  updatedAt: "2026-10-30T00:00:00.000Z",
};
/** The occurrence the editor has open (not the seed). */
const OPEN_DAY = "2026-11-07";
const OPEN_ID = "si-open";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeServer() {
  const state = { routineLive: true };
  /** The kept occurrence, unlinked by the detach's first step. */
  const openRow: ScheduleItem = {
    id: OPEN_ID,
    date: OPEN_DAY,
    routineId: ROUTINE.id,
  } as unknown as ScheduleItem;

  // Each call answers with what the server holds when the call is MADE, so a
  // read can be started before the last step and land after it.
  let nextRead: ReturnType<typeof deferred<RoutineNode[]>> | null = null;
  const fetchAllRoutines = vi.fn(() => {
    const answer = state.routineLive ? [ROUTINE] : [];
    if (nextRead) {
      const held = nextRead;
      nextRead = null;
      return held.promise.then(() => answer);
    }
    return Promise.resolve(answer);
  });

  const writes = deferred<{
    deletedScheduleItemIds: string[];
    detachedItems: unknown[];
  }>();
  const detachRoutine = vi.fn(() => {
    // Step 1 lands at once: the open row loses its link.
    openRow.routineId = null;
    return writes.promise;
  });

  const ds = stubDataService({
    fetchAllRoutines,
    fetchDeletedRoutines: vi.fn(async () => []),
    detachRoutine,
    bulkRestoreScheduleItems: vi.fn(async () => ({
      restoredIds: [],
      conflictedIds: [],
    })),
    restoreRoutine: vi.fn(async () => {
      state.routineLive = true;
    }),
    // #2319 makes the undo re-link the rows the split unlinked, through a
    // DataService method added in a parallel PR. Spread in so this suite
    // compiles without it and still runs with it, whichever PR lands first.
    ...{
      reattachRoutineOccurrences: vi.fn(async () => ({
        reattachedIds: [],
        conflictedIds: [],
      })),
    },
  });

  return {
    ds,
    state,
    openRow,
    fetchAllRoutines,
    /** The last step: the routine is trashed and the call returns. */
    finishWrites: () => {
      state.routineLive = false;
      writes.resolve({ deletedScheduleItemIds: [], detachedItems: [] });
    },
    failWrites: () => writes.reject(new Error("offline")),
    /** Make the next read wait for `release()` before it answers. */
    holdNextRead: () => {
      nextRead = deferred<RoutineNode[]>();
      const held = nextRead;
      return () => held.resolve([]);
    },
  };
}

async function mount(server: ReturnType<typeof makeServer>) {
  const view = renderHook(() => useRoutinesAPI({ dataService: server.ds }), {
    wrapper,
  });
  await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
  return view;
}

/** Bump Sync and wait for the read it starts (and its apply) to settle. */
async function reread(server: ReturnType<typeof makeServer>) {
  const before = server.fetchAllRoutines.mock.calls.length;
  await act(async () => sync.bump());
  await waitFor(() =>
    expect(server.fetchAllRoutines.mock.calls.length).toBe(before + 1),
  );
  await act(async () => {});
}

describe("a re-read in the middle of Repeat = None (#2320)", () => {
  it("does not put the repeat back, so the open day gets no second row", async () => {
    const server = makeServer();
    const view = await mount(server);

    let detach!: Promise<unknown>;
    act(() => {
      detach = view.result.current.detachRoutine(ROUTINE.id, undefined, {
        keepItemIds: [OPEN_ID],
      });
    });
    // Between the unlink and the routine's trash: the server still has it.
    await reread(server);

    expect(view.result.current.routines).toEqual([]);
    expect(
      diffRoutineScheduleItems(
        [server.openRow],
        view.result.current.routines,
        OPEN_DAY,
      ).toCreate,
    ).toEqual([]);

    await act(async () => {
      server.finishWrites();
      await detach;
    });
    await reread(server);
    expect(view.result.current.routines).toEqual([]);
  });

  it("ignores a read that started before the last step and lands after it", async () => {
    const server = makeServer();
    const view = await mount(server);

    let detach!: Promise<unknown>;
    act(() => {
      detach = view.result.current.detachRoutine(ROUTINE.id, undefined, {
        keepItemIds: [OPEN_ID],
      });
    });
    const release = server.holdNextRead();
    const before = server.fetchAllRoutines.mock.calls.length;
    await act(async () => sync.bump());
    await waitFor(() =>
      expect(server.fetchAllRoutines.mock.calls.length).toBe(before + 1),
    );

    await act(async () => {
      server.finishWrites();
      await detach;
    });
    // It read the routine as live; nothing newer has come in since.
    await act(async () => release());

    expect(view.result.current.routines).toEqual([]);
  });

  it("lets a later read bring it back — a restore from the Trash shows up", async () => {
    const server = makeServer();
    const view = await mount(server);

    await act(async () => {
      const detach = view.result.current.detachRoutine(ROUTINE.id);
      server.finishWrites();
      await detach;
    });
    // Restored elsewhere (the Trash screen goes through the DataService).
    server.state.routineLive = true;
    await reread(server);

    expect(view.result.current.routines.map((r) => r.id)).toEqual([ROUTINE.id]);
  });

  it("keeps the repeat after a detach that did not land", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const server = makeServer();
    const view = await mount(server);

    await act(async () => {
      const detach = view.result.current.detachRoutine(ROUTINE.id);
      server.failWrites();
      await expect(detach).rejects.toThrow("offline");
    });
    await reread(server);

    expect(view.result.current.routines.map((r) => r.id)).toEqual([ROUTINE.id]);
  });

  it("keeps the repeat once an undo has put it back", async () => {
    const server = makeServer();
    const view = await mount(server);

    let reversal: { undo: () => Promise<void> } | null = null;
    await act(async () => {
      const detach = view.result.current.detachRoutine(ROUTINE.id, undefined, {
        reversible: true,
      });
      server.finishWrites();
      ({ reversal } = await detach);
    });
    await act(async () => {
      await reversal!.undo();
    });
    await reread(server);

    expect(view.result.current.routines.map((r) => r.id)).toEqual([ROUTINE.id]);
  });
});
