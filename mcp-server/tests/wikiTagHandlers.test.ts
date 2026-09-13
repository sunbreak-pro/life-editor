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

const { tagEntity, untagEntity } =
  await import("../src/handlers/wikiTagHandlers.js");

/*
 * untag_entity (#782 ①) — tags could be attached and never detached.
 *
 * `tag_entity` revives a trashed assignment rather than inserting a second
 * row (uq_wta_item_tag only constrains live rows), so removal has to be the
 * matching soft delete of the LIVE row — a hard delete would work once and
 * then leave the revive path nothing to find.
 */

const tagRow = {
  id: "tag-1",
  name: "life",
  color: "#808080",
  icon: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

describe("untagEntity", () => {
  it("soft-deletes the live assignment and keeps the tag", async () => {
    stub = createSupabaseStub((call) =>
      call.table === "wiki_tags" ? tagRow : { id: "tag_assign-1" },
    );

    const result = await untagEntity({
      tag_name: "life",
      entity_id: "task-1",
    });

    expect(result).toMatchObject({ removed: true, entityId: "task-1" });
    expect(result).toHaveProperty("tag.name", "life");

    const writes = stub.writes();
    expect(writes).toHaveLength(1); // wiki_tags itself is untouched
    expect(writes[0].table).toBe("wiki_tag_assignments");
    expect(writes[0].op).toBe("update"); // not delete — the revive path needs the row
    expect(writes[0].values).toMatchObject({ is_deleted: true });
    expect(writes[0].values).toHaveProperty("deleted_at");
    expect(writes[0].filters).toEqual({ id: "tag_assign-1" });
  });

  it("looks only at the live assignment for this pair", async () => {
    stub = createSupabaseStub((call) =>
      call.table === "wiki_tags" ? tagRow : { id: "tag_assign-1" },
    );

    await untagEntity({ tag_name: "life", entity_id: "task-1" });

    const lookup = stub.calls.find(
      (c) => c.table === "wiki_tag_assignments" && c.op === "select",
    );
    expect(lookup?.filters).toEqual({
      item_id: "task-1",
      tag_id: "tag-1",
      is_deleted: false,
    });
  });

  it("reports no removal when the tag does not exist", async () => {
    stub = createSupabaseStub(() => null);

    const result = await untagEntity({ tag_name: "ghost", entity_id: "t-1" });

    expect(result).toEqual({ removed: false });
    expect(stub.writes()).toEqual([]);
  });

  it("reports no removal when the tag is not on this item", async () => {
    stub = createSupabaseStub((call) =>
      call.table === "wiki_tags" ? tagRow : null,
    );

    const result = await untagEntity({ tag_name: "life", entity_id: "t-1" });

    expect(result).toEqual({ removed: false });
    expect(stub.writes()).toEqual([]);
  });
});

const metaRow = { id: "task-1", role: "task", is_deleted: false };
const liveTagRow = { ...tagRow, is_deleted: false };

describe("tagEntity", () => {
  it("revives the trashed assignment instead of inserting a second row (#1593)", async () => {
    stub = createSupabaseStub(
      fromTables({
        items_meta: [metaRow],
        wiki_tags: [liveTagRow],
        wiki_tag_assignments: [
          {
            id: "tag_assign-1",
            item_id: "task-1",
            tag_id: "tag-1",
            created_at: "2026-05-01T00:00:00Z",
            is_deleted: true,
          },
        ],
      }),
    );

    await tagEntity({ tag_name: "life", entity_id: "task-1" });

    const writes = stub.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("wiki_tag_assignments");
    expect(writes[0].op).toBe("update");
    expect(writes[0].filters).toEqual({ id: "tag_assign-1" });
    expect(writes[0].values).toMatchObject({
      is_deleted: false,
      deleted_at: null,
    });
  });

  it("picks the LIVE row when a pair already carries both (#1593)", async () => {
    // shared used to INSERT on every re-tag, so pairs with a trashed row
    // beside the live one exist in the database today. The lookup has to
    // find the live one whichever order the rows come back in — reviving
    // the dead one would break uq_wta_item_tag.
    stub = createSupabaseStub(
      fromTables({
        items_meta: [metaRow],
        wiki_tags: [liveTagRow],
        wiki_tag_assignments: [
          {
            id: "tag_assign-dead",
            item_id: "task-1",
            tag_id: "tag-1",
            created_at: "2026-05-01T00:00:00Z",
            is_deleted: true,
          },
          {
            id: "tag_assign-live",
            item_id: "task-1",
            tag_id: "tag-1",
            created_at: "2026-06-01T00:00:00Z",
            is_deleted: false,
          },
        ],
      }),
    );

    const result = await tagEntity({ tag_name: "life", entity_id: "task-1" });

    expect(result).toMatchObject({ entityId: "task-1", entityType: "task" });
    // Already live: nothing to write at all.
    expect(stub.writes()).toHaveLength(0);
  });

  it("inserts once for a pair that has never been assigned", async () => {
    stub = createSupabaseStub(
      fromTables({
        items_meta: [metaRow],
        wiki_tags: [liveTagRow],
        wiki_tag_assignments: [],
      }),
    );

    await tagEntity({ tag_name: "life", entity_id: "task-1" });

    const writes = stub.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("insert");
    expect(writes[0].values).toMatchObject({
      item_id: "task-1",
      tag_id: "tag-1",
      is_deleted: false,
    });
  });
});
