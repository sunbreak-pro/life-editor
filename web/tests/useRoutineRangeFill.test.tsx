import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { RoutineNode } from "@life-editor/shared";
import {
  routineFillWindow,
  useRoutineRangeFill,
  type UseRoutineRangeFillArgs,
} from "../src/schedule/useRoutineRangeFill";

/*
 * #2081 — navigating the calendar materialises the visible window's repeat
 * occurrences. Before it the only writers were the today generator and the
 * one-shot fill at creation, so a repeat stopped at the edge of whatever grid
 * was on screen when it was made (2026-10-03 for the reported pair).
 */

const ROUTINE = {
  id: "r-bath",
  title: "Bath",
  frequencyType: "daily",
} as RoutineNode;

function setup(overrides: Partial<UseRoutineRangeFillArgs> = {}) {
  const fill = vi.fn<UseRoutineRangeFillArgs["fill"]>(() => Promise.resolve(3));
  const reload = vi.fn();
  const props: UseRoutineRangeFillArgs = {
    routines: [ROUTINE],
    rangeStart: "2026-10-04",
    rangeEnd: "2026-10-10",
    today: "2026-10-03",
    fill,
    reload,
    ...overrides,
  };
  const view = renderHook(
    (p: UseRoutineRangeFillArgs) => useRoutineRangeFill(p),
    {
      initialProps: props,
    },
  );
  return { ...view, props, fill: props.fill as typeof fill, reload };
}

describe("routineFillWindow", () => {
  it("covers a future week whole", () => {
    expect(routineFillWindow("2026-10-04", "2026-10-10", "2026-10-03")).toEqual(
      { startDate: "2026-10-04", endDate: "2026-10-10" },
    );
  });

  it("starts the day after today when today is inside the range", () => {
    // today belongs to the always-on generator; past days are never filled.
    expect(routineFillWindow("2026-09-27", "2026-10-03", "2026-09-30")).toEqual(
      { startDate: "2026-10-01", endDate: "2026-10-03" },
    );
  });

  it("returns null for a past week and for a range ending today", () => {
    expect(
      routineFillWindow("2026-09-13", "2026-09-19", "2026-10-03"),
    ).toBeNull();
    expect(
      routineFillWindow("2026-09-27", "2026-10-03", "2026-10-03"),
    ).toBeNull();
  });
});

describe("useRoutineRangeFill", () => {
  it("fills the visible October week and reloads once rows were written", async () => {
    const { fill, reload } = setup();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fill).toHaveBeenCalledWith("2026-10-04", "2026-10-10", [ROUTINE]);
  });

  it("fills again when the user steps to the next week", async () => {
    const { fill, rerender, props } = setup();
    await waitFor(() => expect(fill).toHaveBeenCalledTimes(1));
    rerender({ ...props, rangeStart: "2026-10-11", rangeEnd: "2026-10-17" });
    await waitFor(() =>
      expect(fill).toHaveBeenLastCalledWith("2026-10-11", "2026-10-17", [
        ROUTINE,
      ]),
    );
  });

  it("does not reload when nothing was missing", async () => {
    const { fill, reload } = setup({ fill: vi.fn(() => Promise.resolve(0)) });
    await waitFor(() => expect(fill).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it("retries a failed pass once", async () => {
    const fill = vi
      .fn<UseRoutineRangeFillArgs["fill"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(2);
    const { reload } = setup({ fill });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fill).toHaveBeenCalledTimes(2);
  });

  it("does nothing without routines or for a past week", async () => {
    const a = setup({ routines: [] });
    const b = setup({ rangeStart: "2026-09-13", rangeEnd: "2026-09-19" });
    await Promise.resolve();
    expect(a.fill).not.toHaveBeenCalled();
    expect(b.fill).not.toHaveBeenCalled();
  });
});
