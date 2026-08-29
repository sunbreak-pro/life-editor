import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoutinesAPI } from "../src/hooks/useRoutinesAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import type { RoutineNode } from "../src/types/routine";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #672 — the load effect of useRoutinesAPI, untested until now (nothing in the
 * repo mounted the hook). The active list and the trash list are read on the
 * same cursor but independently, which is the part most easily broken by a
 * refactor: fold them into one `await` chain and a trash failure takes the
 * whole screen down with it.
 */

const { sync, wrapper } = createBumpableSync();

function routine(
  id: string,
  overrides: Partial<RoutineNode> = {},
): RoutineNode {
  return {
    id,
    title: id,
    startTime: null,
    endTime: null,
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * DataService stub. `active` / `deleted` are scripted round by round; an Error
 * in a round means that read rejects.
 */
function makeDS(
  active: Array<RoutineNode[] | Error>,
  deleted: Array<RoutineNode[] | Error> = [],
) {
  const take = (rounds: Array<RoutineNode[] | Error>) => {
    const next = rounds.shift() ?? [];
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  };
  const fetchAllRoutines = vi.fn(() => take(active));
  const fetchDeletedRoutines = vi.fn(() => take(deleted));
  const ds = stubDataService({
    fetchAllRoutines,
    fetchDeletedRoutines,
  });
  return { ds, fetchAllRoutines, fetchDeletedRoutines };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRoutinesAPI load effect (#672)", () => {
  it("reports loading until the first read lands, then holds both lists", async () => {
    const { ds } = makeDS([[routine("routine-1")]], [[routine("routine-9")]]);
    const hook = renderHook(() => useRoutinesAPI({ dataService: ds }), {
      wrapper,
    });

    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.routines.map((r) => r.id)).toEqual([
      "routine-1",
    ]);
    await waitFor(() =>
      expect(hook.result.current.deletedRoutines.map((r) => r.id)).toEqual([
        "routine-9",
      ]),
    );
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the schedule domain moves", async () => {
    const { ds, fetchAllRoutines } = makeDS([
      [routine("routine-1")],
      [routine("routine-1"), routine("routine-2")],
    ]);
    const hook = renderHook(() => useRoutinesAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(fetchAllRoutines).toHaveBeenCalledTimes(1));

    // A routine is an Event template, so it rides the schedule counter (#499).
    act(() => sync.bump("schedule"));
    await waitFor(() => expect(fetchAllRoutines).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.routines).toHaveLength(2));
  });

  it("ignores a bump on a domain it does not read", async () => {
    const { ds, fetchAllRoutines } = makeDS([[routine("routine-1")]]);
    renderHook(() => useRoutinesAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchAllRoutines).toHaveBeenCalledTimes(1));

    act(() => {
      sync.bump("notes");
      sync.bump("audio");
    });
    await act(async () => {});
    expect(fetchAllRoutines).toHaveBeenCalledTimes(1);
  });

  it("still fills the active list when the trash read fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([[routine("routine-1")]], [new Error("trash down")]);
    const hook = renderHook(() => useRoutinesAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() =>
      expect(hook.result.current.routines.map((r) => r.id)).toEqual([
        "routine-1",
      ]),
    );
    expect(hook.result.current.isLoading).toBe(false);
    // The trash view has its own empty state; a failure there is logged, not
    // surfaced as the section's error.
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.deletedRoutines).toEqual([]);
  });

  it("surfaces a failed read and un-latches it on the next success (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([new Error("offline"), [routine("routine-1")]]);
    const hook = renderHook(() => useRoutinesAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    expect(hook.result.current.isLoading).toBe(false);

    act(() => sync.bump("schedule"));
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.routines.map((r) => r.id)).toEqual([
      "routine-1",
    ]);
  });
});
