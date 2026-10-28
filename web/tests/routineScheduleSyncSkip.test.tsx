import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import type { RoutineNode } from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { RoutineScheduleSync } from "../src/schedule/RoutineScheduleSync";

/*
 * #2327 — the today generator runs once per (date, routine content).
 *
 * The routine list arrives as a NEW array on every read: the cached copy
 * replayed on mount, the fetch that follows, and every schedule bump. Keyed on
 * the array's identity, the ensure pass re-read the day's events up to three
 * times on one switch to the Schedule. It now runs only when the date or what
 * the routines say has changed.
 *
 * The two Schedule contexts are replaced with plain values the test moves;
 * the generator (useScheduleItemsRoutineSync) is the real one, so the count is
 * taken where the pass reads: `fetchScheduleItemsByDate`.
 */

const ctx = vi.hoisted(() => ({
  routines: [] as RoutineNode[],
  date: "2026-10-21",
  loadDate: (): Promise<void> => Promise.resolve(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useRoutineContext: () => ({ routines: ctx.routines }),
  useScheduleItemsContext: () => ({
    date: ctx.date,
    loadDate: ctx.loadDate,
  }),
}));

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

/** A fresh array of fresh objects — equal content, new identities. */
const freshRoutines = (overrides: Partial<RoutineNode> = {}) => [
  makeRoutine(overrides),
];

function setup(
  fetchScheduleItemsByDate = vi.fn(async (): Promise<unknown[]> => []),
  bulkCreateScheduleItems = vi.fn(async (): Promise<void> => undefined),
) {
  const ds = stubDataService({
    fetchScheduleItemsByDate,
    bulkCreateScheduleItems,
  });
  const view = render(<RoutineScheduleSync dataService={ds} />);
  /** Re-render with whatever `ctx` holds now, then let the pass run. */
  const rerender = async () => {
    view.rerender(<RoutineScheduleSync dataService={ds} />);
    await settle();
  };
  return { fetchScheduleItemsByDate, bulkCreateScheduleItems, rerender };
}

async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

beforeEach(() => {
  ctx.routines = freshRoutines();
  ctx.date = "2026-10-21";
});

describe("RoutineScheduleSync skips a pass it already ran (#2327)", () => {
  it("does not re-read the day for a new array of equal routines", async () => {
    const { fetchScheduleItemsByDate, rerender } = setup();
    await settle();
    expect(fetchScheduleItemsByDate).toHaveBeenCalledTimes(1);

    ctx.routines = freshRoutines();
    await rerender();
    ctx.routines = freshRoutines();
    await rerender();

    expect(fetchScheduleItemsByDate).toHaveBeenCalledTimes(1);
  });

  it("runs again when a routine's content changes", async () => {
    const { fetchScheduleItemsByDate, rerender } = setup();
    await settle();

    ctx.routines = freshRoutines({ startTime: "11:00" });
    await rerender();

    expect(fetchScheduleItemsByDate).toHaveBeenCalledTimes(2);
  });

  it("runs again for a new date, with the routines unchanged", async () => {
    const { fetchScheduleItemsByDate, rerender } = setup();
    await settle();

    ctx.date = "2026-10-22";
    ctx.routines = freshRoutines();
    await rerender();

    expect(fetchScheduleItemsByDate).toHaveBeenCalledTimes(2);
    expect(fetchScheduleItemsByDate).toHaveBeenLastCalledWith("2026-10-22");
  });
});

describe("RoutineScheduleSync retries a pass that failed (#2327)", () => {
  // The generator logs the failure; keep the run's output readable.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-reads the day after the read itself failed", async () => {
    const fetchScheduleItemsByDate = vi
      .fn(async (): Promise<unknown[]> => [])
      .mockRejectedValueOnce(new Error("offline"));
    const { rerender } = setup(fetchScheduleItemsByDate);
    await settle();
    expect(fetchScheduleItemsByDate).toHaveBeenCalledTimes(1);

    // Equal content, new array — the skip must not hold a failed pass.
    ctx.routines = freshRoutines();
    await rerender();

    expect(fetchScheduleItemsByDate).toHaveBeenCalledTimes(2);
  });

  it("re-reads the day after the write of the missing rows failed", async () => {
    const bulkCreateScheduleItems = vi
      .fn(async (): Promise<void> => undefined)
      .mockRejectedValueOnce(new Error("refused"));
    const { fetchScheduleItemsByDate, rerender } = setup(
      undefined,
      bulkCreateScheduleItems,
    );
    await settle();
    // The day had nothing, so the daily routine owed a row and the write ran.
    expect(bulkCreateScheduleItems).toHaveBeenCalledTimes(1);

    ctx.routines = freshRoutines();
    await rerender();

    expect(fetchScheduleItemsByDate).toHaveBeenCalledTimes(2);
    expect(bulkCreateScheduleItems).toHaveBeenCalledTimes(2);
  });
});
