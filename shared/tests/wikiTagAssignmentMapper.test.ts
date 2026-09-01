// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  rowToWikiTagAssignment,
  type WikiTagAssignmentRow,
} from "../src/services/wikiTagAssignmentMapper";

/*
 * wikiTagAssignmentMapper vitest suite (DU-C+ Step 3). A relation table,
 * no version, soft-delete-aware.
 *
 * Read direction only since #1389 — the write-direction pair was deleted
 * there for having no caller outside this file.
 *
 * Cases:
 *   1. row -> domain carries every column
 *   2. soft-delete columns survive the mapping
 *   3. itemId can be any role's items_meta id (no entityType discriminator)
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

  it("maps every row column onto the domain object", () => {
    const row = fresh();
    const dom = rowToWikiTagAssignment(row);
    expect(dom.id).toBe(row.id);
    expect(dom.itemId).toBe(row.item_id);
    expect(dom.tagId).toBe(row.tag_id);
    expect(dom.updatedAt).toBe(row.updated_at);
    expect(dom.isDeleted).toBe(false);
  });

  it("supports itemId across all 5 roles (no entityType)", () => {
    const roles = ["task-", "event-", "routine-", "note-", "daily-"];
    for (const prefix of roles) {
      const row = fresh({ item_id: `${prefix}xyz` });
      const dom = rowToWikiTagAssignment(row);
      expect(dom.itemId).toBe(`${prefix}xyz`);
    }
  });

  it("carries the soft-delete columns through", () => {
    const dom = rowToWikiTagAssignment(
      fresh({ is_deleted: true, deleted_at: NOW }),
    );
    expect(dom.isDeleted).toBe(true);
    expect(dom.deletedAt).toBe(NOW);
  });
});
