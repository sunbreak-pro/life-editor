import { describe, it, expect } from "vitest";
import {
  rowToWikiTag,
  wikiTagToRow,
  wikiTagUpdatesToPatch,
  type WikiTagRow,
} from "../src/services/wikiTagMapper";
import {
  rowToWikiTagGroup,
  wikiTagGroupToRow,
  wikiTagGroupUpdatesToPatch,
  type WikiTagGroupRow,
} from "../src/services/wikiTagGroupMapper";
import type { WikiTag, WikiTagGroup } from "../src/types/wikiTagUnified";

/*
 * wikiTagMapper + wikiTagGroupMapper vitest suite (DU-C+ Step 3).
 * Both are pure mappers over VERSIONED dedicated tables.
 *
 * Mandatory cases:
 *   1. row -> domain -> insert-row roundtrip preserves all fields
 *   2. updates patch ALWAYS includes updated_at (LWW bump enforcement)
 *   3. partial patch only emits present keys
 *   4. soft-delete patch shape (isDeleted + deletedAt round-trip)
 */

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function freshRow(overrides: Partial<WikiTagRow> = {}): WikiTagRow {
  return {
    id: "tag-1",
    user_id: USER,
    name: "work",
    color: "#3b82f6",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T11:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("wikiTagMapper", () => {
  it("roundtrips row -> domain -> insert-row preserving all fields", () => {
    const row = freshRow();
    const tag = rowToWikiTag(row);
    const insert = wikiTagToRow(tag, USER);
    expect(insert.id).toBe(row.id);
    expect(insert.user_id).toBe(USER);
    expect(insert.name).toBe(row.name);
    expect(insert.color).toBe(row.color);
    expect(insert.is_deleted).toBe(false);
    expect(insert.deleted_at).toBeNull();
    expect(insert.version).toBe(1);
  });

  it("rowToWikiTag preserves null color (no defaulting)", () => {
    const tag = rowToWikiTag(freshRow({ color: null }));
    expect(tag.color).toBeNull();
  });

  it("wikiTagUpdatesToPatch ALWAYS emits updated_at (LWW)", () => {
    const empty = wikiTagUpdatesToPatch({}, NOW);
    expect(empty).toEqual({ updated_at: NOW });
    const renamed = wikiTagUpdatesToPatch({ name: "study" }, NOW);
    expect(renamed.updated_at).toBe(NOW);
    expect(renamed.name).toBe("study");
  });

  it("wikiTagUpdatesToPatch only emits keys present on input", () => {
    const patch = wikiTagUpdatesToPatch({ name: "new" }, NOW);
    expect(patch).toEqual({ updated_at: NOW, name: "new" });
    expect("color" in patch).toBe(false);
    expect("is_deleted" in patch).toBe(false);
  });

  it("soft-delete patch passes through isDeleted + deletedAt", () => {
    const patch = wikiTagUpdatesToPatch(
      { isDeleted: true, deletedAt: NOW },
      NOW,
    );
    expect(patch.is_deleted).toBe(true);
    expect(patch.deleted_at).toBe(NOW);
  });
});

describe("wikiTagGroupMapper", () => {
  function freshGroupRow(
    overrides: Partial<WikiTagGroupRow> = {},
  ): WikiTagGroupRow {
    return {
      id: "tgroup-1",
      user_id: USER,
      name: "projects",
      is_deleted: false,
      deleted_at: null,
      created_at: "2026-05-24T10:00:00.000Z",
      updated_at: "2026-05-24T11:00:00.000Z",
      version: 1,
      ...overrides,
    };
  }

  it("roundtrips row -> domain -> insert-row preserving fields", () => {
    const row = freshGroupRow();
    const group = rowToWikiTagGroup(row);
    const insert = wikiTagGroupToRow(group, USER);
    expect(insert.id).toBe(row.id);
    expect(insert.name).toBe(row.name);
    expect(insert.version).toBe(1);
  });

  it("wikiTagGroupUpdatesToPatch ALWAYS emits updated_at", () => {
    const patch = wikiTagGroupUpdatesToPatch({}, NOW);
    expect(patch).toEqual({ updated_at: NOW });
  });
});
