import { describe, it, expect } from "vitest";
import type { RoutineGroup } from "../src/types/routineGroup";
import {
  rowToRoutineGroupV2,
  routineGroupToRowV2,
  routineGroupUpdatesToPatchV2,
  type RoutineGroupRowV2,
} from "../src/services/routineGroupMapper";

/*
 * routineGroupMapper (V2 / 0008 dedicated table) vitest suite. Covers the
 * CURRENT V2 API only (the @deprecated 0006-shape legacy shims are not
 * exercised — DU-C-4 removes them). The mapper is pure.
 *
 * Coercion / rename surfaces:
 *   - frequency_days JSON string <-> number[] (shared with routineMapper)
 *   - 0006 "order" -> 0008 sort_order rename
 *   - 0008 soft-delete columns (is_deleted / deleted_at) — NOT on the
 *     Phase 2 RoutineGroup domain type, so a roundtrip cannot observe
 *     them; rowToRoutineGroupV2 tolerates a soft-deleted row and returns
 *     the same domain shape.
 *
 * Cases:
 *   1. domain -> row -> domain roundtrip across frequencyType shapes
 *   2. order <-> sort_order rename (INSERT + SELECT)
 *   3. frequency_days JSON serialise/parse
 *   4. INSERT defaults (version=1, is_deleted=false, deleted_at=null)
 *   5. DB-Q2 updated_at ALWAYS bumped (incl. zero-change patch)
 *   6. soft-delete patch surface (isDeleted/deletedAt land on patch)
 *   7. null frequencyInterval / frequencyStartDate boundary
 */

const NOW = "2026-05-24T12:00:00.000Z";

/** Re-attach server-derived `user_id` so the WriteRow produced by
 *  routineGroupToRowV2 can feed rowToRoutineGroupV2. */
function reattachUserId(
  writeRow: ReturnType<typeof routineGroupToRowV2>,
): RoutineGroupRowV2 {
  return { ...writeRow, user_id: "00000000-0000-0000-0000-000000000000" };
}

function roundtrip(group: RoutineGroup): RoutineGroup {
  return rowToRoutineGroupV2(reattachUserId(routineGroupToRowV2(group)));
}

