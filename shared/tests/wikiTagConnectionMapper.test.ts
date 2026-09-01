// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  rowToWikiTagConnection,
  type WikiTagConnectionRow,
} from "../src/services/wikiTagConnectionMapper";

/*
 * wikiTagConnectionMapper vitest suite (DU-C+ Step 3). RELATION table,
 * directional items↔items link.
 *
 * Read direction only since #1389 — the write-direction pair was deleted
 * there for having no caller outside this file, self-loop guard included.
 * Self-loops are still refused where an actual write meets them:
 * `check (from_item_id <> to_item_id)` on the table (0008 §13).
 *
 * Cases:
 *   1. row -> domain carries every column
 *   2. cross-role link is supported (event -> daily)
 *   3. origin normalisation (#372) — anything but 'inline' is 'manual'
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
    origin: "manual",
    updated_at: "2026-05-24T11:00:00.000Z",
    is_deleted: false,
    deleted_at: null,
    ...overrides,
  };
}

describe("wikiTagConnectionMapper", () => {
  it("maps every row column onto the domain object", () => {
    const row = fresh();
    const dom = rowToWikiTagConnection(row);
    expect(dom.id).toBe(row.id);
    expect(dom.fromItemId).toBe(row.from_item_id);
    expect(dom.toItemId).toBe(row.to_item_id);
    expect(dom.updatedAt).toBe(row.updated_at);
    expect(dom.isDeleted).toBe(false);
  });

  it("supports cross-role link (event -> daily)", () => {
    const dom = rowToWikiTagConnection(
      fresh({ from_item_id: "event-1", to_item_id: "daily-2" }),
    );
    expect(dom.fromItemId).toBe("event-1");
    expect(dom.toItemId).toBe("daily-2");
  });

  it("carries origin 'inline' through (#372)", () => {
    expect(rowToWikiTagConnection(fresh({ origin: "inline" })).origin).toBe(
      "inline",
    );
  });

  it("normalizes anything but 'inline' to 'manual' (#372 safe side)", () => {
    expect(rowToWikiTagConnection(fresh({ origin: "manual" })).origin).toBe(
      "manual",
    );
    // A value the enum never issued (bad backfill, future column reuse) must
    // land on the never-auto-delete side.
    expect(rowToWikiTagConnection(fresh({ origin: "weird" })).origin).toBe(
      "manual",
    );
  });

  it("carries the soft-delete columns through", () => {
    const dom = rowToWikiTagConnection(
      fresh({ is_deleted: true, deleted_at: NOW }),
    );
    expect(dom.isDeleted).toBe(true);
    expect(dom.deletedAt).toBe(NOW);
  });
});
