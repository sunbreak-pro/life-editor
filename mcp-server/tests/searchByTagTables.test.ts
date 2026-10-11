import { describe, it, expect, vi } from "vitest";
import {
  createSupabaseStub,
  fromTables,
  type SupabaseStub,
} from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { searchByTag, UNTITLED_TABLE_TITLE } =
  await import("../src/handlers/wikiTagHandlers.js");

/*
 * search_by_tag and note tables (#2094, plan Step 6).
 *
 * A note table is an items_meta row of role `table` whose payload names the
 * note it sits in. What the plan asks of the tool: a tagged table is found,
 * its row carries the note's id (and title) so the caller can open the cells
 * with get_note, and a table whose note is in the trash is not returned.
 */

const tag = {
  id: "tag-1",
  name: "budget",
  color: "#808080",
  icon: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  is_deleted: false,
};

const meta = (id: string, role: string, title: string, isDeleted = false) => ({
  id,
  role,
  title,
  is_deleted: isDeleted,
  created_at: "2026-10-02T00:00:00Z",
});

const assignment = (itemId: string) => ({
  id: `tag_assign-${itemId}`,
  item_id: itemId,
  tag_id: "tag-1",
  updated_at: "2026-10-03T00:00:00Z",
  is_deleted: false,
});

function tables() {
  return {
    wiki_tags: [tag],
    wiki_tag_assignments: [
      assignment("table-live"),
      assignment("table-unnamed"),
      assignment("table-in-trashed-note"),
      assignment("note-1"),
    ],
    items_meta: [
      meta("note-1", "note", "Household"),
      meta("note-trashed", "note", "Old plans", true),
      meta("table-live", "table", "Q4 budget"),
      meta("table-unnamed", "table", ""),
      meta("table-in-trashed-note", "table", "Gone"),
    ],
    tables_payload: [
      { item_id: "table-live", parent_note_id: "note-1" },
      { item_id: "table-unnamed", parent_note_id: "note-1" },
      { item_id: "table-in-trashed-note", parent_note_id: "note-trashed" },
    ],
  };
}

describe("searchByTag — note tables (#2094)", () => {
  it("returns a tagged table with the id and title of its note", async () => {
    stub = createSupabaseStub(fromTables(tables()));

    const { results } = await searchByTag({ tag_name: "budget" });

    const table = results.find((r) => r.entityId === "table-live");
    expect(table).toMatchObject({
      entityType: "table",
      entity: {
        id: "table-live",
        title: "Q4 budget",
        parentNoteId: "note-1",
        parentNoteTitle: "Household",
      },
    });
  });

  it("names an unnamed table instead of returning an empty title", async () => {
    stub = createSupabaseStub(fromTables(tables()));

    const { results } = await searchByTag({ tag_name: "budget" });

    expect(
      results.find((r) => r.entityId === "table-unnamed")?.entity.title,
    ).toBe(UNTITLED_TABLE_TITLE);
  });

  it("leaves out a table whose note is in the trash", async () => {
    stub = createSupabaseStub(fromTables(tables()));

    const { results } = await searchByTag({ tag_name: "budget" });

    expect(results.map((r) => r.entityId).sort()).toEqual([
      "note-1",
      "table-live",
      "table-unnamed",
    ]);
  });

  it("filters to tables with entity_type 'table'", async () => {
    stub = createSupabaseStub(fromTables(tables()));

    const { results } = await searchByTag({
      tag_name: "budget",
      entity_type: "table",
    });

    expect(results.map((r) => r.entityType)).toEqual(["table", "table"]);
  });

  it("does not read tables_payload when no table is tagged", async () => {
    const fixture = tables();
    fixture.wiki_tag_assignments = [assignment("note-1")];
    stub = createSupabaseStub(fromTables(fixture));

    await searchByTag({ tag_name: "budget" });

    expect(stub.calls.some((c) => c.table === "tables_payload")).toBe(false);
  });
});
