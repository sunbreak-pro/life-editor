import { describe, it, expect } from "vitest";
import type { WikiTagGroup } from "../src/types/wikiTagUnified";
import {
  rowToWikiTagGroup,
  wikiTagGroupToRow,
  wikiTagGroupUpdatesToPatch,
  type WikiTagGroupRow,
} from "../src/services/wikiTagGroupMapper";

/*
 * wikiTagGroupMapper vitest suite. `wiki_tag_groups` is a VERSIONED
 * dedicated table (0008 §10), soft-delete-aware. The mapper is pure.
 *
 * NOTE: wikiTagGroupToRow returns an INSERT row that INCLUDES user_id but
 * OMITS created_at / updated_at (left to the column DEFAULT now()). So a
 * row -> domain -> insert-row roundtrip cannot observe the timestamps;
 * field-level assertions are used for the columns the insert row carries.
 *
 * Cases:
 *   1. row -> domain -> insert-row preserves stable columns
 *   2. INSERT defaults via nullish coalescing (isDeleted ?? false,
 *      deletedAt ?? null, version ?? 1) when domain optionals are absent
 *   3. soft-deleted group preserved
 *   4. DB-Q2 updated_at ALWAYS emitted (incl. zero-change patch)
 *   5. soft-delete patch shape + version bump pass-through
 */

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function baseRow(overrides: Partial<WikiTagGroupRow> = {}): WikiTagGroupRow {
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

// ---------------------------------------------------------------------------
// 1. row -> domain -> insert-row
// ---------------------------------------------------------------------------

describe("wikiTagGroupMapper roundtrip", () => {
  it("preserves stable columns through row -> domain -> insert-row", () => {
    const row = baseRow();
    const dom = rowToWikiTagGroup(row);
    const insert = wikiTagGroupToRow(dom, USER);
    expect(insert.id).toBe(row.id);
    expect(insert.user_id).toBe(USER);
    expect(insert.name).toBe(row.name);
    expect(insert.is_deleted).toBe(row.is_deleted);
    expect(insert.deleted_at).toBe(row.deleted_at);
    expect(insert.version).toBe(row.version);
    // server-default timestamps are NOT on the insert row.
    expect(insert).not.toHaveProperty("created_at");
    expect(insert).not.toHaveProperty("updated_at");
  });

  it("domain side surfaces created_at / updated_at / version", () => {
    const dom = rowToWikiTagGroup(baseRow({ version: 5 }));
    expect(dom.createdAt).toBe("2026-05-24T10:00:00.000Z");
    expect(dom.updatedAt).toBe("2026-05-24T11:00:00.000Z");
    expect(dom.version).toBe(5);
  });

  it("soft-deleted group preserved", () => {
    const row = baseRow({
      is_deleted: true,
      deleted_at: "2026-05-22T00:00:00.000Z",
    });
    const dom = rowToWikiTagGroup(row);
    expect(dom.isDeleted).toBe(true);
    expect(dom.deletedAt).toBe("2026-05-22T00:00:00.000Z");
    const insert = wikiTagGroupToRow(dom, USER);
    expect(insert.is_deleted).toBe(true);
    expect(insert.deleted_at).toBe("2026-05-22T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// 2. INSERT defaults via nullish coalescing
// ---------------------------------------------------------------------------

describe("wikiTagGroupToRow INSERT defaults", () => {
  it("defaults isDeleted/deletedAt/version when domain optionals absent", () => {
    // Construct a domain object missing the optional-ish fields to exercise
    // the `?? false` / `?? null` / `?? 1` fallbacks in the mapper.
    const partial = {
      id: "tgroup-defaults",
      name: "fresh",
      createdAt: NOW,
      updatedAt: NOW,
    } as unknown as WikiTagGroup;
    const insert = wikiTagGroupToRow(partial, USER);
    expect(insert.is_deleted).toBe(false);
    expect(insert.deleted_at).toBeNull();
    expect(insert.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3 & 4. wikiTagGroupUpdatesToPatch
// ---------------------------------------------------------------------------

describe("wikiTagGroupUpdatesToPatch — DB-Q2 + shape", () => {
  it("ALWAYS emits updated_at on a zero-change patch", () => {
    expect(wikiTagGroupUpdatesToPatch({}, NOW)).toEqual({ updated_at: NOW });
  });

  it("emits name on a rename patch", () => {
    const patch = wikiTagGroupUpdatesToPatch({ name: "renamed" }, NOW);
    expect(patch.name).toBe("renamed");
    expect(patch.updated_at).toBe(NOW);
  });

  it("soft-delete patch shape (is_deleted + deleted_at)", () => {
    const deletedAt = "2026-05-24T08:00:00.000Z";
    const patch = wikiTagGroupUpdatesToPatch(
      { isDeleted: true, deletedAt },
      NOW,
    );
    expect(patch.is_deleted).toBe(true);
    expect(patch.deleted_at).toBe(deletedAt);
  });

  it("coerces isDeleted=undefined to false and deletedAt=undefined to null", () => {
    const patch = wikiTagGroupUpdatesToPatch(
      { isDeleted: undefined, deletedAt: undefined },
      NOW,
    );
    expect(patch.is_deleted).toBe(false);
    expect(patch.deleted_at).toBeNull();
  });

  it("passes through a version bump", () => {
    const patch = wikiTagGroupUpdatesToPatch({ version: 9 }, NOW);
    expect(patch.version).toBe(9);
  });
});
