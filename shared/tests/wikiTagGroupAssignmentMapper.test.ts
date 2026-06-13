import { describe, it, expect } from "vitest";
import type { WikiTagGroupAssignment } from "../src/types/wikiTagUnified";
import {
  rowToWikiTagGroupAssignment,
  wikiTagGroupAssignmentToRow,
  wikiTagGroupAssignmentUpdatesToPatch,
  type WikiTagGroupAssignmentRow,
} from "../src/services/wikiTagGroupAssignmentMapper";

/*
 * wikiTagGroupAssignmentMapper vitest suite. `wiki_tag_group_assignments`
 * is a RELATION table (0008 §11): NO version column, soft-delete-aware.
 * The mapper is pure.
 *
 * NOTE: wikiTagGroupAssignmentToRow returns an INSERT row that INCLUDES
 * user_id but OMITS updated_at (left to the column DEFAULT now()). So a
 * row -> domain -> insert-row roundtrip cannot observe updated_at;
 * field-level assertions cover the columns the insert row carries. A
 * lighter inline check already lives in wikiTagAssignmentMapper.test.ts;
 * this dedicated suite adds soft-delete + default-coercion coverage.
 *
 * Cases:
 *   1. row -> domain -> insert-row preserves tag_id / group_id / id
 *   2. soft-deleted membership preserved
 *   3. INSERT defaults via nullish coalescing (isDeleted ?? false,
 *      deletedAt ?? null) when domain optionals are absent
 *   4. DB-Q2 updated_at ALWAYS emitted (incl. zero-change patch)
 *   5. soft-delete patch shape (unassign / re-add)
 */

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function baseRow(
  overrides: Partial<WikiTagGroupAssignmentRow> = {},
): WikiTagGroupAssignmentRow {
  return {
    id: "tga-1",
    user_id: USER,
    tag_id: "tag-1",
    group_id: "tgroup-1",
    updated_at: NOW,
    is_deleted: false,
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. row -> domain -> insert-row
// ---------------------------------------------------------------------------

describe("wikiTagGroupAssignmentMapper roundtrip", () => {
  it("preserves id / tag_id / group_id through row -> domain -> insert", () => {
    const row = baseRow();
    const dom = rowToWikiTagGroupAssignment(row);
    const insert = wikiTagGroupAssignmentToRow(dom, USER);
    expect(insert.id).toBe(row.id);
    expect(insert.user_id).toBe(USER);
    expect(insert.tag_id).toBe(row.tag_id);
    expect(insert.group_id).toBe(row.group_id);
    expect(insert.is_deleted).toBe(false);
    expect(insert.deleted_at).toBeNull();
    // updated_at is a server-default column — not on the insert row.
    expect(insert).not.toHaveProperty("updated_at");
  });

  it("domain side surfaces updatedAt", () => {
    const dom = rowToWikiTagGroupAssignment(
      baseRow({ updated_at: "2026-05-24T09:00:00.000Z" }),
    );
    expect(dom.updatedAt).toBe("2026-05-24T09:00:00.000Z");
  });

  it("soft-deleted membership preserved", () => {
    const row = baseRow({
      is_deleted: true,
      deleted_at: "2026-05-22T00:00:00.000Z",
    });
    const dom = rowToWikiTagGroupAssignment(row);
    expect(dom.isDeleted).toBe(true);
    expect(dom.deletedAt).toBe("2026-05-22T00:00:00.000Z");
    const insert = wikiTagGroupAssignmentToRow(dom, USER);
    expect(insert.is_deleted).toBe(true);
    expect(insert.deleted_at).toBe("2026-05-22T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// 2. INSERT defaults via nullish coalescing
// ---------------------------------------------------------------------------

describe("wikiTagGroupAssignmentToRow INSERT defaults", () => {
  it("defaults isDeleted=false / deletedAt=null when domain optionals absent", () => {
    const partial = {
      id: "tga-defaults",
      tagId: "tag-x",
      groupId: "tgroup-x",
      updatedAt: NOW,
    } as unknown as WikiTagGroupAssignment;
    const insert = wikiTagGroupAssignmentToRow(partial, USER);
    expect(insert.is_deleted).toBe(false);
    expect(insert.deleted_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3 & 4. wikiTagGroupAssignmentUpdatesToPatch
// ---------------------------------------------------------------------------

describe("wikiTagGroupAssignmentUpdatesToPatch — DB-Q2 + shape", () => {
  it("ALWAYS emits updated_at on a zero-change patch", () => {
    expect(wikiTagGroupAssignmentUpdatesToPatch({}, NOW)).toEqual({
      updated_at: NOW,
    });
  });

  it("unassign (isDeleted=true + deletedAt) lands on the patch", () => {
    const deletedAt = "2026-05-24T08:00:00.000Z";
    const patch = wikiTagGroupAssignmentUpdatesToPatch(
      { isDeleted: true, deletedAt },
      NOW,
    );
    expect(patch.is_deleted).toBe(true);
    expect(patch.deleted_at).toBe(deletedAt);
    expect(patch.updated_at).toBe(NOW);
  });

  it("re-add (isDeleted=false + deletedAt=null) lands on the patch", () => {
    const patch = wikiTagGroupAssignmentUpdatesToPatch(
      { isDeleted: false, deletedAt: null },
      NOW,
    );
    expect(patch.is_deleted).toBe(false);
    expect(patch.deleted_at).toBeNull();
  });

  it("coerces isDeleted=undefined to false", () => {
    const patch = wikiTagGroupAssignmentUpdatesToPatch(
      { isDeleted: undefined },
      NOW,
    );
    expect(patch.is_deleted).toBe(false);
  });
});
