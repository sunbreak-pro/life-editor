import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useRoutinesAPI } from "../src/hooks/useRoutinesAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import type { RoutineNode } from "../src/types/routine";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1140 — the purge is the one write on this hook the DATABASE can refuse
 * outright. Everything else here is a patch that either lands or evaporates,
 * so dropping the row optimistically and logging the rejection costs nothing
 * when it fails. A purge is different: the 0011 composite FK on
 * events_payload is ON DELETE NO ACTION, so a still-referencing occurrence
 * makes it fail as a whole.
 *
 * The old code dropped the routine from `deletedRoutines` and handed the
 * rejection to logServiceError, which meant the routine left Trash on screen
 * while it was still in the database — and with nothing left to click, there
 * was no way to try again either. These cases pin the rollback, and the
 * happy path alongside it: a rollback that also fired on success would put
 * purged routines back into Trash, which is the worse of the two lies.
 */

const { wrapper } = createBumpableSync();

function routine(id: string): RoutineNode {
  return {
    id,
    title: id,
    startTime: null,
    endTime: null,
    isArchived: false,
    isVisible: true,
    isDeleted: true,
    deletedAt: "2026-08-27T00:00:00.000Z",
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
  };
}

function makeHook(purge: () => Promise<void>) {
  const permanentDeleteRoutine = vi.fn(purge);
  const ds = stubDataService({
    fetchAllRoutines: vi.fn(() => Promise.resolve([])),
    fetchDeletedRoutines: vi.fn(() =>
      Promise.resolve([routine("routine-8"), routine("routine-9")]),
    ),
    permanentDeleteRoutine,
  });
  return {
    permanentDeleteRoutine,
    hook: renderHook(() => useRoutinesAPI({ dataService: ds }), { wrapper }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRoutinesAPI.permanentDeleteRoutine (#1140)", () => {
  it("puts the routine back in Trash when the purge is refused", async () => {
    const { hook } = makeHook(() =>
      Promise.reject(new Error("permanentDeleteRoutine events: 1 of 2 …")),
    );
    await waitFor(() =>
      expect(hook.result.current.deletedRoutines).toHaveLength(2),
    );

    await act(async () => {
      hook.result.current.permanentDeleteRoutine("routine-9");
    });

    // Back on screen — and still trashed, so the row the user sees is the row
    // the database has.
    await waitFor(() =>
      expect(
        hook.result.current.deletedRoutines.map((r) => r.id).sort(),
      ).toEqual(["routine-8", "routine-9"]),
    );
    // The other trashed routine was never involved.
    expect(hook.result.current.routines).toEqual([]);
  });

  it("leaves it gone when the purge succeeds", async () => {
    const { hook } = makeHook(() => Promise.resolve());
    await waitFor(() =>
      expect(hook.result.current.deletedRoutines).toHaveLength(2),
    );

    await act(async () => {
      hook.result.current.permanentDeleteRoutine("routine-9");
    });

    expect(hook.result.current.deletedRoutines.map((r) => r.id)).toEqual([
      "routine-8",
    ]);
  });

  it("does not restore a routine it never held", async () => {
    // The optimistic filter is a no-op for an unknown id, so the catch must
    // be one too — otherwise a stale retry could mint a Trash row out of
    // nothing.
    const { hook } = makeHook(() => Promise.reject(new Error("boom")));
    await waitFor(() =>
      expect(hook.result.current.deletedRoutines).toHaveLength(2),
    );

    await act(async () => {
      hook.result.current.permanentDeleteRoutine("routine-404");
    });

    await waitFor(() =>
      expect(hook.result.current.deletedRoutines.map((r) => r.id)).toEqual([
        "routine-8",
        "routine-9",
      ]),
    );
  });
});
