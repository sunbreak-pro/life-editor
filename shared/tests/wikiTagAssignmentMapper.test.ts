import { describe, it, expect } from "vitest";
import {
  rowToWikiTagAssignment,
  wikiTagAssignmentToRow,
  wikiTagAssignmentUpdatesToPatch,
  type WikiTagAssignmentRow,
} from "../src/services/wikiTagAssignmentMapper";
import {
  rowToWikiTagGroupAssignment,
  wikiTagGroupAssignmentToRow,
  wikiTagGroupAssignmentUpdatesToPatch,
  type WikiTagGroupAssignmentRow,
} from "../src/services/wikiTagGroupAssignmentMapper";

/*
 * wikiTagAssignmentMapper + wikiTagGroupAssignmentMapper vitest suite
 * (DU-C+ Step 3). Both relation tables, no version, soft-delete-aware.
 *
 * Cases:
 *   1. row -> domain -> insert-row roundtrip
 *   2. updates patch ALWAYS includes updated_at
 *   3. soft-delete patch shape
 *   4. itemId can be any role's items_meta id (no entityType discriminator)
 */

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

describe("wikiTagAssignmentMapper", () => {
  function fresh(
    overrides: Partial<WikiTagAssignmentRow> = {},
  ): WikiTagAssignmentRow {
    return {
      id: "tag_assign-1",
      user_id: USER,
      item_id: "task-abc",
      tag_id: "tag-1",
      updated_at: "2026-05-24T11:00:00.000Z",
      is_deleted: false,
      deleted_at: null,
      ...overrides,
    };
  }

  it("roundtrips row -> domain -> insert-row", () => {
    const row = fresh();
    const dom = rowToWikiTagAssignment(row);
    const ins = wikiTagAssignmentToRow(dom, USER);
    expect(ins.id).toBe(row.id);
    expect(ins.item_id).toBe(row.item_id);
    expect(ins.tag_id).toBe(row.tag_id);
    expect(ins.is_deleted).toBe(false);
  });

  it("supports itemId across all 5 roles (no entityType)", () => {
    const roles = ["task-", "event-", "routine-", "note-", "daily-"];
    for (const prefix of roles) {
      const row = fresh({ item_id: `${prefix}xyz` });
      const dom = rowToWikiTagAssignment(row);
      expect(dom.itemId).toBe(`${prefix}xyz`);
    }
  });

  it("updates patch ALWAYS emits updated_at", () => {
    const empty = wikiTagAssignmentUpdatesToPatch({}, NOW);
    expect(empty).toEqual({ updated_at: NOW });
  });

  it("soft-delete patch shape", () => {
    const patch = wikiTagAssignmentUpdatesToPatch(
      { isDeleted: true, deletedAt: NOW },
      NOW,
    );
    expect(patch.is_deleted).toBe(true);
    expect(patch.deleted_at).toBe(NOW);
  });
});

describe("wikiTagGroupAssignmentMapper", () => {
  function fresh(
    overrides: Partial<WikiTagGroupAssignmentRow> = {},
  ): WikiTagGroupAssignmentRow {
    return {
      id: "tga-1",
      user_id: USER,
      tag_id: "tag-1",
      group_id: "tgroup-1",
      updated_at: "2026-05-24T11:00:00.000Z",
      is_deleted: false,
      deleted_at: null,
      ...overrides,
    };
  }

  it("roundtrips row -> domain -> insert-row", () => {
    const row = fresh();
    const dom = rowToWikiTagGroupAssignment(row);
    const ins = wikiTagGroupAssignmentToRow(dom, USER);
    expect(ins.id).toBe(row.id);
    expect(ins.tag_id).toBe(row.tag_id);
    expect(ins.group_id).toBe(row.group_id);
  });

  it("updates patch ALWAYS emits updated_at", () => {
    const empty = wikiTagGroupAssignmentUpdatesToPatch({}, NOW);
    expect(empty).toEqual({ updated_at: NOW });
  });
});
