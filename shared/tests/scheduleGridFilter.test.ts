import { describe, it, expect } from "vitest";
import { applyRepeatFilter } from "../src/utils/scheduleGridFilter";

/*
 * #466 Step 5-b: the grid's repeat filter. web has no test runner, so the
 * decision lives in this pure helper and the host only wires state to it.
 */

const rows = [
  { id: "si-1", routineId: "r-1" },
  { id: "si-2", routineId: null },
  { id: "si-3" },
  { id: "si-4", routineId: "r-2" },
];

describe("applyRepeatFilter", () => {
  it("is the identity case when the filter is off (same reference)", () => {
    const result = applyRepeatFilter(rows, false);
    // Same reference, not just same contents: a host memo downstream must not
    // invalidate on every render while the filter is off.
    expect(result.visible).toBe(rows);
    expect(result.hiddenCount).toBe(0);
  });

  it("drops routine-generated rows and counts what it dropped", () => {
    const { visible, hiddenCount } = applyRepeatFilter(rows, true);
    expect(visible.map((r) => r.id)).toEqual(["si-2", "si-3"]);
    // The count travels with the survivors: the caller says "N hidden" from
    // the same call that removed them, so the badge can never disagree with
    // the grid.
    expect(hiddenCount).toBe(2);
    expect(hiddenCount).toBe(rows.length - visible.length);
  });

  it("keeps rows whose routineId is null or absent", () => {
    // A manual event carries null; a task chip / partial row carries neither.
    // Both are one-offs and must survive — only a routine origin hides a row.
    const { visible, hiddenCount } = applyRepeatFilter(
      [{ id: "a", routineId: null }, { id: "b" }],
      true,
    );
    expect(visible.map((r) => r.id)).toEqual(["a", "b"]);
    expect(hiddenCount).toBe(0);
  });

  it("returns an empty list with the full count when every row repeats", () => {
    const all = [
      { id: "si-1", routineId: "r-1" },
      { id: "si-2", routineId: "r-1" },
    ];
    const { visible, hiddenCount } = applyRepeatFilter(all, true);
    expect(visible).toEqual([]);
    expect(hiddenCount).toBe(2);
  });

  it("does not mutate the input", () => {
    const input = [...rows];
    applyRepeatFilter(input, true);
    expect(input).toEqual(rows);
  });
});
