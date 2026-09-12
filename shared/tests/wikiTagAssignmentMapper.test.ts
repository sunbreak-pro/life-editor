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
 *   4. the #1580 pair (created_at / is_display_color) survives the trip, and
 *      a row missing them still yields a usable object
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
      created_at: "2026-05-24T10:00:00.000Z",
      updated_at: "2026-05-24T11:00:00.000Z",
      is_display_color: false,
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
    expect(dom.createdAt).toBe(row.created_at);
    expect(dom.updatedAt).toBe(row.updated_at);
    expect(dom.isDisplayColor).toBe(false);
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

  /*
   * #1580 / migration 0030. `createdAt` is the whole reason that migration
   * exists — `updated_at` jumps to now when a soft-deleted assignment is
   * revived, so it cannot answer "which tag was added first", and that is the
   * default the Schedule colours an item by.
   */
  it("carries created_at and is_display_color through", () => {
    const dom = rowToWikiTagAssignment(
      fresh({
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
        is_display_color: true,
      }),
    );
    expect(dom.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(dom.updatedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(dom.isDisplayColor).toBe(true);
  });

  /*
   * Defence against a row that reached the mapper without the new columns —
   * the bulk read embeds `items_meta!inner(...)`, and an undefined `createdAt`
   * would silently sort every item's tags at random.
   */
  it("falls back rather than handing back undefined", () => {
    const partial = fresh();
    delete (partial as Partial<WikiTagAssignmentRow>).created_at;
    delete (partial as Partial<WikiTagAssignmentRow>).is_display_color;
    const dom = rowToWikiTagAssignment(partial);
    expect(dom.createdAt).toBe(partial.updated_at);
    expect(dom.isDisplayColor).toBe(false);
  });
});
