// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  rowToWikiTag,
  wikiTagToRow,
  wikiTagUpdatesToPatch,
  type WikiTagRow,
} from "../src/services/wikiTagMapper";

/*
 * wikiTagMapper vitest suite (DU-C+ Step 3).
 * A pure mapper over a VERSIONED dedicated table.
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
    icon: "Star",
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
    expect(insert.icon).toBe(row.icon);
    expect(insert.is_deleted).toBe(false);
    expect(insert.deleted_at).toBeNull();
    expect(insert.version).toBe(1);
  });

  it("rowToWikiTag preserves null color (no defaulting)", () => {
    const tag = rowToWikiTag(freshRow({ color: null }));
    expect(tag.color).toBeNull();
  });

  it("rowToWikiTag preserves icon (and null icon, no defaulting)", () => {
    expect(rowToWikiTag(freshRow({ icon: "Tag" })).icon).toBe("Tag");
    expect(rowToWikiTag(freshRow({ icon: null })).icon).toBeNull();
  });

  it("wikiTagUpdatesToPatch passes through icon (present ↔ null)", () => {
    const set = wikiTagUpdatesToPatch({ icon: "Heart" }, NOW);
    expect(set.icon).toBe("Heart");
    const cleared = wikiTagUpdatesToPatch({ icon: null }, NOW);
    expect("icon" in cleared).toBe(true);
    expect(cleared.icon).toBeNull();
    const absent = wikiTagUpdatesToPatch({ name: "x" }, NOW);
    expect("icon" in absent).toBe(false);
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
