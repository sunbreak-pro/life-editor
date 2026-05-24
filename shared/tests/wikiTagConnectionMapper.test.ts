import { describe, it, expect } from "vitest";
import {
  rowToWikiTagConnection,
  wikiTagConnectionToRow,
  wikiTagConnectionUpdatesToPatch,
  type WikiTagConnectionRow,
} from "../src/services/wikiTagConnectionMapper";

/*
 * wikiTagConnectionMapper vitest suite (DU-C+ Step 3). RELATION table,
 * directional items↔items link, self-loop rejected at mapper + DB.
 *
 * Cases:
 *   1. roundtrip row -> domain -> insert-row
 *   2. self-loop throws at mapper layer (defence-in-depth before DB CHECK)
 *   3. cross-role link is supported (task -> note etc)
 *   4. updates patch ALWAYS emits updated_at
 */

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function fresh(
  overrides: Partial<WikiTagConnectionRow> = {},
): WikiTagConnectionRow {
  return {
    id: "link-1",
    user_id: USER,
    from_item_id: "task-abc",
    to_item_id: "note-xyz",
    updated_at: "2026-05-24T11:00:00.000Z",
    is_deleted: false,
    deleted_at: null,
    ...overrides,
  };
}

describe("wikiTagConnectionMapper", () => {
  it("roundtrips row -> domain -> insert-row", () => {
    const row = fresh();
    const dom = rowToWikiTagConnection(row);
    const ins = wikiTagConnectionToRow(dom, USER);
    expect(ins.id).toBe(row.id);
    expect(ins.from_item_id).toBe(row.from_item_id);
    expect(ins.to_item_id).toBe(row.to_item_id);
    expect(ins.is_deleted).toBe(false);
  });

  it("rejects self-loop at mapper layer (before DB CHECK)", () => {
    expect(() =>
      wikiTagConnectionToRow(
        {
          id: "link-self",
          fromItemId: "task-same",
          toItemId: "task-same",
          updatedAt: NOW,
          isDeleted: false,
          deletedAt: null,
        },
        USER,
      ),
    ).toThrow(/self-loop/);
  });

  it("supports cross-role link (event -> daily)", () => {
    const row = fresh({ from_item_id: "event-1", to_item_id: "daily-2" });
    const dom = rowToWikiTagConnection(row);
    const ins = wikiTagConnectionToRow(dom, USER);
    expect(ins.from_item_id).toBe("event-1");
    expect(ins.to_item_id).toBe("daily-2");
  });

  it("updates patch ALWAYS emits updated_at", () => {
    const empty = wikiTagConnectionUpdatesToPatch({}, NOW);
    expect(empty).toEqual({ updated_at: NOW });
  });

  it("soft-delete patch shape", () => {
    const patch = wikiTagConnectionUpdatesToPatch(
      { isDeleted: true, deletedAt: NOW },
      NOW,
    );
    expect(patch.is_deleted).toBe(true);
    expect(patch.deleted_at).toBe(NOW);
  });
});