function baseGroup(overrides: Partial<RoutineGroup> = {}): RoutineGroup {
  return {
    id: "rgroup-1",
    name: "Morning",
    color: "#3b82f6",
    isVisible: true,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. roundtrip across frequencyType shapes
// ---------------------------------------------------------------------------

describe("rowToRoutineGroupV2 ∘ routineGroupToRowV2 roundtrip", () => {
  it("daily frequency, visible", () => {
    expect(roundtrip(baseGroup())).toEqual(baseGroup());
  });

  it("weekdays frequency with frequencyDays [1,3,5]", () => {
    const group = baseGroup({
      id: "rgroup-2",
      frequencyType: "weekdays",
      frequencyDays: [1, 3, 5],
    });
    expect(roundtrip(group)).toEqual(group);
  });

  it("interval frequency with interval + start date, hidden", () => {
    const group = baseGroup({
      id: "rgroup-3",
      isVisible: false,
      frequencyType: "interval",
      frequencyInterval: 3,
      frequencyStartDate: "2026-05-24",
    });
    expect(roundtrip(group)).toEqual(group);
  });

  it("group frequency", () => {
    const group = baseGroup({ id: "rgroup-4", frequencyType: "group" });
    expect(roundtrip(group)).toEqual(group);
  });
});

// ---------------------------------------------------------------------------
// 2. order <-> sort_order rename
// ---------------------------------------------------------------------------

describe("order <-> sort_order rename", () => {
  it("RoutineGroup.order writes to sort_order on INSERT", () => {
    const writeRow = routineGroupToRowV2(baseGroup({ order: 42 }));
    expect(writeRow.sort_order).toBe(42);
    expect(writeRow).not.toHaveProperty("order");
  });

  it("sort_order reads back to RoutineGroup.order on SELECT", () => {
    const row = reattachUserId(routineGroupToRowV2(baseGroup({ order: 7 })));
    expect(rowToRoutineGroupV2(row).order).toBe(7);
  });

  it("UPDATE order=99 writes sort_order=99", () => {
    const patch = routineGroupUpdatesToPatchV2({ order: 99 }, NOW);
    expect(patch.sort_order).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// 3. frequency_days JSON serialise / parse
// ---------------------------------------------------------------------------

describe("frequency_days JSON <-> number[]", () => {
  it("INSERT serialises number[] to JSON string", () => {
    const writeRow = routineGroupToRowV2(
      baseGroup({ frequencyType: "weekdays", frequencyDays: [0, 2, 4, 6] }),
    );
    expect(writeRow.frequency_days).toBe("[0,2,4,6]");
  });

  it("SELECT parses JSON string to number[]", () => {
    const row = reattachUserId(
      routineGroupToRowV2(
        baseGroup({ frequencyType: "weekdays", frequencyDays: [1, 2, 3] }),
      ),
    );
    expect(rowToRoutineGroupV2(row).frequencyDays).toEqual([1, 2, 3]);
  });

  it("UPDATE frequencyDays serialises to JSON string", () => {
    const patch = routineGroupUpdatesToPatchV2({ frequencyDays: [5, 6] }, NOW);
    expect(patch.frequency_days).toBe("[5,6]");
  });
});

// ---------------------------------------------------------------------------
// 4. INSERT defaults
// ---------------------------------------------------------------------------

describe("routineGroupToRowV2 INSERT defaults", () => {
  it("defaults version=1, is_deleted=false, deleted_at=null", () => {
    const writeRow = routineGroupToRowV2(baseGroup());
    expect(writeRow.version).toBe(1);
    expect(writeRow.is_deleted).toBe(false);
    expect(writeRow.deleted_at).toBeNull();
    expect(writeRow).not.toHaveProperty("user_id");
  });
});

// ---------------------------------------------------------------------------
// 5. DB-Q2 updated_at ALWAYS bumped
// ---------------------------------------------------------------------------

describe("routineGroupUpdatesToPatchV2 — DB-Q2 updated_at bump", () => {
  it("bumps updated_at on a name-only patch", () => {
    const patch = routineGroupUpdatesToPatchV2({ name: "Renamed" }, NOW);
    expect(patch.updated_at).toBe(NOW);
    expect(patch.name).toBe("Renamed");
  });

  it("bumps updated_at even with zero changes (defensive bump)", () => {
    const patch = routineGroupUpdatesToPatchV2({}, NOW);
    expect(patch).toEqual({ updated_at: NOW });
  });
});

// ---------------------------------------------------------------------------
// 6. soft-delete patch surface
// ---------------------------------------------------------------------------

describe("soft-delete patch surface (V2 extension)", () => {
  it("isDeleted=true + deletedAt land on the patch", () => {
    const deletedAt = "2026-05-24T08:00:00.000Z";
    const patch = routineGroupUpdatesToPatchV2(
      { isDeleted: true, deletedAt },
      NOW,
    );
    expect(patch.is_deleted).toBe(true);
    expect(patch.deleted_at).toBe(deletedAt);
    expect(patch.updated_at).toBe(NOW);
  });

  it("restore (isDeleted=false + deletedAt=null) lands on the patch", () => {
    const patch = routineGroupUpdatesToPatchV2(
      { isDeleted: false, deletedAt: null },
      NOW,
    );
    expect(patch.is_deleted).toBe(false);
    expect(patch.deleted_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. null boundary on optional frequency fields
// ---------------------------------------------------------------------------

describe("nullable frequency fields", () => {
  it("frequencyInterval / frequencyStartDate null roundtrip", () => {
    const group = baseGroup({
      frequencyInterval: null,
      frequencyStartDate: null,
    });
    const got = roundtrip(group);
    expect(got.frequencyInterval).toBeNull();
    expect(got.frequencyStartDate).toBeNull();
  });

  it("UPDATE frequencyInterval=undefined coerces to null in patch", () => {
    const patch = routineGroupUpdatesToPatchV2(
      { frequencyInterval: undefined },
      NOW,
    );
    expect(patch.frequency_interval).toBeNull();
  });
});
