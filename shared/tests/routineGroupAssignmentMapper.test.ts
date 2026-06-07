import { describe, it, expect } from "vitest";
import type { RoutineGroupAssignment } from "../src/types/routineGroup";
import {
  rowToRoutineGroupAssignmentV2,
  routineGroupAssignmentToRowV2,
  routineGroupAssignmentUpdatesToPatchV2,
  type RoutineGroupAssignmentRowV2,
} from "../src/services/routineGroupAssignmentMapper";

/*
 * routineGroupAssignmentMapper (V2 / 0008 schema) vitest suite. Covers the
 * CURRENT V2 API only (the @deprecated 0006-shape legacy shims with
 * routine_id + created_at are not exercised — DU-C-4 removes them). The
 * mapper is pure.
 *
 * RELATION table: NO version column, soft-delete-aware. Surfaces:
 *   - routineId <-> routine_item_id rename (FK now targets items_meta(id))
 *   - createdAt synthesised from updated_at (0008 dropped the created_at
 *     column) — so a row -> domain -> row roundtrip cannot recover a
 *     distinct createdAt; createdAt == updatedAt is the expected invariant
 *   - DB-Q2: updated_at ALWAYS bumped on a patch
 *
 * Cases:
 *   1. row -> domain -> writeRow roundtrip (live + soft-deleted)
 *   2. routineId <-> routine_item_id rename
 *   3. createdAt synthesised from updated_at (V2 invariant)
 *   4. DB-Q2 updated_at ALWAYS emitted (incl. zero-change patch)
 *   5. soft-delete patch shape (unassign)
 */

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function baseRow(
  overrides: Partial<RoutineGroupAssignmentRowV2> = {},
): RoutineGroupAssignmentRowV2 {
  return {
    id: "rga-1",
    user_id: TEST_USER_ID,
    routine_item_id: "routine-100",
    group_id: "rgroup-1",
    updated_at: NOW,
    is_deleted: false,
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. row -> domain -> writeRow roundtrip
// ---------------------------------------------------------------------------

describe("routineGroupAssignmentMapper V2 roundtrip", () => {
  it("live assignment row -> domain -> writeRow preserves columns", () => {
    const row = baseRow();
    const dom = rowToRoutineGroupAssignmentV2(row);
    const writeRow = routineGroupAssignmentToRowV2(dom);
    expect(writeRow.id).toBe(row.id);
    expect(writeRow.routine_item_id).toBe(row.routine_item_id);
    expect(writeRow.group_id).toBe(row.group_id);
    expect(writeRow.updated_at).toBe(row.updated_at);
    expect(writeRow.is_deleted).toBe(false);
    expect(writeRow.deleted_at).toBeNull();
    // user_id is RLS-derived — never on a write row.
    expect(writeRow).not.toHaveProperty("user_id");
    // createdAt is intentionally dropped (no DB column).
    expect(writeRow).not.toHaveProperty("created_at");
  });

  it("soft-deleted assignment preserves is_deleted + deleted_at", () => {
    const row = baseRow({
      id: "rga-deleted",
      is_deleted: true,
      deleted_at: "2026-05-23T00:00:00.000Z",
    });
    const dom = rowToRoutineGroupAssignmentV2(row);
    expect(dom.isDeleted).toBe(true);
    expect(dom.deletedAt).toBe("2026-05-23T00:00:00.000Z");
    const writeRow = routineGroupAssignmentToRowV2(dom);
    expect(writeRow.is_deleted).toBe(true);
    expect(writeRow.deleted_at).toBe("2026-05-23T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// 2. routineId <-> routine_item_id rename
// ---------------------------------------------------------------------------

describe("routineId <-> routine_item_id rename", () => {
  it("routine_item_id reads back to domain routineId", () => {
    const dom = rowToRoutineGroupAssignmentV2(
      baseRow({ routine_item_id: "routine-xyz" }),
    );
    expect(dom.routineId).toBe("routine-xyz");
  });

  it("domain routineId writes to routine_item_id", () => {
    const dom: RoutineGroupAssignment = rowToRoutineGroupAssignmentV2(
      baseRow(),
    );
    const renamed: RoutineGroupAssignment = { ...dom, routineId: "routine-z" };
    expect(routineGroupAssignmentToRowV2(renamed).routine_item_id).toBe(
      "routine-z",
    );
  });
});

// ---------------------------------------------------------------------------
// 3. createdAt synthesised from updated_at (V2 invariant)
// ---------------------------------------------------------------------------

describe("createdAt synthesised from updated_at", () => {
  it("domain createdAt == updatedAt (0008 has no created_at column)", () => {
    const dom = rowToRoutineGroupAssignmentV2(
      baseRow({ updated_at: "2026-05-24T09:30:00.000Z" }),
    );
    expect(dom.createdAt).toBe("2026-05-24T09:30:00.000Z");
    expect(dom.createdAt).toBe(dom.updatedAt);
  });
});

// ---------------------------------------------------------------------------
// 4. DB-Q2 updated_at ALWAYS emitted
// ---------------------------------------------------------------------------

describe("routineGroupAssignmentUpdatesToPatchV2 — DB-Q2 bump", () => {
  it("emits updated_at even with zero changes", () => {
    const patch = routineGroupAssignmentUpdatesToPatchV2({}, NOW);
    expect(patch).toEqual({ updated_at: NOW });
  });
});

// ---------------------------------------------------------------------------
// 5. soft-delete patch shape (unassign)
// ---------------------------------------------------------------------------

describe("soft-delete patch shape (unassign)", () => {
  it("unassign (isDeleted=true + deletedAt) lands on the patch", () => {
    const deletedAt = "2026-05-24T08:00:00.000Z";
    const patch = routineGroupAssignmentUpdatesToPatchV2(
      { isDeleted: true, deletedAt },
      NOW,
    );
    expect(patch.is_deleted).toBe(true);
    expect(patch.deleted_at).toBe(deletedAt);
    expect(patch.updated_at).toBe(NOW);
  });

  it("re-assign (isDeleted=false + deletedAt=null) lands on the patch", () => {
    const patch = routineGroupAssignmentUpdatesToPatchV2(
      { isDeleted: false, deletedAt: null },
      NOW,
    );
    expect(patch.is_deleted).toBe(false);
    expect(patch.deleted_at).toBeNull();
  });
});
